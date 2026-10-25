import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const source = vi.hoisted(() => ({ calendar: "LOADING", projection: "LOADING", retry: vi.fn(), historyRetry: vi.fn() }))
vi.mock("./hooks/useCalendarEntries", () => ({ useCalendarSnapshot: () => ({ status: source.calendar, entries: [], retry: source.retry }) }))
vi.mock("./hooks/usePlanEvidenceHistory", () => ({ usePlanEvidenceHistory: () => ({ journalReadComplete: false,
  status: "ready", history: { kind: "loaded", plans: [] }, retry: source.historyRetry }) }))
vi.mock("./domain/account/account-journal-projection", async original => ({
  ...await original<typeof import("./domain/account/account-journal-projection")>(), accountJournalProjectionStatus: () => source.projection,
}))
vi.mock("./screens/Home", () => ({ Home: ({ onOpenOracle }: { onOpenOracle: (topic: "mix", mode: "personal") => void }) =>
  <button onClick={() => onOpenOracle("mix", "personal")}>기록 풀이 열기</button> }))
vi.mock("./DeferredMobileScreens", async () => {
  const { OracleExplore } = await import("./screens/OracleExplore")
  return { DeferredMobileScreens: { OracleExplore, Trends: () => null, PlanProposalInbox: () => null } }
})
import { AppShell } from "./AppShell"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, "", "/?app=1"); vi.clearAllMocks() })
afterEach(cleanup)

it.each([
  ["LOADING", "LOADING", true],
  ["STALE", "LOADING", true],
  ["STALE", "FAILED", false],
  ["ERROR", "READY", false],
] as const)("uses current read status %s / %s without starting duplicate reads", (calendar, projection, loading) => {
  source.calendar = calendar; source.projection = projection
  render(<AppShell />)
  fireEvent.click(screen.getByRole("button", { name: "기록 풀이 열기" }))
  expect(screen.getByRole(loading ? "status" : "alert")).toHaveTextContent(loading ? "기록을 확인하고 있어요." : "기록을 모두 확인하지 못했어요.")
  expect(source.retry).not.toHaveBeenCalled(); expect(source.historyRetry).not.toHaveBeenCalled()
  if (loading) expect(screen.queryByRole("button", { name: "다시 확인" })).toBeNull()
  else {
    fireEvent.click(screen.getByRole("button", { name: "다시 확인" }))
    expect(source.retry).toHaveBeenCalledOnce(); expect(source.historyRetry).toHaveBeenCalledOnce()
  }
})
