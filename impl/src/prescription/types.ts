export const RECOVERY_MODES = [
  "WALK",
  "JOG",
  "STAND",
  "FULL_RECOVERY",
  "COACH_DEFINED",
  "NOT_APPLICABLE",
] as const

export type RecoveryMode = (typeof RECOVERY_MODES)[number]

export const V2_SEED_05_STOP_CONDITION_CODES = [
  "STOP_NEW_OR_WORSENING_PAIN",
  "STOP_DIZZINESS_OR_FAINTNESS",
  "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING",
  "STOP_LOSS_OF_CONTROLLED_FORM",
] as const

export type V2Seed05StopConditionCode = (typeof V2_SEED_05_STOP_CONDITION_CODES)[number]

export type PrescriptionWarmupComponent = {
  readonly componentRef: "WU-V2-5K-01" | "WU-MD-01"
  readonly componentVersion: "1.0.0"
  readonly authority: "OWNER_OPERATIONAL_ADAPTATION"
  readonly easyDurationMinutes: 15
  readonly rpeMin: 2
  readonly rpeMax: 3
  readonly strides: {
    readonly repetitions: 4
    readonly durationSeconds: 20
    readonly recoverySeconds: 40
    readonly recoveryMode: "WALK_OR_JOG"
    readonly progression: "PROGRESSIVE"
  }
}

export type PrescriptionCooldownComponent = {
  readonly componentRef: "CD-V2-5K-01" | "CD-MD-01"
  readonly componentVersion: "1.0.0"
  readonly authority: "OWNER_OPERATIONAL_ADAPTATION"
  readonly easyDurationMinutes: 10
  readonly rpeMin: 1
  readonly rpeMax: 2
}

export type PrescriptionFallbackComponent = {
  readonly componentRef: "RPE-ONLY-CONTROLLED-01"
  readonly componentVersion: "1.0.0"
  readonly code: "RPE_ONLY_CONTROLLED"
  readonly behavior: "DELEGATE_TO_EXISTING_RPE_CANDIDATE"
  readonly numericRepetitionVariant: null
}

export type PrescriptionStopConditionComponent = {
  readonly componentRef: "STOP-V2-5K-01" | "STOP-MD-01"
  readonly componentVersion: "1.0.0"
  readonly authority: "OWNER_PRECAUTIONARY_OPERATIONAL_RULE"
  readonly diagnosticClaim: false
  readonly codes: readonly V2Seed05StopConditionCode[]
}

export type PrescriptionOperationalComponents = {
  readonly warmup: PrescriptionWarmupComponent
  readonly cooldown: PrescriptionCooldownComponent
  readonly fallback: PrescriptionFallbackComponent
  readonly stopConditions: PrescriptionStopConditionComponent
}

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

export type GoalReferenceRacePaceResult =
  | {
      readonly kind: "calculated-goal-reference"
      readonly targetRepSeconds: number
      readonly displayOnly: true
      readonly sourceRef: string
      readonly displayRoundingPolicyVersion: string
    }
  | {
      readonly kind: "rejected"
      readonly code: PrescriptionErrorCode
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
  readonly repetitionRecoveryMode: "WALK" | "JOG" | "STAND" | "NOT_APPLICABLE"
  readonly setRecoverySeconds: number | null
  readonly setRecoveryMode: "WALK" | "JOG" | "STAND" | "NOT_APPLICABLE"
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
  readonly repetitionRecoveryMode: "WALK" | "JOG" | "STAND" | "NOT_APPLICABLE"
  readonly setRecoverySeconds: number | null
  readonly setRecoveryMode: "WALK" | "JOG" | "STAND" | "NOT_APPLICABLE"
  readonly warmupComponent: PrescriptionWarmupComponent
  readonly cooldownComponent: PrescriptionCooldownComponent
  readonly fallbackComponent: PrescriptionFallbackComponent
  readonly stopConditionComponent: PrescriptionStopConditionComponent
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
