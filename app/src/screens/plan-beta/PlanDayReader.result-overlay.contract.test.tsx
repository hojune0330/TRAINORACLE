import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AppShellFrame, type ShellToastState } from "../../components/AppShellFrame"
import { beginBrowserPopNavigation } from "../../navigation/browserNavigation"
import { PlanDayReader } from "./PlanDayReader"

beforeEach(() => {
  window.history.replaceState({ parent: "synthetic-plan" }, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => {})
})
afterEach(async () => { cleanup(); await Promise.resolve(); vi.restoreAllMocks() })

it("keeps a portaled plan reader closed behind the save result and resumes its records after the result Back", () => {
  const onClose = vi.fn(), show = vi.spyOn(HTMLDialogElement.prototype, "showModal")
  function Fixture() {
    const [result, setResult] = React.useState<ShellToastState | null>({ count: 1, phase: "enter",
      receipt: { kind: "generic", savedDate: "2026-07-28" }, storageStatus: "CONFIRMED" })
    return <AppShellFrame scrollRegionRef={React.createRef()} savedToast={result} tab="home"
      onDismissToast={() => setResult(null)} onOpenTrends={vi.fn()} onTab={vi.fn()} hideTabBar>
      <PlanDayReader date="2026-07-28" sessions={[{ slot: "PM" }]} initialSlot="PM" initialSection="records"
        canPrevious={false} canNext={false} onPrevious={vi.fn()} onNext={vi.fn()} onClose={onClose}>
        <section data-session-slot="PM"><details data-session-records><summary>합성 오후 기록</summary><p>기록을 유지해요.</p></details></section>
      </PlanDayReader>
    </AppShellFrame>
  }
  render(<Fixture />)
  const dialog = document.querySelector<HTMLDialogElement>(".plan-day-reader")!
  const records = dialog.querySelector<HTMLDetailsElement>("[data-session-records]")!
  expect(dialog).not.toHaveAttribute("open")
  expect(show).not.toHaveBeenCalled()
  expect(records.open).toBe(false)
  fireEvent.click(screen.getByRole("button", { name: "닫기" }))
  expect(dialog).not.toHaveAttribute("open")
  expect(window.history.back).toHaveBeenCalledTimes(1)
  window.history.replaceState({ parent: "synthetic-plan" }, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state: window.history.state }))
  act(() => { beginBrowserPopNavigation() })
  expect(show).toHaveBeenCalledTimes(1)
  expect(dialog).toHaveAttribute("open")
  expect(records.open).toBe(true)
  expect(dialog.querySelector("summary")).toHaveFocus()
  expect(onClose).not.toHaveBeenCalled()
})
