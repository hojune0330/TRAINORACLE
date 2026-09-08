import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { AdjustmentReceiptV3, PrescriptionSnapshotV3 } from "@impl/prescription/prescription-adjustment-v3"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import type { MultiAdjustedPlanSelectionRequestV3 } from "./selected-multi-adjusted-plan-v3"
import type { MultiAdjustedLiveReviewV3 } from "./adjusted-plan-storage-v6"
import { prepareSourceAdjustmentOfferV3 } from "./source-adjustment-offer"
import { prepareUnanchoredAdjustmentOfferV3 } from "./unanchored-adjustment-offer-v3"
import { resolveQualityCandidateScope } from "./adjusted-plan-candidate"
import { createAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { prepareMultiAdjustedPlanCandidateV3 } from "./adjusted-plan-multi-candidate-v3"

const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-adjustment-stage.v3", value)
const reject = (code: string) => ({ kind: "rejected" as const, code })
export type AddressedAdjustmentV3 = { readonly address: { readonly day: number; readonly slot: "AM" | "PM" }; readonly receipt: AdjustmentReceiptV3 }

/** Stages one editor result only. Does not write storage or change another slot. */
export function stageMultiAdjustmentV3(request: MultiAdjustedPlanSelectionRequestV3, change: AddressedAdjustmentV3,
  prescription: PrescriptionSnapshotV3, review: MultiAdjustedLiveReviewV3, at = new Date()) {
  try {
    if (!hasCanonicalJsonTree({ request, change, prescription, review }) || !Number.isFinite(at.getTime())) return reject("INVALID_MULTI_EDIT")
    const matches = request.preparations.filter(p => p.address.day === change.address.day && p.address.slot === change.address.slot)
    const reviewed = review.preparations.filter(p => p.address.day === change.address.day && p.address.slot === change.address.slot)
    if (matches.length !== 1 || reviewed.length !== 1) return reject("INVALID_MULTI_EDIT_ADDRESS")
    const original = matches[0]!, fresh = reviewed[0]!
    if (hash(original.candidate) !== hash(fresh.candidate) || original.startDate !== fresh.startDate
      || ("experienceBand" in original) !== ("experienceBand" in fresh)) return reject("MULTI_EDIT_ORIGIN_CHANGED")
    if (hash(change.receipt.after) !== hash(prescription)) return reject("EDITOR_PRESCRIPTION_MISMATCH")
    const scope = resolveQualityCandidateScope(original.candidate, original.address, original.startDate)
    if (!scope) return reject("ORIGINAL_CANDIDATE_OR_SLOT_UNAVAILABLE")
    const offer = "experienceBand" in fresh
      ? prepareUnanchoredAdjustmentOfferV3({ ...fresh.source, nowMs: at.getTime() })
      : prepareSourceAdjustmentOfferV3({ ...fresh.source, nowMs: at.getTime() })
    if (offer.kind !== "available") return reject(offer.code)
    const snapshot = createAdjustedMethodSnapshotV3({ authority: offer.authority, current: offer.current,
      contextKey: offer.contextKey, nowMs: at.getTime(), receipt: change.receipt, scope, explanation: fresh.explanation })
    if (snapshot.kind !== "prepared") return reject(snapshot.code)
    const replacement = "experienceBand" in fresh
      ? { ...fresh, rawSnapshot: JSON.stringify(snapshot.snapshot), source: { ...fresh.source, nowMs: at.getTime() } }
      : { ...fresh, rawSnapshot: JSON.stringify(snapshot.snapshot), source: { ...fresh.source, nowMs: at.getTime() } }
    const preparations = request.preparations.map(p => p === original ? replacement : p)
    const prepared = prepareMultiAdjustedPlanCandidateV3(preparations, review.rpeBindings)
    if (prepared.kind !== "prepared") return reject(prepared.code)
    return { kind: "staged" as const, storageState: "NOT_SAVED" as const,
      request: structuredClone({ ...request, preparations, expectedCandidateFingerprint: prepared.candidate.contentFingerprint }),
      candidate: prepared.candidate }
  } catch { return reject("INVALID_MULTI_EDIT") }
}
