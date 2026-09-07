import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import { adjustedCandidateFixture } from "./adjusted-plan-candidate.test-fixtures"
import { adjustedPlanReviewScope, checkAdjustedPlanReviewPolicy, REVIEWED_ADJUSTED_PLAN_POLICIES } from "./adjusted-plan-review-policy"
import type { ReviewedAdjustedPlanPolicy } from "./adjusted-plan-review-policy"
import { createAdjustedMethodSnapshot } from "./adjusted-method-snapshot"
import { resolveAdjustedCandidateScope } from "./adjusted-plan-candidate"
import { planAdaptationCandidateSchema } from "./plan-beta-schema"
import { adjustedSuccessorFixture } from "./adjusted-plan-successor.test-fixtures"
import { encodeStoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { generateAdjustedNextFrameFromDraft } from "./plan-beta-flow"
import { loadAthleteRecords } from "./athlete-records"
import { adjustedPlanSelectionFixture } from "./adjusted-plan-selection.test-fixtures"

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

function rebind(preparation: ReturnType<typeof adjustedCandidateFixture>) {
  const scope = resolveAdjustedCandidateScope(preparation.candidate, preparation.address, preparation.startDate)
  if (!scope) throw Error(JSON.stringify(planAdaptationCandidateSchema.safeParse(preparation.candidate)))
  const old = JSON.parse(preparation.rawSnapshot)
  const result = createAdjustedMethodSnapshot({ original: old.original, receipt: old.receipt,
    source: preparation.source, scope, explanation: preparation.explanation })
  if (result.kind !== "prepared") throw Error(result.code)
  return { ...preparation, rawSnapshot: JSON.stringify(result.snapshot) }
}

describe("adjusted complete-frame review scope", () => {
  it("preserves the exact legacy hash and requires explicit v2 adoption", () => {
    const { preparation, scope, policy } = fixture()
    expect(scope.scopeFingerprint).toBe(canonicalJsonFingerprint("trainoracle.adjusted-plan-review-scope.v1", scope.scope))
    const structural = adjustedPlanReviewScope(preparation, "EXPERIENCED", "STRUCTURAL_V2")
    if (structural.kind !== "scope") throw Error(structural.code)
    expect(checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED", [{ ...policy, scopeFingerprint: structural.scopeFingerprint }]).kind).toBe("unavailable")
    expect(checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED", [{ ...policy, scopeVersion: "STRUCTURAL_V2", scopeFingerprint: structural.scopeFingerprint }]).kind).toBe("reviewed_scope")
    expect(structural.scope.layout).toEqual(scope.scope.layout)
    expect(structural.scope.unchangedOperationalComponents).toEqual(scope.scope.unchangedOperationalComponents)
  })
  it("keeps date changes out of review scope but in the exact candidate binding", () => {
    const { preparation, policy } = fixture()
    const structural = adjustedPlanReviewScope(preparation, "EXPERIENCED", "STRUCTURAL_V2")
    if (structural.kind !== "scope") throw Error(structural.code)
    const changed = rebind({ ...preparation, startDate: "2026-09-08" })
    const next = adjustedPlanReviewScope(changed, "EXPERIENCED", "STRUCTURAL_V2")
    if (next.kind !== "scope") throw Error(next.code)
    expect(next.scopeFingerprint).toBe(structural.scopeFingerprint)
    expect(next.candidate.contentFingerprint).not.toBe(structural.candidate.contentFingerprint)
    expect(checkAdjustedPlanReviewPolicy(changed, "EXPERIENCED", [policy]).kind).toBe("reviewed_scope")
    expect(checkAdjustedPlanReviewPolicy(changed, "EXPERIENCED", [{ ...policy, scopeVersion: "STRUCTURAL_V2", scopeFingerprint: structural.scopeFingerprint }]).kind).toBe("reviewed_scope")
    expect(checkAdjustedPlanReviewPolicy({ ...changed, rawSnapshot: preparation.rawSnapshot }, "EXPERIENCED", [policy]).kind).toBe("unavailable")
  })
  it("omits personal outcome counts from a real generated successor without losing them from the candidate", async () => {
    const { next, old, retained, now } = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
    const successor = next.request.preparation
    const first = adjustedPlanReviewScope(successor, "EXPERIENCED", "STRUCTURAL_V2")
    const legacy = adjustedPlanReviewScope(successor, "EXPERIENCED")
    if (first.kind !== "scope" || legacy.kind !== "scope") throw Error("Expected valid scopes")
    expect(first.scope.continuityContext.kind).toBe("PREVIOUS_FRAME_CONTEXT_RETAINED")
    expect(JSON.stringify(first.scope)).not.toContain("progressStateCounts")
    expect(JSON.stringify(legacy.scope)).toContain("progressStateCounts")
    expect(first.candidate.continuityContext).toEqual(successor.candidate.continuityContext)
    expect(first.scope.mainExposureLedger).toEqual({ mainExposureCount: successor.candidate.mainExposureLedger.mainExposureCount })
    const changed = encodeStoredAdjustedPlanState(old.state.selection,
      old.state.progress.map((entry, index) => index === 0 ? { ...entry, state: "RESTED" as const } : entry),
      now.toISOString(), retained, now)
    if (changed.kind !== "encoded") throw Error("Expected changed prior outcomes")
    localStorage.setItem(activePlanBetaStorageKey(), changed.raw)
    const generated = generateAdjustedNextFrameFromDraft({ draft: old.state.selection.intake,
      currentCheck: "NO_KNOWN_RISK", expectedPredecessorFingerprint: changed.state.contentFingerprint,
      prescriptionSelection: { selectedRecordId: loadAthleteRecords(now)[0]!.id } }, retained)
    if (generated.kind !== "adjusted_next_frame_draft") throw Error(generated.code)
    const other = adjustedPlanSelectionFixture({}, generated.draft, now)
    const otherScope = adjustedPlanReviewScope(other.request.preparation, "EXPERIENCED", "STRUCTURAL_V2")
    if (otherScope.kind !== "scope") throw Error(otherScope.code)
    expect(otherScope.scopeFingerprint).toBe(first.scopeFingerprint)
    expect(otherScope.candidate.contentFingerprint).not.toBe(first.candidate.contentFingerprint)
    expect(checkAdjustedPlanReviewPolicy(other.request.preparation, "EXPERIENCED", [next.policy]).kind).toBe("unavailable")
    expect(checkAdjustedPlanReviewPolicy(other.request.preparation, "EXPERIENCED", [{ ...next.policy,
      scopeVersion: "STRUCTURAL_V2", scopeFingerprint: first.scopeFingerprint }]).kind).toBe("reviewed_scope")
  })
  it("rejects ambiguous legacy and structural approvals and unsupported versions", () => {
    const { preparation, policy } = fixture()
    const structural = adjustedPlanReviewScope(preparation, "EXPERIENCED", "STRUCTURAL_V2")
    if (structural.kind !== "scope") throw Error(structural.code)
    const v2: ReviewedAdjustedPlanPolicy = { ...policy, policyId: "TEST-V2", scopeVersion: "STRUCTURAL_V2", scopeFingerprint: structural.scopeFingerprint }
    expect(checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED", [policy, v2])).toEqual({ kind: "unavailable", code: "AMBIGUOUS_PLAN_REVIEW_POLICY" })
    expect(checkAdjustedPlanReviewPolicy(preparation, "EXPERIENCED", [{ ...v2, scopeVersion: "FUTURE" } as unknown as ReviewedAdjustedPlanPolicy]).kind).toBe("unavailable")
  })
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
