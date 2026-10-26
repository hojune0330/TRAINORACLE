import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AppShellFrame, type ShellToastState } from "../../components/AppShellFrame"
import { beginBrowserPopNavigation } from "../../navigation/browserNavigation"
import { PlanDayReader } from "./PlanDayReader"
import { CalendarJournalDetails } from "../../components/CalendarJournalDetails"
import type { JournalEntry } from "../../domain/journal-schema"

vi.mock("../LogDetail", () => ({ LogDetail: () => <div>synthetic day original</div> }))

beforeEach(() => {
  window.history.replaceState({ parent: "synthetic-plan" }, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => {})
})
afterEach(async () => { cleanup(); await Promise.resolve(); vi.restoreAllMocks() })

it("preserves the day journal across AM/PM and consumes its Back before closing the reader", async () => {
  const entry: JournalEntry = { id: "synthetic-day-navigation", kind: "post-session", date: "2026-10-02",
    savedAt: "2026-10-02T09:00:00.000Z", syncState: "local", system: "", title: "synthetic", memo: "",
    distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }
  const before = JSON.stringify(entry), close = vi.fn(), push = vi.spyOn(window.history, "pushState")
  render(<PlanDayReader date={entry.date} sessions={[{ slot: "AM" }, { slot: "PM" }]}
    canPrevious={false} canNext={false} onPrevious={vi.fn()} onNext={vi.fn()} onClose={close}>
    <section data-session-slot="AM">AM</section><section data-session-slot="PM">PM</section>
    <CalendarJournalDetails entries={[entry]} date={entry.date} />
  </PlanDayReader>)
  const readerState = window.history.state
  fireEvent.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
  expect(await screen.findByText("synthetic day original")).toBeVisible()
  const originalState = window.history.state
  fireEvent.click(screen.getByRole("button", { name: "오후" }))
  expect(screen.getByText("synthetic day original")).toBeVisible()
  expect(window.history.state).toEqual(originalState)
  expect(push).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole("button", { name: "달력으로 돌아가기" }))
  expect(window.history.back).toHaveBeenCalledTimes(1)
  window.history.replaceState(readerState, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state: readerState }))
  expect(screen.queryByText("synthetic day original")).toBeNull()
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "달력으로 돌아가기" }))
  expect(window.history.back).toHaveBeenCalledTimes(2)
  window.history.replaceState({ parent: "synthetic-plan" }, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state: window.history.state }))
  expect(close).toHaveBeenCalledOnce()
  expect(JSON.stringify(entry)).toBe(before)
})

it("keeps the selected session independent of scrolling and resets the reading position on explicit selection", () => {
  const props = { sessions: [{ slot: "AM" }, { slot: "PM" }] as const,
    canPrevious: false, canNext: false, onPrevious: vi.fn(), onNext: vi.fn(), onClose: vi.fn() }
  const { rerender } = render(<PlanDayReader {...props} date="2026-07-28" initialSlot="PM"
    canPrevious={false} canNext={false} onPrevious={vi.fn()} onNext={vi.fn()} onClose={vi.fn()}>
    <section data-session-slot="AM">오전 훈련</section><section data-session-slot="PM"><button>오후 기록 펼치기</button></section>
  </PlanDayReader>)
  const body = document.querySelector<HTMLElement>(".plan-day-reader__body")!
  body.scrollTop = 150
  fireEvent.scroll(body)
  expect(screen.getByRole("button", { name: "오후" })).toHaveAttribute("aria-current", "location")
  expect(body.firstElementChild).toHaveAttribute("data-active-slot", "PM")
  body.scrollTop = 0
  fireEvent.scroll(body)
  expect(screen.getByRole("button", { name: "오후" })).toHaveAttribute("aria-current", "location")
  body.scrollTop = 100
  fireEvent.click(screen.getByRole("button", { name: "오전" }))
  expect(screen.getByRole("button", { name: "오전" })).toHaveAttribute("aria-current", "location")
  expect(body.firstElementChild).toHaveAttribute("data-active-slot", "AM")
  expect(body.scrollTop).toBe(0)
  rerender(<PlanDayReader {...props} date="2026-07-29" sessions={[{ slot: "AM" }]} initialSlot="PM"><section data-session-slot="AM">다음 날짜</section></PlanDayReader>)
  expect(body.firstElementChild).toHaveAttribute("data-active-slot", "AM")
  expect(screen.getByText("다음 날짜")).toBeVisible()
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
