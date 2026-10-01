import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { createAdjustmentDraft, applyAdjustmentDraft, type AdjustmentReceipt } from "@impl/prescription/prescription-adjustment"
import { createAdjustmentDraftV3, applyAdjustmentDraftV3, type AdjustmentReceiptV3 } from "@impl/prescription/prescription-adjustment-v3"
import { prepareSourceAdjustmentOffer, prepareSourceAdjustmentOfferV3 } from "./source-adjustment-offer"
import { prepareUnanchoredAdjustmentOfferV3 } from "./unanchored-adjustment-offer-v3"
import { createAdjustedMethodSnapshot } from "./adjusted-method-snapshot"
import { createAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { prepareAdjustedPlanCandidate, prepareAdjustedPlanCandidateV3, resolveAdjustedCandidateScope } from "./adjusted-plan-candidate"
import { stageMultiAdjustmentV3, type AddressedAdjustmentV3 } from "./stage-multi-adjustment-v3"
import type { prepareAdjustedCycleSuccessor } from "./adjusted-cycle-successor"
import type { AdjustedPlanSelectionRequest } from "./adjusted-plan-selection"
import type { AdjustedPlanSelectionRequestV3 } from "./selected-adjusted-plan-v3"
import type { MultiAdjustedPlanSelectionRequestV3 } from "./selected-multi-adjusted-plan-v3"
import type { saveSelectedAdjustedPlan } from "./adjusted-plan-store"
import type { AdjustedPlanLiveReviewV3 } from "./adjusted-plan-storage-v5"
import type { MultiAdjustedLiveReviewV3 } from "./adjusted-plan-storage-v6"

type Prepared = Extract<ReturnType<typeof prepareAdjustedCycleSuccessor>, { kind: "prepared" }>
const reject = (code: string) => ({ kind: "rejected" as const, code })
const same = (a: unknown, b: unknown) => canonicalJsonFingerprint("adjusted-cycle-rebind-v1", a)
  === canonicalJsonFingerprint("adjusted-cycle-rebind-v1", b)
const atAddress = (a: { day: number; slot: string }, b: { day: number; slot: string }) => a.day === b.day && a.slot === b.slot

/** Reissue a current reviewed receipt for the exact selected AFTER configuration.
 * Historical authority/receipts are never reused as permission on new dates. */
export function rebindAdjustedCycleRequest(prepared: Prepared, seed: AdjustedPlanSelectionRequest,
  readReview: (receipt: AdjustmentReceipt) => ReturnType<Parameters<typeof saveSelectedAdjustedPlan>[0]["readReview"]>, at = new Date()) {
  try {
    const row = prepared.rows.find(r => r.source.prescription.kind === "ADJUSTED_METHOD")
    if (!row || row.source.prescription.kind !== "ADJUSTED_METHOD" || !atAddress(row.target, seed.preparation.address))
      return reject("ADJUSTED_SUCCESSOR_SLOT_MISMATCH")
    const source = { ...seed.preparation.source, nowMs: at.getTime() }, offer = prepareSourceAdjustmentOffer(source)
    if (offer.kind !== "available") return reject(offer.code)
    const target = row.source.prescription.snapshot.receipt.after.configuration
    if (!offer.targets.some(t => same(t, target))) return reject("EXACT_ADJUSTED_CONFIGURATION_UNAVAILABLE")
    const draft = createAdjustmentDraft({ authority: offer.authority, policy: offer.policy, current: offer.current,
      target, contextKey: offer.contextKey, nowMs: at.getTime() })
    if (draft.kind !== "draft") return reject(draft.code)
    const applied = applyAdjustmentDraft({ authority: offer.authority, draft: draft.draft, current: offer.current,
      contextKey: offer.contextKey, nowMs: at.getTime(), action: "USER_EXPLICIT" })
    if (applied.kind !== "applied") return reject(applied.code)
    const review = readReview(applied.receipt), p = seed.preparation
    const scope = resolveAdjustedCandidateScope(p.candidate, p.address, p.startDate)
    const original = p.candidate.sessions.find(s => atAddress(s, p.address))?.prescription
    if (!scope || !original) return reject("ORIGINAL_CANDIDATE_OR_SLOT_UNAVAILABLE")
    const snapshot = createAdjustedMethodSnapshot({ original, source: { ...review.source, nowMs: at.getTime() },
      scope, receipt: applied.receipt, explanation: review.explanation })
    if (snapshot.kind !== "prepared") return reject(snapshot.code)
    const preparation = { ...p, rawSnapshot: JSON.stringify(snapshot.snapshot),
      source: { ...review.source, nowMs: at.getTime() }, explanation: review.explanation }
    const candidate = prepareAdjustedPlanCandidate(preparation)
    if (candidate.kind !== "prepared") return reject(candidate.code)
    return { kind: "rebound" as const, request: { ...seed, preparation,
      expectedCandidateFingerprint: candidate.candidate.contentFingerprint }, receipt: applied.receipt }
  } catch { return reject("ADJUSTED_CYCLE_REBIND_UNAVAILABLE") }
}

export function rebindAdjustedCycleRequestV3(prepared: Prepared, seed: AdjustedPlanSelectionRequestV3,
  readReview: (receipt: AdjustmentReceiptV3) => AdjustedPlanLiveReviewV3, at = new Date()) {
  try {
    const row = prepared.rows.find(r => r.source.prescription.kind === "ADJUSTED_METHOD_V3")
    if (!row || row.source.prescription.kind !== "ADJUSTED_METHOD_V3" || !atAddress(row.target, seed.preparation.address))
      return reject("ADJUSTED_SUCCESSOR_SLOT_MISMATCH")
    const offer = prepareSourceAdjustmentOfferV3({ ...seed.preparation.source, nowMs: at.getTime() })
    if (offer.kind !== "available") return reject(offer.code)
    const target = row.source.prescription.snapshot.receipt.after.configuration
    if (!offer.targets.some(t => same(t, target))) return reject("EXACT_ADJUSTED_CONFIGURATION_UNAVAILABLE")
    const draft = createAdjustmentDraftV3({ authority: offer.authority, policy: offer.policy, current: offer.current,
      target, contextKey: offer.contextKey, nowMs: at.getTime() })
    if (draft.kind !== "draft") return reject(draft.code)
    const applied = applyAdjustmentDraftV3({ authority: offer.authority, draft: draft.draft, current: offer.current,
      contextKey: offer.contextKey, nowMs: at.getTime(), action: "USER_EXPLICIT" })
    if (applied.kind !== "applied") return reject(applied.code)
    const review = readReview(applied.receipt), p = seed.preparation
    const scope = resolveAdjustedCandidateScope(p.candidate, p.address, p.startDate)
    if (!scope) return reject("ORIGINAL_CANDIDATE_OR_SLOT_UNAVAILABLE")
    const snapshot = createAdjustedMethodSnapshotV3({ authority: offer.authority, current: offer.current,
      contextKey: offer.contextKey, nowMs: at.getTime(), receipt: applied.receipt, scope, explanation: review.explanation })
    if (snapshot.kind !== "prepared") return reject(snapshot.code)
    const preparation = { ...p, rawSnapshot: JSON.stringify(snapshot.snapshot),
      source: { ...review.source, nowMs: at.getTime() }, explanation: review.explanation }
    const candidate = prepareAdjustedPlanCandidateV3(preparation)
    if (candidate.kind !== "prepared") return reject(candidate.code)
    return { kind: "rebound" as const, request: { ...seed, preparation,
      expectedCandidateFingerprint: candidate.candidate.contentFingerprint }, receipt: applied.receipt }
  } catch { return reject("ADJUSTED_CYCLE_REBIND_UNAVAILABLE") }
}

export function rebindMultiAdjustedCycleRequestV3(prepared: Prepared, seed: MultiAdjustedPlanSelectionRequestV3,
  readReviewForEdits: (request: MultiAdjustedPlanSelectionRequestV3, changes: readonly AddressedAdjustmentV3[]) => MultiAdjustedLiveReviewV3,
  at = new Date()) {
  try {
    let request = structuredClone(seed)
    const changes: AddressedAdjustmentV3[] = []
    const adjusted = prepared.rows.filter(r => r.source.prescription.kind === "ADJUSTED_METHOD_V3")
    if (adjusted.length !== seed.preparations.length) return reject("ADJUSTED_SUCCESSOR_SLOT_MISMATCH")
    for (const row of adjusted) {
      if (row.source.prescription.kind !== "ADJUSTED_METHOD_V3") return reject("ADJUSTED_SUCCESSOR_SLOT_MISMATCH")
      const p = request.preparations.find(p => atAddress(p.address, row.target))
      if (!p) return reject("ADJUSTED_SUCCESSOR_SLOT_MISMATCH")
      const offer = "experienceBand" in p ? prepareUnanchoredAdjustmentOfferV3({ ...p.source, nowMs: at.getTime() })
        : prepareSourceAdjustmentOfferV3({ ...p.source, nowMs: at.getTime() })
      if (offer.kind !== "available") return reject(offer.code)
      const target = row.source.prescription.snapshot.receipt.after.configuration
      if (!offer.targets.some(t => same(t, target))) return reject("EXACT_ADJUSTED_CONFIGURATION_UNAVAILABLE")
      const draft = createAdjustmentDraftV3({ authority: offer.authority, policy: offer.policy, current: offer.current,
        target, contextKey: offer.contextKey, nowMs: at.getTime() })
      if (draft.kind !== "draft") return reject(draft.code)
      const applied = applyAdjustmentDraftV3({ authority: offer.authority, draft: draft.draft, current: offer.current,
        contextKey: offer.contextKey, nowMs: at.getTime(), action: "USER_EXPLICIT" })
      if (applied.kind !== "applied") return reject(applied.code)
      const change = { address: row.target, receipt: applied.receipt }
      changes.push(change)
      const staged = stageMultiAdjustmentV3(request, change, applied.prescription, readReviewForEdits(request, changes), at)
      if (staged.kind !== "staged") return staged
      request = staged.request
    }
    return { kind: "rebound" as const, request, changes }
  } catch { return reject("ADJUSTED_CYCLE_REBIND_UNAVAILABLE") }
}
