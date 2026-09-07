import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import { adjustedCandidateFixture } from "./adjusted-plan-candidate.test-fixtures"
import { adjustedPlanReviewScope, checkAdjustedPlanReviewPolicy, REVIEWED_ADJUSTED_PLAN_POLICIES } from "./adjusted-plan-review-policy"
import type { ReviewedAdjustedPlanPolicy } from "./adjusted-plan-review-policy"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

function fixture() {
  const preparation = adjustedCandidateFixture()
  const scope = adjustedPlanReviewScope(preparation, "EXPERIENCED")
  if (scope.kind !== "scope") throw Error(scope.code)
  const policy: ReviewedAdjustedPlanPolicy = { policyId: "TEST-PLAN-REVIEW", version: "1", scopeFingerprint: scope.scopeFingerprint,
    configurationReviewRef: "TEST-NOT-APPROVAL", exposureReviewRef: "TEST-EXPOSURE", interactionReviewRef: "TEST-INTERACTION",
    safetyReviewRef: "TEST-SAFETY", validFromMs: 100, expiresAtMs: 200, revokedAtMs: null }
  return { preparation, scope, policy }
}

describe("adjusted complete-frame review scope", () => {
  it("requires a real registry entry and cannot create operating authority", () => {
    const { preparation } = fixture()
    expect(REVIEWED_ADJUSTED_PLAN_POLICIES).toEqual([])
    expect(checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED")).toEqual({ kind: "unavailable", code: "PLAN_CONFIGURATION_REVIEW_REQUIRED" })
  })
  it("matches an exact synthetic review without granting execution", () => {
    const { preparation, scope, policy } = fixture()
    const before = JSON.stringify(preparation)
    const result = checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED", [policy])
    expect(result).toMatchObject({ kind: "reviewed_scope", executionAuthority: "NONE", scopeFingerprint: scope.scopeFingerprint,
      candidate: { activationState: "NOT_ACCEPTED" }, policy: { policyId: policy.policyId, version: policy.version } })
    expect(JSON.stringify(preparation)).toBe(before)
  })
  it("includes full layout, support doses, unchanged components and exposure context", () => {
    const { preparation, scope } = fixture()
    expect(scope.scope.layout).toHaveLength(preparation.candidate.sessions.length)
    for (const session of preparation.candidate.sessions.filter(s => s.prescription.kind === "RPE_TIME_RANGE")) {
      expect(scope.scope.layout.find(s => s.day === session.day && s.slot === session.slot)?.prescription).toEqual(session.prescription)
    }
    expect(scope.scope.mainExposureLedger).toEqual(preparation.candidate.mainExposureLedger)
    expect(scope.scope.continuityContext).toEqual(preparation.candidate.continuityContext)
    expect(scope.scope.unchangedOperationalComponents.length).toBeGreaterThan(0)
    expect(JSON.stringify(scope.scope)).not.toContain("athlete-record:")
    expect(JSON.stringify(scope.scope)).not.toContain("performanceSeconds")
    expect(JSON.stringify(scope.scope)).not.toContain("targetRepSeconds")
  })
  it("rejects a policy that omits the surrounding sessions", () => {
    const { preparation, scope, policy } = fixture()
    const incomplete = { ...scope.scope, layout: scope.scope.layout.filter(s => s.prescription.kind === "ADJUSTED_METHOD") }
    const scopeFingerprint = canonicalJsonFingerprint("trainoracle.adjusted-plan-review-scope.v1", incomplete)
    expect(checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED", [{ ...policy, scopeFingerprint }]).kind).toBe("unavailable")
  })
  it.each(["configurationReviewRef", "exposureReviewRef", "interactionReviewRef", "safetyReviewRef"] as const)("requires %s", key => {
    const { preparation, policy } = fixture()
    expect(checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED", [{ ...policy, [key]: " " }]).kind).toBe("unavailable")
  })
  it.each([{ validFromMs: 152 }, { expiresAtMs: 151 }, { revokedAtMs: 150 }, { expiresAtMs: 99 }])("rejects invalid lifecycle %j", patch => {
    const { preparation, policy } = fixture()
    expect(checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED", [{ ...policy, ...patch }]).kind).toBe("unavailable")
  })
  it("rejects duplicate identities including a revoked duplicate", () => {
    const { preparation, policy } = fixture()
    expect(checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED", [policy, { ...policy, revokedAtMs: 150 }])).toEqual({ kind: "unavailable", code: "AMBIGUOUS_PLAN_REVIEW_POLICY" })
  })
  it("requires actual experience matching the source scope", () => {
    const { preparation, policy } = fixture()
    expect(checkAdjustedPlanReviewPolicy(preparation, "DEVELOPING", [policy])).toEqual({ kind: "unavailable", code: "SOURCE_EXPERIENCE_MISMATCH" })
  })
  it("does not read registry getters or write storage", () => {
    const { preparation, policy } = fixture()
    const write = vi.spyOn(Storage.prototype, "setItem")
    const getter = vi.fn(() => "PRIVATE")
    const changed = Object.defineProperty({ ...policy }, "memo", { enumerable: true, get: getter })
    expect(checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED", [changed]).kind).toBe("unavailable")
    expect(getter).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })
})
