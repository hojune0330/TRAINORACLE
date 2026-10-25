import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { Trends } from "../Trends"

beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture() })
afterEach(cleanup)

it("clears the previous saved fact when switching metric and retains the chosen metric across analysis views", () => {
  const change = vi.fn()
  render(<Trends initialContext={{ section: "monthly", metric: "DISTANCE_KM", savedDate: "2026-09-21" }} onContextChange={change} />)
  expect(screen.getByText(/2026-09-21에 저장한/)).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "지표 선택: 거리" }))
  fireEvent.click(screen.getByRole("button", { name: "기분" }))
  expect(screen.queryByText(/2026-09-21에 저장한/)).not.toBeInTheDocument()
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ section: "monthly", metric: "MOOD", savedDate: undefined }))
  fireEvent.click(screen.getByRole("button", { name: "훈련 요약" }))
  fireEvent.click(screen.getByRole("button", { name: "월별 변화" }))
  expect(screen.getByRole("button", { name: "지표 선택: 기분" })).toBeVisible()
})

it("accepts explicit return context updates while retaining local period choices through ordinary rerenders", () => {
  const original = { section: "monthly", metric: "MOOD", reportSource: "example", reportMonths: 6, selectedMonth: "2026-08" } as const
  const { rerender } = render(<Trends initialContext={original} />)
  expect(screen.getByRole("button", { name: "6개월" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: "8월 근거 보기" })).toHaveAttribute("aria-pressed", "true")
  fireEvent.click(screen.getByRole("button", { name: "3개월" }))
  rerender(<Trends initialContext={{ ...original }} />)
  expect(screen.getByRole("button", { name: "3개월" })).toHaveAttribute("aria-pressed", "true")
  rerender(<Trends initialContext={{ ...original, reportSource: "my", selectedMonth: "2026-09" }} />)
  expect(screen.getByRole("button", { name: "내 기록" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: "6개월" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: "지표 선택: 기분" })).toBeVisible()
})
