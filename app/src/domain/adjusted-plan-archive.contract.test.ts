import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { adjustedPlanSelectionFixture } from "./adjusted-plan-selection.test-fixtures"
import { saveSelectedAdjustedPlan } from "./adjusted-plan-store"
import { retainAdjustedOriginalPlan, readAdjustedOriginalPlans, ADJUSTED_PLAN_ARCHIVE_KEY } from "./adjusted-plan-archive"
import { activePlanBetaStorageKey, loadPlanMethodHistorySnapshot } from "./plan-beta-store"
import { encodeStoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import { recommendMethods } from "@impl/prescription/method-recommendation"
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

it.each(["COMPLETED", "RESTED", "SKIPPED", "PAIN_CHECKIN", null] as const)(
  "feeds the exact adjusted configuration and %s outcome into future method recommendations", async outcome => {
    const { state, retained, options } = await setup()
    const session = state.selection.activePlan.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD")!
    if (session.prescription.kind !== "ADJUSTED_METHOD") throw Error("Missing fixture")
    const configured = session.prescription.snapshot.projection.source.to
    const encoded = encodeStoredAdjustedPlanState(state.selection, outcome === null ? [] : [{
      sessionDay: session.day, sessionSlot: session.slot, state: outcome,
    }], TODAY.toISOString(), retained, TODAY)
    if (encoded.kind !== "encoded") throw Error("Invalid fixture")
    localStorage.setItem(activePlanBetaStorageKey(), encoded.raw)
    await retainAdjustedOriginalPlan(encoded.state.contentFingerprint, options)
    // A retained copy of the active frame is not a prior-cycle exposure.
    expect(loadPlanMethodHistorySnapshot(undefined, retained).history).toEqual([])
    localStorage.removeItem(activePlanBetaStorageKey())
    const snapshot = loadPlanMethodHistorySnapshot(state.selection.activePlan.eventDistanceM, retained)
    const selected = { familyId: configured.familyId, configurationId: configured.configurationId, version: configured.version }
    const entry = snapshot.history.find(item => item.selected?.configurationId === configured.configurationId)
    expect(entry).toEqual({ selected, performed: outcome === "COMPLETED"
      ? { status: "PERFORMED", method: selected }
      : { status: outcome === null ? "MISSING" : "NOT_PERFORMED" } })
    const result = recommendMethods({ catalog: retained[0]!.authority.catalog,
      assessments: retained[0]!.authority.catalog.flatMap(family => family.configurations.map(configuration => ({
        familyId: family.familyId, configurationId: configuration.configurationId, version: configuration.version,
        eligibility: "ELIGIBLE" as const, eligibilityPriority: 0, purposePriority: 0, contextPriority: 0,
      }))), history: snapshot.history, repeatPreference: "PREFER_VARIETY" })
    expect(result.kind).toBe("recommended")
    if (result.kind !== "recommended") throw Error(result.code)
    expect(result.eligible.find(item => item.configurationId === configured.configurationId)?.observedPerformedCount)
      .toBe(outcome === "COMPLETED" ? 1 : 0)
    expect(snapshot.coverage?.matchingPlans).toBe(1)
    expect(loadPlanMethodHistorySnapshot(9999, retained).history).toEqual([])
    setActiveLocalAccount("other-athlete")
    expect(loadPlanMethodHistorySnapshot(undefined, retained).history).toEqual([])
  })

it("does not treat corrupted or unreviewable adjusted history as known zero exposure", async () => {
  const { state, options } = await setup()
  await retainAdjustedOriginalPlan(state.contentFingerprint, options)
  localStorage.removeItem(activePlanBetaStorageKey())
  expect(loadPlanMethodHistorySnapshot(undefined, []).coverage).toBeNull()
  localStorage.setItem(ADJUSTED_PLAN_ARCHIVE_KEY, "{broken")
  expect(loadPlanMethodHistorySnapshot(undefined, options.retained)).toEqual({ history: [], coverage: null })
})

it("withholds adjusted exposure when the active identity cannot be checked", async () => {
  const { state, retained, options } = await setup()
  await retainAdjustedOriginalPlan(state.contentFingerprint, options)
  localStorage.setItem(activePlanBetaStorageKey(), "{broken-active")
  expect(loadPlanMethodHistorySnapshot(undefined, retained)).toEqual({ history: [], coverage: null })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe("{broken-active")
})
