import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { JournalArchive } from "./JournalArchive"
import { CycleArchive } from "./CycleArchive"
import type { JournalEntry } from "../domain/journal-schema"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { JOURNAL_STORAGE_KEY } from "../domain/journal-storage-keys"

const entry = (date: string): JournalEntry => ({ id: date, kind: "post-session", date, savedAt: "2026-09-30T00:00:00Z", syncState: "local", system: "base", title: "", memo: "PRIVATE NEVER IN SUMMARY", distanceKm: "5", durationMin: "30", avgPace: "", rpe: 0 })
const props = { selection: { selectedMonth: null, selectedWeekStart: null }, onSelectionChange: vi.fn(), onOpenDay: vi.fn(), onBack: vi.fn() }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-30T12:00:00+09:00"))
  setActiveLocalAccount("test-reset"); setActiveLocalAccount(null)
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it("opens at the recent activity date and does not jump when later data arrives", () => {
  const view = render(<JournalArchive {...props} entries={[entry("2026-07-10"), entry("2026-10-02")]} />)
  expect(screen.getByRole("grid", { name: "2026년 7월 달력" })).toBeVisible()
  expect(screen.getByRole("button", { name: /2026년 7월 10일/ })).toHaveAttribute("data-selected", "true")
  fireEvent.click(screen.getByRole("button", { name: "이전 달" }))
  view.rerender(<JournalArchive {...props} entries={[entry("2026-07-10"), entry("2026-09-29")]} />)
  expect(screen.getByRole("grid", { name: "2026년 6월 달력" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: /최근 기록 날짜/ }))
  expect(screen.getByRole("grid", { name: "2026년 9월 달력" })).toBeVisible()
  expect(screen.getByRole("button", { name: /2026년 9월 29일/ })).toHaveFocus()
  expect(screen.queryByRole("button", { name: /최근 기록 날짜/ })).toBeNull()
})
it("does not show sample data during loading or failure, and keeps explicit examples separate", () => {
  const onOpenDay = vi.fn(), onWriteDate = vi.fn()
  const storedBefore = localStorage.getItem(JOURNAL_STORAGE_KEY)
  const currentProps = { ...props, onOpenDay, onWriteDate }
  const view = render(<JournalArchive {...currentProps} entries={[]} readiness="LOADING" />)
  expect(screen.getByRole("status")).toHaveTextContent("일지를 불러오고 있어요.")
  expect(screen.queryByRole("grid")).toBeNull()
  expect(screen.queryByLabelText("일지 달력 예시")).toBeNull()
  view.rerender(<JournalArchive {...currentProps} entries={[]} readiness="STALE" />)
  expect(screen.getByRole("status")).toHaveTextContent("기록이 없는 상태로 표시하지 않아요.")
  expect(screen.queryByRole("grid")).toBeNull()
  expect(screen.queryByLabelText("일지 달력 예시")).toBeNull()
  view.rerender(<JournalArchive {...currentProps} entries={[]} readiness="ERROR" />)
  expect(screen.getByRole("alert")).toHaveTextContent("기록이 없는 것은 아니에요.")
  expect(screen.queryByRole("grid")).toBeNull()
  expect(screen.queryByLabelText("일지 달력 예시")).toBeNull()
  view.rerender(<JournalArchive {...currentProps} entries={[]} readiness="READY" />)
  expect(screen.getByRole("grid", { name: "2026년 9월 달력" })).toBeVisible()
  expect(screen.queryByLabelText("일지 달력 예시")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "일지가 쌓인 예시 보기" }))
  expect(screen.getByLabelText("일지 달력 예시")).toBeVisible()
  expect(screen.getByText("예시 · 내 기록에 저장되지 않아요")).toBeVisible()
  view.rerender(<JournalArchive {...currentProps} entries={[entry("2026-07-10")]} readiness="READY" />)
  expect(screen.getAllByRole("grid")).toHaveLength(1)
  expect(screen.getByText("내 기록도 도착했어요.")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "내 달력" }))
  expect(screen.queryByLabelText("일지 달력 예시")).toBeNull()
  expect(screen.queryByText("PRIVATE NEVER IN SUMMARY")).toBeNull()
  expect(onOpenDay).not.toHaveBeenCalled()
  expect(onWriteDate).not.toHaveBeenCalled()
  expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(storedBefore)
})
it("jumps between recorded dates without removing ordinary next-day navigation", () => {
  render(<JournalArchive {...props} entries={[entry("2026-07-10"), entry("2026-07-20")]} />)
  fireEvent.click(screen.getByRole("button", { name: /2026년 7월 20일/ }))
  const reader = screen.getByRole("dialog")
  fireEvent.click(within(reader).getByRole("button", { name: "이전 기록" }))
  expect(within(reader).getByRole("heading", { name: "2026년 7월 10일 금요일" })).toBeVisible()
  fireEvent.click(within(reader).getByRole("button", { name: "크게 보기 다음 날짜" }))
  expect(within(reader).getByRole("heading", { name: "2026년 7월 11일 토요일" })).toBeVisible()
})
it("preserves the selected recent day when jumping across cycle indices", () => {
  render(<CycleArchive entries={[entry("2026-07-20")]} anchor="2026-09-30" onOpenDay={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "다음 주기" }))
  fireEvent.click(screen.getByRole("button", { name: "최근 일지가 있는 주기" }))
  expect(screen.getByRole("button", { name: /2026년 7월 20일/ })).toHaveAttribute("data-selected", "true")
})
