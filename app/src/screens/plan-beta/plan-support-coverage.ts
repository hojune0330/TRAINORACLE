import { PLANNED_ENERGY_INTENTS, type ExperienceBand } from "@impl/plan-generator/types"
import { SUPPORTED_PLAN_EVENTS } from "./plan-intake-navigation"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"

/** Read-only projection of selectable templates, not another activation registry. */
export function planSupportCoverage(experienceBand: ExperienceBand, evaluatedAt: string) {
  return SUPPORTED_PLAN_EVENTS.map(event => ({
    event,
    methods: PLANNED_ENERGY_INTENTS.flatMap(trainingFocus =>
      resolveDetailedPlanTemplateOptions({ eventDistanceM: event.distanceM, experienceBand, trainingFocus }, evaluatedAt)),
  }))
}
