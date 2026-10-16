import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Trends } from "../Trends"

beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture() })
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

it("keeps the section navigation ahead of state-specific content without inventing a first-visit result", () => {
  const write = vi.fn()
  const { container } = render(<Trends onWriteLog={write} />)
  const title = screen.getByRole("heading", { name: "내 훈련 살펴보기", level: 2 })
  const navigation = screen.getByRole("navigation", { name: "오라클 항목" })
  expect(navigation.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(container.querySelectorAll(".trends-hub__guide img")).toHaveLength(1)
  expect(container.querySelector(".trends-hub__guide img")).toHaveAttribute("alt", "")
  expect(container.querySelector(".trends-hub__guide img")).toHaveAttribute("src", expect.stringContaining("analysis-lens-v2.webp"))
  expect(screen.queryByRole("region", { name: "누적 거리와 변화" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "운동 기록 쓰기" }))
  expect(write).toHaveBeenCalledOnce()
})

it("keeps a fixed check slot on Oracle destinations and analysis choices", () => {
  render(<Trends />)
  const destinations = screen.getByRole("navigation", { name: "오라클 항목" })
  expect(within(destinations).getAllByRole("button")).toHaveLength(3)
  for (const button of within(destinations).getAllByRole("button")) {
    expect(button.querySelector(":scope > .oracle-section-nav__check")).toBeInTheDocument()
  }
  const reading = within(destinations).getByRole("button", { name: "읽을거리" })
  expect(reading).toHaveTextContent("읽을거리")

  const analyses = screen.getByRole("group", { name: "훈련 분석 자세히 보기" })
  for (const button of within(analyses).getAllByRole("button")) {
    expect(button.querySelector(":scope > .category-choice__check")).toBeInTheDocument()
  }
})

it("offers direct analysis choices and lets the selected result own its title without losing return context", () => {
  const change = vi.fn()
  const { container } = render(<Trends initialContext={{ section: "summary", savedDate: "2026-10-05", metric: "DISTANCE_KM" }} onContextChange={change} />)
  const choices = screen.getByRole("group", { name: "훈련 분석 자세히 보기" })
  const distance = within(choices).getByRole("button", { name: "훈련량" })
  expect(distance).toHaveAccessibleDescription("달린 거리 합계")
  expect(within(choices).getByRole("button", { name: "훈련 구성" })).toHaveAccessibleDescription("직접 고른 훈련 종류")
  expect(within(choices).getByRole("button", { name: "월별 변화" })).toHaveAccessibleDescription("거리·페이스·기분·통증")
  fireEvent.click(distance)
  expect(screen.getByRole("heading", { name: "누적 거리와 변화", level: 2 })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "훈련량 보기" })).toBeNull()
  expect(screen.queryByRole("heading", { name: "내 훈련 살펴보기" })).toBeNull()
  expect(screen.getByRole("region", { name: "누적 거리와 변화" })).toBeVisible()
  expect(screen.queryByRole("region", { name: "훈련 종류별 합계" })).toBeNull()
  expect(change).toHaveBeenLastCalledWith({ section: "distance", savedDate: "2026-10-05", metric: "DISTANCE_KM" })
  expect(container.querySelectorAll(".trends-hub__guide")).toHaveLength(0)
  expect(distance).toHaveAttribute("aria-pressed", "true")
})

it("omits unavailable file analysis while keeping file import direct", () => {
  for (const format of ["TCX", "CSV", "JSON", "GPX"]) {
    vi.stubEnv(`VITE_FEATURE_FILE_ANALYSIS_${format}`, "false")
    vi.stubEnv(`VITE_KILL_FILE_ANALYSIS_${format}`, "false")
  }
  const onImport = vi.fn()
  render(<Trends onOpenImport={onImport} />)

  const choices = screen.getByRole("group", { name: "훈련 분석 자세히 보기" })
  expect(within(choices).queryByRole("button", { name: "파일 분석" })).toBeNull()
  expect(within(choices).getByRole("button", { name: "훈련량" })).toBeVisible()
  const importButton = screen.getByRole("button", { name: "운동 파일 가져오기" })
  expect(importButton.closest("details")).toBeNull()
  fireEvent.click(importButton)
  expect(onImport).toHaveBeenCalledOnce()
})

it("keeps unfinished reads visible without inviting users into imaginary results", () => {
  const { container } = render(<Trends journalReadComplete={false} onOpenOracle={vi.fn()} />)
  expect(screen.getByRole("heading", { name: "내 훈련 살펴보기", level: 2 })).toBeVisible()
  expect(screen.getByText(/기록을 아직 모두 확인하지 못했어요/u)).toBeVisible()
  expect(container.querySelector(".trends-hub__guide img")).toBeNull()
  expect(screen.queryByText("거리와 훈련 종류, 월별 변화를 확인해요.")).toBeNull()
  expect(screen.queryByRole("region", { name: "오라클 예시" })).toBeNull()
})

it("gives legacy in-page destinations their own title instead of leaving an analysis heading over them", () => {
  render(<Trends onOpenOracle={vi.fn()} onOpenRecordReading={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "러닝 취향" }))
  expect(screen.getByRole("heading", { name: "최고기록 살펴보기", level: 2 })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "내 훈련 살펴보기" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "읽을거리" }))
  expect(screen.getByRole("heading", { name: "훈련 이야기 읽기", level: 2 })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "최고기록 살펴보기" })).toBeNull()
})
