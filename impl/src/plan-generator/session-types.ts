import type {
  EasyEnergyIntent,
  PlannedEnergyIntent,
  QualityEnergyIntent,
} from "./types"

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
      readonly prescription: RpeTimeRange
    }

export type CanonicalPlanFrame = {
  readonly formationKind: "LOCAL_CIVIL_9_5"
  readonly lengthDays: 9.5
  readonly slotCount: 19
  readonly continuity: { readonly kind: "STANDARD_FRAME" }
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
