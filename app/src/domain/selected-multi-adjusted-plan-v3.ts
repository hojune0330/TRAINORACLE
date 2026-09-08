import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { prepareAdjustedOriginalSelection, type AdjustedPlanSelectionRequest } from "./adjusted-plan-selection"
import { checkMultiAdjustedPlanReviewV3, type MultiAdjustedPreparationV3, type ReviewedMultiAdjustedPlanPolicyV3 } from "./adjusted-plan-multi-review-v3"
import type { ReviewedRpeSourceBindingV3 } from "./rpe-adjusted-slot-v3"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import type { AdjustedPlanContinuation } from "./selected-adjusted-plan-content"
import { prepareMultiAdjustedNextFrameV3 } from "./adjusted-plan-continuity"
import { readStoredMultiAdjustedPlanV6 } from "./adjusted-plan-storage-v6-schema"
import type { SessionAvailabilityLimitV3 } from "./prescription-availability-v3"
import { assembleMultiAdjustedPlanV3 as assemble, type RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-content-v3"
export { readSelectedMultiAdjustedPlanV3 } from "./selected-multi-adjusted-plan-content-v3"
export type { SelectedMultiAdjustedPlanV3, RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-content-v3"

export type MultiAdjustedPlanSelectionRequestV3 = Omit<AdjustedPlanSelectionRequest, "preparation"> & {
  readonly preparations: MultiAdjustedPreparationV3
  readonly availabilityLimits?: readonly SessionAvailabilityLimitV3[]
}
const reject = (code: string) => ({ kind: "rejected" as const, code })
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-plan-selection.v3", value)

/** Explicit selection only. The account transaction and version-aware read must precede storage. */
export function selectMultiAdjustedPlanV3(request: MultiAdjustedPlanSelectionRequestV3,
  rpeBindings: readonly ReviewedRpeSourceBindingV3[], policies: readonly ReviewedMultiAdjustedPlanPolicyV3[], at = new Date()) {
  return selectMulti(request, rpeBindings, policies, at)
}

export function selectMultiAdjustedPlanSuccessorV3(request: MultiAdjustedPlanSelectionRequestV3, previous: unknown,
  expectedPredecessorFingerprint: string, retained: readonly RetainedMultiAdjustedEvidenceV3[],
  rpeBindings: readonly ReviewedRpeSourceBindingV3[], policies: readonly ReviewedMultiAdjustedPlanPolicyV3[], at = new Date()) {
  try {
    if (!hasCanonicalJsonTree(request) || !request.preparations.length) return reject("INVALID_MULTI_SELECTION")
    const before = readStoredMultiAdjustedPlanV6(previous, retained, at)
    if (before.kind !== "loaded") return reject("INVALID_STORED_PLAN")
    const first = request.preparations[0]!
    const prepared = prepareMultiAdjustedNextFrameV3({ previous: before.state,
      expectedFingerprint: expectedPredecessorFingerprint, nextStartDate: first.startDate,
      currentCheck: request.currentCheck }, retained, at)
    if (prepared.kind !== "prepared") return prepared
    if (before.state.selection.activePlan.eventDistanceM !== first.candidate.eventDistanceM) return reject("SUCCESSOR_EVENT_CHANGED")
    const expected = { kind: "PREVIOUS_FRAME_CONTEXT_RETAINED", ...prepared.context.continuity }
    if (hash(expected) !== hash(first.candidate.continuityContext)) return reject("SUCCESSOR_CONTINUITY_CHANGED")
    return selectMulti(request, rpeBindings, policies, at, {
      predecessorFingerprint: before.state.contentFingerprint,
      predecessorSelectionFingerprint: before.state.selection.contentFingerprint,
      previousPeriodization: before.state.selection.periodization,
    })
  } catch { return reject("INVALID_MULTI_SELECTION") }
}

function selectMulti(request: MultiAdjustedPlanSelectionRequestV3,
  rpeBindings: readonly ReviewedRpeSourceBindingV3[], policies: readonly ReviewedMultiAdjustedPlanPolicyV3[], at: Date,
  continuation?: AdjustedPlanContinuation) {
  try {
    if (!hasCanonicalJsonTree(request) || !Number.isFinite(at.getTime()) || !Array.isArray(request.preparations)
      || !request.preparations.length) return reject("INVALID_MULTI_SELECTION")
    const { preparations: sourceInputs, availabilityLimits, ...common } = structuredClone(request)
    const first = sourceInputs[0]!
    const original = prepareAdjustedOriginalSelection({ ...common,
      preparation: { candidate: first.candidate, startDate: first.startDate } }, at)
    if (original.kind !== "original_selected") return original
    const inputs = sourceInputs.map((input): MultiAdjustedPreparationV3[number] => {
      if ("experienceBand" in input) return { ...input, source: { ...input.source, nowMs: at.getTime() } }
      return { ...input, source: { ...input.source, nowMs: at.getTime() } }
    })
    const review = checkMultiAdjustedPlanReviewV3(inputs, original.base.intake.experienceBand, rpeBindings, policies)
    if (review.kind !== "reviewed_scope") return reject(review.code)
    if (review.candidate.contentFingerprint !== request.expectedCandidateFingerprint) return reject("ADJUSTED_SELECTION_CHANGED")
    if (review.candidate.continuityContext.kind !== "NO_PREVIOUS_FRAME_CONTEXT" && continuation === undefined) return reject("ADJUSTED_SUCCESSOR_REQUIRES_CONTINUITY_TRANSACTION")
    return assemble(original.base, inputs, review, at, continuation, availabilityLimits)
  } catch { return reject("INVALID_MULTI_SELECTION") }
}
