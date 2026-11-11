import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ConnectedWeeklyFacts } from "./ConnectedWeeklyFacts"
import type { PostSessionEntry } from "../../domain/journal-schema"
afterEach(cleanup)
const record: PostSessionEntry = { id: "synthetic-weekly-record", date: "2026-11-11", savedAt: "2026-11-11T12:00:00Z",
  syncState: "local", kind: "post-session", system: "", title: "", distanceKm: "5", durationMin: "30",
  avgPace: "", rpe: 0, memo: "PRIVATE_MEMO_MUST_NOT_DISPLAY", fieldProvenance: { distanceKm: { provenance: "EXPLICIT" } } }
it("shows comparable dates and exclusions and opens the exact underlying journal", () => {
  const open = vi.fn()
  render(<ConnectedWeeklyFacts entries={[record]} today="2026-11-11" onOpenDay={open} />)
  expect(screen.getAllByText("2026-11-09 ~ 2026-11-11").length).toBeGreaterThan(0)
  expect(screen.getByText(/5 km \(1개\)/)).toBeVisible()
  expect(screen.getByText(/거리 비교 제외 0개 · 시간 비교 제외 1개/)).toBeInTheDocument()
  expect(screen.queryByText(record.memo)).toBeNull()
  expect(open).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText("비교에 사용한 기록과 제외 내역"))
  fireEvent.click(screen.getByRole("button", { name: "이번 주 2026-11-11 운동 일지 열기" }))
  expect(open).toHaveBeenLastCalledWith(record.date, record.id)
  fireEvent.click(screen.getByRole("button", { name: "최근 운동 일지에서 돌아보기" }))
  expect(open).toHaveBeenLastCalledWith(record.date, record.id)
  expect(open).toHaveBeenCalledTimes(2)
})
it("removes prior account facts and actions when scoped records are cleared", () => {
  const view = render(<ConnectedWeeklyFacts entries={[record]} today="2026-11-11" onOpenDay={vi.fn()} />)
  expect(screen.getByRole("heading", { name: "이번 주 운동 기록" })).toBeVisible()
  view.rerender(<ConnectedWeeklyFacts entries={[]} today="2026-11-11" onOpenDay={vi.fn()} />)
  expect(screen.queryByRole("heading", { name: "이번 주 운동 기록" })).toBeNull()
})
it("does not claim that an empty previous period means no exercise happened", () => {
  render(<ConnectedWeeklyFacts entries={[record]} today="2026-11-11" />)
  const previous = screen.getByRole("region", { name: "지난주 근거 기록", hidden: true })
  expect(within(previous).getByText("이 기간에 확인할 운동 기록이 없어요.")).toBeInTheDocument()
  expect(screen.getByText(/미수신·미기록 운동은 포함하지 않아요/)).toBeVisible()
})
