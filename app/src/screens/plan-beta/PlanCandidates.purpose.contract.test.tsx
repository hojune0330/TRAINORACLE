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
  await user.click(screen.getByRole("button", { name: /800m.*1500m/u }))
  await user.click(screen.getByRole("button", { name: /고등부/u }))
  await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험이 있어요/u }))
  await user.click(screen.getByRole("button", { name: purpose }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
  await user.click(screen.getByRole("button", { name: /아침에 운동해요/u }))
  await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
}

describe("plan candidate purpose contrast", () => {
  it("explains the selected-purpose plan and the conservative alternative before selection", async () => {
    // Given: an athlete chose LT as the purpose for a new 9.5-day plan.
    render(<PlanBeta />)

    // When: the plan candidates are generated.
    await generateCandidates(/지속 페이스.*LT/u)

    // Then: the athlete can distinguish the selected-purpose plan from the conservative option.
    const comparison = screen.getByRole("region", { name: "두 계획 핵심 비교" })
    expect(within(comparison).getByText("고른 목적을 표준 용량으로 넣었어요.")).toBeVisible()
    expect(within(comparison).getByText("같은 목적을 더 낮은 부담으로 넣었어요.")).toBeVisible()

    const firstSchedule = screen.getAllByRole("list", { name: "날짜별 계획 미리보기" })[0]
    if (firstSchedule === undefined) throw new Error("Expected the first candidate schedule")
    expect(comparison.compareDocumentPosition(firstSchedule))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("shows each VO2 candidate's total prescribed minutes in its headline summary", async () => {
    render(<PlanBeta />)

    await generateCandidates(/반복 인터벌.*VO2/u)

    const comparison = screen.getByRole("region", { name: "두 계획 핵심 비교" })
    const comparisonSummaries = within(comparison).getAllByText(/총 계획 시간/u)
    const headlineSummaries = screen.getAllByText(/총 계획 시간/u, {
      selector: ".plan-candidate-summary",
    })

    expect(comparisonSummaries).toHaveLength(2)
    expect(comparisonSummaries[0]).toHaveTextContent("총 계획 시간 85~130분")
    expect(comparisonSummaries[1]).toHaveTextContent("총 계획 시간 85분")
    expect(comparisonSummaries[0]?.textContent).not.toBe(comparisonSummaries[1]?.textContent)
    expect(headlineSummaries).toHaveLength(2)
    expect(headlineSummaries[0]).toHaveTextContent("총 계획 시간 85~130분")
    expect(headlineSummaries[1]).toHaveTextContent("총 계획 시간 85분")
    expect(screen.getAllByText(/반복 인터벌 · VO2 목적/u)).toHaveLength(2)
  })
})
