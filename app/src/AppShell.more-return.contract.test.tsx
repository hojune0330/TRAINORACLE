import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

vi.mock("./screens/Home", () => ({ Home: ({ onOpenMore }: { onOpenMore: () => void }) => <button onClick={onOpenMore}>더보기 열기</button> }))
vi.mock("./screens/LogEntry", () => ({ LogEntry: ({ entryType, onExit }: { entryType: string; onExit: () => void }) => <>
  <h1>일지 작성 {entryType}</h1><button onClick={onExit}>작성 나가기</button>
</> }))
vi.mock("./DeferredMobileScreens", async () => {
  const { More } = await import("./screens/More")
  return { DeferredMobileScreens: { More, PlanProposalInbox: () => null,
    JournalArchive: () => <h1>복원한 일지 확인 화면</h1>,
    RestoreBackup: ({ onBack, onOpenJournal }: { onBack: () => void; onOpenJournal: () => void }) => <>
      <button onClick={onBack}>복원 닫기</button><button onClick={onOpenJournal}>일지에서 확인하기</button></> } }
})
import { AppShell } from "./AppShell"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, "", "/?app=1") })
afterEach(cleanup)

it("opens quick journal writing from the introduction and returns to that introduction without saving", async () => {
  render(<AppShell />)
  fireEvent.click(screen.getByRole("button", { name: "더보기 열기" }))
  fireEvent.click(await screen.findByRole("button", { name: /앱 소개/u }))
  const before = { ...localStorage }
  fireEvent.click(screen.getByRole("button", { name: "러닝 일지 쓰기" }))
  expect(await screen.findByRole("heading", { name: "일지 작성 quick-session" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "작성 나가기" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "러닝 일지 쓰기" })).toBeVisible())
  expect(screen.getByRole("heading", { name: /훈련 계획을 받아보고/u })).toBeVisible()
  expect({ ...localStorage }).toEqual(before)
})

it("returns to the backup section after restoring and browser Back returns to More tools", async () => {
  render(<AppShell />)
  fireEvent.click(screen.getByRole("button", { name: "더보기 열기" }))
  fireEvent.click(await screen.findByRole("button", { name: /백업/u }))
  expect(window.history.state.trainoracleMore.view).toBe("backup")
  fireEvent.click(screen.getByRole("button", { name: "백업 복원" }))
  fireEvent.click(await screen.findByRole("button", { name: "복원 닫기" }))
  expect(screen.getByRole("button", { name: "백업 복원" })).toBeVisible()
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("button", { name: /백업/u })).toBeVisible())
})

it("opens Journal from restore and preserves browser Back and the original backup destination", async () => {
  render(<AppShell />)
  fireEvent.click(screen.getByRole("button", { name: "더보기 열기" }))
  fireEvent.click(await screen.findByRole("button", { name: /백업/u }))
  fireEvent.click(screen.getByRole("button", { name: "백업 복원" }))
  fireEvent.click(await screen.findByRole("button", { name: "일지에서 확인하기" }))
  expect(screen.getByRole("heading", { name: "복원한 일지 확인 화면" })).toBeVisible()
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("button", { name: "복원 닫기" })).toBeVisible())
  fireEvent.click(screen.getByRole("button", { name: "복원 닫기" }))
  expect(screen.getByRole("button", { name: "백업 복원" })).toBeVisible()
})
