import type { PlanCandidate } from "@impl/plan-generator/types"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { loadAthleteRecords } from "./athlete-records"
import { deriveRecordCurrentness, toCurrentSnapshot } from "./pace-target-evidence"

/** Reconfirm the chosen source, never recalculate a saved prescription from a newer record. */
export function planAnchorsStillCurrent(candidate: PlanCandidate, evaluatedAt: Date): boolean {
  const detailed = candidate.sessions.flatMap(session => session.prescription.kind === "PACE_TARGET" ? [session.prescription] : [])
  if (detailed.length === 0) return true
  const records = loadAthleteRecords(evaluatedAt)
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
