import { canonicalJsonFingerprint, deriveCandidateId } from "@impl/plan-generator/candidate-identity"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { plannedSessionLinkSchema, resolveCurrentPlannedSession } from "./planned-session-link"

const fingerprint = (value: unknown) => canonicalJsonFingerprint("trainoracle.execution-replan.v1", value)

function sameCycleChange(before: PlanBetaStateV3, after: PlanBetaStateV3) {
  const receipt = after.executionReplan ?? after.catalogReplacement
  if (!receipt || before.activePlan.selectionActor !== "SELF" || after.activePlan.selectionActor !== "SELF"
    || receipt.baseStateFingerprint !== fingerprint(before) || receipt.baseCandidateId !== before.activePlan.candidateId
    || fingerprint(receipt.baseSessions) !== fingerprint(before.activePlan.sessions)) return false
  const previousChangeAt = (before.executionReplan ?? before.catalogReplacement)?.acceptedAt ?? before.generatedAt
  if (Date.parse(receipt.acceptedAt) < Date.parse(previousChangeAt)) return false
  // Progress may advance after a change; immutable cycle context must not.
  const context = (state: PlanBetaStateV3) => {
    const { progress: _progress, explanationReceipt: _explanation, executionReplan: _replan,
      catalogReplacement: _replacement, activePlan, ...rest } = state
    const { candidateId: _id, sessions: _sessions, ...plan } = activePlan
    return { ...rest, plan }
  }
  if (fingerprint(context(before)) !== fingerprint(context(after))) return false
  const p = after.activePlan
  if (!("formationKind" in p.frame)) return false
  return p.candidateId === deriveCandidateId(before.activePlan.candidateId, {
    kind: p.candidateKind, eventDistanceM: p.eventDistanceM, selectedDetailedTemplateRef: p.selectedDetailedTemplateRef,
    selectedEnergyIntent: p.selectedEnergyIntent, sourceMode: p.sourceMode, selectionAuthority: "SELF",
    frame: p.frame, sessions: p.sessions,
  })
}

/** Exact original lookup through retained, replay-validated changes in this cycle only. */
export function resolveExecutionReplanSource(currentValue: unknown, linkValue: unknown, archivedPlans: readonly unknown[] = []) {
  const parsed = planBetaStateV3Schema.safeParse(currentValue), link = plannedSessionLinkSchema.safeParse(linkValue)
  if (!parsed.success || !link.success) return null
  const current = parsed.data
  const linkedAt = Date.parse(link.data.linkedAt)
  const linkedAfterActivation = (state: PlanBetaStateV3) => {
    const change = state.executionReplan ?? state.catalogReplacement
    // Content IDs can recur after A -> B -> A. An older link is not a new-version link.
    return change ? linkedAt > Date.parse(change.acceptedAt) : linkedAt >= Date.parse(state.generatedAt)
  }
  const direct = resolveCurrentPlannedSession(current, link.data)
  if (direct && linkedAfterActivation(current)) return { kind: "matched" as const, state: current, session: direct, source: "ACTIVE" as const }
  const occurrence = current.activePlan.sessions.find(s => s.day === link.data.sessionDay && s.slot === link.data.sessionSlot)
  if (!occurrence) return null
  const retained = new Map<string, PlanBetaStateV3>()
  for (const value of archivedPlans) {
    const state = planBetaStateV3Schema.safeParse(value)
    if (state.success) retained.set(fingerprint(state.data), state.data)
  }
  let cursor = current
  const visited = new Set<string>()
  while (true) {
    const receipt = cursor.executionReplan ?? cursor.catalogReplacement
    if (!receipt || visited.has(receipt.baseStateFingerprint)) return null
    visited.add(receipt.baseStateFingerprint)
    const previous = retained.get(receipt.baseStateFingerprint)
    if (!previous || !sameCycleChange(previous, cursor)) return null
    const previousSession = previous.activePlan.sessions.find(s => s.day === link.data.sessionDay && s.slot === link.data.sessionSlot)
    if (!previousSession || fingerprint(previousSession) !== fingerprint(occurrence)) return null
    const original = resolveCurrentPlannedSession(previous, link.data)
    if (original && linkedAfterActivation(previous)) return { kind: "matched" as const, state: previous, session: original, source: "ARCHIVED" as const }
    cursor = previous
  }
}
