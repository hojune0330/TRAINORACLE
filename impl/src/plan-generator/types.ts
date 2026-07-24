import type { SafetyGateDecision } from "../safety-gate/gate"

export const PLAN_EVENT_GROUPS = [
  "MIDDLE_DISTANCE",
  "FIVE_K",
  "TEN_K",
  "GENERAL_ENDURANCE",
] as const

export type PlanEventGroup = (typeof PLAN_EVENT_GROUPS)[number]

export const EXPERIENCE_BANDS = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const

export type ExperienceBand = (typeof EXPERIENCE_BANDS)[number]

export type PlanSourceMode = "PROFILE_ONLY" | "JOURNAL_CONTEXT_ONLY"

export type PlanSelectionAuthority = "SELF" | "COACH_REQUIRED"

export type PlanCandidateKind = "BALANCED" | "CONSERVATIVE"

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
  | "COACH_SELECTION_REQUIRED"
  | "CANDIDATE_NOT_FOUND"
  | "SAFETY_GATE_RECHECK_BLOCKED"
  | "SESSION_DAY_NOT_IN_ACTIVE_PLAN"

export type PlanBetaAudit = {
  readonly event:
    | "PLAN_BETA_GENERATED"
    | "PLAN_BETA_BLOCKED"
    | "PLAN_BETA_REJECTED"
    | "PLAN_BETA_SELECTED"
    | "PLAN_BETA_SELECTION_REJECTED"
    | "PLAN_BETA_PROGRESS_RECORDED"
    | "PLAN_BETA_PROGRESS_REJECTED"
  readonly codes: readonly PlanBetaCode[]
  readonly privacy: "STRUCTURED_CODES_ONLY"
}

export type RpeTimeRange = {
  readonly kind: "RPE_TIME_RANGE"
  readonly rpe: {
    readonly minimum: number
    readonly maximum: number
  }
  readonly durationMinutes: {
    readonly minimum: number
    readonly maximum: number
  }
}

export type PlanSession =
  | {
      readonly day: number
      readonly role: "REST"
      readonly prescription: {
        readonly kind: "REST"
      }
    }
  | {
      readonly day: number
      readonly role: "EASY" | "QUALITY"
      readonly prescription: RpeTimeRange
    }

export type PlanFrame = {
  readonly lengthDays: 7 | 9 | 10
  readonly continuity:
    | {
        readonly kind: "SEVEN_DAY_CONTINUITY"
        readonly nextFrameInput: "SELECTED_PLAN_AND_PROGRESS"
      }
    | {
        readonly kind: "STANDARD_FRAME"
      }
}

export type PlanCandidate = {
  readonly candidateId: string
  readonly kind: PlanCandidateKind
  readonly eventGroup: PlanEventGroup
  readonly sourceMode: PlanSourceMode
  readonly confidence: "LIMITED"
  readonly beta: {
    readonly designation: "BETA"
    readonly prescriptionBasis: "DURATION_RPE_ONLY"
    readonly formationMethodClaim: "NOT_UNIVERSAL"
  }
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
  readonly frame: PlanFrame
  readonly rationaleCodes: readonly PlanBetaCode[]
  readonly sessions: readonly PlanSession[]
}

export type PlanProfile = {
  readonly eventGroup: PlanEventGroup
  readonly experienceBand: ExperienceBand
  readonly availableTrainingDays: readonly number[]
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
  readonly journalSource: JournalSource
  readonly selectionAuthority: PlanSelectionAuthority
  readonly continuity?: PlanContinuityInput
}

export type PlanGenerationSuccess = {
  readonly kind: "generated"
  readonly sourceMode: PlanSourceMode
  readonly confidence: "LIMITED"
  readonly selectionAuthority: PlanSelectionAuthority
  readonly candidates: readonly [PlanCandidate, PlanCandidate]
  readonly audit: PlanBetaAudit
}

export type PlanGenerationResult =
  | PlanGenerationSuccess
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

export type BetaActivePlanSnapshot = {
  readonly kind: "BETA_ACTIVE_PLAN_SNAPSHOT"
  readonly activationState: "SELECTED_BETA_SNAPSHOT"
  readonly candidateId: string
  readonly candidateKind: PlanCandidateKind
  readonly selectionActor: "SELF" | "COACH"
  readonly sourceMode: PlanSourceMode
  readonly frame: PlanFrame
  readonly sessions: readonly PlanSession[]
}

export type PlanSelectionRequest = {
  readonly kind: "PLAN_BETA_SELECTION_REQUEST"
  readonly generatedPlan: PlanGenerationSuccess
  readonly selectedCandidateId: string
  readonly actor: "SELF" | "COACH"
  readonly safetyGate: SafetyGateDecision
}

export type PlanSelectionResult =
  | {
      readonly kind: "selected"
      readonly activePlan: BetaActivePlanSnapshot
      readonly audit: PlanBetaAudit
    }
  | {
      readonly kind: "blocked"
      readonly code: "SAFETY_GATE_RECHECK_BLOCKED"
      readonly audit: PlanBetaAudit
    }
  | {
      readonly kind: "rejected"
      readonly code: "COACH_SELECTION_REQUIRED" | "CANDIDATE_NOT_FOUND"
      readonly audit: PlanBetaAudit
    }

export type PlanProgressRequest = {
  readonly kind: "PLAN_BETA_PROGRESS_REQUEST"
  readonly activePlan: BetaActivePlanSnapshot
  readonly sessionDay: number
  readonly state: PlanProgressState
}

export type PlanProgressResult =
  | {
      readonly kind: "recorded"
      readonly progress: {
        readonly activePlanCandidateId: string
        readonly sessionDay: number
        readonly state: PlanProgressState
      }
      readonly audit: PlanBetaAudit
    }
  | {
      readonly kind: "rejected"
      readonly code: "SESSION_DAY_NOT_IN_ACTIVE_PLAN"
      readonly audit: PlanBetaAudit
    }
