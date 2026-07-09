import type { SafetyGatePassed } from "../safety-gate/gate"

export type PlanDraft = {
  readonly kind: "plan_draft"
  readonly source: "PLAN_GENERATOR_STUB"
}

export function createPlanDraft(_gate: SafetyGatePassed): PlanDraft {
  return {
    kind: "plan_draft",
    source: "PLAN_GENERATOR_STUB",
  }
}
