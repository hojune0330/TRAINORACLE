import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useCalendarSnapshot } from "./useCalendarEntries"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../domain/account/account-journal-projection"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"

const mocks = vi.hoisted(() => ({ hydrate: vi.fn(async () => false), enabled: vi.fn(() => true) }))
vi.mock("../domain/account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: mocks.enabled, hydrateAccountJournalRecords: mocks.hydrate,
}))
vi.mock("../domain/account/config", async importOriginal => ({
  ...await importOriginal<typeof import("../domain/account/config")>(), accountFeatureEnabled: () => true,
}))

beforeEach(async () => {
  localStorage.clear(); vi.clearAllMocks(); mocks.enabled.mockReturnValue(true)
  setActiveLocalAccount("synthetic-a"); resetAccountJournalProjection("synthetic-a")
  await initializeCanonicalJournalFixture()
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); resetAccountJournalProjection(null); localStorage.clear() })

it("uses guarded account recovery only for a failed read, without claiming success", () => {
  setAccountJournalProjectionStatus("synthetic-a", "FAILED")
  const { result } = renderHook(useCalendarSnapshot)
  expect(result.current.status).toBe("ERROR")
  act(() => result.current.retry?.())
  expect(mocks.hydrate).toHaveBeenCalledOnce()
  expect(result.current.status).toBe("ERROR")
})

it.each(["PENDING", "REJECTED", "CONFLICT", "LOADING", "READY"] as const)("does not offer a retry for %s", status => {
  setAccountJournalProjectionStatus("synthetic-a", status)
  const { result } = renderHook(useCalendarSnapshot)
  expect(result.current.retry).toBeUndefined()
  expect(mocks.hydrate).not.toHaveBeenCalled()
})

it("rechecks status when an old retry callback is used", () => {
  setAccountJournalProjectionStatus("synthetic-a", "FAILED")
  const { result } = renderHook(useCalendarSnapshot)
  const retry = result.current.retry
  act(() => setAccountJournalProjectionStatus("synthetic-a", "CONFLICT"))
  act(() => retry?.())
  expect(mocks.hydrate).not.toHaveBeenCalled()
})

it("rejects an old callback across A to B to A account transitions", () => {
  setAccountJournalProjectionStatus("synthetic-a", "FAILED")
  const { result } = renderHook(useCalendarSnapshot)
  const retry = result.current.retry
  act(() => {
    setActiveLocalAccount("synthetic-b"); resetAccountJournalProjection("synthetic-b")
    setActiveLocalAccount("synthetic-a"); resetAccountJournalProjection("synthetic-a")
    setAccountJournalProjectionStatus("synthetic-a", "FAILED")
  })
  act(() => retry?.())
  expect(mocks.hydrate).not.toHaveBeenCalled()
})
