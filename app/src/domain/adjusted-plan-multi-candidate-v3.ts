import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { prepareAdjustedPlanCandidateV3 } from "./adjusted-plan-candidate"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { prepareRpeAdjustedSlotV3, type RpeAdjustedSlotInputV3, type ReviewedRpeSourceBindingV3 } from "./rpe-adjusted-slot-v3"

export type AdjustedSlotPreparationV3 = Parameters<typeof prepareAdjustedPlanCandidateV3>[0]
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-adjusted-plan-candidate.v3", value)
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
const addressKey = (address: { day: number; slot: string }) => `${address.day}:${address.slot}`

/** Independently checked slots, not collective plan approval or storage authority. */
export function prepareMultiAdjustedPlanCandidateV3(inputs: readonly (AdjustedSlotPreparationV3 | RpeAdjustedSlotInputV3)[],
  rpeBindings: readonly ReviewedRpeSourceBindingV3[] = []) {
  try {
    if (!hasCanonicalJsonTree(inputs) || !Array.isArray(inputs) || inputs.length === 0) {
      return unavailable("INVALID_MULTI_ADJUSTMENT_INPUT")
    }
    const prepared = inputs.map(input => "experienceBand" in input
      ? prepareRpeAdjustedSlotV3(input, rpeBindings) : prepareAdjustedPlanCandidateV3(input))
    const failed = prepared.find(result => result.kind !== "prepared")
    if (failed) return failed
    const candidates = prepared.map(result => {
      if (result.kind !== "prepared") throw Error("Unvalidated slot")
      return result.candidate
    })
    const first = candidates[0]!
    if (candidates.some(candidate => candidate.originalContentFingerprint !== first.originalContentFingerprint
      || candidate.originalCandidateId !== first.originalCandidateId || candidate.startDate !== first.startDate)) {
      return unavailable("MULTI_ADJUSTMENT_ORIGINAL_MISMATCH")
    }
    const keys = candidates.map(candidate => addressKey(candidate.changedSlot))
    if (new Set(keys).size !== keys.length) return unavailable("DUPLICATE_ADJUSTED_SLOT")
    const ordered = candidates.map((candidate, i) => ({ candidate, explanation: inputs[i]!.explanation }))
      .sort((a, b) => a.candidate.changedSlot.day - b.candidate.changedSlot.day
        || a.candidate.changedSlot.slot.localeCompare(b.candidate.changedSlot.slot))
    const changedSlots = ordered.map(({ candidate, explanation }) => ({ ...candidate.changedSlot, explanation,
      ...("rpeBinding" in candidate ? { rpeBinding: candidate.rpeBinding } : {}) }))
    const replacements = new Map(ordered.map(({ candidate }) => [addressKey(candidate.changedSlot),
      candidate.sessions.find(session => addressKey(session) === addressKey(candidate.changedSlot))!]))
    const content = {
      kind: "MULTI_ADJUSTED_PLAN_CANDIDATE" as const, schemaVersion: 3 as const,
      activationState: "NOT_ACCEPTED" as const, selectionAuthority: "NONE" as const,
      originalCandidateId: first.originalCandidateId, originalContentFingerprint: first.originalContentFingerprint,
      candidateKind: first.candidateKind, eventDistanceM: first.eventDistanceM,
      selectedEnergyIntent: first.selectedEnergyIntent, sourceMode: first.sourceMode,
      startDate: first.startDate, frame: first.frame, continuityContext: first.continuityContext,
      changedSlots, sessions: first.sessions.map(session => replacements.get(addressKey(session)) ?? session),
      requiredNextGate: "MULTI_FULL_PLAN_SELECTION_REVALIDATION" as const,
    }
    return { kind: "prepared" as const, candidate: structuredClone({ ...content, contentFingerprint: hash(content) }) }
  } catch { return unavailable("INVALID_MULTI_ADJUSTMENT_INPUT") }
}
