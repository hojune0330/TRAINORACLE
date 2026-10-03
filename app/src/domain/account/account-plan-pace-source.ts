import type { AccountPlanPacket } from "./account-plan-document-schema"
import type { AccountPlanPaceRecordGuard } from "./account-plan-collection-transfer"
import { readAccountAthleteRecordsState } from "./account-athlete-record-service"
import { localAccountScopeIsCurrent } from "./local-account-scope"
import { planSessionAnchorsStillCurrent, planSessionsNeedRecordGuard } from "../plan-anchor-reconfirmation"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { areCatalogPaceSourcesCurrent } from "./eligible-account-pace-records"
import { deriveRecordCurrentness } from "../pace-target-evidence"

export type AccountPlanPaceSource = { kind: "none" } | { kind: "unavailable" }
  | { kind: "ready"; guard: AccountPlanPaceRecordGuard }

const sameFacts = (left: unknown, right: unknown) => canonicalJsonFingerprint("pace-source-facts-v1", left)
  === canonicalJsonFingerprint("pace-source-facts-v1", right)
const anchorFacts = (anchor: { elapsedLabel?: string }) => {
  const { elapsedLabel: _elapsed, ...facts } = anchor
  return facts
}

/** PACE_REFERENCE retains its receipt protocol; other edits guard only new uses at each slot. */
export function captureAccountPlanPaceSource(packet: AccountPlanPacket, ownerId: string | null): AccountPlanPaceSource {
  const state = packet.state
  if (state.version === 2 || state.version === 3 && state.activePlanEdit?.action === "PACE_REFERENCE") return { kind: "none" }
  const edit = state.version === 3 ? state.activePlanEdit ?? state.catalogReplacement ?? state.executionReplan : undefined
  const sessions = state.version === 3 ? state.activePlan.sessions : state.selection.activePlan.sessions
  const anchored = sessions.flatMap(session => {
    const prescription = session.prescription
    if (prescription.kind !== "PACE_TARGET" && prescription.kind !== "RPE_TIME_RANGE") return []
    if (!edit) return [{ prescription }]
    const old = edit.baseSessions.find(value => value.day === session.day && value.slot === session.slot)?.prescription
    if (prescription.kind === "PACE_TARGET") return old?.kind === "PACE_TARGET"
      && sameFacts(anchorFacts(old.selectedAnchor), anchorFacts(prescription.selectedAnchor)) ? [] : [{ prescription }]
    const binding = prescription.catalogWorkout
    if (!binding) return []
    const previous = old?.kind === "RPE_TIME_RANGE" ? old.catalogWorkout?.inputs : undefined
    const remaining = [...previous?.paceReferences ?? []]
    const paceReferences = binding.inputs.paceReferences?.filter(reference => {
      const index = remaining.findIndex(value => sameFacts(value, reference))
      if (index < 0) return true
      remaining.splice(index, 1)
      return false
    })
    const fiveK = binding.inputs.fiveK && !sameFacts(binding.inputs.fiveK, previous?.fiveK ?? null) ? binding.inputs.fiveK : null
    if (!fiveK && !paceReferences?.length) return []
    return [{ prescription: { ...prescription, catalogWorkout: { ...binding,
      inputs: { ...binding.inputs, fiveK, paceReferences } } } }]
  })
  if (!planSessionsNeedRecordGuard(anchored) && !anchored.some(s => s.prescription.kind === "RPE_TIME_RANGE"
    && s.prescription.catalogWorkout?.inputs.fiveK)) return { kind: "none" }
  const source = readAccountAthleteRecordsState()
  const now = new Date()
  if (!ownerId || !localAccountScopeIsCurrent(ownerId) || source.ownerId !== ownerId || source.status !== "READY"
    || !source.confirmed || !source.documentId || source.serverRevision === null || source.serverRevision <= 0
    || !planSessionAnchorsStillCurrent(anchored.filter(s => s.prescription.kind === "PACE_TARGET"), now)
    || !anchored.every(s => {
      const inputs = s.prescription.kind === "RPE_TIME_RANGE" ? s.prescription.catalogWorkout?.inputs : undefined
      if (!inputs) return true
      return areCatalogPaceSourcesCurrent(inputs) && (!inputs.fiveK || source.records.some(record =>
        record.id === inputs.fiveK!.recordId && deriveRecordCurrentness(record, now) === "CURRENT"))
    })) return { kind: "unavailable" }
  return { kind: "ready", guard: { documentId: source.documentId, revision: source.serverRevision } }
}

export function accountPlanPaceSourceStillCurrent(packet: AccountPlanPacket, ownerId: string | null, captured: AccountPlanPaceSource): boolean {
  const current = captureAccountPlanPaceSource(packet, ownerId)
  return captured.kind === "none" ? current.kind === "none"
    : captured.kind === "ready" && current.kind === "ready"
      && captured.guard.documentId === current.guard.documentId && captured.guard.revision === current.guard.revision
}
