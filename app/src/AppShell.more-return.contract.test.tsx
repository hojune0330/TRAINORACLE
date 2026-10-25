import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

vi.mock("./screens/Home", () => ({ Home: ({ onOpenMore }: { onOpenMore: () => void }) => <button onClick={onOpenMore}>더보기 열기</button> }))
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
