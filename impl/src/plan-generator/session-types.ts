import type {
  EasyEnergyIntent,
  PlannedEnergyIntent,
  QualityEnergyIntent,
} from "./types"
import type {
  PrescriptionOperationalComponents,
  V2Seed05StopConditionCode,
} from "../prescription/types"

export const PLAN_SESSION_SLOTS = ["AM", "PM"] as const

export type PlanSessionSlot = (typeof PLAN_SESSION_SLOTS)[number]

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

export type PaceTargetPlanPrescription = {
  readonly kind: "PACE_TARGET"
  readonly manifestVersion: string
  readonly templateId: string
  readonly templateVersion: string
  readonly templateContentFingerprint: string
  readonly notation: string
  readonly sourceDecisionId: string
  readonly sourceEvidenceRef: string
  readonly approvalDecisionId: string
  readonly ownerAuthorityDecisionId: string
  readonly sportsScienceEvidence: {
    readonly evidenceId: string
    readonly decisionRef: string
    readonly fingerprint: string
  }
  readonly populationApplicabilityEvidence: {
    readonly evidenceId: string
    readonly decisionRef: string
    readonly fingerprint: string
  }
  readonly scope: {
    readonly eventGroup: "FIVE_K" | "MIDDLE_DISTANCE"
    readonly experienceBand: "EXPERIENCED"
    readonly population: "YOUTH_AND_ADULT"
    readonly eventEvidenceFingerprint: string
    readonly experienceEvidenceFingerprint: string
  }
  readonly componentRefs: readonly {
    readonly componentType: "WARMUP" | "COOLDOWN" | "DOWNSHIFT" | "STOP_CONDITIONS"
    readonly componentRef: string
    readonly componentVersion: string
    readonly componentFingerprint: string
  }[]
  readonly operationalComponents: PrescriptionOperationalComponents
  readonly setCount: number
  readonly repetitionsPerSet: number
  readonly repetitionDistanceM: number
  readonly targetEventDistanceM: number
  readonly targetRepSeconds: number
  readonly selectedAnchor:
    | PaceTargetCurrentAnchorBase & {
        readonly kind: "RECENT_RESULT" | "PB"
        readonly purpose: "CURRENT_CAPABILITY"
        readonly seasonId: null
      }
    | PaceTargetCurrentAnchorBase & {
        readonly kind: "SB"
        readonly purpose: "SEASON_CONTEXT"
        readonly seasonId: string
      }
  readonly displayRoundingPolicyVersion: string
  readonly repetitionRecoverySeconds: number | null
  readonly repetitionRecoveryMode: "WALK" | "JOG" | "STAND" | "NOT_APPLICABLE"
  readonly setRecoverySeconds: number | null
  readonly setRecoveryMode: "WALK" | "JOG" | "STAND" | "NOT_APPLICABLE"
  readonly totals: {
    readonly totalRepetitions: number
    readonly qualityDistanceM: number
    readonly qualityDurationSeconds: number | null
    readonly repetitionRecoveryOccurrences: number
    readonly repetitionRecoveryTotalSeconds: number
    readonly setRecoveryOccurrences: number
    readonly setRecoveryTotalSeconds: number
    readonly plannedRecoverySeconds: number
    readonly mainSessionTotalExcludingWarmupCooldown: number | null
    readonly uncomputableReasonCodes: readonly (
      | "QUALITY_DISTANCE_UNAVAILABLE"
      | "WORK_DURATION_UNAVAILABLE"
      | "REPETITION_RECOVERY_UNAVAILABLE"
      | "SET_RECOVERY_UNAVAILABLE"
    )[]
  }
  readonly stopCodes: readonly V2Seed05StopConditionCode[]
  readonly fallbackCode: "RPE_ONLY_CONTROLLED"
  readonly prescriptionFingerprint: string
}

type PaceTargetCurrentAnchorBase = {
  readonly anchorId: string
  readonly eventDistanceM: number
  readonly performanceSeconds: number
  readonly achievedAt: string
  readonly enteredBy: "ATHLETE" | "COACH" | "VERIFIED_IMPORT"
  readonly verificationState: "VERIFIED" | "SELF_REPORTED" | "UNVERIFIED"
  readonly freshnessState: "CURRENT"
  readonly sourceRef: string
  readonly elapsedLabel: string
}

export type PlanSession =
  | {
      readonly day: number
      readonly slot: PlanSessionSlot
      readonly role: "REST"
      readonly plannedEnergyIntent: "RECOVERY_INTENT"
      readonly prescription: {
        readonly kind: "REST"
      }
    }
  | {
      readonly day: number
      readonly slot: PlanSessionSlot
      readonly role: "EASY"
      readonly plannedEnergyIntent: EasyEnergyIntent
      readonly prescription: RpeTimeRange
    }
  | {
      readonly day: number
      readonly slot: PlanSessionSlot
      readonly role: "QUALITY"
      readonly plannedEnergyIntent: QualityEnergyIntent
      readonly prescription: RpeTimeRange | PaceTargetPlanPrescription
    }

export type CanonicalPlanFrame = {
  readonly formationKind: "LOCAL_CIVIL_9_5"
  readonly lengthDays: 9.5
  readonly slotCount: 19
  readonly projectionLengthDays?: 7 | 9 | 9.5 | 10
  readonly continuity:
    | {
        readonly kind: "SEVEN_DAY_CONTINUITY"
        readonly nextFrameInput: "SELECTED_PLAN_AND_PROGRESS"
      }
    | { readonly kind: "STANDARD_FRAME" }
}

export type LegacyPlanFrame = {
  readonly lengthDays: 7 | 9 | 10
  readonly continuity:
    | {
        readonly kind: "SEVEN_DAY_CONTINUITY"
        readonly nextFrameInput: "SELECTED_PLAN_AND_PROGRESS"
      }
    | { readonly kind: "STANDARD_FRAME" }
}

export type PlanFrame = CanonicalPlanFrame | LegacyPlanFrame
