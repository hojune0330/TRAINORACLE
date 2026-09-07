import { adjustedSelectionFixture } from "./adjusted-plan-candidate.test-fixtures"
import { adjustedPlanReviewScope } from "./adjusted-plan-review-policy"
import type { ReviewedAdjustedPlanPolicy } from "./adjusted-plan-review-policy"
import type { AdjustedPlanSelectionRequest, RetainedAdjustedPlanEvidence } from "./adjusted-plan-selection"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import type { AdjustedFixtureSchedule } from "./adjusted-method-resolution.test-fixtures"

export function adjustedPlanSelectionFixture(schedule: AdjustedFixtureSchedule = {}) {
  const now = TODAY.getTime()
  const { preparation, generation } = adjustedSelectionFixture(undefined, now, schedule)
  const scope = adjustedPlanReviewScope(preparation, generation.intake.experienceBand)
  if (scope.kind !== "scope") throw Error(scope.code)
  const policy: ReviewedAdjustedPlanPolicy = {
    policyId: "TEST-REVIEW", version: "1", scopeFingerprint: scope.scopeFingerprint,
    configurationReviewRef: "TEST-NOT-APPROVAL", exposureReviewRef: "TEST-EXPOSURE",
    interactionReviewRef: "TEST-INTERACTION", safetyReviewRef: "TEST-SAFETY",
    validFromMs: now - 51, expiresAtMs: now + 49, revokedAtMs: null,
  }
  const request: AdjustedPlanSelectionRequest = { action: "USER_EXPLICIT", preparation,
    generated: generation.generated, gate: generation.gate, intake: generation.intake,
    athleteEvidence: generation.athleteEvidence, currentCheck: "NO_KNOWN_RISK",
    expectedCandidateFingerprint: scope.candidate.contentFingerprint }
  const retained: readonly RetainedAdjustedPlanEvidence[] = [{ authority: preparation.source.authority,
    explanation: preparation.explanation, policies: [policy] }]
  const review = { source: preparation.source, explanation: preparation.explanation, policies: [policy], retained }
  return { request, policy, retained, review }
}
