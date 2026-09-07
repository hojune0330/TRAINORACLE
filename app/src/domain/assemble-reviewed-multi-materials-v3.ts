import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { AdjustmentReceiptV3 } from "@impl/prescription/prescription-adjustment-v3"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { resolveQualityCandidateScope } from "./adjusted-plan-candidate"
import { createAdjustedMethodSnapshotV3, type ReviewedAdjustedExplanationV3 } from "./adjusted-method-snapshot-v3"
import { prepareSourceAdjustmentOfferV3 } from "./source-adjustment-offer"
import { prepareUnanchoredAdjustmentOfferV3 } from "./unanchored-adjustment-offer-v3"
import { checkMultiAdjustedPlanReviewV3, type MultiAdjustedPreparationV3 } from "./adjusted-plan-multi-review-v3"
import type { MultiAdjustedLiveReviewV3 } from "./adjusted-plan-storage-v6"
import type { AddressedAdjustmentV3 } from "./stage-multi-adjustment-v3"

type Preparation = MultiAdjustedPreparationV3[number]
type SourceSlot<T> = T extends Preparation ? Omit<T, "candidate" | "startDate" | "rawSnapshot" | "explanation"> & {
  readonly initialReceipt: AdjustmentReceiptV3;
  readonly explanations: readonly ReviewedAdjustedExplanationV3[];
} : never
export type ReviewedMultiSourceSlotV3 = SourceSlot<Preparation>
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-materials.v3", value)
const key = (a: { day: number; slot: string }) => `${a.day}:${a.slot}`
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })

/** Rebuilds current snapshots from independent sources, never from stored plan explanations. */
export function assembleReviewedMultiMaterialsV3(input: {
  readonly candidate: Preparation["candidate"];
  readonly startDate: string;
  readonly experienceBand: "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED";
  readonly slots: readonly ReviewedMultiSourceSlotV3[];
  readonly changes: readonly AddressedAdjustmentV3[];
  readonly rpeBindings: MultiAdjustedLiveReviewV3["rpeBindings"];
  readonly policies: MultiAdjustedLiveReviewV3["policies"];
  readonly retained: MultiAdjustedLiveReviewV3["retained"];
}, at = new Date()) {
  try {
    if (!hasCanonicalJsonTree(input) || !Number.isFinite(at.getTime()) || !input.slots.length) return unavailable("INVALID_MULTI_MATERIALS")
    const addresses = input.slots.map(s => key(s.address)), changes = input.changes.map(c => key(c.address))
    if (new Set(addresses).size !== addresses.length || new Set(changes).size !== changes.length
      || changes.some(address => !addresses.includes(address))) return unavailable("INVALID_MULTI_MATERIAL_ADDRESS")
    const preparations: Preparation[] = []
    for (const slot of input.slots) {
      const scope = resolveQualityCandidateScope(input.candidate, slot.address, input.startDate)
      if (!scope) return unavailable("ORIGINAL_CANDIDATE_OR_SLOT_UNAVAILABLE")
      const receipt = input.changes.find(c => key(c.address) === key(slot.address))?.receipt ?? slot.initialReceipt
      const explanations = slot.explanations.filter(e => hash(e.configuration) === hash(receipt.after.configuration))
      if (explanations.length !== 1) return unavailable("EXACT_CONFIGURATION_EXPLANATION_REQUIRED")
      const explanation = explanations[0]!
      const offer = "experienceBand" in slot
        ? prepareUnanchoredAdjustmentOfferV3({ ...slot.source, nowMs: at.getTime() })
        : prepareSourceAdjustmentOfferV3({ ...slot.source, nowMs: at.getTime() })
      if (offer.kind !== "available") return unavailable(offer.code)
      const snapshot = createAdjustedMethodSnapshotV3({ authority: offer.authority, current: offer.current,
        contextKey: offer.contextKey, nowMs: at.getTime(), receipt, scope, explanation })
      if (snapshot.kind !== "prepared") return unavailable(snapshot.code)
      const common = { candidate: input.candidate, address: slot.address, startDate: input.startDate,
        explanation, rawSnapshot: JSON.stringify(snapshot.snapshot) }
      preparations.push("experienceBand" in slot
        ? { ...common, source: { ...slot.source, nowMs: at.getTime() }, experienceBand: slot.experienceBand }
        : { ...common, source: { ...slot.source, nowMs: at.getTime() } })
    }
    const checked = checkMultiAdjustedPlanReviewV3(preparations, input.experienceBand, input.rpeBindings, input.policies)
    if (checked.kind !== "reviewed_scope") return unavailable(checked.code)
    const currentEvidence = { slots: preparations.map(p => ({ address: p.address, authority: p.source.authority, explanation: p.explanation })),
      rpeBindings: input.rpeBindings, policies: input.policies }
    const retained = [...input.retained, currentEvidence].filter((entry, index, all) =>
      all.findIndex(other => hash(other) === hash(entry)) === index)
    const review: MultiAdjustedLiveReviewV3 = { preparations, rpeBindings: input.rpeBindings, policies: input.policies, retained }
    return { kind: "prepared" as const, executionAuthority: "NONE" as const, review: structuredClone(review) }
  } catch { return unavailable("INVALID_MULTI_MATERIALS") }
}
