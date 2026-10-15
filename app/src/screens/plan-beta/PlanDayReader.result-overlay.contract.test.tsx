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

it("keeps a short final PM session selected at the scroll boundary and follows manual return to AM", () => {
  render(<PlanDayReader date="2026-07-28" sessions={[{ slot: "AM" }, { slot: "PM" }]} initialSlot="PM"
    canPrevious={false} canNext={false} onPrevious={vi.fn()} onNext={vi.fn()} onClose={vi.fn()}>
    <section data-session-slot="AM">오전 훈련</section><section data-session-slot="PM"><button>오후 기록 펼치기</button></section>
  </PlanDayReader>)
  const body = document.querySelector<HTMLElement>(".plan-day-reader__body")!
  const morning = body.querySelector<HTMLElement>('[data-session-slot="AM"]')!
  const afternoon = body.querySelector<HTMLElement>('[data-session-slot="PM"]')!
  Object.defineProperties(body, { clientHeight: { value: 500 }, scrollHeight: { value: 650 } })
  vi.spyOn(body, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect)
  vi.spyOn(morning, "getBoundingClientRect").mockReturnValue({ top: 0 } as DOMRect)
  const afternoonBounds = vi.spyOn(afternoon, "getBoundingClientRect").mockReturnValue({ top: 400 } as DOMRect)
  body.scrollTop = 150
  fireEvent.scroll(body)
  expect(screen.getByRole("button", { name: "오후" })).toHaveAttribute("aria-current", "location")
  afternoonBounds.mockReturnValue({ top: 300 } as DOMRect)
  body.scrollTop = 100
  fireEvent.scroll(body)
  expect(screen.getByRole("button", { name: "오후" })).toHaveAttribute("aria-current", "location")
  afternoonBounds.mockReturnValue({ top: 600 } as DOMRect)
  body.scrollTop = 0
  fireEvent.scroll(body)
  expect(screen.getByRole("button", { name: "오전" })).toHaveAttribute("aria-current", "location")
  afternoonBounds.mockReturnValue({ top: 400, bottom: 800 } as DOMRect)
  act(() => { screen.getByRole("button", { name: "오후 기록 펼치기" }).focus() })
  expect(screen.getByRole("button", { name: "오후" })).toHaveAttribute("aria-current", "location")
  // Manual scrolling past the focused section must release its selection.
  afternoonBounds.mockReturnValue({ top: 650, bottom: 1000 } as DOMRect)
  fireEvent.scroll(body)
  expect(screen.getByRole("button", { name: "오전" })).toHaveAttribute("aria-current", "location")
})

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
