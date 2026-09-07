import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { prepareAdjustedOriginalSelection, type AdjustedPlanSelectionRequest } from "./adjusted-plan-selection"
import { checkMultiAdjustedPlanReviewV3, type MultiAdjustedPreparationV3, type ReviewedMultiAdjustedPlanPolicyV3 } from "./adjusted-plan-multi-review-v3"
import type { ReviewedRpeSourceBindingV3 } from "./rpe-adjusted-slot-v3"
import { hasCanonicalJsonTree, planAdaptationCandidateSchema, planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { createActiveSnapshot } from "@impl/plan-generator/selection"
import type { AdjustmentAuthorityV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { ReviewedAdjustedExplanationV3 } from "./adjusted-method-snapshot-v3"
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
    return assemble(original.base, inputs, review, at)
  } catch { return reject("INVALID_MULTI_SELECTION") }
}

type Review = Extract<ReturnType<typeof checkMultiAdjustedPlanReviewV3>, { kind: "reviewed_scope" }>
function assemble(base: PlanBetaStateV3, inputs: MultiAdjustedPreparationV3, review: Review, at: Date) {
    const first = inputs[0]!
    if (review.candidate.continuityContext.kind !== "NO_PREVIOUS_FRAME_CONTEXT") return reject("ADJUSTED_SUCCESSOR_REQUIRES_CONTINUITY_TRANSACTION")
    const candidateId = `multi-adjusted-plan:v3:${review.candidate.contentFingerprint.slice(7)}`
    const generatedAt = at.toISOString(), periodization = createInitialPeriodizationContext(candidateId, generatedAt)
    if (!periodization || !base.athleteEvidence) return reject("INVALID_MULTI_SELECTION")
    const { pairId, selectedDetailedTemplateRef, ...active } = base.activePlan
    const sources = inputs.map(input => {
      const { authority, nowMs, ...context } = input.source
      return { address: input.address, context }
    }).sort((a, b) => a.address.day - b.address.day || a.address.slot.localeCompare(b.address.slot))
    const content = { kind: "SELECTED_MULTI_ADJUSTED_PLAN" as const, schemaVersion: 3 as const,
      intake: base.intake, generatedAt, athleteEvidence: base.athleteEvidence, periodization,
      activePlan: { ...active, candidateId, sessions: review.candidate.sessions },
      adjustments: { originalCandidate: first.candidate, originalPairId: pairId,
        originalSelectedDetailedTemplateRef: selectedDetailedTemplateRef, sources,
        selectedCandidateFingerprint: review.candidate.contentFingerprint, changedSlots: review.candidate.changedSlots,
        reviewScopeFingerprint: review.scopeFingerprint, reviewPolicy: review.policy, acceptedAt: generatedAt } }
    return { kind: "selected_multi_adjusted" as const, storageState: "NOT_SAVED" as const,
      state: structuredClone({ ...content, contentFingerprint: hash(content) }) }
}

export type SelectedMultiAdjustedPlanV3 = Extract<ReturnType<typeof assemble>, { kind: "selected_multi_adjusted" }>["state"]
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
    const rebuilt = assemble(base, inputs, review, accepted)
    if (rebuilt.kind !== "selected_multi_adjusted" || hash(rebuilt.state) !== hash(stored)) return reject("MULTI_PLAN_CONTENT_MISMATCH")
    return { kind: "read_only" as const, executionAuthority: "NONE" as const, state: rebuilt.state,
      explanations: structuredClone(evidence.slots.map(e => ({ address: e.address, explanation: e.explanation }))) }
  } catch { return reject("INVALID_MULTI_PLAN") }
}
