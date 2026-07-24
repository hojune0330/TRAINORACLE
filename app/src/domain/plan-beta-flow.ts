import { evaluateD9ColloquialLayer } from "@impl/d9/evaluator"
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
      availableTrainingDays: spreadTrainingDays(
        intake.requestedFrameLength,
        intake.availableDayCount,
      ),
    },
    requestedFrameLength: intake.requestedFrameLength,
    journalSource: structuredJournalSource(),
    selectionAuthority: "SELF",
    continuity: loadPreviousContinuity(),
  })

  if (result.kind !== "generated") {
    return { kind: "rejected", code: result.code }
  }
  return {
    kind: "generated",
    generated: result,
    gate: safetyGate,
    intake,
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
  } = draft
  if (
    eventGroup === undefined
    || experienceBand === undefined
    || availableDayCount === undefined
    || requestedFrameLength === undefined
  ) {
    return null
  }
  return {
    eventGroup,
    experienceBand,
    availableDayCount,
    requestedFrameLength,
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
  frameLength: 7 | 9 | 10,
  count: 3 | 4 | 5,
): readonly number[] {
  const matrix = {
    7: {
      3: [1, 3, 5],
      4: [1, 3, 5, 7],
      5: [1, 2, 4, 5, 7],
    },
    9: {
      3: [1, 4, 7],
      4: [1, 3, 6, 9],
      5: [1, 3, 5, 7, 9],
    },
    10: {
      3: [1, 5, 9],
      4: [1, 4, 7, 10],
      5: [1, 3, 5, 7, 9],
    },
  } as const
  return matrix[frameLength][count]
}
