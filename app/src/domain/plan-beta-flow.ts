import { evaluateD9ColloquialLayer } from "@impl/d9/evaluator"
import { assertNever } from "@impl/shared/assert-never"
import { createExplanationReceipt } from "./training-explanation-receipt"
import {
  generatePlanCandidates,
  selectPlanCandidate,
} from "@impl/plan-generator/generator"
import type {
  JournalSource,
  PlanCandidate,
  PlanGenerationSuccess,
  SupportedPlanEventDistanceM,
  PlanContinuityInput,
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
  readPlanBetaStateFromStorage,
} from "./plan-beta-store"
import { prepareAdjustedNextFrame, prepareAdjustedNextFrameV3, prepareMultiAdjustedNextFrameV3 } from "./adjusted-plan-continuity"
import { RETAINED_MULTI_ADJUSTED_EVIDENCE_V3 } from "./adjusted-plan-storage-v6"
import type { RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-v3"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE } from "./adjusted-plan-storage-schema"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE_V3 } from "./adjusted-plan-storage-v5"
import type { RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-v3"
import type { RetainedAdjustedPlanEvidence } from "./selected-adjusted-plan-content"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
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
import type { PlanSessionTarget } from "./plan-session-target"

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
  detailedSessionTarget?: PlanSessionTarget,
  candidateSessionTargets?: import("./plan-session-target").CandidateSessionTargets,
): PlanDraftGeneration {
  return generatePlanDraftWithContinuity(draft, currentCheck, prescriptionSelection,
    detailedSessionTarget, candidateSessionTargets, loadPreviousContinuity())
}

/** A preview leaves the predecessor active. Its distinct result cannot be
 * mistaken for an already accepted successor by the existing save flow. */
export function generateAdjustedNextFrameFromDraft(input: {
  readonly draft: PlanDraftInput
  readonly currentCheck: PlanCurrentCheck
  readonly expectedPredecessorFingerprint: string
  readonly prescriptionSelection?: unknown
  readonly detailedSessionTarget?: PlanSessionTarget
  readonly candidateSessionTargets?: import("./plan-session-target").CandidateSessionTargets
}, retained: readonly RetainedAdjustedPlanEvidence[] = RETAINED_ADJUSTED_PLAN_EVIDENCE) {
  const reject = (code: string) => ({ kind: "rejected" as const, code })
  try {
    if (!hasCanonicalJsonTree(input) || !Reflect.ownKeys(input).every(key => typeof key === "string" &&
      ["draft", "currentCheck", "expectedPredecessorFingerprint", "prescriptionSelection", "detailedSessionTarget", "candidateSessionTargets"].includes(key))) {
      return reject("MALFORMED_INPUT")
    }
    const account = localAccountScopeSnapshot()
    const previous = readPlanBetaStateFromStorage(retained)
    if (previous.kind !== "adjusted_loaded") return reject("ADJUSTED_PREDECESSOR_UNAVAILABLE")
    const evaluatedAt = new Date()
    const nextStartDate = input.draft.startDate ?? todayISO(evaluatedAt)
    const prepared = prepareAdjustedNextFrame({ previous: previous.state,
      expectedFingerprint: input.expectedPredecessorFingerprint, nextStartDate,
      currentCheck: input.currentCheck }, retained, evaluatedAt)
    if (prepared.kind !== "prepared") return prepared
    const draft = generatePlanDraftWithContinuity({ ...input.draft, startDate: nextStartDate },
      input.currentCheck, input.prescriptionSelection, input.detailedSessionTarget,
      input.candidateSessionTargets, prepared.context.continuity, nextStartDate)
    if (draft.kind !== "generated") return draft
    if (draft.intake.eventDistanceM !== previous.state.selection.activePlan.eventDistanceM) return reject("SUCCESSOR_EVENT_CHANGED")
    const current = readPlanBetaStateFromStorage(retained)
    if (!localAccountScopeIsCurrent(account) || current.kind !== "adjusted_loaded"
      || current.state.contentFingerprint !== previous.state.contentFingerprint) return reject("STALE_BASE")
    return { kind: "adjusted_next_frame_draft" as const,
      draft: { ...draft, intake: { ...draft.intake, startDate: nextStartDate } }, continuity: prepared.context,
      requiredNextGate: "REVIEWED_SUCCESSOR_TRANSACTION" as const }
  } catch { return reject("INVALID_CONTINUITY_INPUT") }
}

/** V3 history feeds the same generator, but cannot enter the legacy successor writer. */
export function generateAdjustedNextFrameV3FromDraft(input: Parameters<typeof generateAdjustedNextFrameFromDraft>[0],
  retained: readonly RetainedAdjustedPlanEvidenceV3[] = RETAINED_ADJUSTED_PLAN_EVIDENCE_V3) {
  const reject = (code: string) => ({ kind: "rejected" as const, code })
  try {
    if (!hasCanonicalJsonTree(input) || !Reflect.ownKeys(input).every(key => typeof key === "string" &&
      ["draft", "currentCheck", "expectedPredecessorFingerprint", "prescriptionSelection", "detailedSessionTarget", "candidateSessionTargets"].includes(key))) {
      return reject("MALFORMED_INPUT")
    }
    const account = localAccountScopeSnapshot(), previous = readPlanBetaStateFromStorage([], retained)
    if (previous.kind !== "adjusted_v3_loaded") return reject("ADJUSTED_PREDECESSOR_UNAVAILABLE")
    const at = new Date(), nextStartDate = input.draft.startDate ?? todayISO(at)
    const prepared = prepareAdjustedNextFrameV3({ previous: previous.state,
      expectedFingerprint: input.expectedPredecessorFingerprint, nextStartDate,
      currentCheck: input.currentCheck }, retained, at)
    if (prepared.kind !== "prepared") return prepared
    const draft = generatePlanDraftWithContinuity({ ...input.draft, startDate: nextStartDate },
      input.currentCheck, input.prescriptionSelection, input.detailedSessionTarget,
      input.candidateSessionTargets, prepared.context.continuity, nextStartDate)
    if (draft.kind !== "generated") return draft
    if (draft.intake.eventDistanceM !== previous.state.selection.activePlan.eventDistanceM) return reject("SUCCESSOR_EVENT_CHANGED")
    const current = readPlanBetaStateFromStorage([], retained)
    if (!localAccountScopeIsCurrent(account) || current.kind !== "adjusted_v3_loaded"
      || current.state.contentFingerprint !== previous.state.contentFingerprint) return reject("STALE_BASE")
    return { kind: "adjusted_next_frame_v3_draft" as const,
      draft: { ...draft, intake: { ...draft.intake, startDate: nextStartDate } }, continuity: prepared.context,
      requiredNextGate: "REVIEWED_SUCCESSOR_V3_TRANSACTION" as const }
  } catch { return reject("INVALID_CONTINUITY_INPUT") }
}

export function generateMultiAdjustedNextFrameV3FromDraft(input: Parameters<typeof generateAdjustedNextFrameFromDraft>[0],
  retained: readonly RetainedMultiAdjustedEvidenceV3[] = RETAINED_MULTI_ADJUSTED_EVIDENCE_V3) {
  const reject = (code: string) => ({ kind: "rejected" as const, code })
  try {
    if (!hasCanonicalJsonTree(input) || !Reflect.ownKeys(input).every(key => typeof key === "string" &&
      ["draft", "currentCheck", "expectedPredecessorFingerprint", "prescriptionSelection", "detailedSessionTarget", "candidateSessionTargets"].includes(key))) return reject("MALFORMED_INPUT")
    const account = localAccountScopeSnapshot(), previous = readPlanBetaStateFromStorage([], [], retained)
    if (previous.kind !== "multi_adjusted_v3_loaded") return reject("ADJUSTED_PREDECESSOR_UNAVAILABLE")
    const at = new Date(), nextStartDate = input.draft.startDate ?? todayISO(at)
    const prepared = prepareMultiAdjustedNextFrameV3({ previous: previous.state,
      expectedFingerprint: input.expectedPredecessorFingerprint, nextStartDate,
      currentCheck: input.currentCheck }, retained, at)
    if (prepared.kind !== "prepared") return prepared
    const draft = generatePlanDraftWithContinuity({ ...input.draft, startDate: nextStartDate },
      input.currentCheck, input.prescriptionSelection, input.detailedSessionTarget,
      input.candidateSessionTargets, prepared.context.continuity, nextStartDate)
    if (draft.kind !== "generated") return draft
    if (draft.intake.eventDistanceM !== previous.state.selection.activePlan.eventDistanceM) return reject("SUCCESSOR_EVENT_CHANGED")
    const current = readPlanBetaStateFromStorage([], [], retained)
    if (!localAccountScopeIsCurrent(account) || current.kind !== "multi_adjusted_v3_loaded"
      || current.state.contentFingerprint !== previous.state.contentFingerprint) return reject("STALE_BASE")
    return { kind: "multi_adjusted_next_frame_v3_draft" as const,
      draft: { ...draft, intake: { ...draft.intake, startDate: nextStartDate } }, continuity: prepared.context,
      requiredNextGate: "REVIEWED_MULTI_SUCCESSOR_V3_TRANSACTION" as const }
  } catch { return reject("INVALID_CONTINUITY_INPUT") }
}

function generatePlanDraftWithContinuity(
  draft: PlanDraftInput,
  currentCheck: PlanCurrentCheck,
  prescriptionSelection: unknown,
  detailedSessionTarget: PlanSessionTarget | undefined,
  candidateSessionTargets: import("./plan-session-target").CandidateSessionTargets | undefined,
  continuity: PlanContinuityInput | undefined,
  formationStartDate?: string,
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
      formationStartDate ?? todayISO(evaluatedAt),
      availableTrainingDays,
      effectiveIntake.experienceBand,
    ),
    requestedFrameLength: effectiveIntake.requestedFrameLength,
    selectedEnergyIntent: effectiveIntake.trainingFocus,
    selectedDetailedTemplateRef: effectiveIntake.selectedDetailedTemplateRef,
    ...(draft.targetRaceDate === undefined ? {} : { targetRaceDate: draft.targetRaceDate }),
    journalSource: safety.journalSource,
    selectionAuthority: "SELF",
    continuity,
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
              detailedSessionTarget,
              candidateSessionTargets,
            )
      return {
        kind: "generated",
        generated: binding.generated,
        prescriptionBinding: { kind: binding.kind, code: binding.code },
        gate: safetyGate,
        // The preview can fall back, but the athlete's requested method must remain
        // visible and require an explicit switch before an RPE-only plan is saved.
        intake,
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
  const detailedReferences = canonicalCandidate.sessions.flatMap(session => session.prescription.kind === "PACE_TARGET"
    ? [{
        templateId: session.prescription.templateId,
        version: session.prescription.templateVersion,
        fingerprint: session.prescription.templateContentFingerprint,
      }]
    : [])
  const authorityReferences = detailedReferences.length === 0 && canonicalCandidate.selectedDetailedTemplateRef !== null
    ? [canonicalCandidate.selectedDetailedTemplateRef]
    : detailedReferences
  for (const selectedTemplateRef of authorityReferences) {
    const authority = resolveDetailedPrescriptionRuntimeAuthority({
      selectedTemplateRef,
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
      explanationReceipt: createExplanationReceipt(result.activePlan, generatedAt),
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
