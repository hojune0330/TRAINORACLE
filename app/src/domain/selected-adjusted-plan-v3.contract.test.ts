import { beforeEach, afterEach, expect, it, vi } from "vitest"
import React from "react"
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react"
import { PlanBeta } from "../screens/PlanBeta"
import * as mutationLocks from "./plan-mutation-lock"
import * as originalPlans from "./journal-original-plan"
import { JournalOriginalPlan } from "../screens/journal/JournalOriginalPlan"
import { saveEntry, loadEntries } from "./journal-store"
import { MEMO_PURPOSE, type PostSessionEntry } from "./journal-schema"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { readAdjustedOriginalPlansV3, retainAdjustedOriginalPlanV3, ADJUSTED_PLAN_ARCHIVE_V3_KEY, parseAdjustedOriginalArchiveV3 } from "./adjusted-plan-archive-v3"
import { exportAdjustedPlanBackupV3, readAdjustedPlanBackupV3, importAdjustedPlanHistoryV3 } from "./adjusted-plan-backup-v3"
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
import { prepareAdjustedNextFrameV3 } from "./adjusted-plan-continuity"
import { isoShift } from "./dates"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
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
it("prepares V3 next-cycle history without changing the plan or treating missing outcomes as completed", async () => {
  const { input, retained } = storeInput()
  const saved = await saveSelectedAdjustedPlanV3(input)
  if (saved.kind !== "saved") throw Error(saved.code)
  const state = saved.state, start = state.selection.intake.startDate!
  const request = { previous: state, expectedFingerprint: state.contentFingerprint,
    nextStartDate: start, currentCheck: "NO_KNOWN_RISK" as const }
  const before = localStorage.getItem(activePlanBetaStorageKey())
  expect(prepareAdjustedNextFrameV3(request, [retained], new Date(`${start}T12:00:00`)))
    .toMatchObject({ code: "INCOMPLETE_FRAME" })
  const next = isoShift(start, Math.max(...state.selection.activePlan.sessions.map(s => s.day)))
  const at = new Date(`${next}T12:00:00`)
  const prepared = prepareAdjustedNextFrameV3({ ...request, nextStartDate: next }, [retained], at)
  expect(prepared).toMatchObject({ kind: "prepared", context: {
    completionBasis: "DISPLAYED_FRAME_ELAPSED", executionAuthority: "NONE", storageState: "NOT_SAVED",
    predecessorFingerprint: state.contentFingerprint,
    periodization: { programLineageId: state.selection.periodization.programLineageId, frameOrdinal: 2 },
  } })
  if (prepared.kind !== "prepared") throw Error(prepared.code)
  expect(prepared.context.missingRequiredOutcomes).toBeGreaterThan(0)
  expect(prepared.context.continuity.progressStateCounts.every(row => row.count === 0)).toBe(true)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  expect(prepareAdjustedNextFrameV3({ ...request, nextStartDate: next }, [], at)).toMatchObject({ code: "INVALID_STORED_PLAN" })
  expect(prepareAdjustedNextFrameV3({ ...request, nextStartDate: next, expectedFingerprint: "stale" }, [retained], at))
    .toMatchObject({ code: "STALE_BASE" })
})
it("preserves V3 explicit outcomes and pain holds across next-cycle preparation", () => {
  const { request, policy, retained } = fixture()
  const selected = selectAdjustedPlanForActivationV3(request, [policy], TODAY)
  if (selected.kind !== "selected_adjusted") throw Error(selected.code)
  const sessions = selected.state.activePlan.sessions.filter(s => s.role !== "REST")
  const start = selected.state.intake.startDate!, at = new Date(`${start}T12:00:00`)
  for (const pain of [false, true]) {
    const progress = sessions.map((s, i) => ({ sessionDay: s.day, sessionSlot: s.slot,
      state: pain && i === 0 ? "PAIN_CHECKIN" as const : "SKIPPED" as const }))
    const encoded = encodeStoredAdjustedPlanStateV5(selected.state, progress, TODAY.toISOString(), [retained], at)
    if (encoded.kind !== "encoded") throw Error("encode")
    const context = { previous: encoded.state, expectedFingerprint: encoded.state.contentFingerprint,
      nextStartDate: start, currentCheck: "NO_KNOWN_RISK" as const }
    const result = prepareAdjustedNextFrameV3(context, [retained], at)
    if (pain) expect(result).toMatchObject({ code: "ACTIVE_HOLD" })
    else {
      expect(result).toMatchObject({ kind: "prepared", context: { completionBasis: "EXPLICIT_OUTCOMES", missingRequiredOutcomes: 0 } })
      if (result.kind === "prepared") expect(result.context.continuity.progressStateCounts.find(r => r.state === "SKIPPED")?.count).toBe(sessions.length)
    }
    expect(prepareAdjustedNextFrameV3({ ...context, currentCheck: "REVIEW_REQUIRED" }, [retained], at).kind).toBe("rejected")
    const getter = vi.fn(() => "private")
    expect(prepareAdjustedNextFrameV3(Object.defineProperty({ ...context }, "memo", { enumerable: true, get: getter }), [retained], at))
      .toMatchObject({ code: "INVALID_CONTINUITY_INPUT" })
    expect(getter).not.toHaveBeenCalled()
  }
})
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
it("opens saved V3 in the real plan screen, records an outcome and restores it without changing targets", async () => {
  const { input, retained } = storeInput()
  const saved = await saveSelectedAdjustedPlanV3(input)
  if (saved.kind !== "saved") throw Error(saved.code)
  vi.spyOn(mutationLocks, "getPlanMutationLockManager").mockReturnValue(input.locks!)
  const props = { readAdjustedEvidenceV3: () => [retained] }
  const view = render(React.createElement(PlanBeta, props))
  expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeVisible()
  const slot = saved.state.selection.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  const start = new Date(`${saved.state.selection.intake.startDate}T12:00:00`)
  start.setDate(start.getDate() + slot.day - 1)
  const dateLabel = `${String(start.getMonth() + 1).padStart(2, "0")}/${String(start.getDate()).padStart(2, "0")}`
  fireEvent.click(within(screen.getByRole("navigation", { name: "훈련 날짜" })).getByRole("button", { name: dateLabel }))
  expect(screen.getByText(/200m당 약/)).toBeVisible()
  expect(screen.getByText("걷기 · 100m")).toBeVisible()
  const groupName = `${slot.slot === "AM" ? "오전" : "오후"} 진행 기록`
  await act(async () => { fireEvent.click(within(screen.getByRole("group", { name: groupName })).getByRole("button", { name: "건너뜀" })) })
  expect(within(screen.getByRole("group", { name: groupName })).getByRole("button", { name: "건너뜀" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByText(/200m당 약/)).toBeVisible()
  view.unmount()
  render(React.createElement(PlanBeta, props))
  fireEvent.click(within(screen.getByRole("navigation", { name: "훈련 날짜" })).getByRole("button", { name: dateLabel }))
  expect(within(screen.getByRole("group", { name: groupName })).getByRole("button", { name: "건너뜀" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByText(/200m당 약/)).toBeVisible()
  act(() => setActiveLocalAccount("another"))
  expect(screen.queryByText(/200m당 약/)).toBeNull()
})
it("links a real journal to V3 and renders its original without copying planned measurements or reading memo", async () => {
  const { input, retained } = storeInput()
  const saved = await saveSelectedAdjustedPlanV3(input)
  if (saved.kind !== "saved") throw Error(saved.code)
  const slot = saved.state.selection.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  const draft = createPlannedSessionLogDraft(saved.state.selection, slot, TODAY.toISOString())!
  const onWrite = vi.fn()
  vi.spyOn(mutationLocks, "getPlanMutationLockManager").mockReturnValue(input.locks!)
  const view = render(React.createElement(PlanBeta, { readAdjustedEvidenceV3: () => [retained],
    returnToSession: draft.link, onWritePlannedSessionLog: onWrite }))
  await act(async () => { fireEvent.click(within(screen.getByRole("region", { name: `${slot.slot === "AM" ? "오전" : "오후"} 훈련` }))
    .getByRole("button", { name: "이 훈련 일지 쓰기" })) })
  expect(onWrite).toHaveBeenCalledWith(draft)
  expect(readAdjustedOriginalPlansV3([retained], TODAY)).toMatchObject({ kind: "loaded", entries: [{ state: saved.state }] })
  expect(Object.keys(draft).sort()).toEqual(["date", "link"])
  view.unmount()
  const entry: PostSessionEntry = { id: "synthetic-v3-journal", kind: "post-session", date: draft.date,
    savedAt: TODAY.toISOString(), syncState: "local", activitySlot: slot.slot, plannedSessionLink: draft.link,
    system: "", title: "", memo: "PRIVATE-NOTE-NOT-ANALYSIS", memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
    distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }
  expect(saveEntry(entry).ok).toBe(true)
  const loaded = loadEntries().find(e => e.id === entry.id)!
  if (loaded.kind !== "post-session") throw Error("journal kind")
  expect(loaded.distanceKm).toBe("")
  const originalRead = originalPlans.readJournalOriginalPlan
  expect(originalRead(loaded, [], [retained])).toMatchObject({ kind: "matched_adjusted_v3", session: slot })
  localStorage.removeItem(activePlanBetaStorageKey())
  expect(originalRead(loaded, [], [retained])).toMatchObject({ kind: "matched_adjusted_v3", source: "ARCHIVED", session: slot })
  vi.spyOn(originalPlans, "readJournalOriginalPlan").mockImplementation(e => originalRead(e, [], [retained]))
  const getter = vi.fn(() => "PRIVATE-NOTE-NOT-ANALYSIS")
  Object.defineProperty(loaded, "memo", { enumerable: true, get: getter })
  render(React.createElement(JournalOriginalPlan, { entry: loaded }))
  const details = screen.getByText("계획한 훈련과 비교하기").closest("details")!
  act(() => { details.open = true; fireEvent(details, new Event("toggle")) })
  expect(screen.getByText(/200m당 약/)).toBeVisible()
  expect(screen.getByText("걷기 · 100m")).toBeVisible()
  expect(getter).not.toHaveBeenCalled()
  expect(screen.queryByText("PRIVATE-NOTE-NOT-ANALYSIS")).toBeNull()
  act(() => setActiveLocalAccount("other"))
  expect(screen.queryByText(/200m당 약/)).toBeNull()
})
it("does not archive stale state and rejects corrupt or unsupported retained originals", async () => {
  const { input, retained } = storeInput()
  const saved = await saveSelectedAdjustedPlanV3(input)
  if (saved.kind !== "saved") throw Error(saved.code)
  expect(await retainAdjustedOriginalPlanV3("stale", { retained: [retained], locks: input.locks })).toMatchObject({ code: "STALE_BASE" })
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_V3_KEY)).toBeNull()
  expect(await retainAdjustedOriginalPlanV3(saved.state.contentFingerprint, { retained: [retained], locks: input.locks })).toMatchObject({ kind: "retained" })
  const raw = localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_V3_KEY)!
  expect(await retainAdjustedOriginalPlanV3(saved.state.contentFingerprint, { retained: [retained], locks: input.locks })).toMatchObject({ kind: "retained" })
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_V3_KEY)).toBe(raw)
  expect(parseAdjustedOriginalArchiveV3(raw, [], TODAY).kind).toBe("invalid")
  const changed = JSON.parse(raw)
  changed.entries[0].state.progress = [{ sessionDay: 999, sessionSlot: "AM", state: "COMPLETED" }]
  expect(parseAdjustedOriginalArchiveV3(JSON.stringify(changed), [retained], TODAY).kind).toBe("invalid")
})
it("does not open linked journal when preserving the original fails", async () => {
  const { input, retained } = storeInput()
  const saved = await saveSelectedAdjustedPlanV3(input)
  if (saved.kind !== "saved") throw Error(saved.code)
  const slot = saved.state.selection.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  const draft = createPlannedSessionLogDraft(saved.state.selection, slot, TODAY.toISOString())!, onWrite = vi.fn()
  vi.spyOn(mutationLocks, "getPlanMutationLockManager").mockReturnValue(null)
  render(React.createElement(PlanBeta, { readAdjustedEvidenceV3: () => [retained], returnToSession: draft.link, onWritePlannedSessionLog: onWrite }))
  await act(async () => { fireEvent.click(within(screen.getByRole("region", { name: `${slot.slot === "AM" ? "오전" : "오후"} 훈련` }))
    .getByRole("button", { name: "이 훈련 일지 쓰기" })) })
  expect(onWrite).not.toHaveBeenCalled()
  expect(screen.getByRole("alert")).toHaveTextContent("계획 원본을 보관하지 못했어요")
})
it("exports and imports V3 originals without activating a file or changing an existing plan", async () => {
  const { input, retained } = storeInput(), saved = await saveSelectedAdjustedPlanV3(input)
  if (saved.kind !== "saved") throw Error(saved.code)
  const output = exportAdjustedPlanBackupV3(saved.state.contentFingerprint, [retained], TODAY)
  if (output.kind !== "exported") throw Error("export")
  expect(readAdjustedPlanBackupV3(output.raw, [retained], TODAY)).toMatchObject({ kind: "read_only", executionAuthority: "NONE", storageState: "NOT_RESTORED" })
  expect(output.raw).not.toContain('"memo"')
  localStorage.setItem(activePlanBetaStorageKey(), "EXISTING-PLAN-NOT-REPLACED")
  const request = { raw: output.raw, confirmsOwnFile: true, isCurrentRequest: () => true, readEvidence: () => [retained], locks: input.locks }
  expect(await importAdjustedPlanHistoryV3({ ...request, confirmsOwnFile: false })).toMatchObject({ code: "OWN_FILE_CONFIRMATION_REQUIRED" })
  expect(await importAdjustedPlanHistoryV3(request)).toMatchObject({ kind: "restored_history", added: 1, activePlanChanged: false })
  expect(await importAdjustedPlanHistoryV3(request)).toMatchObject({ kind: "restored_history", added: 0 })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe("EXISTING-PLAN-NOT-REPLACED")
  expect(readAdjustedOriginalPlansV3([retained], TODAY)).toMatchObject({ kind: "loaded", entries: [{ state: saved.state }] })
  const changed = JSON.parse(output.raw); changed.memo = "private"
  expect(readAdjustedPlanBackupV3(JSON.stringify(changed), [retained], TODAY).kind).toBe("invalid")
  expect(await importAdjustedPlanHistoryV3({ ...request, isCurrentRequest: () => false })).toMatchObject({ code: "STALE_IMPORT" })
})
it("opens the shared import screen from V3 and requires confirmation before restoring history", async () => {
  const { input, retained } = storeInput(), saved = await saveSelectedAdjustedPlanV3(input)
  if (saved.kind !== "saved") throw Error(saved.code)
  const output = exportAdjustedPlanBackupV3(saved.state.contentFingerprint, [retained], TODAY)
  if (output.kind !== "exported") throw Error("export")
  vi.spyOn(mutationLocks, "getPlanMutationLockManager").mockReturnValue(input.locks!)
  render(React.createElement(PlanBeta, { readAdjustedEvidenceV3: () => [retained] }))
  fireEvent.click(screen.getByText("저장과 이용 안내"))
  fireEvent.click(screen.getByRole("button", { name: "개인 계획 파일 불러오기" }))
  expect(screen.getByRole("heading", { name: "계획 원본 불러오기" })).toBeVisible()
  const file = new File([output.raw], "plan.json", { type: "application/json" })
  Object.defineProperty(file, "text", { value: async () => output.raw })
  await act(async () => { fireEvent.change(screen.getByLabelText("개인 보관용 계획 파일"), { target: { files: [file] } }) })
  expect(screen.getByRole("button", { name: "과거 원본 보관함에 추가" })).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox"))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "과거 원본 보관함에 추가" })) })
  expect(screen.getByRole("status")).toHaveTextContent("훈련 일정은 바뀌지 않았어요")
  expect(JSON.parse(localStorage.getItem(activePlanBetaStorageKey())!)).toEqual(saved.state)
})
