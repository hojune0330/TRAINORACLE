export const FORMATION_FRAME_KINDS = ["LOCAL_CIVIL_9_5"] as const

export type FormationFrameKind = (typeof FORMATION_FRAME_KINDS)[number]

export type LocalCivilHalfDaySlot = {
  readonly slotIndex: number
  readonly localDayKey: string
  readonly slot: "AM" | "PM"
}

export const MAIN_EXPOSURE_CLASSIFICATIONS = [
  "TRAINING_MAIN",
  "COMPETITION",
  "NONE",
] as const

export type MainExposureClassification =
  (typeof MAIN_EXPOSURE_CLASSIFICATIONS)[number]

export type MainExposureComponent =
  | { readonly kind: "STANDALONE" }
  | { readonly kind: "PARENT" }
  | { readonly kind: "LEAF"; readonly parentExposureId: string }

export type ExplicitMainExposure = {
  readonly exposureId: string
  readonly classification: MainExposureClassification
  readonly localDayKey: string
  readonly component: MainExposureComponent
}

export type LocalCivilNinePointFiveFormation = {
  readonly kind: "LOCAL_CIVIL_9_5"
  readonly slots: readonly LocalCivilHalfDaySlot[]
  readonly exposures: readonly ExplicitMainExposure[]
}

export type PlanReviewReasonCode =
  | "NON_CANONICAL_FRAME_REQUIRES_REVIEW"
  | "CANONICAL_LEDGER_REQUIRES_VALIDATION"
  | "NEEDS_COACH_CLARIFICATION"
  | "INVALID_COMPOSITE_RELATION_REQUIRES_REVIEW"
  | "COMPETITION_DAY_COLLISION_REQUIRES_COACH_CLARIFICATION"
  | "MAIN_EXPOSURE_COUNT_REQUIRES_REVIEW"
  | "MAIN_EXPOSURE_OUTSIDE_AVAILABILITY_REQUIRES_REVIEW"

export type PlanReviewConservativeAlternative =
  "KEEP_CURRENT_PLAN_AND_RECOVERY_GUIDANCE"
