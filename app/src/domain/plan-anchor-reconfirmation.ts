import type { PlanCandidate } from "@impl/plan-generator/types"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { loadAthleteRecords } from "./athlete-records"
import { readEligibleAccountPaceRecords } from "./account/eligible-account-pace-records"
import { localAccountScopeSnapshot } from "./account/local-account-scope"
import { deriveRecordCurrentness, toCurrentSnapshot, toSelectedGoalSnapshot } from "./pace-target-evidence"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"

type AnchoredSessions = readonly Pick<PlanCandidate["sessions"][number], "prescription">[]

export function planSessionsNeedRecordGuard(sessions: AnchoredSessions): boolean {
  return sessions.some(session => session.prescription.kind === "PACE_TARGET"
    || session.prescription.kind === "RPE_TIME_RANGE" && session.prescription.catalogWorkout
    && (session.prescription.catalogWorkout.inputs.paceReferences?.length
      || session.prescription.catalogWorkout.inputs.fiveK
        && resolveCatalogBinding(session.prescription.catalogWorkout)?.steps.some(step => step.referenceRecordId)))
}

/** Reconfirm the chosen source, never recalculate a saved prescription from a newer record. */
export function planAnchorsStillCurrent(candidate: PlanCandidate, evaluatedAt: Date): boolean {
  return planSessionAnchorsStillCurrent(candidate.sessions, evaluatedAt)
}

/** The same evidence recheck is required for saved-plan edits, not only new candidates. */
export function planSessionAnchorsStillCurrent(sessions: AnchoredSessions, evaluatedAt: Date): boolean {
  const detailed = sessions.flatMap(session => session.prescription.kind === "PACE_TARGET" ? [session.prescription] : [])
  const catalogRecords = sessions.flatMap(s => {
    if (s.prescription.kind !== "RPE_TIME_RANGE" || !s.prescription.catalogWorkout?.inputs.fiveK) return []
    const calculated = resolveCatalogBinding(s.prescription.catalogWorkout)
    return calculated?.steps.some(step => step.referenceRecordId) ? [s.prescription.catalogWorkout.inputs.fiveK] : []
  })
  if (detailed.length === 0 && catalogRecords.length === 0 && !sessions.some(s => s.prescription.kind === "RPE_TIME_RANGE"
    && s.prescription.catalogWorkout?.inputs.paceReferences?.length)) return true
  const records = readEligibleAccountPaceRecords(localAccountScopeSnapshot() === null ? loadAthleteRecords(evaluatedAt) : [])
  const references = sessions.flatMap(s => s.prescription.kind === "RPE_TIME_RANGE"
    ? s.prescription.catalogWorkout?.inputs.paceReferences ?? [] : [])
  if (!references.every(ref => records.filter(r => r.id === ref.recordId).length === 1
    && records.some(r => r.id === ref.recordId && r.savedAt === ref.recordVersion
      && (r.eventDistanceM === 21097 ? 21097.5 : r.eventDistanceM) === ref.eventDistanceM
      && r.performanceSeconds === ref.performanceSeconds && r.achievedOn === ref.achievedOn
      && (r.purpose === "RACE_GOAL" ? "GOAL" : "ACTUAL") === ref.kind && r.verificationState !== "UNVERIFIED"))) return false
  if (!catalogRecords.every(old => records.some(record => record.id === old.recordId && record.purpose !== "RACE_GOAL"
    && record.eventDistanceM === 5000 && record.performanceSeconds === old.seconds && record.achievedOn === old.achievedAt
    && record.verificationState !== "UNVERIFIED" && deriveRecordCurrentness(record, evaluatedAt) === "CURRENT"))) return false
  return detailed.every(prescription => {
    const previous = prescription.selectedAnchor
    const matches = records.filter(record => record.id === previous.anchorId)
    const record = matches.length === 1 ? matches[0] : undefined
    if (record === undefined) return false
    if (previous.kind === "GOAL") {
      if (record.purpose !== "RACE_GOAL" || record.verificationState === "UNVERIFIED") return false
      const current = toSelectedGoalSnapshot(record, evaluatedAt)
      // Calendar changes do not rewrite accepted goals; the action's preview date is guarded separately.
      const { evaluatedOn: _previousDay, timeZone: _previousZone, ...previousSelection } = previous.selectionEvidence
      const { evaluatedOn: _currentDay, timeZone: _currentZone, ...currentSelection } = current.selectionEvidence
      return canonicalJsonFingerprint("goal-anchor-v1", { ...previous, selectionEvidence: previousSelection })
        === canonicalJsonFingerprint("goal-anchor-v1", { ...current, selectionEvidence: currentSelection })
    }
    if (record.purpose === "RACE_GOAL") return false
    const current = toCurrentSnapshot(record, deriveRecordCurrentness(record, evaluatedAt), evaluatedAt)
    if (current === null) return false
    // Elapsed copy can change with the calendar while the confirmed facts stay identical.
    const { elapsedLabel: _previousElapsed, ...previousFacts } = previous
    const { elapsedLabel: _currentElapsed, ...currentFacts } = current
    return canonicalJsonFingerprint("anchor-facts-v1", previousFacts)
      === canonicalJsonFingerprint("anchor-facts-v1", currentFacts)
  })
}
