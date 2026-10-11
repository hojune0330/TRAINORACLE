import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { localJournalScopeGeneration, setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { projectJournalArchive } from "../domain/journal-archive"
import type { JournalEntry } from "../domain/journal-schema"
import { JournalMonthCalendar } from "./JournalMonthCalendar"

const date = "2026-10-02"
const entries: readonly JournalEntry[] = [
  { id: "synthetic-return-am", kind: "post-session", date, savedAt: date + "T00:00:00Z", syncState: "local",
    system: "", title: "synthetic private title", memo: "synthetic private memo", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, activitySlot: "AM" },
  { id: "synthetic-return-pm", kind: "post-session", date, savedAt: date + "T09:00:00Z", syncState: "local",
    system: "", title: "synthetic private title", memo: "synthetic private memo", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, activitySlot: "PM" },
]
const month = projectJournalArchive(entries).months[0]!

beforeEach(() => {
  setActiveLocalAccount("synthetic-return-reset"); setActiveLocalAccount(null)
  window.history.replaceState({}, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => {
    window.history.replaceState({}, "", window.location.href)
    fireEvent(window, new PopStateEvent("popstate", { state: {} }))
  })
})
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); setActiveLocalAccount(null) })

it("passes the selected record and only transient reader identifiers when opening the original", () => {
  const open = vi.fn()
  render(<JournalMonthCalendar month={month} entries={entries} onMonthChange={vi.fn()} onOpenDay={open} />)
  fireEvent.click(screen.getByRole("button", { name: /2026년 10월 2일 금요일/u }))
  fireEvent.click(screen.getByRole("button", { name: /오후 · 훈련 기록/u }))
  const body = screen.getByRole("dialog").querySelector<HTMLElement>(".plan-day-reader__body")!
  body.scrollTop = 240
  fireEvent.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
  expect(open).toHaveBeenCalledExactlyOnceWith(date, entries[1]!.id,
    { scope: localJournalScopeGeneration(), date, entryId: entries[1]!.id, scroll: 240 })
  expect(JSON.stringify(window.history.state)).not.toContain("synthetic private")
  expect(JSON.stringify(window.history.state)).not.toContain(entries[1]!.id)
})

it.each(["explicit", "browser"] as const)("reopens the expanded day with selected record and scroll, then returns stable date focus using %s Back", async (back) => {
  const calendarReturn = { scope: localJournalScopeGeneration(), date, entryId: entries[1]!.id, scroll: 240 }
  const consumed = vi.fn()
  const props = { month, entries, selectedDate: date, onMonthChange: vi.fn(), onOpenDay: vi.fn(), onCalendarReturnConsumed: consumed }
  const view = render(<JournalMonthCalendar {...props} calendarReturn={calendarReturn} />)
  expect(screen.getByRole("dialog", { name: "2026년 10월 2일 금요일" })).toBeVisible()
  const choice = screen.getByRole("button", { name: /오후 · 훈련 기록/u })
  expect(choice).toHaveAttribute("aria-pressed", "true")
  await waitFor(() => {
    expect(choice).toHaveFocus()
    expect(screen.getByRole("dialog").querySelector(".plan-day-reader__body")).toHaveProperty("scrollTop", 240)
  })
  expect(consumed).toHaveBeenCalledOnce()
  view.rerender(<JournalMonthCalendar {...props} calendarReturn={null} />)
  expect(screen.getByRole("dialog")).toBeVisible()
  if (back === "explicit") fireEvent.click(screen.getByRole("button", { name: "달력으로 돌아가기" }))
  else {
    window.history.replaceState({}, "", window.location.href)
    fireEvent(window, new PopStateEvent("popstate", { state: {} }))
  }
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(screen.getByRole("button", { name: /2026년 10월 2일 금요일/u })).toHaveFocus()
  view.unmount()
  render(<JournalMonthCalendar {...props} calendarReturn={null} />)
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(consumed).toHaveBeenCalledOnce()
})

it("focuses the restored date heading when only one live record exists", async () => {
  const calendarReturn = { scope: localJournalScopeGeneration(), date, entryId: entries[0]!.id, scroll: 80 }
  render(<JournalMonthCalendar month={month} entries={[entries[0]!]} selectedDate={date} calendarReturn={calendarReturn}
    onMonthChange={vi.fn()} onOpenDay={vi.fn()} />)
  const title = screen.getByRole("heading", { level: 2, name: "2026년 10월 2일 금요일" })
  await waitFor(() => expect(title).toHaveFocus())
  expect(screen.getByRole("dialog").querySelector(".plan-day-reader__body")).toHaveProperty("scrollTop", 80)
})

it("does not reopen a deleted record or a return from an earlier account lifetime", () => {
  const calendarReturn = { scope: localJournalScopeGeneration(), date, entryId: entries[1]!.id, scroll: 240 }
  const view = render(<JournalMonthCalendar month={month} entries={[entries[0]!]} selectedDate={date} calendarReturn={calendarReturn}
    onMonthChange={vi.fn()} onOpenDay={vi.fn()} />)
  expect(screen.queryByRole("dialog")).toBeNull()
  view.unmount()
  setActiveLocalAccount("synthetic-return-a"); setActiveLocalAccount("synthetic-return-b"); setActiveLocalAccount(null)
  render(<JournalMonthCalendar month={month} entries={entries} selectedDate={date} calendarReturn={calendarReturn}
    onMonthChange={vi.fn()} onOpenDay={vi.fn()} />)
  expect(screen.queryByRole("dialog")).toBeNull()
})
