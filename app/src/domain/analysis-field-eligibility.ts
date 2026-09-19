import type { StructuredJournalObservation } from "./journal-observation"
import { parseDistanceKm, parseDurationMin } from "./numeric-input"
import { ENERGY_SYSTEM_KEYS } from "./energy-system-taxonomy"
import { isProjectedFileObservation } from "./import/file-analysis"

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

/** FILE is not EXPLICIT. Only the current in-memory projection grants distance use. */
export function acceptsFileDistance(observation: StructuredJournalObservation): boolean {
  const file = observation.acceptedFileObservation
  return isProjectedFileObservation(file)
    && observation.sourceRef.sourceKind === "SESSION_RESULT_RECORD"
    && observation.sourceRef.sourceId === file.journalEntryId
    && observation.sourceRef.sourceVersion === file.contentRevisionFingerprint
    && (observation.sourceRef.trustState === "SOURCE_NOT_VERIFIED" || observation.sourceRef.trustState === "ACCEPTED")
    && observation.loggedOn === file.date
    && observation.fieldProvenance.distanceKm === "FILE"
    && observation.acceptedFileFields?.includes("distanceKm") === true
    && file.sport === "RUNNING"
    && file.distanceMeters !== null
    && observation.distanceKm === file.distanceMeters / 1000
}
