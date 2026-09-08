import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { createActiveSnapshot } from "@impl/plan-generator/selection"
import { hasCanonicalJsonTree, planAdaptationCandidateSchema, planBetaStateV3Schema } from "./plan-beta-schema"
import type { PlanBetaStateV3 } from "./plan-beta-schema"
import { prepareAdjustedOriginalSelection } from "./adjusted-plan-selection"
import type { AdjustedPlanSelectionRequest } from "./adjusted-plan-selection"
import type { prepareAdjustedPlanCandidateV3 } from "./adjusted-plan-candidate"
import { checkAdjustedPlanReviewPolicyV3, REVIEWED_ADJUSTED_PLAN_POLICIES_V3 } from "./adjusted-plan-review-v3"
import type { ReviewedAdjustedPlanPolicyV3 } from "./adjusted-plan-review-v3"
import { createInitialPeriodizationContext, advancePeriodizationContext } from "./periodization-lineage"
import { adjustedPlanContinuationSchema, type AdjustedPlanContinuation } from "./selected-adjusted-plan-content"
import { prepareAdjustedNextFrameV3 } from "./adjusted-plan-continuity"
import { readStoredAdjustedPlanStateV5 } from "./adjusted-plan-storage-v5"

type Preparation = Parameters<typeof prepareAdjustedPlanCandidateV3>[0]
type Review = Extract<ReturnType<typeof checkAdjustedPlanReviewPolicyV3>, { kind: "reviewed_scope" }>
export type AdjustedPlanSelectionRequestV3 = Omit<AdjustedPlanSelectionRequest, "preparation"> & { readonly preparation: Preparation }
export type RetainedAdjustedPlanEvidenceV3 = {
  readonly authority: Preparation["source"]["authority"]
  readonly explanation: Preparation["explanation"]
  readonly policies: readonly ReviewedAdjustedPlanPolicyV3[]
}
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-selection.v3", value)
const reject = (code: string) => ({ kind: "rejected" as const, code })

function assemble(base: PlanBetaStateV3, preparation: Preparation, review: Review, at: Date,
  continuation?: AdjustedPlanContinuation) {
  if (base.athleteEvidence === undefined) return reject("ADJUSTED_PLAN_EVIDENCE_MISSING")
  const priorFrame = preparation.candidate.continuityContext.kind === "PREVIOUS_FRAME_CONTEXT_RETAINED"
  if (priorFrame !== (continuation !== undefined)) return reject("INVALID_ADJUSTED_CONTINUATION")
  const checked = continuation === undefined ? undefined : adjustedPlanContinuationSchema.safeParse(continuation)
  if (checked !== undefined && !checked.success) return reject("INVALID_ADJUSTED_CONTINUATION")
  const retained = checked?.success ? checked.data : undefined
  const identity = retained === undefined ? review.candidate.contentFingerprint
    : hash({ candidate: review.candidate.contentFingerprint, continuation: retained })
  const candidateId = `adjusted-plan:v3:${identity.slice(7)}`
  const generatedAt = at.toISOString(), periodization = retained === undefined
    ? createInitialPeriodizationContext(candidateId, generatedAt)
    : advancePeriodizationContext(retained.previousPeriodization, generatedAt)
  if (periodization === null) return reject("INVALID_ADJUSTED_SELECTION")
  const { pairId, selectedDetailedTemplateRef, ...originalActive } = base.activePlan
  const { authority, nowMs, ...sourceContext } = preparation.source
  const content = { kind: "SELECTED_ADJUSTED_PLAN" as const, schemaVersion: 3 as const,
    intake: base.intake, generatedAt, athleteEvidence: base.athleteEvidence, periodization,
    ...(retained === undefined ? {} : { continuation: retained }),
    activePlan: { ...originalActive, candidateId, sessions: review.candidate.sessions },
    adjustment: { originalCandidate: preparation.candidate, originalPairId: pairId,
      originalSelectedDetailedTemplateRef: selectedDetailedTemplateRef, sourceContext,
      selectedCandidateFingerprint: review.candidate.contentFingerprint, changedSlot: review.candidate.changedSlot,
      reviewScopeFingerprint: review.scopeFingerprint, reviewPolicy: review.policy, acceptedAt: generatedAt } }
  return { kind: "selected_adjusted" as const, storageState: "NOT_SAVED" as const,
    state: structuredClone({ ...content, contentFingerprint: hash(content) }) }
}
export type SelectedAdjustedPlanStateV3 = Extract<ReturnType<typeof assemble>, { kind: "selected_adjusted" }>["state"]

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

/** Historical reconstruction is not current activation and never reads a live athlete store. */
export function readSelectedAdjustedPlanV3(value: unknown, evidence: RetainedAdjustedPlanEvidenceV3, readAt = new Date()) {
  try {
    if (!hasCanonicalJsonTree(value) || !hasCanonicalJsonTree(evidence) || value === null || typeof value !== "object") {
      return reject("INVALID_ADJUSTED_PLAN")
    }
    const stored = value as SelectedAdjustedPlanStateV3, accepted = new Date(stored.generatedAt)
    if (!Number.isFinite(readAt.getTime()) || !Number.isFinite(accepted.getTime()) || accepted > readAt
      || accepted.toISOString() !== stored.generatedAt) return reject("INVALID_ADJUSTED_PLAN_TIME")
    const original = planAdaptationCandidateSchema.parse(stored.adjustment.originalCandidate)
    if (original.selectionAuthority !== "SELF") return reject("INVALID_ADJUSTED_PLAN_ORIGIN")
    const slots = stored.activePlan.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")
    if (slots.length !== 1 || slots[0]!.prescription.kind !== "ADJUSTED_METHOD_V3") return reject("INVALID_ADJUSTED_PLAN_SESSIONS")
    const preparation: Preparation = { candidate: original, address: { day: slots[0]!.day, slot: slots[0]!.slot },
      startDate: stored.intake.startDate!, rawSnapshot: JSON.stringify(slots[0]!.prescription.snapshot),
      source: { ...stored.adjustment.sourceContext, authority: evidence.authority, nowMs: accepted.getTime() },
      explanation: evidence.explanation }
    const base = planBetaStateV3Schema.parse({ version: 3, intake: stored.intake,
      activePlan: createActiveSnapshot(original, "SELF"), progress: [], generatedAt: stored.generatedAt, athleteEvidence: stored.athleteEvidence })
    if (base.intake.trainingFocus !== original.selectedEnergyIntent) return reject("INVALID_ADJUSTED_PLAN_ORIGIN")
    const review = checkAdjustedPlanReviewPolicyV3(preparation, base.intake.experienceBand, evidence.policies)
    if (review.kind !== "reviewed_scope") return reject("RETAINED_ADJUSTED_EVIDENCE_UNAVAILABLE")
    const rebuilt = assemble(base, preparation, review, accepted, stored.continuation)
    if (rebuilt.kind !== "selected_adjusted" || hash(rebuilt.state) !== hash(stored)) return reject("ADJUSTED_PLAN_CONTENT_MISMATCH")
    return { kind: "read_only" as const, executionAuthority: "NONE" as const, state: rebuilt.state,
      explanation: structuredClone(evidence.explanation) }
  } catch { return reject("INVALID_ADJUSTED_PLAN") }
}
