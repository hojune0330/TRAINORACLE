import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { adjustedPlanSelectionFixture } from "./adjusted-plan-selection.test-fixtures"
import { saveSelectedAdjustedPlan } from "./adjusted-plan-store"
import { retainAdjustedOriginalPlan, readAdjustedOriginalPlans, ADJUSTED_PLAN_ARCHIVE_KEY } from "./adjusted-plan-archive"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { readJournalOriginalPlan } from "./journal-original-plan"
import { saveEntry, loadEntries } from "./journal-store"
import type { PostSessionEntry } from "./journal-schema"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
const locks: PlanMutationLockManager = { request: async (_n, _o, callback) => callback({}) }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
async function setup() {
  const { request, review, retained } = adjustedPlanSelectionFixture()
  const saved = await saveSelectedAdjustedPlan({ request, readReview: () => review, isCurrentDraft: () => true, locks })
  if (saved.kind !== "saved") throw Error(saved.code)
  return { state: saved.state, retained, options: { retained, locks } }
}
it("retains exact content without clearing active state and can find it from a saved journal later", async () => {
  const { state, retained, options } = await setup()
  const session = state.selection.activePlan.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD")!
  const draft = createPlannedSessionLogDraft(state.selection, session, TODAY.toISOString())!
  const entry: PostSessionEntry = { id: "archive-test", kind: "post-session", date: draft.date,
    savedAt: TODAY.toISOString(), syncState: "local", activitySlot: session.slot, plannedSessionLink: draft.link,
    system: "", title: "", memo: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }
  expect(saveEntry(entry).ok).toBe(true)
  const before = localStorage.getItem(activePlanBetaStorageKey())
  expect(await retainAdjustedOriginalPlan(state.contentFingerprint, options)).toEqual({ kind: "retained" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  expect(readAdjustedOriginalPlans(retained)).toMatchObject({ kind: "loaded", entries: [{ state }] })
  // Simulate a later active-plan replacement; retention itself never removes it.
  localStorage.removeItem(activePlanBetaStorageKey())
  const loaded = loadEntries().find(item => item.id === entry.id) as PostSessionEntry
  expect(readJournalOriginalPlan(loaded, retained)).toMatchObject({ kind: "matched_adjusted", source: "ARCHIVED", state })
  setActiveLocalAccount("other-account")
  expect(readAdjustedOriginalPlans(retained)).toEqual({ kind: "loaded", entries: [] })
})
it("replays retention without duplicate entries and rejects corrupted archive bytes", async () => {
  const { state, retained, options } = await setup()
  await retainAdjustedOriginalPlan(state.contentFingerprint, options)
  const first = localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)
  await retainAdjustedOriginalPlan(state.contentFingerprint, options)
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)).toBe(first)
  localStorage.setItem(ADJUSTED_PLAN_ARCHIVE_KEY, "{broken")
  expect(readAdjustedOriginalPlans(retained).kind).toBe("invalid")
  expect(await retainAdjustedOriginalPlan(state.contentFingerprint, options)).toMatchObject({ kind: "rejected" })
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)).toBe("{broken")
})
it("rolls back a failed archive write and never changes active bytes", async () => {
  const { state, options } = await setup()
  const active = localStorage.getItem(activePlanBetaStorageKey())
  const original = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    original.call(this, key, value)
    if (key === ADJUSTED_PLAN_ARCHIVE_KEY) throw Error("Synthetic archive failure")
  })
  expect(await retainAdjustedOriginalPlan(state.contentFingerprint, options)).toMatchObject({ code: "ARCHIVE_WRITE_FAILED" })
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)).toBeNull()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(active)
})
