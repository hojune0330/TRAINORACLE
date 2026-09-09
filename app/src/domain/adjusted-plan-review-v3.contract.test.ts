import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { adjustedMethodV3FixtureWithCandidate } from "./adjusted-method-resolution-v3.test-fixtures"
import { resolveAdjustedCandidateScope } from "./adjusted-plan-candidate"
import { createAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { prepareSourceAdjustmentOfferV3 } from "./source-adjustment-offer"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import { adjustedPlanReviewScopeV3, checkAdjustedPlanReviewPolicyV3 } from "./adjusted-plan-review-v3"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
function fixture() {
  const { candidate, resolution } = adjustedMethodV3FixtureWithCandidate()
  const slot = candidate.sessions.find(s => s.prescription.kind === "PACE_TARGET")!
  const address = { day: slot.day, slot: slot.slot }, startDate = "2026-09-07"
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
  const input = { candidate, address, startDate, rawSnapshot: JSON.stringify(snapshot.snapshot), source: resolution.source, explanation }
  const reviewed = adjustedPlanReviewScopeV3(input, "EXPERIENCED")
  if (reviewed.kind !== "scope") throw Error(reviewed.code)
  const policy = { scopeVersion: "STRUCTURAL_V3" as const, policyId: "TEST", version: "1", scopeFingerprint: reviewed.scopeFingerprint,
    configurationReviewRef: "TEST-C", exposureReviewRef: "TEST-E", interactionReviewRef: "TEST-I", safetyReviewRef: "TEST-S",
    validFromMs: 100, expiresAtMs: 200, revokedAtMs: null }
  return { input, reviewed, policy }
}
it("requires a separate current full-plan review and never saves or activates", () => {
  const { input, policy } = fixture(), writes = vi.spyOn(Storage.prototype, "setItem")
  expect(checkAdjustedPlanReviewPolicyV3(input, "EXPERIENCED")).toMatchObject({ code: "PLAN_CONFIGURATION_REVIEW_REQUIRED" })
  expect(checkAdjustedPlanReviewPolicyV3(input, "EXPERIENCED", [policy])).toMatchObject({ kind: "reviewed_scope", executionAuthority: "NONE" })
  expect(writes).not.toHaveBeenCalled()
})
it("retains every session and target population without personal record values in the review scope", () => {
  const { input, reviewed } = fixture()
  expect(reviewed.scope.layout).toHaveLength(input.candidate.sessions.length)
  expect(reviewed.scope.layout.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")).toHaveLength(1)
  expect(reviewed.scope.mainExposureCount).toBe(input.candidate.mainExposureLedger.mainExposureCount)
  const raw = JSON.stringify(reviewed.scope)
  expect(raw).not.toContain(input.source.anchor.sourceRef)
  expect(raw).not.toContain(input.startDate)
  expect(raw).not.toContain("targetRepSeconds")
  expect(raw).not.toContain("performanceSeconds")
})
it("rejects stale, revoked, mismatched and ambiguous whole-plan reviews", () => {
  const { input, policy } = fixture()
  for (const policies of [[{ ...policy, expiresAtMs: 150 }], [{ ...policy, revokedAtMs: 149 }],
    [{ ...policy, scopeFingerprint: `sha256:${"a".repeat(64)}` }], [policy, policy],
    [policy, { ...policy, policyId: "ALSO" }]]) {
    expect(checkAdjustedPlanReviewPolicyV3(input, "EXPERIENCED", policies).kind).toBe("unavailable")
  }
  expect(checkAdjustedPlanReviewPolicyV3(input, "NEW_TO_RUNNING", [policy])).toMatchObject({ code: "SOURCE_EXPERIENCE_MISMATCH" })
})
it("does not let whole-plan review bypass source freshness or explanation binding", () => {
  const { input, policy } = fixture()
  expect(checkAdjustedPlanReviewPolicyV3({ ...input, source: { ...input.source, nowMs: 201 } }, "EXPERIENCED", [policy]).kind).toBe("unavailable")
  expect(checkAdjustedPlanReviewPolicyV3({ ...input, explanation: { ...input.explanation, recoveryRationale: "changed" } }, "EXPERIENCED", [policy]).kind).toBe("unavailable")
})
it("rejects old versions, extra fields and accessor registries without executing getters", () => {
  const { input, policy } = fixture(), getter = vi.fn(() => "private")
  for (const invalid of [{ ...policy, scopeVersion: "STRUCTURAL_V2" }, { ...policy, memo: "private" },
    Object.defineProperty({ ...policy }, "configurationReviewRef", { enumerable: true, get: getter })]) {
    expect(checkAdjustedPlanReviewPolicyV3(input, "EXPERIENCED", [invalid as typeof policy]).kind).toBe("unavailable")
  }
  expect(getter).not.toHaveBeenCalled()
})
