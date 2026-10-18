import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { TrainingInstructionCards } from "./TrainingInstructionCards"
import { EXECUTION_STOP_CUE } from "../screens/plan-beta/labels"

afterEach(cleanup)

it("preserves the split workout order and total while keeping the stop cue outside the final exercise", () => {
  const steps = [
    { role: "TOTAL_DURATION", title: "총 시간", detail: "준비·회복·정리 포함 62분" },
    { role: "WARMUP", title: "준비", detail: "가벼운 조깅 10분" },
    { role: "MAIN", title: "본운동", detail: `22분 · 힘든 정도 3–4/10 → 종료 뒤 2분 걷기 → 23분 · 힘든 정도 3–4/10 ${EXECUTION_STOP_CUE}` },
    { role: "COOLDOWN", title: "정리", detail: "가볍게 5분 걷기" },
  ]
  const original = JSON.stringify(steps)
  const { container } = render(<TrainingInstructionCards steps={steps} />)
  expect(screen.getByText("62분")).toBeVisible()
  expect(screen.getByText("준비·회복·정리 포함")).toBeVisible()
  const sequence = screen.getByRole("list", { name: "본운동 순서" })
  const rows = within(sequence).getAllByRole("listitem")
  expect(rows).toHaveLength(3)
  expect(rows[0]).toHaveTextContent("22분힘든 정도 3–4/10")
  expect(rows[1]).toHaveTextContent("종료 뒤 2분 걷기")
  expect(rows[2]).toHaveTextContent("23분힘든 정도 3–4/10")
  expect(sequence).not.toHaveTextContent("중단하세요")
  const reminder = screen.getByRole("complementary", { name: "운동 중 기억할 점" })
  expect(reminder).toHaveTextContent(EXECUTION_STOP_CUE.replace(/\s+/gu, " "))
  expect(container.textContent?.split("중단하세요")).toHaveLength(2)
  expect(Array.from(container.querySelectorAll("dt"), title => title.textContent)).toEqual(["총 시간", "준비", "본운동", "정리"])
  expect(screen.getByText("가벼운 조깅 10분")).toBeVisible()
  expect(screen.getByText("가볍게 5분 걷기")).toBeVisible()
  expect(container.querySelectorAll(".companion-motion")).toHaveLength(1)
  expect(within(reminder).getByRole("button", { name: "수달 동작 보기" })).toBeVisible()
  container.querySelectorAll("img").forEach(img => fireEvent.error(img))
  expect(container.querySelector("img")).toBeNull()
  expect(reminder).toHaveTextContent("중단하세요")
  expect(JSON.stringify(steps)).toBe(original)
})

it("keeps repeated groups, pace qualifications and unstructured guidance intact", () => {
  const grouped = "2세트 × (400m · 현재 기록 기준 → 200m 회복)"
  const fallback = "세부 구성을 불러오지 못했어요. 저장된 시간만 확인해 주세요."
  render(<TrainingInstructionCards steps={[
    { role: "MAIN", title: "본운동", detail: `${grouped} → 마지막 뒤 3분 걷기` },
    { role: "OTHER", title: "안내", detail: fallback },
  ]} />)
  const rows = within(screen.getByRole("list", { name: "본운동 순서" })).getAllByRole("listitem")
  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveTextContent(grouped)
  expect(rows[1]).toHaveTextContent("마지막 뒤 3분 걷기")
  expect(screen.getByText(fallback)).toBeVisible()
  expect(screen.queryByRole("complementary")).toBeNull()
})

it("keeps the single reminder companion paused when the displayed prescription changes", () => {
  const steps = [
    { role: "TOTAL_DURATION", title: "총 시간", detail: "준비·회복·정리 포함 47분" },
    { role: "MAIN", title: "본운동", detail: `현재 기록 기준 약 1000m × 5회 · 반복 사이 150초 조깅 ${EXECUTION_STOP_CUE}` },
  ]
  const view = render(<TrainingInstructionCards steps={steps} />)
  const reminder = screen.getByRole("complementary", { name: "운동 중 기억할 점" })
  fireEvent.click(within(reminder).getByRole("button", { name: "수달 움직임 멈추기" }))
  view.rerender(<TrainingInstructionCards steps={[
    steps[0]!,
    { ...steps[1]!, detail: `목표 초 미확인 · 반복 사이 150초 조깅 ${EXECUTION_STOP_CUE}` },
  ]} />)
  expect(within(reminder).getByRole("button", { name: "수달 움직임 켜기" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByText("목표 초 미확인 · 반복 사이 150초 조깅")).toBeVisible()
  expect(reminder).toHaveTextContent(EXECUTION_STOP_CUE.replace(/\s+/gu, " "))
  expect(view.container.querySelectorAll(".companion-motion")).toHaveLength(1)
})
