import { useState } from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MonthCalendar, shiftCalendarMonth } from "./MonthCalendar"
import { useLocalToday } from "../hooks/useLocalToday"

afterEach(() => { cleanup(); vi.useRealTimers() })

function CalendarHarness({ initial = "2026-09", live = false }: { initial?: string; live?: boolean }) {
  const [month, setMonth] = useState(initial)
  const [selected, setSelected] = useState("2026-09-30")
  const today = useLocalToday()
  return <MonthCalendar month={month} today={live ? today : "2026-09-27"} selectedDate={selected}
    onMonthChange={setMonth} onSelectDate={setSelected} dayDescription={() => ""} renderDay={() => null} />
}

describe("shared civil-date calendar", () => {
  it("reveals Today only for that action and does not retain the intent for later month or data changes", () => {
    const view = render(<CalendarHarness />)
    const viewport = view.container.querySelector<HTMLElement>(".month-calendar__viewport")!
    const scroll = vi.fn()
    Object.defineProperty(viewport, "scrollTo", { configurable: true, value: scroll })
    const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return new DOMRect(this.getAttribute("data-date") === "2026-09-27" ? 500 : 0, 0,
        this.classList.contains("month-calendar__viewport") ? 300 : 60, 44)
    })
    fireEvent.click(screen.getByRole("button", { name: "오늘" }))
    expect(scroll).toHaveBeenCalledOnce()
    viewport.scrollLeft = 100
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }))
    view.rerender(<CalendarHarness />)
    expect(scroll).toHaveBeenCalledOnce()
    bounds.mockRestore()
  })
  it("uses an explicit journal legend without changing the plan MAIN explanation", () => {
    const props = { month: "2026-10", today: "2026-10-18", onMonthChange: vi.fn(), onSelectDate: vi.fn(),
      dayDescription: () => "", renderDay: () => null, trainingColors: true }
    const view = render(<MonthCalendar {...props} legendContext="journal" />)
    fireEvent.click(screen.getByText("훈련 색·종류 알아보기"))
    const legend = screen.getByRole("list", { name: "달력 색상 범례" })
    expect(legend).toHaveAttribute("data-context", "journal")
    expect(legend).toHaveTextContent("LT · VO₂ · GLY · ATP-PC · MIX")
    expect(legend).toHaveTextContent("건너뜀")
    expect(legend).toHaveTextContent("직접 고른 종류를 확인할 수 없는 훈련 기록")
    expect(legend).not.toHaveTextContent("플라이오 · 플라이오 포함")
    expect(screen.getByText(/‘플라이오 포함’은 기존 종류의 색을 유지해요/)).toBeVisible()
    expect(legend).not.toHaveTextContent("계획의 메인 운동")
    view.rerender(<MonthCalendar {...props} legendContext="plan" />)
    expect(screen.getByRole("list", { name: "달력 색상 범례" })).toHaveTextContent("주요 훈련계획의 메인 운동")
  })
  it("keeps the journal month face in one fully named control and leaves standard calendars unskinned", () => {
    const props = { month: "2026-10", today: "2026-10-18", onMonthChange: vi.fn(), onSelectDate: vi.fn(),
      dayDescription: () => "", renderDay: () => null }
    const view = render(<MonthCalendar {...props} category="journal" presentation="journal-archive" />)
    const month = screen.getByRole("button", { name: "2026년 10월 · 년월과 날짜 이동" })
    expect(within(month).getByText("2026년")).toBeVisible()
    expect(month.querySelector(".month-calendar__month-value")).toHaveTextContent("10월")
    expect(view.container.querySelector<HTMLElement>(".month-calendar")?.style.getPropertyValue("--journal-calendar-paper"))
      .toContain("illustrations/journal-calendar-paper-v1.webp")
    fireEvent.click(month)
    const input = screen.getByLabelText("날짜로 이동")
    input.focus()
    fireEvent.keyDown(input, { key: "Escape" })
    expect(month).toHaveFocus()
    expect(screen.queryByLabelText("날짜로 이동")).toBeNull()

    view.rerender(<MonthCalendar {...props} />)
    expect(screen.getByRole("button", { name: "2026년 10월 · 년월과 날짜 이동" })).toHaveTextContent("2026년 10월")
    expect(view.container.querySelector(".month-calendar__year")).toBeNull()
    expect(view.container.querySelector<HTMLElement>(".month-calendar")?.style.getPropertyValue("--journal-calendar-paper")).toBe("")
  })

  it("closes date tools with Escape and restores the month trigger without changing dates", () => {
    render(<CalendarHarness />)
    const trigger = screen.getByRole("button", { name: /년월과 날짜 이동/ })
    fireEvent.click(trigger)
    const input = screen.getByLabelText("날짜로 이동")
    input.focus()
    fireEvent.keyDown(input, { key: "Escape" })
    expect(screen.queryByLabelText("날짜로 이동")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(screen.getByRole("button", { name: "2026년 9월 30일 수요일" }).closest("td")).toHaveAttribute("aria-selected", "true")
  })
  it("shows weekdays and distinguishes today from selected date", () => {
    render(<CalendarHarness />)
    const grid = screen.getByRole("grid", { name: "2026년 9월 달력" })
    expect(within(grid).getAllByRole("columnheader")).toHaveLength(7)
    expect(screen.getByRole("columnheader", { name: "일요일" })).toBeVisible()
    expect(screen.getByRole("button", { name: "2026년 9월 27일 일요일" })).toHaveAttribute("aria-current", "date")
    const selected = screen.getByRole("button", { name: "2026년 9월 30일 수요일" })
    expect(selected.closest("td")).toHaveAttribute("aria-selected", "true")
    expect(selected).not.toHaveAttribute("aria-current")
    expect(within(grid).getAllByRole("button")).toHaveLength(35)
  })

  it("navigates across months and returns to the actual current day", async () => {
    const user = userEvent.setup()
    render(<CalendarHarness />)
    await user.click(screen.getByRole("button", { name: "다음 달" }))
    expect(screen.getByRole("button", { name: "2026년 10월 1일 목요일" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "오늘" }))
    expect(screen.getByRole("button", { name: "2026년 9월 27일 일요일" }).closest("td"))
      .toHaveAttribute("aria-selected", "true")
  })

  it("supports arrow-key focus across month boundaries without selecting or editing", () => {
    render(<CalendarHarness />)
    const last = screen.getByRole("button", { name: "2026년 9월 30일 수요일" })
    last.focus()
    fireEvent.keyDown(last, { key: "ArrowRight" })
    expect(screen.getByRole("button", { name: "2026년 10월 1일 목요일" })).toHaveFocus()
    expect(screen.getByRole("button", { name: "2026년 9월 30일 수요일" }).closest("td")).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("button", { name: "2026년 10월 1일 목요일" }).closest("td")).toHaveAttribute("aria-selected", "false")
  })

  it("handles leap February and December without UTC date drift", () => {
    expect(shiftCalendarMonth("2026-12", 1)).toBe("2027-01")
    expect(shiftCalendarMonth("2026-01", -1)).toBe("2025-12")
    render(<CalendarHarness initial="2028-02" />)
    expect(screen.getByRole("button", { name: "2028년 2월 29일 화요일" })).toBeVisible()
    expect(screen.queryByRole("button", { name: /2월 30일/u })).toBeNull()
  })

  it("jumps to a chosen year/month and a specific leap date", () => {
    render(<CalendarHarness />)
    fireEvent.click(screen.getByRole("button", { name: /년월과 날짜 이동/ }))
    fireEvent.change(screen.getByLabelText("년월 선택"), { target: { value: "2028-02" } })
    expect(screen.getByRole("grid", { name: "2028년 2월 달력" })).toBeVisible()
    fireEvent.change(screen.getByLabelText("날짜로 이동"), { target: { value: "2028-02-29" } })
    expect(screen.getByRole("button", { name: "2028년 2월 29일 화요일" }).closest("td")).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByLabelText("날짜로 이동")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "2028년 2월 29일 화요일" })).toHaveFocus()
  })

  it("retains the keyboard's last day when tabbing away and back without selecting it", async () => {
    const user = userEvent.setup()
    render(<><CalendarHarness /><button>다음 영역</button></>)
    const selected = screen.getByRole("button", { name: "2026년 9월 30일 수요일" })
    selected.focus()
    await user.keyboard("{ArrowLeft}{ArrowLeft}")
    const moved = screen.getByRole("button", { name: "2026년 9월 28일 월요일" })
    expect(moved).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "다음 영역" })).toHaveFocus()
    await user.tab({ shift: true })
    expect(moved).toHaveFocus()
    expect(selected.closest("td")).toHaveAttribute("aria-selected", "true")
  })

  it("allows adjacent-month dates and marks the exact cross-month cycle range", () => {
    const select = vi.fn(), month = vi.fn()
    render(<MonthCalendar month="2026-09" today="2026-09-27" onMonthChange={month} onSelectDate={select}
      highlightedRange={{ start: "2026-09-29", end: "2026-10-08" }} dayDescription={() => ""} renderDay={() => null} />)
    expect(screen.getByRole("button", { name: "2026년 9월 28일 월요일" }).closest("td")).not.toHaveAttribute("data-in-range")
    const outside = screen.getByRole("button", { name: "2026년 10월 1일 목요일" })
    expect(outside.closest("td")).toHaveAttribute("data-in-range")
    fireEvent.click(outside)
    expect(month).toHaveBeenCalledWith("2026-10")
    expect(select).toHaveBeenCalledWith("2026-10-01")
  })

  it("keeps an optional picture beside the date in the same single date button", () => {
    const select = vi.fn()
    render(<MonthCalendar month="2026-09" today="2026-09-27" onMonthChange={() => undefined} onSelectDate={select}
      dayDescription={() => "일지 있음"} dayAdornmentDescription={date => date === "2026-09-27" ? "일지에 그림 장식 있음" : undefined}
      renderDay={() => null} renderDayAdornment={date => date === "2026-09-27" ? <span data-testid="picture">☀</span> : null} />)

    const dateButton = screen.getByRole("button", { name: "2026년 9월 27일 일요일 · 일지 있음 · 일지에 그림 장식 있음" })
    expect(dateButton.querySelector(".month-calendar__date-heading--with-adornment")).toBeTruthy()
    expect(dateButton.querySelector("[aria-hidden='true'] [data-testid='picture']")).toBeTruthy()
    const unadornedDate = screen.getByRole("button", { name: "2026년 9월 28일 월요일 · 일지 있음" })
    expect(unadornedDate.querySelector(".month-calendar__date-heading--with-adornment")).toBeNull()
    expect(unadornedDate.querySelector(".month-calendar__day-adornment")).toBeNull()
    expect(unadornedDate.querySelector(".month-calendar__events")).toBeNull()
    expect(within(screen.getByRole("grid", { name: "2026년 9월 달력" })).getAllByRole("button")).toHaveLength(35)
    fireEvent.click(dateButton)
    expect(select).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledWith("2026-09-27")
  })

  it("refreshes today at local midnight and when a suspended browser resumes", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 27, 23, 59, 59))
    render(<CalendarHarness live />)
    act(() => { vi.advanceTimersByTime(1_100) })
    expect(screen.getByRole("button", { name: "2026년 9월 28일 월요일" })).toHaveAttribute("aria-current", "date")
    expect(screen.getByRole("button", { name: "2026년 9월 27일 일요일" })).not.toHaveAttribute("aria-current")
    vi.setSystemTime(new Date(2026, 8, 29, 9))
    fireEvent.focus(window)
    expect(screen.getByRole("button", { name: "2026년 9월 29일 화요일" })).toHaveAttribute("aria-current", "date")
    expect(screen.getByRole("button", { name: "2026년 9월 30일 수요일" }).closest("td"))
      .toHaveAttribute("aria-selected", "true")
  })

  it("notices an active-tab clock or timezone date jump without stealing the selected date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 27, 12))
    render(<CalendarHarness live />)
    vi.setSystemTime(new Date(2026, 8, 28, 1))
    act(() => { vi.advanceTimersByTime(60_100) })
    expect(screen.getByRole("button", { name: "2026년 9월 28일 월요일" })).toHaveAttribute("aria-current", "date")
    expect(screen.getByRole("button", { name: "2026년 9월 30일 수요일" }).closest("td")).toHaveAttribute("aria-selected", "true")
  })
})
