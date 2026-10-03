import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import type { PlanBetaStateV3 } from "./plan-beta-schema"
import type { PostSessionEntry } from "./journal-schema"
import { journalProgressAction, journalResultLabel, reflectSavedJournalProgress } from "./journal-plan-progress"
import { loadVersionedPlanBetaState, savePlanBetaState } from "./plan-beta-store"
import { loadEntries, saveEntry } from "./journal-store"
import { parseAccountJournalRecord } from "./account/account-journal-record-schema"
import { fromStructuredJournalPayload, toAnalysisJournalEntry, toExportJournalEntry } from "./safe-export"
import { parseJournalEntryForWrite } from "./journal-schema"
import { JOURNAL_STORAGE_KEY } from "./journal-storage-keys"

function fixture() {
  const state = stateFixture() as PlanBetaStateV3
  const link = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, "2026-07-24T01:00:00Z")!.link
  const entry: PostSessionEntry = { id: "synthetic-journal", kind: "post-session", date: link.plannedDate,
    savedAt: "2026-07-24T02:00:00Z", syncState: "local", title: "", system: "", distanceKm: "", durationMin: "",
    avgPace: "", memo: "", rpe: 6, activityOutcome: "COMPLETED", activitySlot: "AM", painCheckStatus: "NO_SIGNAL_REPORTED",
    plannedSessionLink: link, fieldProvenance: { activityOutcome: { provenance: "EXPLICIT" },
      activitySlot: { provenance: "EXPLICIT" }, painCheckStatus: { provenance: "EXPLICIT" } } }
  return { state, entry }
}

describe("journal receipt progress is explicit and exact", () => {
  it.each(["COMPLETED", "RESTED", "SKIPPED"] as const)("offers the matching %s action", activityOutcome => {
    const { state, entry } = fixture()
    expect(journalProgressAction(state, { ...entry, activityOutcome })?.state).toBe(activityOutcome)
    expect(state.progress).toEqual([])
  })
  it.each(["PARTIAL", "LIGHT_ACTIVITY"] as const)("does not turn %s into completion or skipping", activityOutcome => {
    const { state, entry } = fixture()
    expect(journalProgressAction(state, { ...entry, activityOutcome })).toBeNull()
    expect(journalResultLabel({ ...entry, activityOutcome })).toContain("기록 있음")
  })
  it("rejects missing no-pain answer, opposite slot, stale plan and existing progress", () => {
    const { state, entry } = fixture()
    expect(journalProgressAction(state, { ...entry, painCheckStatus: "UNANSWERED" })).toBeNull()
    expect(journalProgressAction(state, { ...entry, activitySlot: "PM" })).toBeNull()
    expect(journalProgressAction({ ...state, generatedAt: "2026-07-25T00:00:00Z" }, entry)).toBeNull()
    expect(journalProgressAction({ ...state, progress: [{ sessionDay: 1, sessionSlot: "AM", state: "RESTED" }] }, entry)).toBeNull()
    expect(journalProgressAction(state, { ...entry, fieldProvenance: {} })).toBeNull()
  })
  it("offers only pain review when a pain signal is present", () => {
    const { state, entry } = fixture()
    expect(journalProgressAction(state, { ...entry, painCheckStatus: "SIGNAL_REPORTED" })?.state).toBe("PAIN_CHECKIN")
    expect(journalProgressAction(state, { ...entry, painParts: { knee: 4 } })?.state).toBe("PAIN_CHECKIN")
  })
  it("preserves an explicit change reason in account storage and owner backup, not analysis", () => {
    const { entry } = fixture()
    const changed: PostSessionEntry = { ...entry, activityOutcome: "PARTIAL", planExecutionChange: "FEWER_REPETITIONS",
      fieldProvenance: { ...entry.fieldProvenance, planExecutionChange: { provenance: "EXPLICIT" } } }
    expect(parseJournalEntryForWrite(changed)).toMatchObject({ planExecutionChange: "FEWER_REPETITIONS" })
    expect(parseAccountJournalRecord({ version: 2, state: "FINALIZED", kind: "JOURNAL", entry: changed })?.entry)
      .toMatchObject({ planExecutionChange: "FEWER_REPETITIONS" })
    expect(fromStructuredJournalPayload(toExportJournalEntry(changed)))
      .toMatchObject({ planExecutionChange: "FEWER_REPETITIONS" })
    expect(toAnalysisJournalEntry(changed)).not.toHaveProperty("planExecutionChange")
    expect(parseJournalEntryForWrite({ ...changed, activityOutcome: "COMPLETED" })).toBeNull()
    expect(parseJournalEntryForWrite({ ...changed, plannedSessionLink: undefined })).toBeNull()
    expect(parseJournalEntryForWrite({ ...changed, fieldProvenance: entry.fieldProvenance })).toBeNull()
  })
})

describe("saved journal progress transaction", () => {
  let locksDescriptor: PropertyDescriptor | undefined
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
    Object.defineProperty(navigator, "locks", { configurable: true, value: {
      request: async (_name: string, _options: unknown, callback: (lock: object) => unknown) => callback({}),
    } })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    if (locksDescriptor) Object.defineProperty(navigator, "locks", locksDescriptor)
    else Reflect.deleteProperty(navigator, "locks")
  })
  function persisted() {
    const data = fixture()
    expect(savePlanBetaState(data.state).ok).toBe(true)
    expect(saveEntry(data.entry).ok).toBe(true)
    return data
  }
  it("reflects explicit completion once, preserving the journal", async () => {
    const { entry } = persisted()
    expect((await reflectSavedJournalProgress(entry)).ok).toBe(true)
    expect(loadVersionedPlanBetaState()?.progress).toEqual([{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }])
    expect(loadEntries()).toHaveLength(1)
    expect((await reflectSavedJournalProgress(entry)).ok).toBe(false)
  })
  it.each([true, false])("rejects duplicate occurrence records even if completion agrees (same ID: %s)", async sameId => {
    const { entry } = persisted()
    const duplicate = { ...entry, id: sameId ? entry.id : "duplicate-result" }
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([entry, duplicate]))
    expect((await reflectSavedJournalProgress(entry)).ok).toBe(false)
    expect(loadVersionedPlanBetaState()?.progress).toEqual([])
    expect(JSON.parse(localStorage.getItem(JOURNAL_STORAGE_KEY)!)).toHaveLength(2)
  })
  it("rejects a stale journal revision without changing either record", async () => {
    const { entry } = persisted()
    expect((await reflectSavedJournalProgress({ ...entry, savedAt: "2026-07-24T03:00:00Z" })).ok).toBe(false)
    expect(loadVersionedPlanBetaState()?.progress).toEqual([])
    expect(loadEntries()[0]?.savedAt).toBe(entry.savedAt)
  })
  it("rechecks evidence after acquiring the mutation lock", async () => {
    const { entry } = persisted()
    Object.defineProperty(navigator, "locks", { configurable: true, value: {
      request: async (_name: string, _options: unknown, callback: (lock: object) => unknown) => {
        localStorage.removeItem("trainoracle.plan-beta.v1")
        return callback({})
      },
    } })
    expect((await reflectSavedJournalProgress(entry)).ok).toBe(false)
    expect(loadVersionedPlanBetaState()).toBeNull()
    expect(loadEntries()).toHaveLength(1)
  })
  it("keeps the journal when writing the plan fails", async () => {
    const { entry } = persisted()
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "trainoracle.plan-beta.v1") throw new DOMException("quota", "QuotaExceededError")
      original.call(this, key, value)
    })
    expect((await reflectSavedJournalProgress(entry)).ok).toBe(false)
    expect(loadEntries()).toHaveLength(1)
    expect(loadVersionedPlanBetaState()?.progress).toEqual([])
  })
})
