import type { SupportedPlanEventDistanceM } from "@impl/plan-generator/types"

/** Display/input boundary only. It cannot authorize, calculate, or persist a plan. */
export type InstantPlanEntry =
  | { readonly kind: "CURRENT_RECORD"; readonly eventDistanceM: SupportedPlanEventDistanceM;
      readonly performanceSeconds: number; readonly achievedOn: string }
  | { readonly kind: "GOAL_ONLY"; readonly eventDistanceM: SupportedPlanEventDistanceM;
      readonly performanceSeconds: number }
  | { readonly kind: "NO_RECORD"; readonly eventDistanceM: SupportedPlanEventDistanceM }

export type InstantPlanSource =
  | { readonly kind: "GENERAL" }
  | { readonly kind: "CREATOR"; readonly programId: string; readonly version: string }

export type InstantPlanDaySummary = {
  readonly date: string
  readonly dayLabel: string
  readonly sessions: readonly {
    readonly id: string
    readonly slotLabel: string
    readonly title: string
    readonly role: "MAIN" | "BASE" | "REC" | "OFF" | "OTHER"
  }[]
}

export type InstantPlanRecommendation = {
  readonly id: string
  readonly title: string
  readonly reason: string
  readonly periodLabel: string
  readonly sessionCount: number
  readonly durationLabel: string
  readonly firstSessionLabel: string
  readonly days: readonly InstantPlanDaySummary[]
  readonly source: InstantPlanSource
  readonly creatorLabel?: string
}

export type InstantPlanActionState =
  | { readonly kind: "READY" }
  | { readonly kind: "SAVING" }
  | { readonly kind: "PENDING"; readonly message: string }
  | { readonly kind: "BLOCKED" | "FAILED"; readonly message: string }

export type InstantPlanToday = {
  readonly dateLabel: string
  readonly state: "BEFORE_START" | "SCHEDULED" | "PARTLY_RECORDED" | "RECORDED" | "REST"
    | "RETURN_AFTER_GAP" | "COMPLETED" | "UNAVAILABLE"
  readonly title: string
  readonly sourceLabel?: string
  readonly sessions: readonly {
    readonly id: string
    readonly slotLabel: string
    readonly title: string
    readonly recorded: boolean
    readonly steps: readonly { readonly label: string; readonly instruction: string }[]
  }[]
}
