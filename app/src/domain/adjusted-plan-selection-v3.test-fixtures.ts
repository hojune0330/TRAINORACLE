import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { adjustedMethodV3FixtureWithCandidate } from "./adjusted-method-resolution-v3.test-fixtures"
import type { AdjustedFixtureGeneration, AdjustedFixtureSchedule } from "./adjusted-method-resolution.test-fixtures"
import { resolveAdjustedCandidateScope } from "./adjusted-plan-candidate"
import { createAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { prepareSourceAdjustmentOfferV3 } from "./source-adjustment-offer"
import { adjustedPlanReviewScopeV3 } from "./adjusted-plan-review-v3"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import type { AdjustedPlanSelectionRequestV3, RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-v3"

/** Exact synthetic review evidence; never added to the operating registries. */
export function adjustedPlanSelectionV3Fixture(generationOverride?: AdjustedFixtureGeneration, at = TODAY,
  schedule: AdjustedFixtureSchedule = {}) {
  const { candidate, resolution, generation } = adjustedMethodV3FixtureWithCandidate(
    undefined, undefined, undefined, at.getTime(), schedule, generationOverride)
  const slot = candidate.sessions.find(s => s.prescription.kind === "PACE_TARGET")!
  const address = { day: slot.day, slot: slot.slot }, startDate = generation.intake.startDate ?? "2026-09-07"
  const scope = resolveAdjustedCandidateScope(candidate, address, startDate)!
  const offer = prepareSourceAdjustmentOfferV3(resolution.source)
  if (offer.kind !== "available") throw Error(offer.code)
  const explanation = { configuration: resolution.receipt.after.configuration, resolutionContextKey: offer.contextKey,
    version: "TEST-1", reviewRef: "TEST_NOT_APPROVAL", purpose: "test", energySupply: "test", workRationale: "test",
    recoveryRationale: "test", cycleRole: "test", expectedAdaptation: "test", limitations: "test", observation: "test",
    evidenceRefs: ["TEST-SOURCE"], sequenceContentIdentity: sequenceV3ContentIdentity(resolution.receipt.after.sequence),
    nodeIds: ["v3-sets", "v3-work"] }
  const snapshot = createAdjustedMethodSnapshotV3({ authority: offer.authority, current: offer.current,
    receipt: resolution.receipt, contextKey: offer.contextKey, nowMs: resolution.source.nowMs, scope, explanation })
  if (snapshot.kind !== "prepared") throw Error(snapshot.code)
  const preparation = { candidate, address, startDate, rawSnapshot: JSON.stringify(snapshot.snapshot), source: resolution.source, explanation }
  const reviewed = adjustedPlanReviewScopeV3(preparation, generation.intake.experienceBand)
  if (reviewed.kind !== "scope") throw Error(reviewed.code)
  const policy = { scopeVersion: "STRUCTURAL_V3" as const, policyId: "TEST", version: "1", scopeFingerprint: reviewed.scopeFingerprint,
    configurationReviewRef: "TEST-C", exposureReviewRef: "TEST-E", interactionReviewRef: "TEST-I", safetyReviewRef: "TEST-S",
    validFromMs: at.getTime() - 50, expiresAtMs: at.getTime() + 50, revokedAtMs: null }
  const request: AdjustedPlanSelectionRequestV3 = { action: "USER_EXPLICIT", preparation,
    generated: generation.generated, gate: generation.gate, intake: generation.intake,
    athleteEvidence: generation.athleteEvidence, currentCheck: "NO_KNOWN_RISK",
    expectedCandidateFingerprint: reviewed.candidate.contentFingerprint }
  const retained: RetainedAdjustedPlanEvidenceV3 = { authority: resolution.source.authority, explanation, policies: [policy] }
  return { request, policy, retained }
}
