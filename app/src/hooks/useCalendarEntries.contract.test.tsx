import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useCalendarEntries } from "./useCalendarEntries"
import { deleteEntry, restoreDeletedEntry, saveEntry } from "../domain/journal-store"
import { updateEntry } from "../domain/journal-update"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import type { JournalEntry } from "../domain/journal-schema"

const entry: JournalEntry = { id: "synthetic-refresh", kind: "post-session", date: "2026-09-27",
  savedAt: "2026-09-27T01:00:00Z", syncState: "local", system: "base", title: "", memo: "",
  distanceKm: "3", durationMin: "20", avgPace: "", rpe: 3 }

beforeEach(() => { localStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); setActiveLocalAccount(null) })

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
