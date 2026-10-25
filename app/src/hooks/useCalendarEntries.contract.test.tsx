import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useCalendarEntries, useCalendarSnapshot } from "./useCalendarEntries"
import { deleteEntry, restoreDeletedEntry, saveEntry } from "../domain/journal-store"
import { updateEntry } from "../domain/journal-update"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import type { JournalEntry } from "../domain/journal-schema"
import { JOURNAL_STORAGE_KEY } from "../domain/journal-storage-keys"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import * as accountJournalRecords from "../domain/account/account-journal-record-service"
import { resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../domain/account/account-journal-projection"

const entry: JournalEntry = { id: "synthetic-refresh", kind: "post-session", date: "2026-09-27",
  savedAt: "2026-09-27T01:00:00Z", syncState: "local", system: "base", title: "", memo: "",
  distanceKm: "3", durationMin: "20", avgPace: "", rpe: 3 }

beforeEach(async () => { localStorage.clear(); setActiveLocalAccount(null); await initializeCanonicalJournalFixture() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); setActiveLocalAccount(null); resetAccountJournalProjection(null) })

it("refreshes committed local create, edit, delete and undo in the same tab", () => {
  const { result } = renderHook(useCalendarEntries)
  act(() => { expect(saveEntry(entry).ok).toBe(true) })
  expect(result.current).toHaveLength(1)
  act(() => { expect(updateEntry({ ...entry, distanceKm: "4", savedAt: "2026-09-27T02:00:00Z" }, entry.savedAt).ok).toBe(true) })
  expect(result.current[0]).toMatchObject({ distanceKm: "4" })
  act(() => { expect(deleteEntry(entry.id).ok).toBe(true) })
  expect(result.current).toHaveLength(0)
  act(() => { expect(restoreDeletedEntry(entry.id).ok).toBe(true) })
  expect(result.current).toHaveLength(1)
  expect(result.current[0]).toMatchObject({ distanceKm: "4" })
})

it("never shows failed writes or another account's owned records", () => {
  setActiveLocalAccount("synthetic-owner-a")
  expect(saveEntry(entry).ok).toBe(true)
  const { result } = renderHook(useCalendarEntries)
  expect(result.current).toHaveLength(1)
  act(() => { setActiveLocalAccount("synthetic-owner-b") })
  expect(result.current).toHaveLength(0)
  act(() => { setActiveLocalAccount("synthetic-owner-a") })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("synthetic storage full") })
  act(() => { expect(updateEntry({ ...entry, distanceKm: "99", savedAt: "2026-09-27T03:00:00Z" }, entry.savedAt).ok).toBe(false) })
  expect(result.current[0]).toMatchObject({ distanceKm: "3" })
})

it("retries a temporary local read failure without replacing the stored journal", () => {
  expect(saveEntry(entry).ok).toBe(true)
  const read = Storage.prototype.getItem
  let unavailable = true
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key: string) {
    if (key === JOURNAL_STORAGE_KEY && unavailable) throw new Error("synthetic read failure")
    return read.call(this, key)
  })
  const write = vi.spyOn(Storage.prototype, "setItem")
  const { result } = renderHook(useCalendarSnapshot)
  expect(result.current.status).toBe("ERROR")
  expect(result.current.retry).toBeTypeOf("function")
  unavailable = false
  act(() => { result.current.retry?.() })
  expect(result.current.status).toBe("READY")
  expect(result.current.entries).toEqual([entry])
  expect(result.current.retry).toBeUndefined()
  expect(write.mock.calls.every(([key]) => key === "__to_probe__")).toBe(true)
  expect(JSON.parse(localStorage.getItem(JOURNAL_STORAGE_KEY)!)).toEqual([entry])
})

it("maps a failed account read to the existing guarded hydration retry", () => {
  setActiveLocalAccount("synthetic-retry-owner")
  resetAccountJournalProjection("synthetic-retry-owner")
  setAccountJournalProjectionStatus("synthetic-retry-owner", "FAILED")
  vi.spyOn(accountJournalRecords, "accountJournalRecordsEnabled").mockReturnValue(true)
  const hydrate = vi.spyOn(accountJournalRecords, "hydrateAccountJournalRecords").mockResolvedValue(false)
  const { result } = renderHook(useCalendarSnapshot)
  expect(result.current.retry).toBeTypeOf("function")
  act(() => { result.current.retry?.() })
  expect(hydrate).toHaveBeenCalledOnce()
})

it.each([false, true])("rejects a stale retry after an account scope change (returns to original owner: %s)", returnToOwner => {
  setActiveLocalAccount("synthetic-retry-owner")
  resetAccountJournalProjection("synthetic-retry-owner")
  setAccountJournalProjectionStatus("synthetic-retry-owner", "FAILED")
  vi.spyOn(accountJournalRecords, "accountJournalRecordsEnabled").mockReturnValue(true)
  const hydrate = vi.spyOn(accountJournalRecords, "hydrateAccountJournalRecords").mockResolvedValue(false)
  const { result } = renderHook(useCalendarSnapshot)
  const staleRetry = result.current.retry
  act(() => {
    setActiveLocalAccount("synthetic-other-owner")
    if (returnToOwner) setActiveLocalAccount("synthetic-retry-owner")
  })
  act(() => { staleRetry?.() })
  expect(hydrate).not.toHaveBeenCalled()
})
