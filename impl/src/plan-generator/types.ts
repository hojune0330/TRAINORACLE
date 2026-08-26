import type { SafetyGateDecision } from "../safety-gate/gate"
import type {
  LocalCivilNinePointFiveFormation,
  PlanReviewConservativeAlternative,
  PlanReviewReasonCode,
} from "./formation-types"
import type { CanonicalPlanFrame, PlanSession } from "./session-types"
import type { RacePlacementState } from "./race-placement"

export {
  FORMATION_FRAME_KINDS,
  MAIN_EXPOSURE_CLASSIFICATIONS,
} from "./formation-types"
export { PLAN_SESSION_SLOTS } from "./session-types"
export type {
  ExplicitMainExposure,
  FormationFrameKind,
  LocalCivilHalfDaySlot,
  LocalCivilNinePointFiveFormation,
  MainExposureClassification,
  MainExposureComponent,
  PlanReviewConservativeAlternative,
  PlanReviewReasonCode,
} from "./formation-types"
export type {
  CanonicalPlanFrame,
  LegacyPlanFrame,
  PlanFrame,
  PlanSession,
  PlanSessionSlot,
  RpeTimeRange,
  PaceTargetPlanPrescription,
} from "./session-types"
export type {
  BetaActivePlanSnapshot,
  PlanProgressRequest,
  PlanProgressResult,
  PlanSelectionRequest,
  PlanSelectionResult,
} from "./selection-types"

export const PLAN_EVENT_GROUPS = [
  "MIDDLE_DISTANCE",
  "FIVE_K",
  "TEN_K",
  "GENERAL_ENDURANCE",
] as const

export type PlanEventGroup = (typeof PLAN_EVENT_GROUPS)[number]

export const EXPERIENCE_BANDS = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const

export type ExperienceBand = (typeof EXPERIENCE_BANDS)[number]

export const PLANNED_ENERGY_INTENTS = [
  "RECOVERY_INTENT",
  "BASE_INTENT",
  "LT_INTENT",
  "VO2_INTENT",
  "GLY_INTENT",
  "ATP_PC_INTENT",
  "MIXED_INTENT",
] as const

export type PlannedEnergyIntent = (typeof PLANNED_ENERGY_INTENTS)[number]

export type EasyEnergyIntent = "RECOVERY_INTENT" | "BASE_INTENT"

export type QualityEnergyIntent = Exclude<
  PlannedEnergyIntent,
  EasyEnergyIntent
>

export type PlanSourceMode = "PROFILE_ONLY" | "JOURNAL_CONTEXT_ONLY"

export type PlanSelectionAuthority = "SELF" | "COACH_REQUIRED"

export type PlanCandidateKind = "BALANCED" | "CONSERVATIVE"
export type SupportedPlanEventDistanceM = 800 | 1500 | 3000 | 5000

export type DetailedTemplateRef = {
  readonly templateId: string
  readonly version: string
  readonly fingerprint: string
}

export const SECOND_SESSION_MODES = [
  "SINGLE_SESSION_ONLY",
  "RECOVERY_PM_ALLOWED",
] as const

export type SecondSessionMode = (typeof SECOND_SESSION_MODES)[number]

export const TRAINING_TIME_PREFERENCES = ["MORNING", "EVENING", "VARIES"] as const

export type TrainingTimePreference = (typeof TRAINING_TIME_PREFERENCES)[number]

export type PlanProgressState = "COMPLETED" | "RESTED" | "SKIPPED" | "PAIN_CHECKIN"

export type PlanProgressStateCount = {
  readonly state: PlanProgressState
  readonly count: number
}

export type PlanContinuityInput = {
  readonly previousCandidateKind: PlanCandidateKind
  readonly progressStateCounts: readonly PlanProgressStateCount[]
}

export type PlanBetaCode =
  | "PROFILE_ONLY_LIMITED_CONTEXT"
  | "RECENT_JOURNAL_CONTEXT_PRESENT"
  | "BETA_DURATION_RPE_ONLY"
  | "PACE_TARGET_BOUND"
  | "BETA_NON_UNIVERSAL_FORMATION_SCOPE"
  | "PREVIOUS_FRAME_CONTEXT_RETAINED"
  | "SAFETY_GATE_ACTIVE"
  | "SAFETY_GATE_UNKNOWN"
  | "MALFORMED_INPUT"
  | "UNSUPPORTED_FRAME_LENGTH"
  | "INSUFFICIENT_AVAILABLE_DAYS"
  | "INVALID_AVAILABLE_DAY"
  | "INVALID_JOURNAL_CONTEXT"
  | "INVALID_CONTINUITY_CONTEXT"
  | "NON_CANONICAL_FRAME_REQUIRES_REVIEW"
  | "CANONICAL_LEDGER_REQUIRES_VALIDATION"
  | "NEEDS_COACH_CLARIFICATION"
  | "INVALID_COMPOSITE_RELATION_REQUIRES_REVIEW"
  | "COMPETITION_DAY_COLLISION_REQUIRES_COACH_CLARIFICATION"
  | "MAIN_EXPOSURE_COUNT_REQUIRES_REVIEW"
  | "MAIN_EXPOSURE_OUTSIDE_AVAILABILITY_REQUIRES_REVIEW"
  | "COACH_SELECTION_REQUIRED"
  | "CANDIDATE_NOT_FOUND"
  | "INVALID_SELECTION_REQUEST"
  | "NON_SELECTABLE_PLAN_RESULT"
  | "STALE_CANDIDATE_FINGERPRINT"
  | "NONCANONICAL_CANDIDATE_FRAME"
  | "SAFETY_GATE_RECHECK_BLOCKED"
  | "SESSION_DAY_NOT_IN_ACTIVE_PLAN"
  | "SESSION_SLOT_NOT_IN_ACTIVE_PLAN"

export type PlanBetaAudit = {
  readonly event:
    | "PLAN_BETA_GENERATED"
    | "PLAN_BETA_BLOCKED"
    | "PLAN_BETA_REJECTED"
    | "PLAN_BETA_REVIEW_REQUIRED"
    | "PLAN_BETA_SELECTED"
    | "PLAN_BETA_SELECTION_REJECTED"
    | "PLAN_BETA_PROGRESS_RECORDED"
    | "PLAN_BETA_PROGRESS_REJECTED"
  readonly codes: readonly PlanBetaCode[]
  readonly privacy: "STRUCTURED_CODES_ONLY"
}

export type PlanCandidate = {
  readonly candidateId: string
  readonly pairId: string
  readonly kind: PlanCandidateKind
  readonly eventGroup: PlanEventGroup
  readonly eventDistanceM: SupportedPlanEventDistanceM
  readonly selectedDetailedTemplateRef: DetailedTemplateRef | null
  readonly selectedEnergyIntent: PlannedEnergyIntent
  readonly sourceMode: PlanSourceMode
  readonly confidence: "LIMITED"
  readonly beta: {
    readonly designation: "BETA"
    readonly prescriptionBasis: "DURATION_RPE_ONLY" | "ONE_TRUSTED_DETAILED_SESSION"
    readonly formationMethodClaim: "NOT_UNIVERSAL"
  }
  readonly detailedPrescriptionFingerprint: string | null
  readonly continuityContext:
    | {
        readonly kind: "NO_PREVIOUS_FRAME_CONTEXT"
      }
    | {
        readonly kind: "PREVIOUS_FRAME_CONTEXT_RETAINED"
        readonly previousCandidateKind: PlanCandidateKind
        readonly progressStateCounts: readonly PlanProgressStateCount[]
      }
  readonly selectionAuthority: PlanSelectionAuthority
  readonly frame: CanonicalPlanFrame
  readonly mainExposureLedger: {
    readonly mainExposureCount: 2 | 3
    readonly fingerprint: string
    readonly countedExposureIds: readonly string[]
  }
  readonly rationaleCodes: readonly PlanBetaCode[]
  readonly sessions: readonly PlanSession[]
}

export type PlanProfile = {
  readonly eventGroup: PlanEventGroup
  readonly eventDistanceM: SupportedPlanEventDistanceM
  readonly experienceBand: ExperienceBand
  readonly availableTrainingDays: readonly number[]
  readonly secondSessionMode: SecondSessionMode
  readonly trainingTimePreference: TrainingTimePreference
}

export type JournalSource =
  | {
      readonly kind: "NO_USABLE_JOURNAL"
    }
  | {
      readonly kind: "RECENT_JOURNAL_CONTEXT"
      readonly eligibleSessionCount: number
    }

export type PlanGenerationRequest = {
  readonly kind: "PLAN_BETA_GENERATION_REQUEST"
  readonly safetyGate: SafetyGateDecision
  readonly profile: PlanProfile
  readonly requestedFrameLength: 7 | 9 | 10
  readonly selectedEnergyIntent: PlannedEnergyIntent
  readonly selectedDetailedTemplateRef?: DetailedTemplateRef | null
  readonly targetRaceDate?: string
  readonly journalSource: JournalSource
  readonly selectionAuthority: PlanSelectionAuthority
  readonly continuity?: PlanContinuityInput
}

export type CanonicalPlanGenerationRequest = Omit<
  PlanGenerationRequest,
  "requestedFrameLength" | "selectedDetailedTemplateRef"
> & {
  readonly requestedFrameLength: 7 | 9 | 9.5 | 10
  readonly selectedDetailedTemplateRef: DetailedTemplateRef | null
  readonly formation: LocalCivilNinePointFiveFormation
}

export type PlanGenerationSuccess = {
  readonly kind: "generated"
  readonly racePlacement: Extract<RacePlacementState, { readonly kind: "NO_TARGET_RACE" | "GENERIC_PLACEMENT_NO_AUTHORITY" }>
  readonly pairId: string
  readonly sourceMode: PlanSourceMode
  readonly selectedEnergyIntent: PlannedEnergyIntent
  readonly confidence: "LIMITED"
  readonly selectionAuthority: PlanSelectionAuthority
  readonly candidates: readonly [PlanCandidate, PlanCandidate]
  readonly audit: PlanBetaAudit
}

export type PlanGenerationReviewResult = {
  readonly kind: "needs_review_with_reason"
  readonly status: "NEEDS_REVIEW_WITH_REASON"
  readonly reasonCodes: readonly PlanReviewReasonCode[]
  readonly conservativeAlternative: PlanReviewConservativeAlternative
  readonly reviewNotice: "현재 입력으로는 후보를 만들지 않고, 기존 계획 유지와 회복 안내만 제공합니다."
  readonly candidates: readonly []
  readonly audit: PlanBetaAudit
}

export type PlanGenerationResult =
  | PlanGenerationSuccess
  | {
      readonly kind: "preview_only"
      readonly code: "RACE_DATE_PERSISTENCE_NOT_AUTHORIZED"
      readonly racePlacement: Extract<RacePlacementState, { readonly kind: "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED" }>
      readonly preview: {
        readonly eventDistanceM: SupportedPlanEventDistanceM
        readonly targetRaceDate: string
      }
      readonly candidates: readonly []
      readonly audit: PlanBetaAudit
    }
  | PlanGenerationReviewResult
  | {
      readonly kind: "blocked"
      readonly code: "SAFETY_GATE_ACTIVE" | "SAFETY_GATE_UNKNOWN"
      readonly candidates: readonly []
      readonly audit: PlanBetaAudit
    }
  | {
      readonly kind: "rejected"
      readonly code:
        | "MALFORMED_INPUT"
        | "UNSUPPORTED_FRAME_LENGTH"
        | "INSUFFICIENT_AVAILABLE_DAYS"
        | "INVALID_AVAILABLE_DAY"
        | "INVALID_JOURNAL_CONTEXT"
        | "INVALID_CONTINUITY_CONTEXT"
      readonly candidates: readonly []
      readonly audit: PlanBetaAudit
    }
