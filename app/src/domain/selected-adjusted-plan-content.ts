import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { createActiveSnapshot } from "@impl/plan-generator/selection"
import { hasCanonicalJsonTree, planAdaptationCandidateSchema, planBetaStateV3Schema } from "./plan-beta-schema"
import type { PlanBetaStateV3 } from "./plan-beta-schema"
import { checkAdjustedPlanReviewPolicy } from "./adjusted-plan-review-policy"
import type { ReviewedAdjustedPlanPolicy } from "./adjusted-plan-review-policy"
import type { prepareAdjustedPlanCandidate } from "./adjusted-plan-candidate"
import { createInitialPeriodizationContext, advancePeriodizationContext, periodizationContextSchema } from "./periodization-lineage"
import { z } from "zod"
import type { SourceAdjustmentOfferInput } from "./source-adjustment-offer"
import type { ResolvedAdjustedExplanation } from "./adjusted-method-snapshot"

type Preparation = Parameters<typeof prepareAdjustedPlanCandidate>[0]
type ReviewedScope = Extract<ReturnType<typeof checkAdjustedPlanReviewPolicy>, { kind: "reviewed_scope" }>
export const adjustedPlanSelectionFingerprint = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-selection.v1", value)
const hash = adjustedPlanSelectionFingerprint
const reject = (code: string) => ({ kind: "rejected" as const, code })
const continuationSchema = z.object({
  predecessorFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  predecessorSelectionFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  previousPeriodization: periodizationContextSchema,
}).strict()
export type AdjustedPlanContinuation = z.infer<typeof continuationSchema>

/** Content assembly only; the caller owns current selection or historical validation. */
export function assembleAdjustedPlanSelection(base: PlanBetaStateV3, preparation: Preparation, review: ReviewedScope, evaluatedAt: Date,
  continuation?: AdjustedPlanContinuation) {
  if (base.athleteEvidence === undefined) return reject("ADJUSTED_PLAN_EVIDENCE_MISSING")
  const priorFrame = preparation.candidate.continuityContext.kind === "PREVIOUS_FRAME_CONTEXT_RETAINED"
  if (priorFrame !== (continuation !== undefined)) return reject("INVALID_ADJUSTED_CONTINUATION")
  const checkedContinuation = continuation === undefined ? undefined : continuationSchema.safeParse(continuation)
  if (checkedContinuation !== undefined && !checkedContinuation.success) return reject("INVALID_ADJUSTED_CONTINUATION")
  const retainedContinuation = checkedContinuation?.success ? checkedContinuation.data : undefined
  const identity = retainedContinuation === undefined ? review.candidate.contentFingerprint
    : hash({ candidate: review.candidate.contentFingerprint, continuation: retainedContinuation })
  const candidateId = `adjusted-plan:v1:${identity.slice("sha256:".length)}`
  const generatedAt = evaluatedAt.toISOString()
  const periodization = retainedContinuation === undefined ? createInitialPeriodizationContext(candidateId, generatedAt)
    : advancePeriodizationContext(retainedContinuation.previousPeriodization, generatedAt)
  if (periodization === null) return reject("INVALID_ADJUSTED_SELECTION")
  // Original pair/template references are provenance, not adjustment authority.
  const { pairId, selectedDetailedTemplateRef, ...originalActive } = base.activePlan
  const content = {
    kind: "SELECTED_ADJUSTED_PLAN" as const, schemaVersion: 1 as const,
    intake: base.intake, generatedAt, athleteEvidence: base.athleteEvidence, periodization,
    ...(retainedContinuation === undefined ? {} : { continuation: retainedContinuation }),
    activePlan: { ...originalActive, candidateId, sessions: review.candidate.sessions },
    adjustment: {
      originalCandidate: preparation.candidate, originalPairId: pairId,
      originalSelectedDetailedTemplateRef: selectedDetailedTemplateRef,
      selectedCandidateFingerprint: review.candidate.contentFingerprint,
      changedSlot: review.candidate.changedSlot, reviewScopeFingerprint: review.scopeFingerprint,
      reviewPolicy: review.policy, acceptedAt: generatedAt,
    },
  }
  return { kind: "selected_adjusted" as const, storageState: "NOT_SAVED" as const,
    state: structuredClone({ ...content, contentFingerprint: hash(content) }) }
}

export type SelectedAdjustedPlanState = Extract<ReturnType<typeof assembleAdjustedPlanSelection>,
  { kind: "selected_adjusted" }>["state"]
export type RetainedAdjustedPlanEvidence = {
  readonly authority: SourceAdjustmentOfferInput["authority"]
  readonly explanation: ResolvedAdjustedExplanation
  readonly policies: readonly ReviewedAdjustedPlanPolicy[]
}

/** Historical reconstruction deliberately has no import of the live selection
 * flow. No current athlete-store read, safety clearance or execution permission.
 */
export function readSelectedAdjustedPlan(value: unknown, evidence: RetainedAdjustedPlanEvidence, readAt = new Date()) {
  try {
    if (!hasCanonicalJsonTree(value) || !hasCanonicalJsonTree(evidence) || value === null
        || typeof value !== "object" || Array.isArray(value)) return reject("INVALID_ADJUSTED_PLAN")
    const stored = value as SelectedAdjustedPlanState
    const accepted = new Date(stored.generatedAt)
    if (!Number.isFinite(readAt.getTime()) || !Number.isFinite(accepted.getTime()) || accepted > readAt
        || accepted.toISOString() !== stored.generatedAt) return reject("INVALID_ADJUSTED_PLAN_TIME")
    const original = planAdaptationCandidateSchema.parse(stored.adjustment.originalCandidate)
    if (original.selectionAuthority !== "SELF") {
      return reject("INVALID_ADJUSTED_PLAN_ORIGIN")
    }
    const adjusted = stored.activePlan.sessions.filter(session => session.prescription.kind === "ADJUSTED_METHOD")
    if (adjusted.length !== 1 || adjusted[0]!.prescription.kind !== "ADJUSTED_METHOD") return reject("INVALID_ADJUSTED_PLAN_SESSIONS")
    const snapshot = adjusted[0]!.prescription.snapshot
    const preparation: Preparation = {
      candidate: original, address: { day: adjusted[0]!.day, slot: adjusted[0]!.slot },
      startDate: stored.intake.startDate!, rawSnapshot: JSON.stringify(snapshot),
      source: { ...snapshot.sourceContext, authority: evidence.authority, nowMs: accepted.getTime() },
      explanation: evidence.explanation,
    }
    const base = planBetaStateV3Schema.parse({ version: 3, intake: stored.intake,
      activePlan: createActiveSnapshot(original, "SELF"), progress: [], generatedAt: stored.generatedAt,
      athleteEvidence: stored.athleteEvidence })
    if (base.intake.trainingFocus !== original.selectedEnergyIntent) return reject("INVALID_ADJUSTED_PLAN_ORIGIN")
    const reviewed = checkAdjustedPlanReviewPolicy(preparation, base.intake.experienceBand, evidence.policies)
    if (reviewed.kind !== "reviewed_scope") return reject("RETAINED_ADJUSTED_EVIDENCE_UNAVAILABLE")
    const reconstructed = assembleAdjustedPlanSelection(base, preparation, reviewed, accepted, stored.continuation)
    if (reconstructed.kind !== "selected_adjusted" || hash(reconstructed.state) !== hash(stored)) return reject("ADJUSTED_PLAN_CONTENT_MISMATCH")
    return { kind: "read_only" as const, executionAuthority: "NONE" as const,
      state: reconstructed.state, explanation: structuredClone(evidence.explanation) }
  } catch { return reject("INVALID_ADJUSTED_PLAN") }
}
