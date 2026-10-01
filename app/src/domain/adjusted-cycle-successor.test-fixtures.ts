import { createAdjustmentDraftV3, applyAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { generatePlanFromDraft, generateAdjustedNextFrameV3FromDraft, generateMultiAdjustedNextFrameV3FromDraft } from "./plan-beta-flow"
import { adjustedPlanSelectionV3Fixture } from "./adjusted-plan-selection-v3.test-fixtures"
import { selectAdjustedPlanForActivationV3 } from "./selected-adjusted-plan-v3"
import { encodeStoredAdjustedPlanStateV5 } from "./adjusted-plan-storage-v5"
import { selectMultiAdjustedPlanV3 } from "./selected-multi-adjusted-plan-v3"
import { encodeStoredMultiAdjustedPlanV6 } from "./adjusted-plan-storage-v6"
import { prepareUnanchoredAdjustmentOfferV3 } from "./unanchored-adjustment-offer-v3"
import { unanchoredAdjustmentFixtureV3 } from "./unanchored-adjustment-v3.test-fixtures"
import { createAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { resolveQualityCandidateScope } from "./adjusted-plan-candidate"
import { rpeSourceBindingScopeV3, type RpeAdjustedSlotInputV3 } from "./rpe-adjusted-slot-v3"
import { multiAdjustedPlanReviewScopeV3 } from "./adjusted-plan-multi-review-v3"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { loadAthleteRecords } from "./athlete-records"
import { draftFor, RUNTIME_CASES, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { isoShift } from "./dates"
import type { PlanMutationLockManager } from "./plan-mutation-lock"

export const adjustedCycleTestLocks: PlanMutationLockManager = { request: async (_n, _o, callback) => callback({}) }
const completed = (sessions: readonly { day: number; slot: "AM" | "PM"; role: string }[]) => sessions.filter(s => s.role !== "REST")
  .map(s => ({ sessionDay: s.day, sessionSlot: s.slot, state: "COMPLETED" as const }))

export function adjustedCycleV5Fixture(setTime: (at: Date) => void) {
  const first = adjustedPlanSelectionV3Fixture()
  const selected = selectAdjustedPlanForActivationV3(first.request, [first.policy], TODAY)
  if (selected.kind !== "selected_adjusted") throw Error(selected.code)
  const old = encodeStoredAdjustedPlanStateV5(selected.state, completed(selected.state.activePlan.sessions), TODAY.toISOString(), [first.retained], TODAY)
  if (old.kind !== "encoded") throw Error("Invalid V5 fixture")
  localStorage.setItem(activePlanBetaStorageKey(), old.raw)
  const start = isoShift(selected.state.intake.startDate!, Math.max(...selected.state.activePlan.sessions.map(s => s.day)))
  const now = new Date(`${start}T12:00:00`); setTime(now)
  const generated = generateAdjustedNextFrameV3FromDraft({ draft: { ...selected.state.intake, startDate: start },
    currentCheck: "NO_KNOWN_RISK", expectedPredecessorFingerprint: old.state.contentFingerprint,
    prescriptionSelection: { selectedRecordId: loadAthleteRecords(now)[0]!.id } }, [first.retained])
  if (generated.kind !== "adjusted_next_frame_v3_draft") throw Error(generated.code)
  const next = adjustedPlanSelectionV3Fixture(generated.draft, now), retained = [first.retained, next.retained]
  const input = { request: next.request, expectedPredecessorFingerprint: old.state.contentFingerprint,
    cycleDraft: generated.cycleDraft, futureEnvironmentConfirmed: true,
    readReview: () => ({ source: next.request.preparation.source, explanation: next.retained.explanation, policies: [next.policy], retained }),
    isCurrentDraft: () => true, locks: adjustedCycleTestLocks }
  return { old, next, now, generated, retained, input }
}

/** Synthetic independent authorities remain in tests, never in the operating registry. */
export function multiAdjustedCycleMaterial(supplied?: Extract<ReturnType<typeof generatePlanFromDraft>, { kind: "generated" }>, at = TODAY,
  startDate = "2026-09-08") {
  const intake = { ...draftFor(RUNTIME_CASES[3]), selectedDetailedTemplateRef: null }
  const generation = supplied ?? generatePlanFromDraft(intake, "NO_KNOWN_RISK", {})
  if (generation.kind !== "generated") throw Error("Missing RPE candidate")
  const candidate = generation.generated.candidates[0], source = unanchoredAdjustmentFixtureV3(false, at.getTime(), true)
  const offer = prepareUnanchoredAdjustmentOfferV3(source)
  if (offer.kind !== "available") throw Error(offer.code)
  const draft = createAdjustmentDraftV3({ authority: offer.authority, current: offer.current, policy: offer.policy,
    target: offer.targets[0]!, contextKey: offer.contextKey, nowMs: at.getTime() })
  if (draft.kind !== "draft") throw Error(draft.code)
  const applied = applyAdjustmentDraftV3({ authority: offer.authority, current: offer.current, draft: draft.draft,
    contextKey: offer.contextKey, nowMs: at.getTime(), action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw Error(applied.code)
  const explanation = { configuration: applied.prescription.configuration, resolutionContextKey: offer.contextKey,
    version: "1", reviewRef: "TEST_NOT_APPROVAL", purpose: "test", energySupply: "test", workRationale: "test", recoveryRationale: "test",
    cycleRole: "test", expectedAdaptation: "test", limitations: "test", observation: "test", evidenceRefs: ["TEST"],
    sequenceContentIdentity: sequenceV3ContentIdentity(applied.prescription.sequence), nodeIds: ["work"] }
  const inputs: RpeAdjustedSlotInputV3[] = candidate.sessions.filter(s => s.role === "QUALITY").map(session => {
    const address = { day: session.day, slot: session.slot }, scope = resolveQualityCandidateScope(candidate, address, startDate)!
    const snapshot = createAdjustedMethodSnapshotV3({ authority: offer.authority, current: offer.current, receipt: applied.receipt,
      contextKey: offer.contextKey, nowMs: at.getTime(), scope, explanation })
    if (snapshot.kind !== "prepared") throw Error(snapshot.code)
    return { candidate, address, startDate, source, explanation, rawSnapshot: JSON.stringify(snapshot.snapshot), experienceBand: intake.experienceBand }
  })
  const scopes = inputs.map(i => {
    const s = rpeSourceBindingScopeV3(i)
    if (s.kind !== "scope") throw Error(s.code)
    return s.scopeFingerprint
  })
  const bindings = [...new Set(scopes)].map((scopeFingerprint, i) => ({ bindingId: `TEST-${i}`, version: "1", scopeFingerprint,
    reviewRef: "TEST_NOT_APPROVAL", validFromMs: at.getTime() - 50, expiresAtMs: at.getTime() + 50, revokedAtMs: null }))
  const scope = multiAdjustedPlanReviewScopeV3(inputs, intake.experienceBand, bindings)
  if (scope.kind !== "scope") throw Error(scope.code)
  const policy = { scopeVersion: "MULTI_STRUCTURAL_V3" as const, policyId: "TEST", version: "1", scopeFingerprint: scope.scopeFingerprint,
    configurationReviewRef: "TEST-C", exposureReviewRef: "TEST-E", interactionReviewRef: "TEST-I", safetyReviewRef: "TEST-S",
    validFromMs: at.getTime() - 50, expiresAtMs: at.getTime() + 50, revokedAtMs: null }
  const request = { action: "USER_EXPLICIT" as const, preparations: inputs, generated: generation.generated, gate: generation.gate,
    intake: generation.intake, athleteEvidence: generation.athleteEvidence, currentCheck: "NO_KNOWN_RISK" as const,
    expectedCandidateFingerprint: scope.candidate.contentFingerprint }
  const retained = [{ slots: inputs.map(p => ({ address: p.address, authority: p.source.authority, explanation: p.explanation })),
    rpeBindings: bindings, policies: [policy] }]
  return { request, readReview: () => ({ preparations: inputs, rpeBindings: bindings, policies: [policy], retained }) }
}

export function adjustedCycleV6Fixture(setTime: (at: Date) => void) {
  const first = multiAdjustedCycleMaterial(), review = first.readReview()
  const selected = selectMultiAdjustedPlanV3(first.request, review.rpeBindings, review.policies, TODAY)
  if (selected.kind !== "selected_multi_adjusted") throw Error(selected.code)
  const old = encodeStoredMultiAdjustedPlanV6(selected.state, completed(selected.state.activePlan.sessions), TODAY.toISOString(), review.retained, TODAY)
  if (old.kind !== "encoded") throw Error("Invalid V6 fixture")
  localStorage.setItem(activePlanBetaStorageKey(), old.raw)
  const start = isoShift(selected.state.intake.startDate!, Math.max(...selected.state.activePlan.sessions.map(s => s.day)))
  const now = new Date(`${start}T12:00:00`); setTime(now)
  const generated = generateMultiAdjustedNextFrameV3FromDraft({ draft: { ...selected.state.intake, startDate: start },
    currentCheck: "NO_KNOWN_RISK", expectedPredecessorFingerprint: old.state.contentFingerprint }, review.retained)
  if (generated.kind !== "multi_adjusted_next_frame_v3_draft") throw Error(generated.code)
  const next = multiAdjustedCycleMaterial(generated.draft, now, start), retained = [...review.retained, ...next.readReview().retained]
  const input = { request: next.request, expectedPredecessorFingerprint: old.state.contentFingerprint,
    cycleDraft: generated.cycleDraft, futureEnvironmentConfirmed: true, readReview: () => ({ ...next.readReview(), retained }),
    isCurrentDraft: () => true, locks: adjustedCycleTestLocks }
  return { old, next, now, generated, retained, input }
}
