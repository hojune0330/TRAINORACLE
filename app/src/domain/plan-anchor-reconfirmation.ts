import type { PlanCandidate } from "@impl/plan-generator/types"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { loadAthleteRecords } from "./athlete-records"
import { deriveRecordCurrentness, toCurrentSnapshot } from "./pace-target-evidence"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"

/** Reconfirm the chosen source, never recalculate a saved prescription from a newer record. */
export function planAnchorsStillCurrent(candidate: PlanCandidate, evaluatedAt: Date): boolean {
  const detailed = candidate.sessions.flatMap(session => session.prescription.kind === "PACE_TARGET" ? [session.prescription] : [])
  const catalogRecords = candidate.sessions.flatMap(s => {
    if (s.prescription.kind !== "RPE_TIME_RANGE" || !s.prescription.catalogWorkout?.inputs.fiveK) return []
    const calculated = resolveCatalogBinding(s.prescription.catalogWorkout)
    return calculated?.steps.some(step => step.referenceRecordId) ? [s.prescription.catalogWorkout.inputs.fiveK] : []
  })
  if (detailed.length === 0 && catalogRecords.length === 0) return true
  const records = loadAthleteRecords(evaluatedAt)
  if (!catalogRecords.every(old => records.some(record => record.id === old.recordId && record.purpose !== "RACE_GOAL"
    && record.eventDistanceM === 5000 && record.performanceSeconds === old.seconds && record.achievedOn === old.achievedAt
    && record.verificationState !== "UNVERIFIED" && deriveRecordCurrentness(record, evaluatedAt) === "CURRENT"))) return false
  return detailed.every(prescription => {
    const previous = prescription.selectedAnchor
    const matches = records.filter(record => record.id === previous.anchorId)
    const record = matches.length === 1 ? matches[0] : undefined
    if (record === undefined || record.purpose === "RACE_GOAL") return false
    const current = toCurrentSnapshot(record, deriveRecordCurrentness(record, evaluatedAt), evaluatedAt)
    if (current === null) return false
    // Elapsed copy can change with the calendar while the confirmed facts stay identical.
    const { elapsedLabel: _previousElapsed, ...previousFacts } = previous
    const { elapsedLabel: _currentElapsed, ...currentFacts } = current
    return canonicalJsonFingerprint("anchor-facts-v1", previousFacts)
      === canonicalJsonFingerprint("anchor-facts-v1", currentFacts)
  })
}
