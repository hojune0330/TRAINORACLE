import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { adjustedPlanSelectionFixture } from "./adjusted-plan-selection.test-fixtures"
import { saveSelectedAdjustedPlan } from "./adjusted-plan-store"
import { encodeStoredAdjustedPlanState, readStoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import { readSelectedAdjustedPlan, selectAdjustedPlanForActivation } from "./adjusted-plan-selection"
import { activePlanBetaStorageKey, archiveAndClearActivePlan, readPlanBetaStateFromStorage, savePlanBetaState } from "./plan-beta-store"
import { saveEntry, loadEntries } from "./journal-store"
import { readJournalOriginalPlan } from "./journal-original-plan"
import type { PostSessionEntry } from "./journal-schema"
import { MEMO_PURPOSE } from "./journal-schema"
import { selectPlanForActivation } from "./plan-beta-flow"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession } from "./planned-session-link"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import type { PlanMutationLockManager } from "./plan-mutation-lock"

const locks: PlanMutationLockManager = { request: async (_name, _options, callback) => callback({}) }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
function fixture() {
  const data = adjustedPlanSelectionFixture()
  return { ...data, input: { request: data.request, readReview: () => data.review, isCurrentDraft: () => true, locks } }
}
describe("adjusted active-plan storage", () => {
  it("writes and reloads exact adjusted content in the actual account-scoped active key", async () => {
    const { input, retained } = fixture()
    const saved = await saveSelectedAdjustedPlan(input)
    expect(saved.kind).toBe("saved")
    if (saved.kind !== "saved") throw Error(saved.code)
    const raw = localStorage.getItem(activePlanBetaStorageKey())!
    const read = readStoredAdjustedPlanState(JSON.parse(raw), retained)
    expect(read.kind).toBe("loaded")
    if (read.kind !== "loaded") throw Error("Expected historical read")
    expect(read.state).toEqual(saved.state)
    expect(readPlanBetaStateFromStorage(retained).kind).toBe("adjusted_loaded")
    expect(read.executionAuthority).toBe("NONE")
    const selection = read.state.selection
    const session = selection.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD")!
    const link = createPlannedSessionLogDraft(selection, session, TODAY.toISOString())!
    expect(resolveCurrentPlannedSession(selection, link.link)).toEqual(session)
    expect(JSON.stringify(link.link)).not.toContain("selectedAnchor")
    const entry: PostSessionEntry = { id: "synthetic-adjusted-journal", kind: "post-session", date: link.date,
      savedAt: TODAY.toISOString(), syncState: "local", plannedSessionLink: link.link, activitySlot: session.slot,
      system: "", title: "", memo: "PRIVATE-NOT-EXPLANATION", memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
      distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }
    expect(saveEntry(entry).ok).toBe(true)
    const journal = loadEntries().find(item => item.id === entry.id)
    if (journal?.kind !== "post-session") throw Error("Expected saved journal")
    expect(journal.distanceKm).toBe("")
    const beforeRead = Object.entries(localStorage)
    const linked = readJournalOriginalPlan(journal, retained)
    expect(linked.kind).toBe("matched_adjusted")
    expect(JSON.stringify(linked)).not.toContain("PRIVATE-NOT-EXPLANATION")
    expect(Object.entries(localStorage)).toEqual(beforeRead)
    setActiveLocalAccount("00000000-0000-4000-8000-000000000003")
    expect(readJournalOriginalPlan(journal, retained).kind).not.toBe("matched_adjusted")
  })
  it("retains history after source expiry and record deletion without allowing a new save", async () => {
    const { input, retained } = fixture()
    const saved = await saveSelectedAdjustedPlan(input)
    if (saved.kind !== "saved") throw Error(saved.code)
    const stored = JSON.parse(localStorage.getItem(activePlanBetaStorageKey())!)
    localStorage.clear()
    vi.setSystemTime(new Date(TODAY.getTime() + 1000))
    expect(readStoredAdjustedPlanState(stored, retained).kind).toBe("loaded")
    expect((await saveSelectedAdjustedPlan(input)).kind).toBe("rejected")
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  })
  it("rejects changing persisted target seconds without trusting a stored hash", async () => {
    const { input, retained } = fixture()
    const saved = await saveSelectedAdjustedPlan(input)
    if (saved.kind !== "saved") throw Error(saved.code)
    const corrupt = structuredClone(saved.state)
    const session = corrupt.selection.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD")!
    if (session.prescription.kind !== "ADJUSTED_METHOD") throw Error("Expected adjustment")
    const target = session.prescription.snapshot.projection.segmentTargets[0]!
    Object.assign(target, { targetRepSeconds: target.targetRepSeconds! + 1 })
    expect(readStoredAdjustedPlanState(corrupt, retained).kind).toBe("invalid")
    expect(readSelectedAdjustedPlan(corrupt.selection, retained[0]!).kind).toBe("rejected")
  })
  it("replays an untouched exact choice without writing or resetting it", async () => {
    const { input } = fixture()
    const first = await saveSelectedAdjustedPlan(input)
    const raw = localStorage.getItem(activePlanBetaStorageKey())
    vi.setSystemTime(new Date(TODAY.getTime() + 1))
    const write = vi.spyOn(Storage.prototype, "setItem")
    const again = await saveSelectedAdjustedPlan(input)
    expect(again).toMatchObject({ kind: "saved", replayed: true })
    expect(again.kind === "saved" && first.kind === "saved" && again.state).toEqual(first.kind === "saved" && first.state)
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
    expect(write.mock.calls.filter(([key]) => key !== "__to_probe__")).toEqual([])
  })
  it("does not overwrite an existing legacy plan or corrupt content", async () => {
    const { input } = fixture()
    for (const old of ["corrupt", JSON.stringify({ version: 3 })]) {
      localStorage.setItem(activePlanBetaStorageKey(), old)
      expect((await saveSelectedAdjustedPlan(input)).kind).toBe("rejected")
      expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old)
    }
  })
  it("blocks stale legacy writes over a stored adjusted plan", async () => {
    const { input, request } = fixture()
    const selected = selectPlanForActivation(request.preparation.candidate.candidateId, request.generated, request.gate,
      { ...request.intake, startDate: request.preparation.startDate }, request.athleteEvidence)
    if (selected.kind !== "selected") throw Error(selected.code)
    expect((await saveSelectedAdjustedPlan(input)).kind).toBe("saved")
    const raw = localStorage.getItem(activePlanBetaStorageKey())
    expect(savePlanBetaState(selected.state).ok).toBe(false)
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
    const before = Object.entries(localStorage)
    expect(archiveAndClearActivePlan(selected.state).ok).toBe(false)
    expect(Object.entries(localStorage)).toEqual(before)
  })
  it("rejects cancellation or account changes while waiting for the lock", async () => {
    const { input } = fixture()
    let current = true
    const queued: PlanMutationLockManager = { request: async (_n, _o, callback) => { current = false; return callback({}) } }
    expect((await saveSelectedAdjustedPlan({ ...input, isCurrentDraft: () => current, locks: queued })).kind).toBe("rejected")
    const switched: PlanMutationLockManager = { request: async (_n, _o, callback) => {
      setActiveLocalAccount("00000000-0000-4000-8000-000000000002"); return callback({}) } }
    expect((await saveSelectedAdjustedPlan({ ...input, locks: switched })).kind).toBe("rejected")
    expect(Object.keys(localStorage).filter(k => k.includes("plan-beta"))).toEqual([])
  })
  it("reads current review after lock acquisition and blocks revocation", async () => {
    const { input, review } = fixture()
    expect((await saveSelectedAdjustedPlan({ ...input, readReview: () => ({ ...review,
      policies: review.policies.map(p => ({ ...p, revokedAtMs: TODAY.getTime() })) }) })).kind).toBe("rejected")
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  })
  it("restores an absent key after a write which stores then throws", async () => {
    const { input } = fixture()
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      original.call(this, key, value)
      if (key === activePlanBetaStorageKey()) throw Error("write confirmation failed")
    })
    expect(await saveSelectedAdjustedPlan(input)).toEqual({ kind: "rejected", code: "PLAN_STORAGE_WRITE_FAILED" })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  })
  it("requires retained evidence and validates progress against actual selected slots", () => {
    const { request, policy, retained } = fixture()
    const selected = selectAdjustedPlanForActivation(request, [policy])
    if (selected.kind !== "selected_adjusted") throw Error(selected.code)
    expect(encodeStoredAdjustedPlanState(selected.state, [], TODAY.toISOString(), []).kind).toBe("invalid")
    const item = { sessionDay: 999, sessionSlot: "AM" as const, state: "COMPLETED" as const }
    expect(encodeStoredAdjustedPlanState(selected.state, [item], TODAY.toISOString(), retained).kind).toBe("invalid")
    const session = selected.state.activePlan.sessions[0]!
    const valid = { ...item, sessionDay: session.day, sessionSlot: session.slot }
    expect(encodeStoredAdjustedPlanState(selected.state, [valid], TODAY.toISOString(), retained).kind).toBe("encoded")
    expect(encodeStoredAdjustedPlanState(selected.state, [valid, valid], TODAY.toISOString(), retained).kind).toBe("invalid")
  })
})
