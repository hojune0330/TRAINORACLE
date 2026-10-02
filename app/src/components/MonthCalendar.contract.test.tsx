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
