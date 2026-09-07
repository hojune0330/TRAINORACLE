import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { adjustedMethodV3FixtureWithCandidate } from "./adjusted-method-resolution-v3.test-fixtures"
import { resolveAdjustedCandidateScope } from "./adjusted-plan-candidate"
import { createAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { prepareSourceAdjustmentOfferV3 } from "./source-adjustment-offer"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import { adjustedPlanReviewScopeV3 } from "./adjusted-plan-review-v3"
import { selectAdjustedPlanForActivationV3, readSelectedAdjustedPlanV3 } from "./selected-adjusted-plan-v3"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
function fixture() {
  const { candidate, resolution, generation } = adjustedMethodV3FixtureWithCandidate(undefined, undefined, undefined, TODAY.getTime())
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
  const preparation = { candidate, address, startDate, rawSnapshot: JSON.stringify(snapshot.snapshot), source: resolution.source, explanation }
  const reviewed = adjustedPlanReviewScopeV3(preparation, "EXPERIENCED")
  if (reviewed.kind !== "scope") throw Error(reviewed.code)
  const policy = { scopeVersion: "STRUCTURAL_V3" as const, policyId: "TEST", version: "1", scopeFingerprint: reviewed.scopeFingerprint,
    configurationReviewRef: "TEST-C", exposureReviewRef: "TEST-E", interactionReviewRef: "TEST-I", safetyReviewRef: "TEST-S",
    validFromMs: TODAY.getTime() - 50, expiresAtMs: TODAY.getTime() + 50, revokedAtMs: null }
  const request = { action: "USER_EXPLICIT" as const, preparation, generated: generation.generated, gate: generation.gate,
    intake: generation.intake, athleteEvidence: generation.athleteEvidence, currentCheck: "NO_KNOWN_RISK" as const,
    expectedCandidateFingerprint: reviewed.candidate.contentFingerprint }
  return { request, policy, retained: { authority: resolution.source.authority, explanation, policies: [policy] } }
}
it("selects the exact V3 plan and reconstructs it historically without a live record or writes", () => {
  const { request, policy, retained } = fixture()
  const selected = selectAdjustedPlanForActivationV3(request, [policy], TODAY)
  if (selected.kind !== "selected_adjusted") throw Error(selected.code)
  expect(selected).toMatchObject({ storageState: "NOT_SAVED", state: { schemaVersion: 3 } })
  localStorage.clear()
  const writes = vi.spyOn(Storage.prototype, "setItem")
  const read = readSelectedAdjustedPlanV3(JSON.parse(JSON.stringify(selected.state)), retained, new Date(TODAY.getTime() + 1000))
  expect(read).toMatchObject({ kind: "read_only", executionAuthority: "NONE", state: selected.state })
  expect(writes).not.toHaveBeenCalled()
})
it("requires current explicit selection, current records and exact candidate confirmation", () => {
  const { request, policy } = fixture()
  expect(selectAdjustedPlanForActivationV3({ ...request, expectedCandidateFingerprint: "changed" }, [policy], TODAY).kind).toBe("rejected")
  expect(selectAdjustedPlanForActivationV3(request, [], TODAY).kind).toBe("rejected")
  expect(selectAdjustedPlanForActivationV3(request, [policy], new Date(TODAY.getTime() + 1000)).kind).toBe("rejected")
  localStorage.clear()
  expect(selectAdjustedPlanForActivationV3(request, [policy], TODAY).kind).toBe("rejected")
})
it("rejects altered stored targets, missing retained evidence, future capture and private fields", () => {
  const { request, policy, retained } = fixture()
  const selected = selectAdjustedPlanForActivationV3(request, [policy], TODAY)
  if (selected.kind !== "selected_adjusted") throw Error(selected.code)
  const altered = structuredClone(selected.state)
  const slot = altered.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  if (slot.prescription.kind !== "ADJUSTED_METHOD_V3") throw Error("slot")
  Reflect.set(slot.prescription.projection.segmentTargets[0]!, "targetRepSeconds", 999)
  expect(readSelectedAdjustedPlanV3(altered, retained, TODAY).kind).toBe("rejected")
  expect(readSelectedAdjustedPlanV3(selected.state, { ...retained, policies: [] }, TODAY).kind).toBe("rejected")
  expect(readSelectedAdjustedPlanV3(selected.state, retained, new Date(TODAY.getTime() - 1)).kind).toBe("rejected")
  expect(readSelectedAdjustedPlanV3({ ...selected.state, memo: "private" }, retained, TODAY).kind).toBe("rejected")
})
