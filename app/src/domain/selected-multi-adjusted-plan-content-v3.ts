import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { checkMultiAdjustedPlanReviewV3, type MultiAdjustedPreparationV3, type ReviewedMultiAdjustedPlanPolicyV3 } from "./adjusted-plan-multi-review-v3"
import type { ReviewedRpeSourceBindingV3 } from "./rpe-adjusted-slot-v3"
import { hasCanonicalJsonTree, planAdaptationCandidateSchema, planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { createActiveSnapshot } from "@impl/plan-generator/selection"
import type { AdjustmentAuthorityV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { ReviewedAdjustedExplanationV3 } from "./adjusted-method-snapshot-v3"
import { createInitialPeriodizationContext, advancePeriodizationContext } from "./periodization-lineage"
import { adjustedPlanContinuationSchema, type AdjustedPlanContinuation } from "./selected-adjusted-plan-content"
import { checkSessionAvailabilityV3, type SessionAvailabilityLimitV3 } from "./prescription-availability-v3"

const reject = (code: string) => ({ kind: "rejected" as const, code })
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-plan-selection.v3", value)

type Review = Extract<ReturnType<typeof checkMultiAdjustedPlanReviewV3>, { kind: "reviewed_scope" }>
export function assembleMultiAdjustedPlanV3(base: PlanBetaStateV3, inputs: MultiAdjustedPreparationV3, review: Review, at: Date, continuation?: AdjustedPlanContinuation,
  availabilityLimits?: readonly SessionAvailabilityLimitV3[]) {
    const availability = checkSessionAvailabilityV3(review.candidate.sessions, availabilityLimits)
    if (availability.kind !== "checked") return availability
    const first = inputs[0]!
    const priorFrame = review.candidate.continuityContext.kind === "PREVIOUS_FRAME_CONTEXT_RETAINED"
    if (priorFrame !== (continuation !== undefined)) return reject("INVALID_ADJUSTED_CONTINUATION")
    const checked = continuation === undefined ? undefined : adjustedPlanContinuationSchema.safeParse(continuation)
    if (checked !== undefined && !checked.success) return reject("INVALID_ADJUSTED_CONTINUATION")
    const retained = checked?.success ? checked.data : undefined
    const identity = retained === undefined ? review.candidate.contentFingerprint : hash({ candidate: review.candidate.contentFingerprint, continuation: retained })
    const candidateId = `multi-adjusted-plan:v3:${identity.slice(7)}`
    const generatedAt = at.toISOString(), periodization = retained === undefined
      ? createInitialPeriodizationContext(candidateId, generatedAt) : advancePeriodizationContext(retained.previousPeriodization, generatedAt)
    if (!periodization || !base.athleteEvidence) return reject("INVALID_MULTI_SELECTION")
    const { pairId, selectedDetailedTemplateRef, ...active } = base.activePlan
    const sources = inputs.map(input => {
      const { authority, nowMs, ...context } = input.source
      return { address: input.address, context }
    }).sort((a, b) => a.address.day - b.address.day || a.address.slot.localeCompare(b.address.slot))
    const content = { kind: "SELECTED_MULTI_ADJUSTED_PLAN" as const, schemaVersion: 3 as const,
      intake: base.intake, generatedAt, athleteEvidence: base.athleteEvidence, periodization,
      ...(availability.limits === undefined ? {} : { availabilityLimits: availability.limits }),
      ...(retained === undefined ? {} : { continuation: retained }),
      activePlan: { ...active, candidateId, sessions: review.candidate.sessions },
      adjustments: { originalCandidate: first.candidate, originalPairId: pairId,
        originalSelectedDetailedTemplateRef: selectedDetailedTemplateRef, sources,
        selectedCandidateFingerprint: review.candidate.contentFingerprint, changedSlots: review.candidate.changedSlots,
        reviewScopeFingerprint: review.scopeFingerprint, reviewPolicy: review.policy, acceptedAt: generatedAt } }
    return { kind: "selected_multi_adjusted" as const, storageState: "NOT_SAVED" as const,
      state: structuredClone({ ...content, contentFingerprint: hash(content) }) }
}

export type SelectedMultiAdjustedPlanV3 = Extract<ReturnType<typeof assembleMultiAdjustedPlanV3>, { kind: "selected_multi_adjusted" }>["state"]
export type RetainedMultiAdjustedEvidenceV3 = {
  readonly slots: readonly { readonly address: { readonly day: number; readonly slot: "AM" | "PM" };
    readonly authority: AdjustmentAuthorityV3; readonly explanation: ReviewedAdjustedExplanationV3 }[]
  readonly rpeBindings: readonly ReviewedRpeSourceBindingV3[]
  readonly policies: readonly ReviewedMultiAdjustedPlanPolicyV3[]
}

/** Rebuild with independently retained versions at acceptance time, never current activation authority. */
export function readSelectedMultiAdjustedPlanV3(value: unknown, evidence: RetainedMultiAdjustedEvidenceV3, at = new Date()) {
  try {
    if (!hasCanonicalJsonTree(value) || !hasCanonicalJsonTree(evidence) || value === null || typeof value !== "object"
      || !Number.isFinite(at.getTime())) return reject("INVALID_MULTI_PLAN")
    const stored = value as SelectedMultiAdjustedPlanV3, accepted = new Date(stored.generatedAt)
    if (!Number.isFinite(accepted.getTime()) || accepted > at || accepted.toISOString() !== stored.generatedAt) return reject("INVALID_MULTI_PLAN_TIME")
    const original = planAdaptationCandidateSchema.parse(stored.adjustments.originalCandidate)
    if (original.selectionAuthority !== "SELF") return reject("INVALID_MULTI_PLAN_ORIGIN")
    const slots = stored.activePlan.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")
    if (!slots.length || evidence.slots.length !== slots.length || stored.adjustments.sources.length !== slots.length) return reject("INVALID_MULTI_PLAN_SLOTS")
    const inputs: MultiAdjustedPreparationV3 = slots.map(slot => {
      if (slot.prescription.kind !== "ADJUSTED_METHOD_V3") throw Error("Missing adjusted snapshot")
      const matches = evidence.slots.filter(e => e.address.day === slot.day && e.address.slot === slot.slot)
      const contexts = stored.adjustments.sources.filter(s => s.address.day === slot.day && s.address.slot === slot.slot)
      if (matches.length !== 1 || contexts.length !== 1) throw Error("Ambiguous retained slot")
      const retained = matches[0]!, context = contexts[0]!.context
      const common = { candidate: original, address: retained.address, startDate: stored.intake.startDate!,
        rawSnapshot: JSON.stringify(slot.prescription.snapshot), explanation: retained.explanation }
      if ("kind" in context) return { ...common, experienceBand: stored.intake.experienceBand,
        source: { ...context, authority: retained.authority, nowMs: accepted.getTime() } }
      return { ...common, source: { ...context, authority: retained.authority, nowMs: accepted.getTime() } }
    })
    const base = planBetaStateV3Schema.parse({ version: 3, intake: stored.intake, activePlan: createActiveSnapshot(original, "SELF"),
      progress: [], generatedAt: stored.generatedAt, athleteEvidence: stored.athleteEvidence })
    if (base.intake.trainingFocus !== original.selectedEnergyIntent) return reject("INVALID_MULTI_PLAN_ORIGIN")
    const review = checkMultiAdjustedPlanReviewV3(inputs, base.intake.experienceBand, evidence.rpeBindings, evidence.policies)
    if (review.kind !== "reviewed_scope") return reject("RETAINED_MULTI_EVIDENCE_UNAVAILABLE")
    const rebuilt = assembleMultiAdjustedPlanV3(base, inputs, review, accepted, stored.continuation, stored.availabilityLimits)
    if (rebuilt.kind !== "selected_multi_adjusted" || hash(rebuilt.state) !== hash(stored)) return reject("MULTI_PLAN_CONTENT_MISMATCH")
    return { kind: "read_only" as const, executionAuthority: "NONE" as const, state: rebuilt.state,
      explanations: structuredClone(evidence.slots.map(e => ({ address: e.address, explanation: e.explanation }))) }
  } catch { return reject("INVALID_MULTI_PLAN") }
}
