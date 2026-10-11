import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Trends } from "../Trends"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)

it("puts a meaningful task title before navigation without inventing a result for the first visit", () => {
  const write = vi.fn()
  const { container } = render(<Trends onWriteLog={write} />)
  const title = screen.getByRole("heading", { name: "내 훈련 살펴보기", level: 2 })
  const navigation = screen.getByRole("group", { name: "오라클 항목" })
  expect(title.compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(container.querySelectorAll(".trends-hub__guide img")).toHaveLength(1)
  expect(container.querySelector(".trends-hub__guide img")).toHaveAttribute("alt", "")
  expect(screen.queryByRole("region", { name: "누적 거리와 변화" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "첫 기록 남기기" }))
  expect(write).toHaveBeenCalledOnce()
})

it("explains each analysis choice and updates only the selected task while preserving return context", () => {
  const change = vi.fn()
  const { container } = render(<Trends initialContext={{ section: "summary", savedDate: "2026-10-05", metric: "DISTANCE_KM" }} onContextChange={change} />)
  fireEvent.click(screen.getByText("훈련량·구성·변화 보기"))
  const choices = screen.getByRole("group", { name: "훈련 분석 자세히 보기" })
  const distance = within(choices).getByRole("button", { name: "훈련량" })
  expect(distance).toHaveAccessibleDescription("달린 거리 합계")
  expect(within(choices).getByRole("button", { name: "훈련 구성" })).toHaveAccessibleDescription("직접 고른 훈련 종류")
  expect(within(choices).getByRole("button", { name: "월별 변화" })).toHaveAccessibleDescription("거리·페이스·기분·통증")
  fireEvent.click(distance)
  expect(screen.getByRole("heading", { name: "훈련량 보기", level: 2 })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "내 훈련 살펴보기" })).toBeNull()
  expect(screen.getByRole("region", { name: "누적 거리와 변화" })).toBeVisible()
  expect(screen.queryByRole("region", { name: "훈련 종류별 합계" })).toBeNull()
  expect(change).toHaveBeenLastCalledWith({ section: "distance", savedDate: "2026-10-05", metric: "DISTANCE_KM" })
  expect(container.querySelectorAll(".trends-hub__guide img")).toHaveLength(1)
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
  fireEvent.click(screen.getByRole("button", { name: "읽을거리·관심" }))
  expect(screen.getByRole("heading", { name: "훈련 이야기 읽기", level: 2 })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "최고기록 살펴보기" })).toBeNull()
})
