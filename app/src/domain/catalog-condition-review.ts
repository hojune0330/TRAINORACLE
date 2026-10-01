import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession, catalogFamilyForIntent } from "@impl/prescription/catalog-session-binding"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { isInitialCandidatePair } from "@impl/plan-generator/support-only-candidate-pair"
import type { PlanBetaIntake } from "./plan-beta-store"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"

const SPACE_REQUIREMENT = "ACCELERATION_AND_DECELERATION_SPACE"

export type CatalogConditionReview = {
  readonly pairId: string
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly catalogId: string
  readonly catalogFingerprint: string
}
export type CatalogConditionRequest = CatalogConditionReview & {
  readonly revision: number
  readonly startDate: string
  readonly accountScope: string | null
}

/** Discovery only. The editor must collect the actual answer before applying. */
export function findCatalogConditionReview(generated: PlanGenerationSuccess, intake: PlanBetaIntake): CatalogConditionReview | null {
  if (intake.selectedDetailedTemplateRef !== null || !generated.candidates.every(isVerifiedPlanCandidate)
    || !isInitialCandidatePair(...generated.candidates)) return null
  for (const session of generated.candidates[0].sessions) {
    if (session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE" || session.prescription.catalogWorkout) continue
    const paired = generated.candidates.map(candidate => candidate.sessions.find(s => s.day === session.day && s.slot === session.slot))
    if (paired.length !== 2 || paired.some(s => !s || s.role !== "QUALITY" || s.prescription.kind !== "RPE_TIME_RANGE" || s.prescription.catalogWorkout)) continue
    for (const entry of ALL_WORKOUT_CATALOG) {
      if (entry.family !== catalogFamilyForIntent(session.plannedEnergyIntent) || entry.hold !== null
        || entry.requirements.length !== 1 || entry.requirements[0] !== SPACE_REQUIREMENT) continue
      // Hypothetical readiness never leaves this function as a confirmed input.
      const inputs = { eventDistanceM: intake.eventDistanceM, experience: intake.experienceBand,
        availableSeconds: null, confirmedRequirements: [SPACE_REQUIREMENT], fiveK: null, segmentPaces: [] }
      const calculation = calculateCatalogWorkout(entry.id, inputs)
      if (!calculation?.totals.seconds || calculation.unavailable.length) continue
      if (!paired.every(original => {
        if (!original || original.prescription.kind !== "RPE_TIME_RANGE") return false
        const bound = bindCatalogSession(original, entry.id, inputs)
        return bound?.prescription.kind === "RPE_TIME_RANGE"
          && bound.prescription.rpe.maximum <= original.prescription.rpe.maximum
          && bound.prescription.durationMinutes.maximum <= original.prescription.durationMinutes.maximum
      })) continue
      if (!replaceCandidateCatalogWorkout(generated, session, entry.id, inputs)) continue
      return { pairId: generated.pairId, day: session.day, slot: session.slot, catalogId: entry.id, catalogFingerprint: entry.fingerprint }
    }
  }
  return null
}
