import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { prepareAdjustedOriginalSelection, type AdjustedPlanSelectionRequest } from "./adjusted-plan-selection"
import { checkMultiAdjustedPlanReviewV3, type MultiAdjustedPreparationV3, type ReviewedMultiAdjustedPlanPolicyV3 } from "./adjusted-plan-multi-review-v3"
import type { ReviewedRpeSourceBindingV3 } from "./rpe-adjusted-slot-v3"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { createInitialPeriodizationContext } from "./periodization-lineage"

export type MultiAdjustedPlanSelectionRequestV3 = Omit<AdjustedPlanSelectionRequest, "preparation"> & {
  readonly preparations: MultiAdjustedPreparationV3
}
const reject = (code: string) => ({ kind: "rejected" as const, code })
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-plan-selection.v3", value)

/** Explicit selection only. The account transaction and version-aware read must precede storage. */
export function selectMultiAdjustedPlanV3(request: MultiAdjustedPlanSelectionRequestV3,
  rpeBindings: readonly ReviewedRpeSourceBindingV3[], policies: readonly ReviewedMultiAdjustedPlanPolicyV3[], at = new Date()) {
  try {
    if (!hasCanonicalJsonTree(request) || !Number.isFinite(at.getTime()) || !Array.isArray(request.preparations)
      || !request.preparations.length) return reject("INVALID_MULTI_SELECTION")
    const { preparations: sourceInputs, ...common } = structuredClone(request)
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
    if (review.candidate.continuityContext.kind !== "NO_PREVIOUS_FRAME_CONTEXT") return reject("ADJUSTED_SUCCESSOR_REQUIRES_CONTINUITY_TRANSACTION")
    const candidateId = `multi-adjusted-plan:v3:${review.candidate.contentFingerprint.slice(7)}`
    const generatedAt = at.toISOString(), periodization = createInitialPeriodizationContext(candidateId, generatedAt)
    if (!periodization || !original.base.athleteEvidence) return reject("INVALID_MULTI_SELECTION")
    const { pairId, selectedDetailedTemplateRef, ...active } = original.base.activePlan
    const sources = inputs.map(input => {
      const { authority, nowMs, ...context } = input.source
      return { address: input.address, context }
    }).sort((a, b) => a.address.day - b.address.day || a.address.slot.localeCompare(b.address.slot))
    const content = { kind: "SELECTED_MULTI_ADJUSTED_PLAN" as const, schemaVersion: 3 as const,
      intake: original.base.intake, generatedAt, athleteEvidence: original.base.athleteEvidence, periodization,
      activePlan: { ...active, candidateId, sessions: review.candidate.sessions },
      adjustments: { originalCandidate: first.candidate, originalPairId: pairId,
        originalSelectedDetailedTemplateRef: selectedDetailedTemplateRef, sources,
        selectedCandidateFingerprint: review.candidate.contentFingerprint, changedSlots: review.candidate.changedSlots,
        reviewScopeFingerprint: review.scopeFingerprint, reviewPolicy: review.policy, acceptedAt: generatedAt } }
    return { kind: "selected_multi_adjusted" as const, storageState: "NOT_SAVED" as const,
      state: structuredClone({ ...content, contentFingerprint: hash(content) }) }
  } catch { return reject("INVALID_MULTI_SELECTION") }
}
