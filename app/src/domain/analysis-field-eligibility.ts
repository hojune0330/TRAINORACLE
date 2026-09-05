import type { StructuredJournalObservation } from "./journal-observation"
import { parseDistanceKm, parseDurationMin } from "./numeric-input"
import { ENERGY_SYSTEM_KEYS } from "./energy-system-taxonomy"

/** Attestations are projected from parsed local fields, never provider payloads. */
export function acceptsExplicitField(observation: StructuredJournalObservation, field: "system" | "distanceKm" | "durationMin" | "rpe"): boolean {
  if (observation.sourceRef.sourceId.trim() === ""
    || observation.sourceRef.sourceKind !== "SESSION_RESULT_RECORD"
    || observation.fieldProvenance[field] !== "EXPLICIT") return false
  if (field === "system" && !ENERGY_SYSTEM_KEYS.some(key => key === observation.energySystem)) return false
  if (field === "distanceKm" && parseDistanceKm(String(observation.distanceKm)) === null) return false
  if (field === "durationMin" && parseDurationMin(String(observation.durationMin)) === null) return false
  if (field === "rpe" && (observation.rpe === null || !Number.isInteger(observation.rpe) || observation.rpe < 1 || observation.rpe > 10)) return false
  const trust = observation.sourceRef.trustState
  return trust === "ACCEPTED"
    || (trust === "SOURCE_NOT_VERIFIED" && observation.acceptedExplicitFields?.includes(field) === true)
}
