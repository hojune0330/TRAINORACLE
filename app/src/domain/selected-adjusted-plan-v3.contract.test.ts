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
import { saveSelectedAdjustedPlanV3, readStoredAdjustedPlanStateV5, encodeStoredAdjustedPlanStateV5 } from "./adjusted-plan-storage-v5"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { saveAdjustedPlanProgressV3 } from "./adjusted-plan-progress"

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

function storeInput() {
  const f = fixture()
  const input: Parameters<typeof saveSelectedAdjustedPlanV3>[0] = { request: f.request, isCurrentDraft: () => true,
    readReview: () => ({ source: f.request.preparation.source, explanation: f.retained.explanation,
      policies: [f.policy], retained: [f.retained] }),
    locks: { request: async (_name, _options, callback) => callback({}) } }
  return { ...f, input }
}
it("writes and reloads exact V3 bytes in the real active storage key and acknowledges identical replay", async () => {
  const { input, retained } = storeInput()
  const result = await saveSelectedAdjustedPlanV3(input)
  if (result.kind !== "saved") throw Error(result.code)
  const raw = localStorage.getItem(activePlanBetaStorageKey())!
  expect(JSON.parse(raw).version).toBe(5)
  expect(readStoredAdjustedPlanStateV5(JSON.parse(raw), [retained], TODAY)).toMatchObject({ kind: "loaded", state: result.state })
  expect(await saveSelectedAdjustedPlanV3(input)).toMatchObject({ kind: "saved", replayed: true })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
})
it("preserves an existing plan and refuses missing locks or changed accounts", async () => {
  const { input } = storeInput(), key = activePlanBetaStorageKey()
  localStorage.setItem(key, "EXISTING_PLAN")
  expect((await saveSelectedAdjustedPlanV3(input)).kind).toBe("rejected")
  expect(localStorage.getItem(key)).toBe("EXISTING_PLAN")
  expect(await saveSelectedAdjustedPlanV3({ ...input, locks: null })).toMatchObject({ code: "MUTATION_LOCK_UNAVAILABLE" })
  expect(await saveSelectedAdjustedPlanV3({ ...input, locks: { request: async (_n, _o, callback) => {
    setActiveLocalAccount("other"); return callback({})
  } } })).toMatchObject({ code: "STALE_CANDIDATE_SELECTION" })
  expect(localStorage.getItem(key)).toBe("EXISTING_PLAN")
})
it("rolls back only its own failed write and preserves another writer's replacement", async () => {
  for (const replace of [false, true]) {
    localStorage.clear(); setActiveLocalAccount(null)
    const { input } = storeInput(), key = activePlanBetaStorageKey(), originalSet = Storage.prototype.setItem
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k, value) {
      originalSet.call(this, k, replace && k === key ? "OTHER_WRITER" : value)
      if (k === key) throw Error("write confirmation failure")
    })
    expect((await saveSelectedAdjustedPlanV3(input)).kind).toBe("rejected")
    expect(localStorage.getItem(key)).toBe(replace ? "OTHER_WRITER" : null)
    spy.mockRestore()
  }
})
it("validates stored progress addresses, duplicate outcomes, timestamps and evidence uniqueness", () => {
  const { request, policy, retained } = fixture()
  const selected = selectAdjustedPlanForActivationV3(request, [policy], TODAY)
  if (selected.kind !== "selected_adjusted") throw Error(selected.code)
  const session = selected.state.activePlan.sessions[0]!
  const progress = { sessionDay: session.day, sessionSlot: session.slot, state: "SKIPPED" as const }
  expect(encodeStoredAdjustedPlanStateV5(selected.state, [progress], TODAY.toISOString(), [retained], TODAY).kind).toBe("encoded")
  for (const entries of [[progress, progress], [{ ...progress, sessionDay: 999 }]]) {
    expect(encodeStoredAdjustedPlanStateV5(selected.state, entries, TODAY.toISOString(), [retained], TODAY).kind).toBe("invalid")
  }
  expect(encodeStoredAdjustedPlanStateV5(selected.state, [], TODAY.toISOString(), [retained, retained], TODAY).kind).toBe("invalid")
  expect(encodeStoredAdjustedPlanStateV5(selected.state, [], new Date(TODAY.getTime() + 1).toISOString(), [retained], TODAY).kind).toBe("invalid")
})
it.each(["COMPLETED", "RESTED", "SKIPPED", "PAIN_CHECKIN"] as const)("stores %s without changing prescription or inventing measurements", async state => {
  const { input, retained } = storeInput()
  const selected = await saveSelectedAdjustedPlanV3(input)
  if (selected.kind !== "saved") throw Error(selected.code)
  const slot = selected.state.selection.activePlan.sessions.find(s => s.role === "QUALITY")!
  const result = await saveAdjustedPlanProgressV3({ expectedFingerprint: selected.state.contentFingerprint,
    progress: { sessionDay: slot.day, sessionSlot: slot.slot, state }, retained: [retained], locks: input.locks })
  if (result.kind !== "saved") throw Error(result.code)
  expect(result.state.selection).toEqual(selected.state.selection)
  expect(result.state.progress).toEqual([{ sessionDay: slot.day, sessionSlot: slot.slot, state }])
  expect(readStoredAdjustedPlanStateV5(JSON.parse(localStorage.getItem(activePlanBetaStorageKey())!), [retained], TODAY))
    .toMatchObject({ kind: "loaded", state: result.state })
  if (state === "PAIN_CHECKIN") {
    expect(await saveAdjustedPlanProgressV3({ expectedFingerprint: result.state.contentFingerprint,
      progress: { sessionDay: slot.day, sessionSlot: slot.slot, state: "COMPLETED" }, retained: [retained], locks: input.locks }))
      .toMatchObject({ code: "PAIN_REVIEW_REQUIRED" })
  }
})
it("rejects stale progress without changing stored bytes", async () => {
  const { input, retained } = storeInput()
  const selected = await saveSelectedAdjustedPlanV3(input)
  if (selected.kind !== "saved") throw Error(selected.code)
  const slot = selected.state.selection.activePlan.sessions[0]!, raw = localStorage.getItem(activePlanBetaStorageKey())
  expect(await saveAdjustedPlanProgressV3({ expectedFingerprint: "stale", progress: { sessionDay: slot.day,
    sessionSlot: slot.slot, state: "SKIPPED" }, retained: [retained], locks: input.locks })).toMatchObject({ code: "STALE_BASE" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
})
it("rejects progress accessors before parsing them", async () => {
  const getter = vi.fn(() => "COMPLETED")
  const progress = Object.defineProperty({ sessionDay: 1, sessionSlot: "AM" as const, state: "COMPLETED" as const },
    "state", { enumerable: true, get: getter })
  expect(await saveAdjustedPlanProgressV3({ expectedFingerprint: "test", progress })).toMatchObject({ code: "INVALID_PROGRESS" })
  expect(getter).not.toHaveBeenCalled()
})
