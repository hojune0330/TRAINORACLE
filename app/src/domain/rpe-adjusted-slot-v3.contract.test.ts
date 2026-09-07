import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createAdjustmentDraftV3, applyAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { draftFor, RUNTIME_CASES, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { unanchoredAdjustmentFixtureV3 } from "./unanchored-adjustment-v3.test-fixtures"
import { prepareUnanchoredAdjustmentOfferV3 } from "./unanchored-adjustment-offer-v3"
import { createAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { resolveQualityCandidateScope } from "./adjusted-plan-candidate"
import { prepareRpeAdjustedSlotV3, rpeSourceBindingScopeV3, type RpeAdjustedSlotInputV3 } from "./rpe-adjusted-slot-v3"
import { prepareMultiAdjustedPlanCandidateV3 } from "./adjusted-plan-multi-candidate-v3"
import { multiAdjustedPlanReviewScopeV3, checkMultiAdjustedPlanReviewV3 } from "./adjusted-plan-multi-review-v3"
import { selectMultiAdjustedPlanV3, readSelectedMultiAdjustedPlanV3 } from "./selected-multi-adjusted-plan-v3"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { saveSelectedMultiAdjustedPlanV6, readStoredMultiAdjustedPlanV6 } from "./adjusted-plan-storage-v6"
import { activePlanBetaStorageKey, savePlanBetaState, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { saveMultiAdjustedPlanProgressV3 } from "./adjusted-plan-progress"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
import { retainMultiAdjustedOriginalPlanV3, readMultiAdjustedOriginalPlansV3 } from "./multi-adjusted-plan-archive-v3"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { readJournalOriginalPlan } from "./journal-original-plan"
import { saveEntry, loadEntries } from "./journal-store"
import { MEMO_PURPOSE, type PostSessionEntry } from "./journal-schema"
import React from "react"
import { render, screen, cleanup } from "@testing-library/react"
import { AdjustedPrescriptionV3 } from "../screens/plan-beta/AdjustedPrescriptionV3"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
function fixture() {
  const intake = { ...draftFor(RUNTIME_CASES[3]), selectedDetailedTemplateRef: null }
  const generated = generatePlanFromDraft(intake, "NO_KNOWN_RISK", {})
  if (generated.kind !== "generated") throw Error("No generated candidate")
  const candidate = generated.generated.candidates[0], source = unanchoredAdjustmentFixtureV3(false, TODAY.getTime())
  const offer = prepareUnanchoredAdjustmentOfferV3(source)
  if (offer.kind !== "available") throw Error(offer.code)
  const draft = createAdjustmentDraftV3({ authority: offer.authority, current: offer.current, policy: offer.policy,
    target: offer.targets[0]!, contextKey: offer.contextKey, nowMs: source.nowMs })
  if (draft.kind !== "draft") throw Error(draft.code)
  const applied = applyAdjustmentDraftV3({ authority: offer.authority, current: offer.current, draft: draft.draft,
    contextKey: offer.contextKey, nowMs: source.nowMs, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw Error(applied.code)
  const explanation = { configuration: applied.prescription.configuration, resolutionContextKey: offer.contextKey,
    version: "1", reviewRef: "TEST_NOT_APPROVAL", purpose: "test", energySupply: "test", workRationale: "test",
    recoveryRationale: "test", cycleRole: "test", expectedAdaptation: "test", limitations: "test", observation: "test",
    evidenceRefs: ["TEST"], sequenceContentIdentity: sequenceV3ContentIdentity(applied.prescription.sequence), nodeIds: ["work"] }
  const inputs: RpeAdjustedSlotInputV3[] = candidate.sessions.filter(s => s.role === "QUALITY").map(session => {
    const address = { day: session.day, slot: session.slot }, startDate = "2026-09-08"
    const scope = resolveQualityCandidateScope(candidate, address, startDate)!
    const snapshot = createAdjustedMethodSnapshotV3({ authority: offer.authority, current: offer.current, receipt: applied.receipt,
      contextKey: offer.contextKey, nowMs: source.nowMs, scope, explanation })
    if (snapshot.kind !== "prepared") throw Error(snapshot.code)
    return { candidate, address, startDate, source, explanation, rawSnapshot: JSON.stringify(snapshot.snapshot), experienceBand: intake.experienceBand }
  })
  const scopes = inputs.map(input => {
    const result = rpeSourceBindingScopeV3(input)
    if (result.kind !== "scope") throw Error(result.code)
    return result.scopeFingerprint
  })
  const bindings = [...new Set(scopes)].map((scopeFingerprint, i) => ({ bindingId: `TEST-${i}`, version: "1",
    scopeFingerprint, reviewRef: "TEST_NOT_APPROVAL", validFromMs: source.nowMs - 50, expiresAtMs: source.nowMs + 50, revokedAtMs: null }))
  return { inputs, bindings, generated }
}

it("connects every real generated RPE MAIN to independently scoped detailed content without any athlete record", () => {
  const { inputs, bindings } = fixture()
  expect(inputs.length).toBeGreaterThanOrEqual(2)
  const result = prepareMultiAdjustedPlanCandidateV3(inputs, bindings)
  if (result.kind !== "prepared") throw Error(result.code)
  expect(result.candidate.changedSlots).toHaveLength(inputs.length)
  expect(result.candidate.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")).toHaveLength(inputs.length)
  expect(prepareMultiAdjustedPlanCandidateV3([...inputs].reverse(), bindings)).toEqual(result)
  for (const session of result.candidate.sessions) {
    if (session.prescription.kind !== "ADJUSTED_METHOD_V3") continue
    expect(session.prescription.projection).toMatchObject({ recordBasis: "NOT_USED", segmentTargets: [],
      originalPrescription: { kind: "RPE_TIME_RANGE" }, structuralTotals: { main: { workSeconds: 120, recoverySeconds: 120 } } })
  }
  expect(result.candidate.selectionAuthority).toBe("NONE")
})

function storageFixture() {
  const { inputs, bindings, generated } = fixture()
  const scope = multiAdjustedPlanReviewScopeV3(inputs, inputs[0]!.experienceBand, bindings)
  if (scope.kind !== "scope") throw Error(scope.code)
  const policy = { scopeVersion: "MULTI_STRUCTURAL_V3" as const, policyId: "TEST", version: "1", scopeFingerprint: scope.scopeFingerprint,
    configurationReviewRef: "TEST-C", exposureReviewRef: "TEST-E", interactionReviewRef: "TEST-I", safetyReviewRef: "TEST-S",
    validFromMs: TODAY.getTime() - 50, expiresAtMs: TODAY.getTime() + 50, revokedAtMs: null }
  const request = { action: "USER_EXPLICIT" as const, preparations: inputs, generated: generated.generated, gate: generated.gate,
    intake: generated.intake, athleteEvidence: generated.athleteEvidence, currentCheck: "NO_KNOWN_RISK" as const,
    expectedCandidateFingerprint: scope.candidate.contentFingerprint }
  const retained = [{ slots: inputs.map(i => ({ address: i.address, authority: i.source.authority, explanation: i.explanation })),
    rpeBindings: bindings, policies: [policy] }]
  const locks: PlanMutationLockManager = { request: async (_n, _o, callback) => callback({}) }
  return { request, locks, isCurrentDraft: () => true,
    readReview: () => ({ preparations: inputs, rpeBindings: bindings, policies: [policy], retained }) }
}

it("writes and independently reads a real multi-slot V6 plan, replaying the same unprogressed selection", async () => {
  const input = storageFixture(), result = await saveSelectedMultiAdjustedPlanV6(input)
  expect(result).toMatchObject({ kind: "saved", replayed: false })
  const raw = localStorage.getItem(activePlanBetaStorageKey())!
  expect(readStoredMultiAdjustedPlanV6(JSON.parse(raw), input.readReview().retained, TODAY)).toMatchObject({ kind: "loaded", executionAuthority: "NONE" })
  expect(readStoredMultiAdjustedPlanV6(JSON.parse(raw), [], TODAY).kind).toBe("invalid")
  expect(await saveSelectedMultiAdjustedPlanV6(input)).toMatchObject({ kind: "saved", replayed: true })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
  const original = selectPlanForActivation(input.request.preparations[0]!.candidate.candidateId, input.request.generated,
    input.request.gate, { ...input.request.intake, startDate: input.request.preparations[0]!.startDate }, input.request.athleteEvidence, TODAY)
  if (original.kind !== "selected") throw Error("Original selection failed")
  expect(savePlanBetaState(original.state).ok).toBe(false)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
})

it("reads through the shared account store and records each adjusted MAIN independently without changing the prescription", async () => {
  const input = storageFixture(), saved = await saveSelectedMultiAdjustedPlanV6(input)
  if (saved.kind !== "saved") throw Error("Initial save failed")
  const retained = input.readReview().retained
  const read = () => readPlanBetaStateFromStorage([], [], retained)
  expect(read()).toMatchObject({ kind: "multi_adjusted_v3_loaded", state: saved.state })
  expect(readPlanBetaStateFromStorage().kind).toBe("invalid")
  const slots = saved.state.selection.activePlan.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")
  expect(slots.length).toBeGreaterThan(1)
  let fingerprint = saved.state.contentFingerprint
  for (const [index, slot] of slots.entries()) {
    const result = await saveMultiAdjustedPlanProgressV3({ expectedFingerprint: fingerprint, retained, locks: input.locks,
      progress: { sessionDay: slot.day, sessionSlot: slot.slot, state: index === 0 ? "COMPLETED" : "PAIN_CHECKIN" } })
    if (result.kind !== "saved") throw Error(result.code)
    expect(result.state.selection).toEqual(saved.state.selection)
    expect(result.state.progress).toHaveLength(index + 1)
    fingerprint = result.state.contentFingerprint
  }
  const pain = slots[1]!
  expect(await saveMultiAdjustedPlanProgressV3({ expectedFingerprint: fingerprint, retained, locks: input.locks,
    progress: { sessionDay: pain.day, sessionSlot: pain.slot, state: "RESTED" } })).toMatchObject({ code: "PAIN_REVIEW_REQUIRED" })
  expect(await saveMultiAdjustedPlanProgressV3({ expectedFingerprint: saved.state.contentFingerprint, retained, locks: input.locks,
    progress: { sessionDay: slots[0]!.day, sessionSlot: slots[0]!.slot, state: "SKIPPED" } })).toMatchObject({ code: "STALE_BASE" })
  expect(read()).toMatchObject({ kind: "multi_adjusted_v3_loaded", state: { contentFingerprint: fingerprint } })
  setActiveLocalAccount("another-account")
  expect(read().kind).toBe("missing")
})

it("retains a multi-plan journal original and reads the exact slot after the active plan is gone without reading memo", async () => {
  setActiveLocalAccount("journal-owner")
  const input = storageFixture(), saved = await saveSelectedMultiAdjustedPlanV6(input)
  if (saved.kind !== "saved") throw Error("Initial save failed")
  const retained = input.readReview().retained
  const slot = saved.state.selection.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  const draft = createPlannedSessionLogDraft(saved.state.selection, slot, TODAY.toISOString())!
  expect(await retainMultiAdjustedOriginalPlanV3(saved.state.contentFingerprint, { retained, locks: input.locks })).toEqual({ kind: "retained" })
  expect(await retainMultiAdjustedOriginalPlanV3(saved.state.contentFingerprint, { retained, locks: input.locks })).toEqual({ kind: "retained" })
  expect(readMultiAdjustedOriginalPlansV3(retained, TODAY)).toMatchObject({ kind: "loaded", entries: [{ state: saved.state }] })
  const entry: PostSessionEntry = { id: "synthetic-multi-journal", kind: "post-session", date: draft.date,
    savedAt: TODAY.toISOString(), syncState: "local", activitySlot: slot.slot, plannedSessionLink: draft.link,
    system: "", title: "", memo: "PRIVATE-NOTE", memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
    distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }
  expect(saveEntry(entry).ok).toBe(true)
  const loaded = loadEntries().find(e => e.id === entry.id)!
  if (loaded.kind !== "post-session") throw Error("Wrong journal kind")
  const getter = vi.fn(() => "PRIVATE-NOTE")
  Object.defineProperty(loaded, "memo", { enumerable: true, get: getter })
  expect(readJournalOriginalPlan(loaded, [], [], retained)).toMatchObject({ kind: "matched_multi_adjusted_v3", source: "ACTIVE", session: slot })
  localStorage.removeItem(activePlanBetaStorageKey())
  const original = readJournalOriginalPlan(loaded, [], [], retained)
  expect(original).toMatchObject({ kind: "matched_multi_adjusted_v3", source: "ARCHIVED", session: slot })
  expect(getter).not.toHaveBeenCalled()
  if (original.kind !== "matched_multi_adjusted_v3") throw Error("Original missing")
  expect(original.explanation).toEqual(retained[0]!.slots.find(s => s.address.day === slot.day && s.address.slot === slot.slot)!.explanation)
  render(React.createElement(AdjustedPrescriptionV3, { session: original.session, explanation: original.explanation }))
  expect(screen.queryByText("저장 당시 기록으로 계산한 참고 시간")).toBeNull()
  expect(screen.getByText("이 훈련을 하는 이유")).toBeTruthy()
  expect(loaded.distanceKm).toBe("")
  setActiveLocalAccount("another-account")
  expect(readJournalOriginalPlan(loaded, [], [], retained).kind).toBe("unavailable")
})

it.each(["expiry", "other-writer"])("handles %s during a real multi-plan write without overwriting another writer", async change => {
  const input = storageFixture(), original = Storage.prototype.setItem, key = activePlanBetaStorageKey()
  let injected = false
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, name, value) {
    original.call(this, name, value)
    if (name === key && !injected) {
      injected = true
      if (change === "expiry") vi.setSystemTime(new Date(TODAY.getTime() + 100))
      else original.call(this, key, "OTHER_WRITER")
    }
  })
  const result = await saveSelectedMultiAdjustedPlanV6(input)
  expect(injected).toBe(true)
  expect(result).toMatchObject({ code: change === "expiry" ? "PLAN_STORAGE_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN" })
  expect(localStorage.getItem(key)).toBe(change === "expiry" ? null : "OTHER_WRITER")
})

it("rejects account changes while waiting for the multi-plan lock", async () => {
  const input = storageFixture(), key = activePlanBetaStorageKey()
  expect(await saveSelectedMultiAdjustedPlanV6({ ...input, locks: { request: async (_n, _o, callback) => {
    setActiveLocalAccount("other"); return callback({})
  } } })).toMatchObject({ code: "STALE_CANDIDATE_SELECTION" })
  expect(localStorage.getItem(key)).toBeNull()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})
it("requires a matching binding review and rejects expiration, relocation and changed experience", () => {
  const { inputs, bindings } = fixture(), input = inputs[0]!
  expect(prepareRpeAdjustedSlotV3(input)).toMatchObject({ kind: "unavailable", code: "RPE_SOURCE_BINDING_REVIEW_REQUIRED" })
  expect(prepareRpeAdjustedSlotV3(input, bindings.map(b => ({ ...b, expiresAtMs: 149 }))).kind).toBe("unavailable")
  expect(prepareRpeAdjustedSlotV3({ ...input, rawSnapshot: inputs[1]!.rawSnapshot }, bindings).kind).toBe("unavailable")
  expect(prepareRpeAdjustedSlotV3({ ...input, experienceBand: "NEW_TO_RUNNING" }, bindings).kind).toBe("unavailable")
  expect(prepareMultiAdjustedPlanCandidateV3([input, input], bindings)).toMatchObject({ code: "DUPLICATE_ADJUSTED_SLOT" })
})

it("requires a separate exact whole-plan review even when all individual bindings are accepted", () => {
  const { inputs, bindings } = fixture(), experience = inputs[0]!.experienceBand
  const scope = multiAdjustedPlanReviewScopeV3(inputs, experience, bindings)
  if (scope.kind !== "scope") throw Error(scope.code)
  expect(checkMultiAdjustedPlanReviewV3(inputs, experience, bindings)).toMatchObject({ code: "MULTI_PLAN_CONFIGURATION_REVIEW_REQUIRED" })
  const policy = { scopeVersion: "MULTI_STRUCTURAL_V3" as const, policyId: "TEST", version: "1", scopeFingerprint: scope.scopeFingerprint,
    configurationReviewRef: "TEST-C", exposureReviewRef: "TEST-E", interactionReviewRef: "TEST-I", safetyReviewRef: "TEST-S",
    validFromMs: TODAY.getTime() - 50, expiresAtMs: TODAY.getTime() + 50, revokedAtMs: null }
  const result = checkMultiAdjustedPlanReviewV3(inputs, experience, bindings, [policy])
  expect(result).toMatchObject({ kind: "reviewed_scope", executionAuthority: "NONE" })
  expect(checkMultiAdjustedPlanReviewV3([...inputs].reverse(), experience, bindings, [policy])).toEqual(result)
  expect(checkMultiAdjustedPlanReviewV3(inputs.slice(0, 1), experience, bindings, [policy]).kind).toBe("unavailable")
  expect(checkMultiAdjustedPlanReviewV3(inputs, experience, bindings, [{ ...policy, revokedAtMs: 140 }]).kind).toBe("unavailable")
  expect(checkMultiAdjustedPlanReviewV3(inputs, experience, bindings, [policy, policy])).toMatchObject({ code: "AMBIGUOUS_MULTI_PLAN_REVIEW" })
  expect(checkMultiAdjustedPlanReviewV3(inputs, "NEW_TO_RUNNING", bindings, [policy])).toMatchObject({ code: "SOURCE_EXPERIENCE_MISMATCH" })
})

it("selects a real multi-slot candidate only after explicit action and current whole-plan review, without writing", () => {
  const { inputs, bindings, generated } = fixture()
  const scope = multiAdjustedPlanReviewScopeV3(inputs, inputs[0]!.experienceBand, bindings)
  if (scope.kind !== "scope") throw Error(scope.code)
  const policy = { scopeVersion: "MULTI_STRUCTURAL_V3" as const, policyId: "TEST", version: "1", scopeFingerprint: scope.scopeFingerprint,
    configurationReviewRef: "TEST-C", exposureReviewRef: "TEST-E", interactionReviewRef: "TEST-I", safetyReviewRef: "TEST-S",
    validFromMs: TODAY.getTime() - 50, expiresAtMs: TODAY.getTime() + 50, revokedAtMs: null }
  const request = { action: "USER_EXPLICIT" as const, preparations: inputs, generated: generated.generated, gate: generated.gate,
    intake: generated.intake, athleteEvidence: generated.athleteEvidence, currentCheck: "NO_KNOWN_RISK" as const,
    expectedCandidateFingerprint: scope.candidate.contentFingerprint }
  const write = vi.spyOn(Storage.prototype, "setItem")
  const before = { ...localStorage }
  const result = selectMultiAdjustedPlanV3(request, bindings, [policy], TODAY)
  expect(result).toMatchObject({ kind: "selected_multi_adjusted", storageState: "NOT_SAVED" })
  expect(write.mock.calls.every(([key]) => key === "__to_probe__")).toBe(true)
  expect({ ...localStorage }).toEqual(before)
  expect(selectMultiAdjustedPlanV3({ ...request, currentCheck: "REVIEW_REQUIRED" }, bindings, [policy], TODAY).kind).not.toBe("selected_multi_adjusted")
  expect(selectMultiAdjustedPlanV3({ ...request, expectedCandidateFingerprint: "changed" }, bindings, [policy], TODAY)).toMatchObject({ code: "ADJUSTED_SELECTION_CHANGED" })
  expect(selectMultiAdjustedPlanV3(request, bindings, [policy], new Date(TODAY.getTime() + 100)).kind).not.toBe("selected_multi_adjusted")
  if (result.kind !== "selected_multi_adjusted") throw Error(result.code)
  const evidence = { slots: inputs.map(i => ({ address: i.address, authority: i.source.authority, explanation: i.explanation })),
    rpeBindings: bindings, policies: [policy] }
  const future = new Date(TODAY.getTime() + 1000)
  expect(readSelectedMultiAdjustedPlanV3(result.state, evidence, future)).toMatchObject({ kind: "read_only", executionAuthority: "NONE", state: result.state })
  expect(readSelectedMultiAdjustedPlanV3(result.state, { ...evidence, slots: evidence.slots.slice(1) }, future).kind).not.toBe("read_only")
  const tampered = structuredClone(result.state)
  const changed = tampered.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  if (changed.prescription.kind !== "ADJUSTED_METHOD_V3") throw Error("No adjusted slot")
  const altered = { ...tampered, activePlan: { ...tampered.activePlan, sessions: tampered.activePlan.sessions.map(s => s === changed
    ? { ...s, prescription: { ...changed.prescription, projectionFingerprint: "changed" } } : s) } }
  const { contentFingerprint: _fingerprint, ...content } = altered
  const forged = { ...content, contentFingerprint: canonicalJsonFingerprint("trainoracle.multi-plan-selection.v3", content) }
  expect(readSelectedMultiAdjustedPlanV3(forged, evidence, future)).toMatchObject({ code: "MULTI_PLAN_CONTENT_MISMATCH" })
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("No live storage in historical read") })
  expect(readSelectedMultiAdjustedPlanV3(result.state, evidence, future).kind).toBe("read_only")
  expect(read).not.toHaveBeenCalled()
})
