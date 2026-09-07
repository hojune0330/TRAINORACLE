import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { adjustedSuccessorFixture } from "./adjusted-plan-successor.test-fixtures"
import { saveSelectedAdjustedSuccessor } from "./adjusted-plan-store"
import { readStoredAdjustedPlanState, encodeStoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { ADJUSTED_PLAN_ARCHIVE_KEY, readAdjustedOriginalPlans } from "./adjusted-plan-archive"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { readJournalOriginalPlan } from "./journal-original-plan"
import { saveEntry, loadEntries } from "./journal-store"
import type { PostSessionEntry } from "./journal-schema"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
import { selectAdjustedPlanForActivation } from "./adjusted-plan-selection"
import { generateAdjustedNextFrameFromDraft } from "./plan-beta-flow"
import { adjustedPlanSelectionFixture } from "./adjusted-plan-selection.test-fixtures"
import { loadAthleteRecords } from "./athlete-records"
import { isoShift } from "./dates"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

async function setup() {
  return adjustedSuccessorFixture(date => vi.setSystemTime(date))
}

it("atomically retains the old original and stores a readable successor with forward lineage", async () => {
  const { input, old, retained, now } = await setup()
  const oldSession = old.state.selection.activePlan.sessions.find(session => session.prescription.kind === "ADJUSTED_METHOD")!
  const link = createPlannedSessionLogDraft(old.state.selection, oldSession, now.toISOString())!
  const entry: PostSessionEntry = { id: "successor-old-journal", kind: "post-session", date: link.date,
    savedAt: now.toISOString(), syncState: "local", activitySlot: oldSession.slot, plannedSessionLink: link.link,
    system: "", title: "", memo: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }
  expect(saveEntry(entry).ok).toBe(true)
  const result = await saveSelectedAdjustedSuccessor(input)
  expect(result.kind).toBe("saved")
  if (result.kind !== "saved") throw Error(result.code)
  expect(result.state.selection.periodization).toMatchObject({
    programLineageId: old.state.selection.periodization.programLineageId, frameOrdinal: 2, source: "ROLLED_FORWARD",
  })
  expect(result.state.selection.continuation?.predecessorFingerprint).toBe(old.state.contentFingerprint)
  expect(result.state.progress).toEqual([])
  expect(readPlanBetaStateFromStorage(retained)).toMatchObject({ kind: "adjusted_loaded", state: result.state })
  expect(readAdjustedOriginalPlans(retained)).toMatchObject({ kind: "loaded", entries: [{ state: old.state }] })
  const loaded = loadEntries().find(item => item.id === entry.id) as PostSessionEntry
  expect(readJournalOriginalPlan(loaded, retained)).toMatchObject({ kind: "matched_adjusted", source: "ARCHIVED", state: old.state })
  const nextSession = result.state.selection.activePlan.sessions.find(session => session.prescription.kind === "ADJUSTED_METHOD")!
  const nextLink = createPlannedSessionLogDraft(result.state.selection, nextSession, now.toISOString())!
  const nextEntry: PostSessionEntry = { ...entry, id: "successor-new-journal", date: nextLink.date,
    activitySlot: nextSession.slot, plannedSessionLink: nextLink.link }
  expect(saveEntry(nextEntry).ok).toBe(true)
  const loadedNext = loadEntries().find(item => item.id === nextEntry.id) as PostSessionEntry
  expect(readJournalOriginalPlan(loadedNext, retained)).toMatchObject({ kind: "matched_adjusted", source: "ACTIVE", state: result.state })
  const bytes = localStorage.getItem(activePlanBetaStorageKey())
  expect(await saveSelectedAdjustedSuccessor(input)).toMatchObject({ kind: "rejected", code: "STALE_BASE" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(bytes)
})

it.each([ADJUSTED_PLAN_ARCHIVE_KEY, "trainoracle.plan-beta.v1"])("restores both original keys after a %s write failure", async key => {
  const { input, old } = await setup()
  const write = Storage.prototype.setItem
  let thrown = false
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, name, value) {
    write.call(this, name, value)
    if (!thrown && name === key) { thrown = true; throw Error("Synthetic write failure") }
  })
  expect(await saveSelectedAdjustedSuccessor(input)).toMatchObject({ code: "SUCCESSOR_STORAGE_WRITE_FAILED" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)).toBeNull()
})

it("does not overwrite an intervening active write after archiving", async () => {
  const { input } = await setup()
  const write = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    write.call(this, key, value)
    if (key === ADJUSTED_PLAN_ARCHIVE_KEY) write.call(this, activePlanBetaStorageKey(), "other-writer")
  })
  expect(await saveSelectedAdjustedSuccessor(input)).toMatchObject({ code: "PLAN_STORAGE_STATE_UNCERTAIN" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe("other-writer")
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)).toBeNull()
})

it("does not let the initial selection API activate a successor or read a broken lineage", async () => {
  const { input, next, retained, now } = await setup()
  expect(selectAdjustedPlanForActivation(next.request, next.review.policies, now))
    .toMatchObject({ code: "ADJUSTED_SUCCESSOR_REQUIRES_CONTINUITY_TRANSACTION" })
  const saved = await saveSelectedAdjustedSuccessor(input)
  if (saved.kind !== "saved") throw Error(saved.code)
  const changed = structuredClone(saved.state)
  delete changed.selection.continuation
  expect(readStoredAdjustedPlanState(changed, retained, now).kind).toBe("invalid")
})

it("rejects cancellation, missing lock, corrupt archives and a different expected predecessor without writes", async () => {
  const { input, old } = await setup()
  expect(await saveSelectedAdjustedSuccessor({ ...input, isCurrentDraft: () => false })).toMatchObject({ code: "STALE_CANDIDATE_SELECTION" })
  expect(await saveSelectedAdjustedSuccessor({ ...input, locks: null })).toMatchObject({ code: "MUTATION_LOCK_UNAVAILABLE" })
  expect(await saveSelectedAdjustedSuccessor({ ...input, expectedPredecessorFingerprint: "different" })).toMatchObject({ code: "STALE_BASE" })
  localStorage.setItem(ADJUSTED_PLAN_ARCHIVE_KEY, "{broken")
  expect(await saveSelectedAdjustedSuccessor(input)).toMatchObject({ code: "INVALID_STORED_ARCHIVE" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)).toBe("{broken")
})

it("rechecks current safety and the whole-frame review before any successor write", async () => {
  const { input, old } = await setup()
  expect((await saveSelectedAdjustedSuccessor({ ...input,
    request: { ...input.request, currentCheck: "REVIEW_REQUIRED" } })).kind).toBe("rejected")
  expect(await saveSelectedAdjustedSuccessor({ ...input,
    readReview: () => ({ ...input.readReview(), policies: [] }) })).toMatchObject({ code: "PLAN_CONFIGURATION_REVIEW_REQUIRED" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)).toBeNull()
})

it("rejects an account switch while waiting for the mutation lock", async () => {
  const { input, old } = await setup()
  const key = activePlanBetaStorageKey()
  const switched: PlanMutationLockManager = { request: async (_name, _options, callback) => {
    setActiveLocalAccount("other-account")
    return callback({})
  } }
  expect(await saveSelectedAdjustedSuccessor({ ...input, locks: switched })).toMatchObject({ code: "STALE_CANDIDATE_SELECTION" })
  expect(localStorage.getItem(key)).toBe(old.raw)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})

it("continues twice without resetting lineage and retains both earlier originals", async () => {
  const { input, retained, old, now } = await setup()
  const second = await saveSelectedAdjustedSuccessor(input)
  if (second.kind !== "saved") throw Error(second.code)
  const progress = second.state.selection.activePlan.sessions.filter(session => session.role !== "REST")
    .map(session => ({ sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED" as const }))
  const completed = encodeStoredAdjustedPlanState(second.state.selection, progress, now.toISOString(), retained, now)
  if (completed.kind !== "encoded") throw Error("Expected completed second frame")
  localStorage.setItem(activePlanBetaStorageKey(), completed.raw)
  const nextStart = isoShift(second.state.selection.intake.startDate!, 1)
  const nextTime = new Date(`${nextStart}T12:00:00`)
  vi.setSystemTime(nextTime)
  const generated = generateAdjustedNextFrameFromDraft({ draft: { ...second.state.selection.intake, startDate: nextStart },
    currentCheck: "NO_KNOWN_RISK", expectedPredecessorFingerprint: completed.state.contentFingerprint,
    prescriptionSelection: { selectedRecordId: loadAthleteRecords(nextTime)[0]!.id } }, retained)
  if (generated.kind !== "adjusted_next_frame_draft") throw Error(generated.code)
  const next = adjustedPlanSelectionFixture({}, generated.draft, nextTime)
  const allEvidence = [...retained, ...next.retained]
  const third = await saveSelectedAdjustedSuccessor({ ...input, request: next.request,
    expectedPredecessorFingerprint: completed.state.contentFingerprint,
    readReview: () => ({ ...next.review, retained: allEvidence }) })
  expect(third.kind).toBe("saved")
  if (third.kind !== "saved") throw Error(third.code)
  expect(third.state.selection.periodization).toMatchObject({ frameOrdinal: 3, mesocycleOrdinal: 1,
    programLineageId: old.state.selection.periodization.programLineageId })
  expect(readPlanBetaStateFromStorage(allEvidence)).toMatchObject({ kind: "adjusted_loaded", state: third.state })
  const archive = readAdjustedOriginalPlans(allEvidence)
  expect(archive.kind).toBe("loaded")
  if (archive.kind === "loaded") expect(archive.entries.map(entry => entry.state.selection.periodization.frameOrdinal)).toEqual([1, 2])
})
