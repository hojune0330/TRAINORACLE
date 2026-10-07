import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

vi.mock("./screens/Home", () => ({ Home: ({ onOpenMore }: { onOpenMore: () => void }) => <button onClick={onOpenMore}>더보기 열기</button> }))
vi.mock("./DeferredMobileScreens", async () => {
  const { More } = await import("./screens/More")
  return { DeferredMobileScreens: { More, PlanProposalInbox: () => null,
    RestoreBackup: ({ onBack }: { onBack: () => void }) => <button onClick={onBack}>복원 닫기</button> } }
})
import { AppShell } from "./AppShell"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, "", "/?app=1") })
afterEach(cleanup)

it("returns to the backup section after restoring and browser Back returns to More tools", async () => {
  render(<AppShell />)
  fireEvent.click(screen.getByRole("button", { name: "더보기 열기" }))
  fireEvent.click(await screen.findByRole("button", { name: /백업/u }))
  expect(window.history.state.trainoracleMore.view).toBe("backup")
  fireEvent.click(screen.getByRole("button", { name: "내려받은 백업 되돌리기" }))
  fireEvent.click(await screen.findByRole("button", { name: "복원 닫기" }))
  expect(screen.getByRole("button", { name: "내려받은 백업 되돌리기" })).toBeVisible()
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("button", { name: /백업/u })).toBeVisible())
})
