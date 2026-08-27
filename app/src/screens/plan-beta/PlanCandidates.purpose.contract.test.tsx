import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PlanBeta } from "../PlanBeta"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(cleanup)

async function generateCandidates(purpose: RegExp): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /^1500m/u }))
  await user.click(screen.getByRole("button", { name: /고등부/u }))
  await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험이 있어요/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
  await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))
  await user.click(screen.getByRole("button", { name: purpose }))
  await user.click(screen.getByRole("button", { name: /RPE 기준으로 받기/u }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
  await user.click(screen.getByRole("button", { name: /아침에 운동해요/u }))
  await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))
  await user.click(screen.getByRole("button", { name: "날짜 없이 계획 후보 보기" }))
}

describe("plan candidate purpose contrast", () => {
  it("keeps one candidate schedule expanded and allows both to collapse", async () => {
    render(<PlanBeta />)

    await generateCandidates(/지속 페이스.*LT/u)

    const user = userEvent.setup()
    const candidateA = screen.getByRole("button", { name: "후보 A 일정 접기" })
    const candidateB = screen.getByRole("button", { name: "후보 B 일정 펼치기" })
    expect(candidateA).toHaveAttribute("aria-expanded", "true")
    expect(candidateB).toHaveAttribute("aria-expanded", "false")
    expect(screen.getAllByRole("list", { name: "날짜별 계획 미리보기" })).toHaveLength(1)

    await user.click(candidateB)
    expect(screen.getByRole("button", { name: "후보 A 일정 펼치기" }))
      .toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: "후보 B 일정 접기" }))
      .toHaveAttribute("aria-expanded", "true")
    expect(screen.getAllByRole("list", { name: "날짜별 계획 미리보기" })).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "후보 B 일정 접기" }))
    expect(screen.queryByRole("list", { name: "날짜별 계획 미리보기" }))
      .not.toBeInTheDocument()
  })

  it("explains the easy-session-duration-only difference before selection", async () => {
    // Given: an athlete chose LT as the purpose for a new 9.5-day plan.
    render(<PlanBeta />)

    // When: the plan candidates are generated.
    await generateCandidates(/지속 페이스.*LT/u)

    // Then: the athlete sees the shared high-intensity work before the only authorized difference.
    const comparison = screen.getByRole("region", { name: "두 계획 핵심 비교" })
    expect(within(comparison).getByRole("heading", {
      name: "고른 목표는 같고, 쉬운 훈련 시간만 달라요",
    })).toBeVisible()
    expect(within(comparison).getByText("쉬운 훈련 시간을 범위로 표시해요.")).toBeVisible()
    expect(within(comparison).getByText("쉬운 훈련을 가장 짧은 시간으로 표시해요.")).toBeVisible()
    expect(within(comparison).getByText(/같은 횟수와 RPE로/u)).toBeVisible()
    expect(within(comparison).getByText(/고강도 훈련이 더 많거나 세지는 차이는 아니에요/u)).toBeVisible()
    expect(comparison).not.toHaveTextContent("보조훈련")
    expect(comparison).not.toHaveTextContent("보조 훈련")

    const firstSchedule = screen.getAllByRole("list", { name: "날짜별 계획 미리보기" })[0]
    if (firstSchedule === undefined) throw new Error("Expected the first candidate schedule")
    expect(comparison.compareDocumentPosition(firstSchedule))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("shows each VO2 candidate's readable total time without repeating shared facts", async () => {
    render(<PlanBeta />)

    await generateCandidates(/반복 인터벌.*VO2/u)

    const comparison = screen.getByRole("region", { name: "두 계획 핵심 비교" })
    const comparisonSummaries = within(comparison).getAllByText(/표시된 시간 합계/u)
    const headlineSummaries = screen.getAllByText(/표시된 시간 합계/u, {
      selector: ".plan-candidate-summary",
    })

    expect(comparisonSummaries).toHaveLength(2)
    expect(comparisonSummaries[0]).toHaveTextContent("9일 동안 표시된 시간 합계 1시간 25분~2시간 10분")
    expect(comparisonSummaries[1]).toHaveTextContent("9일 동안 표시된 시간 합계 1시간 25분~1시간 40분")
    expect(comparisonSummaries[0]?.textContent).not.toBe(comparisonSummaries[1]?.textContent)
    expect(headlineSummaries).toHaveLength(2)
    expect(headlineSummaries[0]).toHaveTextContent("9일 동안 표시된 시간 합계 1시간 25분~2시간 10분")
    expect(headlineSummaries[1]).toHaveTextContent("9일 동안 표시된 시간 합계 1시간 25분~1시간 40분")
    expect(screen.getAllByText(/반복 인터벌 · VO2 목적/u)).toHaveLength(2)
  })
})
