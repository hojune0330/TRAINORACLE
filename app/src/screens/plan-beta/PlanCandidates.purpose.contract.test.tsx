import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PlanBeta } from "../PlanBeta"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(cleanup)

async function generateLtCandidates(): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /800m.*1500m/u }))
  await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험이 있어요/u }))
  await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /아침에 운동해요/u }))
  await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
}

describe("plan candidate purpose contrast", () => {
  it("explains the selected-purpose plan and the conservative alternative before selection", async () => {
    // Given: an athlete chose LT as the purpose for a new 9.5-day plan.
    render(<PlanBeta />)

    // When: the plan candidates are generated.
    await generateLtCandidates()

    // Then: the athlete can distinguish the selected-purpose plan from the conservative option.
    expect(screen.getByText("고른 목적을 이 계획에 넣었어요.")).toBeVisible()
    expect(screen.getByText("고른 목적을 덜어 낸 대안이에요.")).toBeVisible()
  })
})
