import { afterEach, beforeEach, expect, it, vi } from "vitest"
import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { PlanBeta } from "../screens/PlanBeta"
import { adjustedPlanSelectionV3Fixture } from "./adjusted-plan-selection-v3.test-fixtures"
import { selectAdjustedPlanForActivationV3, type RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-v3"
import { encodeStoredAdjustedPlanStateV5, readStoredAdjustedPlanStateV5, type StoredAdjustedPlanStateV5 } from "./adjusted-plan-storage-v5"
import { saveSelectedAdjustedSuccessorV3 } from "./adjusted-plan-successor-v3"
import { generateAdjustedNextFrameV3FromDraft } from "./plan-beta-flow"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { ADJUSTED_PLAN_ARCHIVE_V3_KEY, readAdjustedOriginalPlansV3 } from "./adjusted-plan-archive-v3"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { accountScopedStorageKey } from "./account/local-account-scope"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { loadAthleteRecords, activeAthleteRecordsStorageKey } from "./athlete-records"
import { isoShift } from "./dates"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { saveEntry, loadEntries } from "./journal-store"
import type { PostSessionEntry } from "./journal-schema"
import { readJournalOriginalPlan } from "./journal-original-plan"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

function nextInput(previous: StoredAdjustedPlanStateV5, retained: readonly RetainedAdjustedPlanEvidenceV3[]) {
  const nextStart = isoShift(previous.selection.intake.startDate!, Math.max(...previous.selection.activePlan.sessions.map(s => s.day)))
  const at = new Date(`${nextStart}T12:00:00`)
  vi.setSystemTime(at)
  const raw = localStorage.getItem(activePlanBetaStorageKey())
  const generated = generateAdjustedNextFrameV3FromDraft({ draft: { ...previous.selection.intake, startDate: nextStart },
    currentCheck: "NO_KNOWN_RISK", expectedPredecessorFingerprint: previous.contentFingerprint,
    prescriptionSelection: { selectedRecordId: loadAthleteRecords(at)[0]!.id } }, retained)
  if (generated.kind !== "adjusted_next_frame_v3_draft") throw Error(generated.code)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
  const next = adjustedPlanSelectionV3Fixture(generated.draft, at)
  const allEvidence = [...retained, next.retained]
  const input: Parameters<typeof saveSelectedAdjustedSuccessorV3>[0] = {
    request: next.request, expectedPredecessorFingerprint: previous.contentFingerprint, isCurrentDraft: () => true,
    readReview: () => ({ source: next.request.preparation.source, explanation: next.retained.explanation,
      policies: [next.policy], retained: allEvidence }), locks: { request: async (_n, _o, callback) => callback({}) },
  }
  return { input, next, retained: allEvidence, at, generated }
}

function setup() {
  const first = adjustedPlanSelectionV3Fixture()
  const selected = selectAdjustedPlanForActivationV3(first.request, [first.policy], TODAY)
  if (selected.kind !== "selected_adjusted") throw Error(selected.code)
  const progress = selected.state.activePlan.sessions.filter(s => s.role !== "REST")
    .map(s => ({ sessionDay: s.day, sessionSlot: s.slot, state: "SKIPPED" as const }))
  const old = encodeStoredAdjustedPlanStateV5(selected.state, progress, TODAY.toISOString(), [first.retained], TODAY)
  if (old.kind !== "encoded") throw Error("old")
  localStorage.setItem(activePlanBetaStorageKey(), old.raw)
  return { old, ...nextInput(old.state, [first.retained]) }
}

it("generates and saves a real V3 successor while retaining both old and new journal originals", async () => {
  const { input, old, retained, at, generated } = setup()
  expect(generated.requiredNextGate).toBe("REVIEWED_SUCCESSOR_V3_TRANSACTION")
  expect(generated.continuity.continuity.progressStateCounts.find(s => s.state === "COMPLETED")?.count).toBe(0)
  const oldSession = old.state.selection.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  const oldLink = createPlannedSessionLogDraft(old.state.selection, oldSession, at.toISOString())!
  const entry: PostSessionEntry = { id: "old-v3", kind: "post-session", date: oldLink.date, savedAt: at.toISOString(),
    syncState: "local", activitySlot: oldSession.slot, plannedSessionLink: oldLink.link,
    system: "", title: "", memo: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }
  expect(saveEntry(entry).ok).toBe(true)
  const result = await saveSelectedAdjustedSuccessorV3(input)
  if (result.kind !== "saved") throw Error(result.code)
  expect(result.state.selection.periodization).toMatchObject({ frameOrdinal: 2, source: "ROLLED_FORWARD",
    programLineageId: old.state.selection.periodization.programLineageId })
  expect(result.state.selection.continuation?.predecessorFingerprint).toBe(old.state.contentFingerprint)
  expect(result.state.progress).toEqual([])
  expect(result.state.selection.activePlan.sessions.some(s => s.slot === "AM")).toBe(true)
  expect(result.state.selection.activePlan.sessions.some(s => s.slot === "PM")).toBe(true)
  expect(result.state.selection.activePlan.sessions.map(s => [s.role, s.plannedEnergyIntent]))
    .toEqual(old.state.selection.activePlan.sessions.map(s => [s.role, s.plannedEnergyIntent]))
  expect(readPlanBetaStateFromStorage([], retained)).toMatchObject({ kind: "adjusted_v3_loaded", state: result.state })
  expect(readAdjustedOriginalPlansV3(retained)).toMatchObject({ kind: "loaded", entries: [{ state: old.state }] })
  const loadedOld = loadEntries().find(e => e.id === entry.id) as PostSessionEntry
  expect(readJournalOriginalPlan(loadedOld, [], retained)).toMatchObject({ kind: "matched_adjusted_v3", source: "ARCHIVED", state: old.state })
  const nextSession = result.state.selection.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  const nextLink = createPlannedSessionLogDraft(result.state.selection, nextSession, at.toISOString())!
  expect(saveEntry({ ...entry, id: "new-v3", date: nextLink.date, activitySlot: nextSession.slot, plannedSessionLink: nextLink.link }).ok).toBe(true)
  const loadedNext = loadEntries().find(e => e.id === "new-v3") as PostSessionEntry
  expect(readJournalOriginalPlan(loadedNext, [], retained)).toMatchObject({ kind: "matched_adjusted_v3", source: "ACTIVE", state: result.state })
  const bytes = localStorage.getItem(activePlanBetaStorageKey())
  expect(await saveSelectedAdjustedSuccessorV3(input)).toMatchObject({ code: "STALE_BASE" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(bytes)
})

it("continues twice without fabricating outcomes or resetting the original lineage", async () => {
  const first = setup()
  const second = await saveSelectedAdjustedSuccessorV3(first.input)
  if (second.kind !== "saved") throw Error(second.code)
  const next = nextInput(second.state, first.retained)
  expect(next.generated.continuity).toMatchObject({ completionBasis: "DISPLAYED_FRAME_ELAPSED" })
  expect(next.generated.continuity.missingRequiredOutcomes).toBeGreaterThan(0)
  expect(next.generated.continuity.continuity.progressStateCounts.every(s => s.count === 0)).toBe(true)
  const third = await saveSelectedAdjustedSuccessorV3(next.input)
  if (third.kind !== "saved") throw Error(third.code)
  expect(third.state.selection.periodization).toMatchObject({ frameOrdinal: 3, mesocycleOrdinal: 1,
    programLineageId: first.old.state.selection.periodization.programLineageId })
  expect(readStoredAdjustedPlanStateV5(third.state, next.retained, next.at).kind).toBe("loaded")
  const archive = readAdjustedOriginalPlansV3(next.retained)
  if (archive.kind !== "loaded") throw Error("archive")
  expect(archive.entries.map(e => e.state.selection.periodization.frameOrdinal)).toEqual([1, 2])
  expect(archive.entries[1]!.state.progress).toEqual([])
})

it.each(["archive", "active"])("restores both keys after a %s write fails after writing bytes", async target => {
  const { input, old } = setup(), original = Storage.prototype.setItem
  const key = target === "archive" ? accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_V3_KEY) : activePlanBetaStorageKey()
  let thrown = false
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, name, value) {
    original.call(this, name, value)
    if (!thrown && name === key) { thrown = true; throw Error("synthetic write failure") }
  })
  expect(await saveSelectedAdjustedSuccessorV3(input)).toMatchObject({ code: "SUCCESSOR_STORAGE_WRITE_FAILED" })
  expect(thrown).toBe(true)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(localStorage.getItem(accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_V3_KEY))).toBeNull()
})

it("preserves another writer and rolls back only its own archive", async () => {
  const { input } = setup(), original = Storage.prototype.setItem
  const archiveKey = accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_V3_KEY), activeKey = activePlanBetaStorageKey()
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    original.call(this, key, value)
    if (key === archiveKey) original.call(this, activeKey, "OTHER_WRITER")
  })
  expect(await saveSelectedAdjustedSuccessorV3(input)).toMatchObject({ code: "PLAN_STORAGE_STATE_UNCERTAIN" })
  expect(localStorage.getItem(activeKey)).toBe("OTHER_WRITER")
  expect(localStorage.getItem(archiveKey)).toBeNull()
})

it.each(["record", "expiry"])("rechecks %s after archive writing before replacing the plan", async change => {
  const { input, old, at } = setup(), original = Storage.prototype.setItem
  const archiveKey = accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_V3_KEY)
  let injected = false
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    original.call(this, key, value)
    if (key === archiveKey && !injected) {
      injected = true
      if (change === "record") localStorage.removeItem(activeAthleteRecordsStorageKey())
      else vi.setSystemTime(new Date(at.getTime() + 100))
    }
  })
  expect(await saveSelectedAdjustedSuccessorV3(input)).toMatchObject({ kind: "rejected", code: "SUCCESSOR_STORAGE_WRITE_FAILED" })
  expect(injected).toBe(true)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(localStorage.getItem(archiveKey)).toBeNull()
})

it("rejects initial-writer bypass and corrupted continuation history", async () => {
  const { input, retained, at } = setup()
  expect(selectAdjustedPlanForActivationV3(input.request, input.readReview().policies, at))
    .toMatchObject({ code: "ADJUSTED_SUCCESSOR_REQUIRES_CONTINUITY_TRANSACTION" })
  const saved = await saveSelectedAdjustedSuccessorV3(input)
  if (saved.kind !== "saved") throw Error(saved.code)
  const changed = structuredClone(saved.state)
  delete changed.selection.continuation
  expect(readStoredAdjustedPlanStateV5(changed, retained, at).kind).toBe("invalid")
})

it("rejects cancelled, stale, unreviewed and corrupt requests before any write", async () => {
  const { input, old } = setup(), archiveKey = accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_V3_KEY)
  expect(await saveSelectedAdjustedSuccessorV3({ ...input, isCurrentDraft: () => false })).toMatchObject({ code: "STALE_CANDIDATE_SELECTION" })
  expect(await saveSelectedAdjustedSuccessorV3({ ...input, locks: null })).toMatchObject({ code: "MUTATION_LOCK_UNAVAILABLE" })
  expect(await saveSelectedAdjustedSuccessorV3({ ...input, expectedPredecessorFingerprint: "stale" })).toMatchObject({ code: "STALE_BASE" })
  expect((await saveSelectedAdjustedSuccessorV3({ ...input, request: { ...input.request, currentCheck: "REVIEW_REQUIRED" } })).kind).toBe("rejected")
  expect((await saveSelectedAdjustedSuccessorV3({ ...input, readReview: () => ({ ...input.readReview(), policies: [] }) })).kind).toBe("rejected")
  expect(localStorage.getItem(archiveKey)).toBeNull()
  localStorage.setItem(archiveKey, "{corrupt")
  expect(await saveSelectedAdjustedSuccessorV3(input)).toMatchObject({ code: "INVALID_STORED_ARCHIVE" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(localStorage.getItem(archiveKey)).toBe("{corrupt")
})

it("keeps accounts isolated when the account changes while waiting for the lock", async () => {
  const { input, old } = setup(), key = activePlanBetaStorageKey()
  expect(await saveSelectedAdjustedSuccessorV3({ ...input, locks: { request: async (_n, _o, callback) => {
    setActiveLocalAccount("other"); return callback({})
  } } })).toMatchObject({ code: "STALE_CANDIDATE_SELECTION" })
  expect(localStorage.getItem(key)).toBe(old.raw)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})

it("keeps all 18 existing originals and the current plan when archive capacity is reached", async () => {
  const first = adjustedPlanSelectionV3Fixture(), evidence = [first.retained]
  const entries: Array<{ archivedAt: string; state: StoredAdjustedPlanStateV5 }> = []
  for (let i = 1; i <= 18; i++) {
    const at = new Date(TODAY.getTime() + i)
    const selected = selectAdjustedPlanForActivationV3(first.request, [first.policy], at)
    if (selected.kind !== "selected_adjusted") throw Error(selected.code)
    const encoded = encodeStoredAdjustedPlanStateV5(selected.state, [], at.toISOString(), evidence, at)
    if (encoded.kind !== "encoded") throw Error("archive fixture")
    entries.push({ archivedAt: at.toISOString(), state: encoded.state })
  }
  // Seed the capacity precondition once; the actual save still validates every
  // original. Repeated archive appends here revalidated 1+...+18 unrelated prefixes.
  const content = { version: 3, entries }
  const raw = JSON.stringify({ ...content,
    contentFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-original-archive.v3", content) })
  const selected = selectAdjustedPlanForActivationV3(first.request, [first.policy], TODAY)
  if (selected.kind !== "selected_adjusted") throw Error(selected.code)
  const old = encodeStoredAdjustedPlanStateV5(selected.state, [], TODAY.toISOString(), evidence, TODAY)
  if (old.kind !== "encoded") throw Error("old")
  const archiveKey = accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_V3_KEY)
  localStorage.setItem(activePlanBetaStorageKey(), old.raw)
  localStorage.setItem(archiveKey, raw)
  const next = nextInput(old.state, evidence)
  const loaded = readAdjustedOriginalPlansV3(next.retained)
  expect(loaded.kind).toBe("loaded")
  if (loaded.kind !== "loaded") throw Error("Invalid capacity fixture")
  expect(loaded.entries).toHaveLength(18)
  expect(await saveSelectedAdjustedSuccessorV3(next.input)).toMatchObject({ code: "ARCHIVE_CAPACITY_REACHED" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(localStorage.getItem(archiveKey)).toBe(raw)
}, 30_000)

function openComparison() {
  fireEvent.click(screen.getByRole("button", { name: "다음 훈련 주기 준비" }))
  expect(screen.getByRole("button", { name: "다음 계획 비교하기" })).toBeDisabled()
  fireEvent.click(screen.getByRole("radio", { name: "알고 있는 통증이나 이상이 없어요" }))
  fireEvent.change(screen.getByLabelText("추천 페이스에 사용할 경기 기록"), { target: { value: loadAthleteRecords()[0]!.id } })
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 비교하기" }))
  expect(screen.getByRole("heading", { level: 1, name: "다음 계획을 비교해 주세요" })).toBeInTheDocument()
}

it("takes the real schedule through comparison and explicit save, then renders the successor", async () => {
  const { input, retained, old } = setup()
  const resolver = vi.fn(() => ({ seed: input.request, readReview: input.readReview, locks: input.locks }))
  render(React.createElement(PlanBeta, { readAdjustedEvidenceV3: () => retained, adjustmentResolverV3: resolver }))
  openComparison()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  fireEvent.click(screen.getAllByRole("button", { name: /구성 확인$/u })[0]!)
  expect(screen.getByRole("heading", { name: "이 구성으로 다음 계획을 저장할까요?" })).toBeInTheDocument()
  expect(screen.getByRole("region", { name: "적용할 훈련" })).toBeInTheDocument()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeInTheDocument()
  const current = readPlanBetaStateFromStorage([], retained)
  if (current.kind !== "adjusted_v3_loaded") throw Error("saved plan")
  expect(current.state.selection.periodization.frameOrdinal).toBe(2)
  expect(readAdjustedOriginalPlansV3(retained)).toMatchObject({ kind: "loaded", entries: [{ state: old.state }] })
})

it("allows backing out of confirmation without replacing or archiving the current plan", () => {
  const { input, retained, old } = setup()
  render(React.createElement(PlanBeta, { readAdjustedEvidenceV3: () => retained,
    adjustmentResolverV3: () => ({ seed: input.request, readReview: input.readReview, locks: input.locks }) }))
  openComparison()
  fireEvent.click(screen.getAllByRole("button", { name: /구성 확인$/u })[0]!)
  fireEvent.click(screen.getByRole("button", { name: "후보로 돌아가기" }))
  fireEvent.click(screen.getByRole("button", { name: "현재 일정으로" }))
  expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeInTheDocument()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(localStorage.getItem(accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_V3_KEY))).toBeNull()
})

it("does not present an unconnected operating catalog as an available save action", () => {
  const { retained, old } = setup()
  render(React.createElement(PlanBeta, { readAdjustedEvidenceV3: () => retained }))
  openComparison()
  expect(screen.getAllByRole("button", { name: /구성 확인$/u }).every(button => button.hasAttribute("disabled"))).toBe(true)
  expect(screen.getByText("검토된 상세 구성을 연결하는 중이에요. 지금은 비교만 할 수 있고 현재 일정은 유지돼요.")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "이 구성으로 계획 저장" })).not.toBeInTheDocument()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
})

it("refuses a stale current plan when final confirmation is clicked", async () => {
  const { input, retained } = setup()
  render(React.createElement(PlanBeta, { readAdjustedEvidenceV3: () => retained,
    adjustmentResolverV3: () => ({ seed: input.request, readReview: input.readReview, locks: input.locks }) }))
  openComparison()
  fireEvent.click(screen.getAllByRole("button", { name: /구성 확인$/u })[0]!)
  localStorage.setItem(activePlanBetaStorageKey(), "OTHER_WRITER")
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(screen.getByRole("alert")).toBeInTheDocument()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe("OTHER_WRITER")
  expect(localStorage.getItem(accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_V3_KEY))).toBeNull()
})
