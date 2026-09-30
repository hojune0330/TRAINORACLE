import { PLANNED_ENERGY_INTENTS, type ExperienceBand } from "@impl/plan-generator/types"
import { SUPPORTED_PLAN_EVENTS } from "./plan-intake-navigation"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"

/** Read-only projection of selectable templates, not another activation registry. */
export function planSupportCoverage(experienceBand: ExperienceBand, evaluatedAt: string) {
  return SUPPORTED_PLAN_EVENTS.map(event => ({
    event,
    catalogConfigurations: ALL_WORKOUT_CATALOG.filter(entry => entry.family !== "OFF"
      && entry.eventDistances.includes(event.distanceM) && entry.experience.includes(experienceBand)),
    methods: PLANNED_ENERGY_INTENTS.flatMap(trainingFocus =>
      resolveDetailedPlanTemplateOptions({ eventDistanceM: event.distanceM, experienceBand, trainingFocus }, evaluatedAt)),
  }))
}
