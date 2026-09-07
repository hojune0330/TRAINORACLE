import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { adjustedSelectionFixture } from "./adjusted-plan-candidate.test-fixtures"
import { adjustedPlanReviewScope } from "./adjusted-plan-review-policy"
import type { ReviewedAdjustedPlanPolicy } from "./adjusted-plan-review-policy"
import { selectAdjustedPlanForActivation } from "./adjusted-plan-selection"
import type { AdjustedPlanSelectionRequest } from "./adjusted-plan-selection"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession } from "./planned-session-link"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"

const now = TODAY.getTime()
function fixture() {
  const { preparation, generation } = adjustedSelectionFixture(undefined, now)
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
  return { request, policy }
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe("explicit adjusted whole-plan selection", () => {
  it("selects actual adjusted content with a distinct identity and no storage write", () => {
    const { request, policy } = fixture()
    const write = vi.spyOn(Storage.prototype, "setItem")
    const storageBefore = Object.entries(localStorage)
    const before = JSON.stringify(request)
    const result = selectAdjustedPlanForActivation(request, [policy])
    expect(result.kind).toBe("selected_adjusted")
    if (result.kind !== "selected_adjusted") throw Error(result.code)
    expect(result.storageState).toBe("NOT_SAVED")
    expect(result.state.activePlan.candidateId).not.toBe(request.preparation.candidate.candidateId)
    expect(result.state.activePlan).not.toHaveProperty("pairId")
    expect(result.state).not.toHaveProperty("adaptationScope")
    expect(result.state).not.toHaveProperty("explanationReceipt")
    expect(result.state.adjustment.originalCandidate).toEqual(request.preparation.candidate)
    expect(result.state.periodization.frameOrdinal).toBe(1)
    const adjusted = result.state.activePlan.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD")
    expect(adjusted).toHaveLength(1)
    const session = adjusted[0]!
    expect(result.state.activePlan.sessions.filter(s => s !== session))
      .toEqual(request.preparation.candidate.sessions.filter(s => s.day !== session.day || s.slot !== session.slot))
    const link = createPlannedSessionLogDraft(result.state, session, TODAY.toISOString())!
    expect(resolveCurrentPlannedSession(result.state, JSON.parse(JSON.stringify(link.link)))).toEqual(session)
    // Existing safety reads probe storage availability, then remove that key.
    expect(write.mock.calls.filter(([key]) => key !== "__to_probe__")).toEqual([])
    expect(Object.entries(localStorage)).toEqual(storageBefore)
    expect(JSON.stringify(request)).toBe(before)
  })
  it("does not activate the empty operating registry", () => {
    const { request } = fixture()
    expect(selectAdjustedPlanForActivation(request)).toEqual({ kind: "rejected", code: "PLAN_CONFIGURATION_REVIEW_REQUIRED" })
  })
  it("rejects a changed preview before selection", () => {
    const { request, policy } = fixture()
    expect(selectAdjustedPlanForActivation({ ...request, expectedCandidateFingerprint: `sha256:${"0".repeat(64)}` }, [policy]))
      .toEqual({ kind: "rejected", code: "ADJUSTED_SELECTION_CHANGED" })
  })
  it("uses current time instead of accepting the snapshot's previous authority", () => {
    const { request, policy } = fixture()
    expect(selectAdjustedPlanForActivation(request, [policy], new Date(now + 50)).kind).toBe("rejected")
  })
  it("rejects a withdrawn whole-frame review", () => {
    const { request, policy } = fixture()
    expect(selectAdjustedPlanForActivation(request, [{ ...policy, revokedAtMs: now }]).kind).toBe("rejected")
  })
  it("rejects current pain despite a passed preview gate", () => {
    const { request, policy } = fixture()
    expect(selectAdjustedPlanForActivation({ ...request, currentCheck: "REVIEW_REQUIRED" }, [policy]))
      .toEqual({ kind: "rejected", code: "CURRENT_CHECK_REQUIRES_REVIEW" })
  })
  it("cannot replay another candidate with the same ID", () => {
    const { request, policy } = fixture()
    const changed = { ...request, preparation: { ...request.preparation,
      candidate: { ...request.preparation.candidate, sourceMode: "JOURNAL_CONTEXT_ONLY" as const } } }
    expect(selectAdjustedPlanForActivation(changed, [policy])).toEqual({ kind: "rejected", code: "STALE_ORIGINAL_CANDIDATE" })
  })
  it("requires the underlying record still to exist", () => {
    const { request, policy } = fixture()
    localStorage.clear()
    expect(selectAdjustedPlanForActivation(request, [policy])).toEqual({ kind: "rejected", code: "PACE_ANCHOR_RECONFIRMATION_REQUIRED" })
  })
  it("rejects missing explicit action and mismatched athlete experience", () => {
    const { request, policy } = fixture()
    expect(selectAdjustedPlanForActivation({ ...request, action: "AUTO" as "USER_EXPLICIT" }, [policy]).kind).toBe("rejected")
    expect(selectAdjustedPlanForActivation({ ...request, intake: { ...request.intake, experienceBand: "DEVELOPING" } }, [policy]).kind).toBe("rejected")
  })
  it("rejects changing the selected purpose without regenerating the candidate", () => {
    const { request, policy } = fixture()
    expect(selectAdjustedPlanForActivation({ ...request, intake: { ...request.intake, trainingFocus: "ATP_PC_INTENT" } }, [policy]))
      .toEqual({ kind: "rejected", code: "SELECTION_INTAKE_CHANGED" })
  })
  it("does not let duplicate canonical candidates masquerade as one selection", () => {
    const { request, policy } = fixture()
    const repeated = { ...request, generated: { ...request.generated,
      candidates: [request.preparation.candidate, request.preparation.candidate] as typeof request.generated.candidates } }
    expect(selectAdjustedPlanForActivation(repeated, [policy])).toEqual({ kind: "rejected", code: "STALE_ORIGINAL_CANDIDATE" })
  })
  it("rejects undeclared fields and does not evaluate an accessor", () => {
    const { request, policy } = fixture()
    expect(selectAdjustedPlanForActivation(Object.assign({}, request, { extra: "not part of selection" }), [policy]).kind).toBe("rejected")
    const getter = vi.fn(() => "private")
    const changed = Object.defineProperty({ ...request }, "memo", { enumerable: true, get: getter })
    expect(selectAdjustedPlanForActivation(changed, [policy]).kind).toBe("rejected")
    expect(getter).not.toHaveBeenCalled()
  })
})
