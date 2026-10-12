import { beforeEach, expect, it, vi } from "vitest"
import {
  ACCOUNT_DELETION_BOUNDARY_PREFIX, accountDeletionBoundaryState, accountDeletionGeneration, closeAccountDeletionBoundary,
  isAccountDeletionClosed, onAccountDeletionBoundaryChange,
} from "./account-deletion-boundary"
import { activeLocalAccount, localJournalScopeGeneration, setActiveLocalAccount } from "./local-journal-ownership"

const instant = "2026-10-07T00:00:00.000Z"
beforeEach(() => { localStorage.clear(); setActiveLocalAccount(null) })

it("retains a non-content terminal marker without altering device originals and cannot reopen A after B", () => {
  const a = "deletion-boundary-a", b = "deletion-boundary-b"
  const original = '{"synthetic":"retained original"}'
  localStorage.setItem("trainoracle.journal.v1", original)
  setActiveLocalAccount(a)
  const generation = localJournalScopeGeneration()
  closeAccountDeletionBoundary(a, instant)
  setActiveLocalAccount(null)
  expect(localJournalScopeGeneration()).toBeGreaterThan(generation)
  expect(accountDeletionGeneration(a)).toBe(1)
  expect(localStorage.getItem(ACCOUNT_DELETION_BOUNDARY_PREFIX + a)).toBe(instant)
  expect(localStorage.getItem("trainoracle.journal.v1")).toBe(original)
  setActiveLocalAccount(b)
  expect(activeLocalAccount()).toBe(b)
  setActiveLocalAccount(a)
  expect(activeLocalAccount()).toBeNull()
  expect(isAccountDeletionClosed(b)).toBe(false)
})

it("keeps immediate closure when localStorage refuses writes", () => {
  const owner = "deletion-quota"
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("synthetic quota") })
  closeAccountDeletionBoundary(owner, instant)
  expect(isAccountDeletionClosed(owner)).toBe(true)
  expect(accountDeletionGeneration(owner)).toBe(1)
  write.mockRestore()
})

it("treats an unreadable marker as UNKNOWN and refuses account scope without claiming deletion or blocking guest", () => {
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("synthetic unavailable") })
  const owner = "deletion-boundary-unknown"
  expect(accountDeletionBoundaryState(owner)).toBe("UNKNOWN")
  expect(isAccountDeletionClosed(owner)).toBe(false)
  setActiveLocalAccount(owner)
  expect(activeLocalAccount()).toBeNull()
  setActiveLocalAccount(null)
  expect(activeLocalAccount()).toBeNull()
  closeAccountDeletionBoundary("deletion-boundary-known-closed", instant)
  expect(accountDeletionBoundaryState("deletion-boundary-known-closed")).toBe("CLOSED")
  read.mockRestore()
  expect(accountDeletionBoundaryState(owner)).toBe("OPEN")
  setActiveLocalAccount(owner)
  expect(activeLocalAccount()).toBe(owner)
  setActiveLocalAccount(null)
})

it("accepts only an identified cross-tab closure and never reopens on a clear/remove event", () => {
  const listener = vi.fn()
  const owner = "deletion-cross-tab"
  const stop = onAccountDeletionBoundaryChange(listener)
  window.dispatchEvent(new StorageEvent("storage", { key: ACCOUNT_DELETION_BOUNDARY_PREFIX + owner, newValue: instant }))
  expect(listener).toHaveBeenCalledWith(owner)
  expect(isAccountDeletionClosed(owner)).toBe(true)
  window.dispatchEvent(new StorageEvent("storage", { key: ACCOUNT_DELETION_BOUNDARY_PREFIX + owner, newValue: null }))
  window.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null }))
  expect(listener).toHaveBeenCalledTimes(1)
  expect(isAccountDeletionClosed(owner)).toBe(true)
  stop()
})
