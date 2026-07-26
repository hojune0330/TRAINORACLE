export const RECOVERY_MODES = [
  "WALK",
  "JOG",
  "STAND",
  "FULL_RECOVERY",
  "COACH_DEFINED",
  "NOT_APPLICABLE",
] as const

export type RecoveryMode = (typeof RECOVERY_MODES)[number]

export type PaceTargetKind = "RACE_PACE" | "EFFORT_GUIDANCE" | "SPRINT_REFERENCE"

export type PaceAnchorRecord = {
  readonly anchorId: string
  readonly kind:
    | "RECENT_RESULT"
    | "PB"
    | "SB"
    | "GOAL"
    | "COACH_REFERENCE"
    | "RPE_ONLY"
    | "SPRINT_BENCHMARK"
  readonly eventDistanceM: number | null
  readonly performanceSeconds: number | null
  readonly achievedAt: string | null
  readonly seasonId: string | null
  readonly enteredBy: "ATHLETE" | "COACH" | "VERIFIED_IMPORT"
  readonly sourceRef: string
  readonly verificationState: "VERIFIED" | "SELF_REPORTED" | "UNVERIFIED"
  readonly freshnessState: "CURRENT" | "STALE" | "UNKNOWN"
  readonly purpose:
    | "CURRENT_CAPABILITY"
    | "SEASON_CONTEXT"
    | "ASPIRATIONAL_TARGET"
    | "SPRINT_REFERENCE"
    | "EFFORT_ONLY"
}

export type UnboundPrescriptionNotation = {
  readonly kind: "UNBOUND_PRESCRIPTION_NOTATION"
  readonly setCount: number
  readonly repetitionsPerSet: number
  readonly repetitionDistanceM: number | null
  readonly repetitionDurationSeconds: number | null
  readonly paceTargetKind: "RACE_PACE"
  readonly paceTargetEventDistanceM: number
  readonly repetitionRecoverySeconds: number | null
  readonly repetitionRecoveryMode: "STAND" | "NOT_APPLICABLE"
  readonly setRecoverySeconds: number | null
  readonly setRecoveryMode: "STAND" | "NOT_APPLICABLE"
}

export type StructuredPrescription = {
  readonly kind: "STRUCTURED_PRESCRIPTION"
  readonly setCount: number
  readonly repetitionsPerSet: number
  readonly repetitionDistanceM: number | null
  readonly repetitionDurationSeconds: number | null
  readonly paceAnchorRef: string
  readonly paceTargetKind: "RACE_PACE"
  readonly paceTargetEventDistanceM: number
  readonly displayRoundingPolicyVersion: string
  readonly repetitionRecoverySeconds: number | null
  readonly repetitionRecoveryMode: "STAND" | "NOT_APPLICABLE"
  readonly setRecoverySeconds: number | null
  readonly setRecoveryMode: "STAND" | "NOT_APPLICABLE"
  readonly warmupComponentRef: null
  readonly cooldownComponentRef: null
  readonly downshiftOptionRefs: readonly string[]
  readonly stopConditionCodes: readonly string[]
}

export type PrescriptionDerivedTotals = {
  readonly totalRepetitions: number
  readonly qualityDistanceM: number | null
  readonly qualityDurationSeconds: number | null
  readonly repetitionRecoveryOccurrences: number
  readonly repetitionRecoveryTotalSeconds: number | null
  readonly setRecoveryOccurrences: number
  readonly setRecoveryTotalSeconds: number | null
  readonly plannedRecoverySeconds: number | null
  readonly mainSessionTotalExcludingWarmupCooldown: number | null
  readonly uncomputableReasonCodes: readonly PrescriptionUncomputableReasonCode[]
}

export type PrescriptionUncomputableReasonCode =
  | "QUALITY_DISTANCE_UNAVAILABLE"
  | "WORK_DURATION_UNAVAILABLE"
  | "REPETITION_RECOVERY_UNAVAILABLE"
  | "SET_RECOVERY_UNAVAILABLE"

export type PrescriptionErrorCode =
  | "MALFORMED_NOTATION"
  | "ANCHOR_INCOMPLETE"
  | "ANCHOR_PROVENANCE_INCOMPLETE"
  | "ANCHOR_NOT_CURRENT"
  | "GOAL_ANCHOR_FORBIDDEN"
  | "ANCHOR_REFERENCE_MISMATCH"
  | "CROSS_EVENT_MODEL_REQUIRED"
  | "SPRINT_RACE_PACE_FORBIDDEN"
  | "TEMPLATE_NOT_ACTIVE"
  | "TEMPLATE_NOT_ELIGIBLE"
  | "SAFETY_GATE_BLOCKED"
  | "MALFORMED_RUNTIME_INPUT"

export type PrescriptionNotationResult =
  | {
      readonly kind: "parsed"
      readonly notation: UnboundPrescriptionNotation
    }
  | {
      readonly kind: "rejected"
      readonly code: "MALFORMED_NOTATION"
    }

export type StructuredPrescriptionResult =
  | {
      readonly kind: "created"
      readonly prescription: StructuredPrescription
    }
  | {
      readonly kind: "rejected"
      readonly code: PrescriptionErrorCode
    }

export type RacePaceCalculationResult =
  | {
      readonly kind: "calculated"
      readonly targetRepSeconds: number
      readonly displayRoundingPolicyVersion: string
    }
  | {
      readonly kind: "rejected"
      readonly code: PrescriptionErrorCode
    }

export type TemplateRuntimeStatus = {
  readonly lifecycleStatus: "DRAFT" | "ACTIVE"
  readonly eligibilityStatus: "REVIEW_REQUIRED" | "ELIGIBLE"
}
