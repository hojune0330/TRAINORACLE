import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { prepareAdjustedOriginalSelection, type AdjustedPlanSelectionRequest } from "./adjusted-plan-selection"
import type { prepareAdjustedPlanCandidateV3 } from "./adjusted-plan-candidate"
import { checkAdjustedPlanReviewPolicyV3, REVIEWED_ADJUSTED_PLAN_POLICIES_V3, type ReviewedAdjustedPlanPolicyV3 } from "./adjusted-plan-review-v3"
import type { AdjustedPlanContinuation } from "./selected-adjusted-plan-content"
import { prepareAdjustedNextFrameV3 } from "./adjusted-plan-continuity"
import { readStoredAdjustedPlanStateV5 } from "./adjusted-plan-storage-v5-schema"
import { assembleAdjustedPlanSelectionV3 as assemble, type RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-content-v3"
export { readSelectedAdjustedPlanV3 } from "./selected-adjusted-plan-content-v3"
export type { SelectedAdjustedPlanStateV3, RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-content-v3"
export type AdjustedPlanSelectionRequestV3 = Omit<AdjustedPlanSelectionRequest, "preparation"> & { readonly preparation: Parameters<typeof prepareAdjustedPlanCandidateV3>[0] }
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-selection.v3", value)
const reject = (code: string) => ({ kind: "rejected" as const, code })

/** Call under the account/plan mutation lock, with current independently supplied authority. */
export function selectAdjustedPlanForActivationV3(request: AdjustedPlanSelectionRequestV3,
  policies: readonly ReviewedAdjustedPlanPolicyV3[] = REVIEWED_ADJUSTED_PLAN_POLICIES_V3, at = new Date()) {
  return selectAdjustedPlanV3(request, policies, at)
}

/** The predecessor is read from active storage by the mutation transaction, not accepted from a draft. */
export function selectAdjustedPlanSuccessorV3(request: AdjustedPlanSelectionRequestV3, previous: unknown,
  expectedPredecessorFingerprint: string, retained: readonly RetainedAdjustedPlanEvidenceV3[],
  policies: readonly ReviewedAdjustedPlanPolicyV3[], at = new Date()) {
  try {
    if (!hasCanonicalJsonTree(request)) return reject("INVALID_ADJUSTED_SELECTION")
    const before = readStoredAdjustedPlanStateV5(previous, retained, at)
    if (before.kind !== "loaded") return reject("INVALID_STORED_PLAN")
    const prepared = prepareAdjustedNextFrameV3({ previous: before.state,
      expectedFingerprint: expectedPredecessorFingerprint, nextStartDate: request.preparation.startDate,
      currentCheck: request.currentCheck }, retained, at)
    if (prepared.kind !== "prepared") return prepared
    if (before.state.selection.activePlan.eventDistanceM !== request.preparation.candidate.eventDistanceM) return reject("SUCCESSOR_EVENT_CHANGED")
    const expected = { kind: "PREVIOUS_FRAME_CONTEXT_RETAINED", ...prepared.context.continuity }
    if (hash(expected) !== hash(request.preparation.candidate.continuityContext)) return reject("SUCCESSOR_CONTINUITY_CHANGED")
    return selectAdjustedPlanV3(request, policies, at, {
      predecessorFingerprint: before.state.contentFingerprint,
      predecessorSelectionFingerprint: before.state.selection.contentFingerprint,
      previousPeriodization: before.state.selection.periodization,
    })
  } catch { return reject("INVALID_ADJUSTED_SELECTION") }
}

function selectAdjustedPlanV3(request: AdjustedPlanSelectionRequestV3,
  policies: readonly ReviewedAdjustedPlanPolicyV3[], at: Date, continuation?: AdjustedPlanContinuation) {
  try {
    const original = prepareAdjustedOriginalSelection(request, at)
    if (original.kind !== "original_selected") return original
    const input = structuredClone(request)
    const preparation = { ...input.preparation, source: { ...input.preparation.source, nowMs: at.getTime() } }
    const review = checkAdjustedPlanReviewPolicyV3(preparation, original.base.intake.experienceBand, policies)
    if (review.kind !== "reviewed_scope") return reject(review.code)
    if (review.candidate.contentFingerprint !== input.expectedCandidateFingerprint) return reject("ADJUSTED_SELECTION_CHANGED")
    if (preparation.candidate.continuityContext.kind !== "NO_PREVIOUS_FRAME_CONTEXT" && continuation === undefined) {
      return reject("ADJUSTED_SUCCESSOR_REQUIRES_CONTINUITY_TRANSACTION")
    }
    return assemble(original.base, preparation, review, at, continuation)
  } catch { return reject("INVALID_ADJUSTED_SELECTION") }
}
