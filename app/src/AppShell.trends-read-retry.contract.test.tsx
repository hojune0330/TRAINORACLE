import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { setAccountAuthState } from "./domain/account/account-auth-state"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { resetAccountJournalProjection } from "./domain/account/account-journal-projection"
import { JOURNAL_STORAGE_KEY } from "./domain/journal-storage-keys"
import { saveEntry, todayISO } from "./domain/journal-store"
import { initializeCanonicalJournalFixture } from "./test/canonical-journal-fixture"

vi.mock("./screens/Home", () => ({ Home: () => <h1>재시도 출발 홈</h1> }))
vi.mock("./DeferredMobileScreens", async () => {
  const { Trends } = await import("./screens/Trends")
  return { DeferredMobileScreens: { Trends, PlanProposalInbox: () => null } }
})
import { AppShell } from "./AppShell"

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); resetAccountJournalProjection(null)
  setAccountAuthState("GUEST"); await initializeCanonicalJournalFixture()
  window.history.replaceState(null, "", "/?app=1")
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("synthetic test forbids network") }))
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setActiveLocalAccount(null); setAccountAuthState("RESOLVING")
})

it.each([false, true])("retries parent and child readiness after a local read failure (failure persists: %s)", persistent => {
  const date = todayISO()
  expect(saveEntry({ id: "retry-rpe", kind: "post-session", date, savedAt: `${date}T08:00:00Z`, syncState: "local",
    title: "", memo: "", system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 6,
    fieldProvenance: { rpe: { provenance: "EXPLICIT" } } }).ok).toBe(true)
  const stored = localStorage.getItem(JOURNAL_STORAGE_KEY)
  const originalRead = Storage.prototype.getItem
  let failed = false
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key: string) {
    if (failed && key === JOURNAL_STORAGE_KEY) throw new Error("synthetic journal read failure")
    return originalRead.call(this, key)
  })
  render(<AppShell />)
  expect(screen.getByRole("heading", { name: "재시도 출발 홈" })).toBeVisible()
  failed = true
  act(() => window.dispatchEvent(new Event("focus")))
  fireEvent.click(screen.getByRole("button", { name: "오라클" }))
  expect(screen.getByText(/기록을 아직 모두 확인하지 못했어요/u)).toBeVisible()
  expect(screen.queryByRole("region", { name: "오라클 예시" })).toBeNull()
  const write = vi.spyOn(Storage.prototype, "setItem")
  const remove = vi.spyOn(Storage.prototype, "removeItem")

  failed = persistent
  fireEvent.click(screen.getByRole("button", { name: "다시 확인" }))
  if (persistent) {
    expect(screen.getByText(/기록을 아직 모두 확인하지 못했어요/u)).toBeVisible()
    expect(screen.queryByRole("region", { name: "내 훈련 요약" })).toBeNull()
    expect(screen.queryByRole("region", { name: "오라클 예시" })).toBeNull()
  } else {
    expect(screen.queryByText(/기록을 아직 모두 확인하지 못했어요/u)).toBeNull()
    expect(screen.getByRole("heading", { name: "힘든 정도 6/10" })).toBeVisible()
    expect(screen.getByRole("region", { name: "오라클 예시" })).toHaveClass("oracle-example-preview--compact")
  }
  expect(write.mock.calls.filter(([key]) => key === JOURNAL_STORAGE_KEY)).toEqual([])
  expect(remove.mock.calls.filter(([key]) => key === JOURNAL_STORAGE_KEY)).toEqual([])
  expect(originalRead.call(localStorage, JOURNAL_STORAGE_KEY)).toBe(stored)
  expect(fetch).not.toHaveBeenCalled()
})
