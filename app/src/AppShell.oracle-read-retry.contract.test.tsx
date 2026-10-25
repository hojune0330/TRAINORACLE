import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { resetAccountJournalProjection } from "./domain/account/account-journal-projection"
import { JOURNAL_STORAGE_KEY } from "./domain/journal-storage-keys"
import { initializeCanonicalJournalFixture } from "./test/canonical-journal-fixture"

vi.mock("./screens/Home", () => ({ Home: ({ onOpenOracle }: { onOpenOracle: (topic: "mix", mode: "example") => void }) =>
  <button onClick={() => onOpenOracle("mix", "example")}>오라클 예시 열기</button> }))
vi.mock("./DeferredMobileScreens", async () => {
  const { OracleExplore } = await import("./screens/OracleExplore")
  return { DeferredMobileScreens: { OracleExplore, Trends: () => null, PlanProposalInbox: () => null } }
})
import { AppShell } from "./AppShell"

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); resetAccountJournalProjection(null)
  await initializeCanonicalJournalFixture(); window.history.replaceState(null, "", "/?app=1")
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("synthetic test forbids network") }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setActiveLocalAccount(null) })

it.each([false, true])("rereads the parent source from the open Oracle result (failure persists: %s)", persistent => {
  const originalRead = Storage.prototype.getItem
  let failed = false
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key: string) {
    if (failed && key === JOURNAL_STORAGE_KEY) throw new Error("synthetic journal read failure")
    return originalRead.call(this, key)
  })
  render(<AppShell />)
  failed = true
  act(() => window.dispatchEvent(new Event("focus")))
  fireEvent.click(screen.getByRole("button", { name: "오라클 예시 열기" }))
  fireEvent.click(screen.getByRole("button", { name: "내 기록 확인" }))
  expect(screen.getByRole("alert")).toHaveTextContent("기록을 모두 확인하지 못했어요.")
  expect(screen.queryByRole("button", { name: "훈련 기록 남기기" })).toBeNull()
  const write = vi.spyOn(Storage.prototype, "setItem")
  failed = persistent
  fireEvent.click(screen.getByRole("button", { name: "다시 확인" }))
  expect(screen.getByRole("combobox", { name: "살펴볼 주제" })).toHaveValue("mix")
  expect(screen.getByRole("button", { name: "내 기록" })).toHaveAttribute("aria-pressed", "true")
  if (persistent) {
    expect(screen.getByRole("alert")).toHaveTextContent("기록을 모두 확인하지 못했어요.")
    expect(screen.queryByRole("button", { name: "훈련 기록 남기기" })).toBeNull()
  } else {
    expect(screen.queryByText(/기록을 모두 확인하지 못했어요/u)).toBeNull()
    expect(screen.getByRole("button", { name: "훈련 기록 남기기" })).toBeVisible()
  }
  expect(screen.queryByText("내 기록을 분석한 결과가 아니에요")).toBeNull()
  expect(write.mock.calls.filter(([key]) => key === JOURNAL_STORAGE_KEY)).toEqual([])
  expect(fetch).not.toHaveBeenCalled()
})
