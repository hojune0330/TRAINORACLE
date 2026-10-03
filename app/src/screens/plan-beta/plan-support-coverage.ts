import { PLANNED_ENERGY_INTENTS, type ExperienceBand } from "@impl/plan-generator/types"
import { SUPPORTED_PLAN_EVENTS } from "./plan-intake-navigation"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import { canonicalPaceDistance, catalogRecordPaceModel, PACE_EVENT_METERS } from "@impl/prescription/record-pace"
import { recordPaceSegments } from "../../domain/catalog-pace-reference"

/** Read-only projection of selectable templates, not another activation registry. */
export function planSupportCoverage(experienceBand: ExperienceBand, evaluatedAt: string) {
  return SUPPORTED_PLAN_EVENTS.map(event => {
    const catalogConfigurations = ALL_WORKOUT_CATALOG.filter(entry => entry.family !== "OFF"
      && entry.eventDistances.some(distance => canonicalPaceDistance(distance) === canonicalPaceDistance(event.distanceM))
      && entry.experience.includes(experienceBand))
    // Calculation support is not individual eligibility or permission to apply a plan.
    const catalogPaceConfigurations = catalogConfigurations.filter(entry => !entry.hold).flatMap(entry => {
      const segments = recordPaceSegments(entry.id, {
        eventDistanceM: event.distanceM, experience: experienceBand, availableSeconds: null,
        confirmedRequirements: [], fiveK: null, segmentPaces: [],
      })
      const referenceEventDistances = PACE_EVENT_METERS.filter(distance => segments.some(segment =>
        catalogRecordPaceModel(segment.intent, distance, segment.referenceEventDistanceM) !== null))
      return referenceEventDistances.length === 0 ? [] : [{ catalogId: entry.id, referenceEventDistances }]
    })
    return {
      event,
      catalogConfigurations,
      catalogPaceConfigurations,
      methods: PLANNED_ENERGY_INTENTS.flatMap(trainingFocus =>
        resolveDetailedPlanTemplateOptions({ eventDistanceM: event.distanceM, experienceBand, trainingFocus }, evaluatedAt)),
    }
  })
}
