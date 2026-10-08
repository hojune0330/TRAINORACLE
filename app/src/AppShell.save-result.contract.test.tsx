import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { LogEntryProps } from "./screens/LogEntry"

const fixture = vi.hoisted(() => ({
  status: "FAILED" as "FAILED" | "LOADING" | "READY",
  summary: null as null | { today: string; journalRecordedToday: boolean },
  read: vi.fn(), award: vi.fn(), saved: vi.fn(),
  entry: { id: "synthetic-save-result", kind: "post-session" as const, date: "2026-10-08",
    savedAt: "2026-10-08T00:00:00.000Z", syncState: "synced" as const,
    system: "run" as const, title: "Synthetic", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" },
}))
vi.mock("./screens/Home", () => ({ Home: ({ onWriteLog }: { onWriteLog: (type: "post-session" | "quick-session") => void }) =>
  <><h1>합성 홈</h1><button onClick={() => onWriteLog("post-session")}>합성 기록 시작</button>
  <button onClick={() => onWriteLog("quick-session")}>합성 빠른 기록 시작</button></> }))
vi.mock("./screens/LogEntry", () => ({ LogEntry: ({ onDone, onSaved }: LogEntryProps) =>
  <><button onClick={() => { fixture.saved(); onDone?.("post-session", fixture.entry) }}>확인된 저장 결과 전달</button>
  <button onClick={() => { fixture.saved(); onSaved?.(fixture.entry) }}>확인된 빠른 저장</button>
  <button onClick={() => onDone?.("post-session", fixture.entry)}>빠른 완료</button></> }))
vi.mock("./domain/engagement", async original => ({
  ...await original<typeof import("./domain/engagement")>(), awardJournalEntry: fixture.award,
}))
vi.mock("./domain/account/account-reward-service", async original => ({
  ...await original<typeof import("./domain/account/account-reward-service")>(),
  accountRewardsEnabled: () => true, accountRewardStatus: () => fixture.status,
  readAccountRewardSummary: () => fixture.summary, hydrateAccountRewards: fixture.read,
}))
import { AppShell } from "./AppShell"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { ACCOUNT_REWARD_EVENT } from "./domain/account/account-reward-service"

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, "", "/?app=1")
  fixture.status = "FAILED"; fixture.summary = null
  fixture.read.mockReset(); fixture.award.mockReset().mockReturnValue({ kind: "PENDING" }); fixture.saved.mockReset()
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks() })

function savedWithFailedReward() {
  render(<AppShell />)
  act(() => setActiveLocalAccount("a1111111-1111-4111-8111-111111111111"))
  fireEvent.click(screen.getByRole("button", { name: "합성 기록 시작" }))
  fireEvent.click(screen.getByRole("button", { name: "확인된 저장 결과 전달" }))
  act(() => window.dispatchEvent(new Event(ACCOUNT_REWARD_EVENT)))
}

it("retries only the reward summary without repeating a save or award", async () => {
  savedWithFailedReward()
  expect(screen.getByRole("heading", { name: /기록을 남겼어요/ })).toBeVisible()
  expect(screen.getByRole("status")).toHaveTextContent("포인트 확인만 다시")
  let finish!: () => void
  fixture.read.mockImplementation(() => {
    fixture.status = "LOADING"
    return new Promise<void>(resolve => { finish = () => {
      fixture.summary = { today: fixture.entry.date, journalRecordedToday: true }; fixture.status = "READY"
      window.dispatchEvent(new Event(ACCOUNT_REWARD_EVENT)); resolve()
    } })
  })
  fireEvent.click(screen.getByRole("button", { name: "포인트 다시 확인" }))
  expect(screen.getByRole("button", { name: "포인트 확인 중" })).toBeDisabled()
  await act(async () => finish())
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("계정에 반영돼 있어요"))
  expect(fixture.read).toHaveBeenCalledTimes(1)
  expect(fixture.saved).toHaveBeenCalledTimes(1)
  expect(fixture.award).toHaveBeenCalledTimes(1)
})

it("drops a late reward result across an account change", async () => {
  savedWithFailedReward()
  let finish!: () => void
  fixture.read.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  fireEvent.click(screen.getByRole("button", { name: "포인트 다시 확인" }))
  act(() => setActiveLocalAccount("b1111111-1111-4111-8111-111111111111"))
  await act(async () => {
    fixture.status = "READY"; fixture.summary = { today: fixture.entry.date, journalRecordedToday: true }
    window.dispatchEvent(new Event(ACCOUNT_REWARD_EVENT)); finish()
  })
  expect(screen.queryByText(/계정에 반영돼 있어요/)).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: /기록을 남겼어요/ })).not.toBeInTheDocument()
  expect(fixture.saved).toHaveBeenCalledTimes(1)
  expect(fixture.award).toHaveBeenCalledTimes(1)
})

it("processes a Quick save before leaving completion and does not award twice on Done", () => {
  render(<AppShell />)
  fireEvent.click(screen.getByRole("button", { name: "합성 빠른 기록 시작" }))
  fireEvent.click(screen.getByRole("button", { name: "확인된 빠른 저장" }))
  expect(fixture.award).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("button", { name: "빠른 완료" })).toBeVisible()
  expect(document.querySelector(".saved-toast")).not.toBeNull()
  expect(document.querySelector(".journal-save-result")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "빠른 완료" }))
  expect(fixture.award).toHaveBeenCalledTimes(1)
  expect(fixture.saved).toHaveBeenCalledTimes(1)
  expect(document.querySelector(".journal-save-result")).toBeNull()
})
