import { evaluateD9ColloquialLayer } from "@impl/d9/evaluator"
import { assertNever } from "@impl/shared/assert-never"
import {
  generatePlanCandidates,
  selectPlanCandidate,
} from "@impl/plan-generator/generator"
import type {
  JournalSource,
  PlanCandidate,
  PlanGenerationSuccess,
  SupportedPlanEventDistanceM,
} from "@impl/plan-generator/types"
import type { RacePlacementState } from "@impl/plan-generator/race-placement"
import raceDateRetentionAuthority from "../../../reports/review/RACE_DATE_RETENTION_AUTHORITY.json"
import {
  createEvaluatorFailureSignal,
  mapD9ResultToRveSignal,
} from "@impl/rve/signal"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import { loadAthleteRecords } from "./athlete-records"
import {
  isoShift,
  isValidIsoDate,
} from "./dates"
import type {
  JournalEntry,
  PostSessionEntry,
} from "./journal-schema"
import { loadEntriesForPlanSafety, todayISO } from "./journal-store"
import {
  loadPreviousContinuity,
} from "./plan-beta-store"
import { divisionForGoal } from "../screens/plan-beta/plan-intake-navigation"
import { createPlanFormation } from "./plan-beta-formation"
import type {
  PlanBetaIntake,
  PlanBetaState,
} from "./plan-beta-store"
import {
  detailedTemplateRefSchema,
  hasCanonicalJsonTree,
  planIntakeSchema,
} from "./plan-beta-schema"
import { resolveDetailedPrescriptionRuntimeAuthority } from "./detailed-prescription-runtime-authority"
import {
  assessPurposeScopedMemo,
  painLevelsRequireReview,
} from "../safety/memo-safety"
import {
  bindDetailedPrescriptionCandidates,
  type CandidatePrescriptionBinding,
} from "./plan-candidate-prescription"
import { createInitialPeriodizationContext } from "./periodization-lineage"

export type PlanCurrentCheck = "NO_KNOWN_RISK" | "REVIEW_REQUIRED"

export type PlanAthleteEvidence = {
  readonly storedRecordCount: number
  readonly goalRecordCount: number
  readonly recentJournalSessionCount: number
}

export type PlanSafetyEvaluation =
  | {
      readonly kind: "passed"
      readonly gate: Extract<SafetyGateDecision, { readonly kind: "passed" }>
      readonly journalSource: JournalSource
    }
  | {
      readonly kind: "blocked"
      readonly code: "RECENT_JOURNAL_REQUIRES_REVIEW" | "CURRENT_CHECK_REQUIRES_REVIEW"
    }

const CURRENT_CHECK_TEXT: Readonly<Record<PlanCurrentCheck, string>> = {
  NO_KNOWN_RISK: "통증은 없고 몸 상태는 평소와 같아요",
  REVIEW_REQUIRED: "통증·부상·몸 이상이 있거나 잘 모르겠어요",
}

export type PlanDraftGeneration =
  | {
      readonly kind: "generated"
      readonly generated: PlanGenerationSuccess
      readonly prescriptionBinding: Omit<CandidatePrescriptionBinding, "generated">
      readonly gate: SafetyGateDecision
      readonly intake: PlanBetaIntake
      readonly athleteEvidence: PlanAthleteEvidence
    }
  | {
      readonly kind: "preview_only"
      readonly code: "RACE_DATE_PERSISTENCE_NOT_AUTHORIZED"
      readonly racePlacement: Extract<RacePlacementState, { readonly kind: "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED" }>
      readonly preview: {
        readonly eventDistanceM: SupportedPlanEventDistanceM
        readonly targetRaceDate: string
      }
      readonly candidates: readonly []
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

type PlanDraftInput = Omit<Partial<PlanBetaIntake>, "selectedDetailedTemplateRef"> & {
  readonly selectedDetailedTemplateRef?: unknown
  readonly targetRaceDate?: unknown
}

export function generatePlanFromDraft(
  draft: PlanDraftInput,
  currentCheck: PlanCurrentCheck,
  prescriptionSelection?: unknown,
): PlanDraftGeneration {
  const draftKeys = new Set([
    "eventGroup", "eventDistanceM", "competitionDivision", "experienceBand",
    "availableDayCount", "requestedFrameLength", "trainingFocus", "secondSessionMode",
    "trainingTimePreference", "selectedDetailedTemplateRef", "startDate", "targetRaceDate",
  ])
  if (!hasCanonicalJsonTree(draft)
      || !Reflect.ownKeys(draft).every((key) => typeof key === "string" && draftKeys.has(key))) {
    return { kind: "rejected", code: "MALFORMED_INPUT" }
  }
  const normalizedTemplateRef = normalizeDraftTemplateRef(draft.selectedDetailedTemplateRef)
  if (normalizedTemplateRef.kind === "malformed") {
    return { kind: "rejected", code: "MINIMUM_PROFILE_INCOMPLETE" }
  }
  const evaluatedAt = new Date()
  const intake = completeIntake({
    ...draft,
    selectedDetailedTemplateRef: normalizedTemplateRef.value,
  })
  if (intake === null) {
    return { kind: "rejected", code: "MINIMUM_PROFILE_INCOMPLETE" }
  }
  const safety = evaluatePlanSafety(currentCheck, evaluatedAt)
  if (safety.kind === "blocked") return safety
  const safetyGate = safety.gate
  const authority = resolveDetailedPrescriptionRuntimeAuthority({
    selectedTemplateRef: intake.selectedDetailedTemplateRef,
    targetEventDistanceM: intake.eventDistanceM,
    selectedEnergyIntent: intake.trainingFocus,
    evaluatedAt: evaluatedAt.toISOString(),
  })
  const authorityFallback = intake.selectedDetailedTemplateRef !== null
    && authority.kind === "fallback"
  const effectiveIntake = authorityFallback
    ? { ...intake, selectedDetailedTemplateRef: null }
    : intake
  const availableTrainingDays = spreadTrainingDays(
    effectiveIntake.availableDayCount,
    effectiveIntake.requestedFrameLength,
  )
  const athleteEvidence = summarizeAthleteEvidence(safety.journalSource, evaluatedAt)
  const result = generatePlanCandidates({
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate,
    profile: {
      eventGroup: effectiveIntake.eventGroup,
      eventDistanceM: effectiveIntake.eventDistanceM,
      experienceBand: effectiveIntake.experienceBand,
      availableTrainingDays,
      secondSessionMode: effectiveIntake.secondSessionMode,
      trainingTimePreference: effectiveIntake.trainingTimePreference,
    },
    formation: createPlanFormation(
      todayISO(evaluatedAt),
      availableTrainingDays,
      effectiveIntake.experienceBand,
    ),
    requestedFrameLength: effectiveIntake.requestedFrameLength,
    selectedEnergyIntent: effectiveIntake.trainingFocus,
    selectedDetailedTemplateRef: effectiveIntake.selectedDetailedTemplateRef,
    ...(draft.targetRaceDate === undefined ? {} : { targetRaceDate: draft.targetRaceDate }),
    journalSource: safety.journalSource,
    selectionAuthority: "SELF",
    continuity: loadPreviousContinuity(),
  })

  switch (result.kind) {
    case "generated":
      {
        const binding = normalizedTemplateRef.kind === "incomplete"
          ? {
              kind: "fallback" as const,
              code: "PACE_TARGET_FALLBACK_INCOMPLETE_TEMPLATE_REF" as const,
              generated: result,
            }
          : authorityFallback
          ? {
              kind: "fallback" as const,
              code: "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT" as const,
              generated: result,
            }
          : bindDetailedPrescriptionCandidates(
              result,
              effectiveIntake,
              safetyGate,
              prescriptionSelection,
              evaluatedAt,
            )
      return {
        kind: "generated",
        generated: binding.generated,
        prescriptionBinding: { kind: binding.kind, code: binding.code },
        gate: safetyGate,
        intake: effectiveIntake,
        athleteEvidence,
      }
      }
    case "needs_review_with_reason":
      return { kind: "rejected", code: "FORMATION_REVIEW_REQUIRED" }
    case "preview_only":
      if (!raceDatePersistenceIsDisabled()) {
        return { kind: "rejected", code: "RACE_DATE_AUTHORITY_NOT_IMPLEMENTED" }
      }
      return {
        kind: "preview_only",
        code: result.code,
        racePlacement: result.racePlacement,
        preview: result.preview,
        candidates: result.candidates,
      }
    case "blocked":
    case "rejected":
      return { kind: "rejected", code: result.code }
    default:
      return assertNever(result)
  }
}

export function evaluatePlanSafety(
  currentCheck: PlanCurrentCheck,
  evaluatedAt: Date = new Date(),
): PlanSafetyEvaluation {
  const journal = loadEntriesForPlanSafety()
  if (
    journal.status === "uncertain"
    || recentJournalRequiresReview(journal.entries, evaluatedAt)
  ) {
    return { kind: "blocked", code: "RECENT_JOURNAL_REQUIRES_REVIEW" }
  }

  const gate = currentCheckGate(currentCheck)
  return gate.kind === "blocked"
    ? { kind: "blocked", code: "CURRENT_CHECK_REQUIRES_REVIEW" }
    : {
        kind: "passed",
        gate,
        journalSource: structuredJournalSource(journal.entries, evaluatedAt),
      }
}

export function selectPlanForActivation(
  candidateId: string,
  generated: PlanGenerationSuccess,
  gate: SafetyGateDecision,
  intake: PlanBetaIntake,
  athleteEvidence: PlanAthleteEvidence = {
    storedRecordCount: 0,
    goalRecordCount: 0,
    recentJournalSessionCount: 0,
  },
  evaluatedAt: Date = new Date(),
): PlanSelection {
  const result = selectPlanCandidate({
    kind: "PLAN_BETA_SELECTION_REQUEST",
    generatedPlan: generated,
    selectedCandidateId: candidateId,
    actor: "SELF",
    safetyGate: gate,
  })
  if (result.kind !== "selected") {
    return { kind: "rejected", code: result.code }
  }

  const canonicalCandidate = generated.candidates.find(
    (candidate) => candidate.candidateId === result.activePlan.candidateId,
  )
  if (canonicalCandidate === undefined) {
    return { kind: "rejected", code: "CANDIDATE_NOT_FOUND" }
  }
  if (canonicalCandidate.selectedDetailedTemplateRef !== null) {
    const authority = resolveDetailedPrescriptionRuntimeAuthority({
      selectedTemplateRef: canonicalCandidate.selectedDetailedTemplateRef,
      targetEventDistanceM: canonicalCandidate.eventDistanceM,
      selectedEnergyIntent: canonicalCandidate.selectedEnergyIntent,
      evaluatedAt: evaluatedAt.toISOString(),
    })
    if (authority.kind !== "authorized") {
      return { kind: "rejected", code: "DETAILED_TEMPLATE_AUTHORITY_UNAVAILABLE" }
    }
  }

  const generatedAt = evaluatedAt.toISOString()
  const periodization = createInitialPeriodizationContext(
    result.activePlan.candidateId,
    generatedAt,
  )
  if (periodization === null) {
    return { kind: "rejected", code: "INVALID_SELECTION_REQUEST" }
  }

  return {
    kind: "selected",
    state: {
      version: 3,
      intake,
      activePlan: result.activePlan,
      progress: [],
      generatedAt,
      periodization,
      athleteEvidence,
    },
  }
}

function completeIntake(
  draft: Partial<PlanBetaIntake>,
): PlanBetaIntake | null {
  const {
    eventGroup,
    eventDistanceM,
    competitionDivision,
    experienceBand,
    availableDayCount,
    requestedFrameLength,
    trainingFocus,
    secondSessionMode,
    trainingTimePreference,
    selectedDetailedTemplateRef,
  } = draft
  if (
    eventGroup === undefined
    || eventDistanceM === undefined
    || experienceBand === undefined
    || availableDayCount === undefined
    || requestedFrameLength === undefined
    || trainingFocus === undefined
    || secondSessionMode === undefined
    || trainingTimePreference === undefined
  ) {
    return null
  }
  const normalizedCompetitionDivision = divisionForGoal(eventGroup) ?? competitionDivision
  if (normalizedCompetitionDivision === undefined) return null
  const parsed = planIntakeSchema.safeParse({
    eventGroup,
    eventDistanceM,
    competitionDivision: normalizedCompetitionDivision,
    experienceBand,
    availableDayCount,
    requestedFrameLength,
    trainingFocus,
    secondSessionMode,
    trainingTimePreference,
    selectedDetailedTemplateRef: selectedDetailedTemplateRef ?? null,
  })
  return parsed.success ? parsed.data : null
}

function normalizeDraftTemplateRef(value: unknown):
  | { readonly kind: "complete"; readonly value: PlanBetaIntake["selectedDetailedTemplateRef"] }
  | { readonly kind: "incomplete"; readonly value: null }
  | { readonly kind: "malformed" } {
  if (value === undefined || value === null) return { kind: "complete", value: null }
  if (typeof value !== "object" || Array.isArray(value)) return { kind: "malformed" }
  const keys = Reflect.ownKeys(value)
  const allowedKeys = new Set(["templateId", "version", "fingerprint"])
  if (!keys.every((key) => typeof key === "string" && allowedKeys.has(key))) {
    return { kind: "malformed" }
  }
  if (keys.length < allowedKeys.size) return { kind: "incomplete", value: null }
  const parsed = detailedTemplateRefSchema.safeParse(value)
  return parsed.success
    ? { kind: "complete", value: parsed.data }
    : { kind: "malformed" }
}

function raceDatePersistenceIsDisabled(): boolean {
  return raceDateRetentionAuthority.schemaVersion === 1
    && raceDateRetentionAuthority.kind === "TRAINORACLE_RACE_DATE_RETENTION_AUTHORITY"
    && raceDateRetentionAuthority.status === "NOT_AUTHORIZED"
    && raceDateRetentionAuthority.policy === "RACE_DATE_PERSISTENCE_DISABLED_UNTIL_GOVERNANCE_RECEIPT"
    && raceDateRetentionAuthority.receipt === null
}

function currentCheckGate(currentCheck: PlanCurrentCheck): SafetyGateDecision {
  try {
    const d9 = evaluateD9ColloquialLayer(CURRENT_CHECK_TEXT[currentCheck])
    return decideSafetyGate(mapD9ResultToRveSignal(d9))
  } catch {
    return decideSafetyGate(createEvaluatorFailureSignal("exception"))
  }
}

function recentJournalRequiresReview(
  entries: readonly JournalEntry[],
  evaluatedAt: Date,
): boolean {
  const today = todayISO(evaluatedAt)
  const from = isoShift(today, -13)
  return entries
    .filter((entry) => entry.date >= from && entry.date <= today)
    .some(entryRequiresReview)
}

function entryRequiresReview(entry: JournalEntry): boolean {
  if (entry.kind === "evening" && painLevelsRequireReview(entry.painParts)) {
    return true
  }
  if (entry.kind === "post-session" && painLevelsRequireReview(entry.painParts ?? {})) {
    return true
  }

  const rawText = entry.kind === "evening" ? entry.note : entry.memo
  return assessPurposeScopedMemo(rawText, entry.memoPurpose)
    ?.blocksPlanGeneration === true
}

function structuredJournalSource(
  entries: readonly JournalEntry[],
  evaluatedAt: Date,
): JournalSource {
  const today = todayISO(evaluatedAt)
  const from = isoShift(today, -13)
  const sessions = entries.filter(
    (entry): entry is PostSessionEntry =>
      entry.kind === "post-session"
      && entry.activityOutcome !== "RESTED"
      && entry.activityOutcome !== "SKIPPED"
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

function summarizeAthleteEvidence(
  journalSource: JournalSource,
  evaluatedAt: Date,
): PlanAthleteEvidence {
  const records = loadAthleteRecords(evaluatedAt)
  return {
    storedRecordCount: records.length,
    goalRecordCount: records.filter((record) => record.purpose === "RACE_GOAL").length,
    recentJournalSessionCount: journalSource.kind === "RECENT_JOURNAL_CONTEXT"
      ? journalSource.eligibleSessionCount
      : 0,
  }
}

function spreadTrainingDays(
  count: PlanBetaIntake["availableDayCount"],
  requestedFrameLength: PlanBetaIntake["requestedFrameLength"],
): readonly number[] {
  const visibleDays = Math.ceil(requestedFrameLength)
  if (count === "EVERY_DAY") {
    return Object.freeze(Array.from({ length: visibleDays }, (_, index) => index + 1))
  }
  const matrix = {
    3: [1, 5, 9],
    4: [1, 4, 7, 10],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 5, 6, 8, 10],
  } as const
  if (visibleDays === 10) return Object.freeze([...matrix[count]])

  return Object.freeze(Array.from(
    { length: count },
    (_, index) => Math.round(1 + (index * (visibleDays - 1)) / (count - 1)),
  ))
}
