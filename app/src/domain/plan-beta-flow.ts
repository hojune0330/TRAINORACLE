import { evaluateD9ColloquialLayer } from "@impl/d9/evaluator"
import { assertNever } from "@impl/shared/assert-never"
import {
  generatePlanCandidates,
  selectPlanCandidate,
} from "@impl/plan-generator/generator"
import type {
  PlanCandidate,
  PlanGenerationSuccess,
} from "@impl/plan-generator/types"
import {
  createEvaluatorFailureSignal,
  mapD9ResultToRveSignal,
} from "@impl/rve/signal"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import {
  isoShift,
  isValidIsoDate,
} from "./dates"
import type {
  JournalEntry,
  PostSessionEntry,
} from "./journal-schema"
import { loadEntries, todayISO } from "./journal-store"
import {
  loadPreviousContinuity,
} from "./plan-beta-store"
import { createPlanFormation } from "./plan-beta-formation"
import type {
  PlanBetaIntake,
  PlanBetaState,
} from "./plan-beta-store"
import {
  assessPurposeScopedMemo,
  painLevelsRequireReview,
} from "../safety/memo-safety"

export type PlanCurrentCheck = "NO_KNOWN_RISK" | "REVIEW_REQUIRED"

const CURRENT_CHECK_TEXT: Readonly<Record<PlanCurrentCheck, string>> = {
  NO_KNOWN_RISK: "통증은 없고 몸 상태는 평소와 같아요",
  REVIEW_REQUIRED: "통증·부상·몸 이상이 있거나 잘 모르겠어요",
}

export type PlanDraftGeneration =
  | {
      readonly kind: "generated"
      readonly generated: PlanGenerationSuccess
      readonly gate: SafetyGateDecision
      readonly intake: PlanBetaIntake
    }
  | {
      readonly kind: "rejected"
      readonly code: string
    }
  | {
      readonly kind: "blocked"
      readonly code: "RECENT_JOURNAL_REQUIRES_REVIEW" | "CURRENT_CHECK_REQUIRES_REVIEW"
    }

export type PlanSelection =
  | {
      readonly kind: "selected"
      readonly state: PlanBetaState
    }
  | {
      readonly kind: "rejected"
      readonly code: string
    }

export function generatePlanFromDraft(
  draft: Partial<PlanBetaIntake>,
  currentCheck: PlanCurrentCheck,
): PlanDraftGeneration {
  const intake = completeIntake(draft)
  if (intake === null) {
    return { kind: "rejected", code: "MINIMUM_PROFILE_INCOMPLETE" }
  }

  if (recentJournalRequiresReview()) {
    return { kind: "blocked", code: "RECENT_JOURNAL_REQUIRES_REVIEW" }
  }

  const safetyGate = currentCheckGate(currentCheck)
  if (safetyGate.kind === "blocked") {
    return { kind: "blocked", code: "CURRENT_CHECK_REQUIRES_REVIEW" }
  }
  const result = generatePlanCandidates({
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate,
    profile: {
      eventGroup: intake.eventGroup,
      experienceBand: intake.experienceBand,
      availableTrainingDays: spreadTrainingDays(intake.availableDayCount),
      secondSessionMode: intake.secondSessionMode,
      trainingTimePreference: intake.trainingTimePreference,
    },
    formation: createPlanFormation(
      todayISO(),
      spreadTrainingDays(intake.availableDayCount),
      intake.experienceBand,
    ),
    selectedEnergyIntent: intake.trainingFocus,
    journalSource: structuredJournalSource(),
    selectionAuthority: "SELF",
    continuity: loadPreviousContinuity(),
  })

  switch (result.kind) {
    case "generated":
      return {
        kind: "generated",
        generated: result,
        gate: safetyGate,
        intake,
      }
    case "needs_review_with_reason":
      return { kind: "rejected", code: "FORMATION_REVIEW_REQUIRED" }
    case "blocked":
    case "rejected":
      return { kind: "rejected", code: result.code }
    default:
      return assertNever(result)
  }
}

export function selectPlanForActivation(
  candidate: PlanCandidate,
  generated: PlanGenerationSuccess,
  gate: SafetyGateDecision,
  intake: PlanBetaIntake,
): PlanSelection {
  const result = selectPlanCandidate({
    kind: "PLAN_BETA_SELECTION_REQUEST",
    generatedPlan: generated,
    selectedCandidateId: candidate.candidateId,
    actor: "SELF",
    safetyGate: gate,
  })
  if (result.kind !== "selected") {
    return { kind: "rejected", code: result.code }
  }

  return {
    kind: "selected",
    state: {
      version: 1,
      intake,
      activePlan: result.activePlan,
      progress: [],
      generatedAt: new Date().toISOString(),
    },
  }
}

function completeIntake(
  draft: Partial<PlanBetaIntake>,
): PlanBetaIntake | null {
  const {
    eventGroup,
    experienceBand,
    availableDayCount,
    requestedFrameLength,
    trainingFocus,
    secondSessionMode,
    trainingTimePreference,
  } = draft
  if (
    eventGroup === undefined
    || experienceBand === undefined
    || availableDayCount === undefined
    || requestedFrameLength === undefined
    || trainingFocus === undefined
    || secondSessionMode === undefined
    || trainingTimePreference === undefined
  ) {
    return null
  }
  return {
    eventGroup,
    experienceBand,
    availableDayCount,
    requestedFrameLength,
    trainingFocus,
    secondSessionMode,
    trainingTimePreference,
  }
}

function currentCheckGate(currentCheck: PlanCurrentCheck): SafetyGateDecision {
  try {
    const d9 = evaluateD9ColloquialLayer(CURRENT_CHECK_TEXT[currentCheck])
    return decideSafetyGate(mapD9ResultToRveSignal(d9))
  } catch {
    return decideSafetyGate(createEvaluatorFailureSignal("exception"))
  }
}

function recentJournalRequiresReview(): boolean {
  const today = todayISO()
  const from = isoShift(today, -13)
  return loadEntries()
    .filter((entry) => entry.date >= from && entry.date <= today)
    .some(entryRequiresReview)
}

function entryRequiresReview(entry: JournalEntry): boolean {
  if (entry.kind === "evening" && painLevelsRequireReview(entry.painParts)) {
    return true
  }

  const rawText = entry.kind === "evening" ? entry.note : entry.memo
  return assessPurposeScopedMemo(rawText, entry.memoPurpose)
    ?.blocksPlanGeneration === true
}

function structuredJournalSource() {
  const today = todayISO()
  const from = isoShift(today, -13)
  const sessions = loadEntries().filter(
    (entry): entry is PostSessionEntry =>
      entry.kind === "post-session"
      && isValidIsoDate(entry.date)
      && entry.date >= from
      && entry.date <= today,
  )
  if (sessions.length < 2) return { kind: "NO_USABLE_JOURNAL" } as const

  return {
    kind: "RECENT_JOURNAL_CONTEXT",
    eligibleSessionCount: sessions.length,
  } as const
}

function spreadTrainingDays(
  count: PlanBetaIntake["availableDayCount"],
): readonly number[] {
  if (count === "EVERY_DAY") {
    return Object.freeze(Array.from({ length: 10 }, (_, index) => index + 1))
  }
  const matrix = {
    3: [1, 5, 9],
    4: [1, 4, 7, 10],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 5, 6, 8, 10],
  } as const
  return Object.freeze([...matrix[count]])
}
