import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { ActivePlan } from "./ActivePlan"
import { createInitialPeriodizationContext } from "../../domain/periodization-lineage"

afterEach(cleanup)

describe("active plan journal action", () => {
  it("opens a journal only from the exact non-rest planned session", async () => {
    const state = stateFixture()
    const onWriteSessionLog = vi.fn()
    const user = userEvent.setup()
    render(
      <ActivePlan
        state={state}
        onProgress={vi.fn()}
        onNextFrame={vi.fn()}
        onActivateNextFrame={vi.fn()}
        onCheckDetailedExecution={vi.fn()}
        onWriteSessionLog={onWriteSessionLog}
      />,
    )

    await user.click(screen.getByRole("button", { name: "이 훈련 일지 쓰기" }))
    expect(onWriteSessionLog).toHaveBeenCalledWith(state.activePlan.sessions[0])
  })

  it("shows the long direction without presenting it as automatic load progression", () => {
    const state = stateFixture()
    if (state.version !== 3) throw new Error("V3 fixture required")
    const periodization = createInitialPeriodizationContext(
      state.activePlan.candidateId,
      state.generatedAt,
    )!
    render(
      <ActivePlan
        state={{ ...state, periodization }}
        onProgress={vi.fn()}
        onNextFrame={vi.fn()}
        onActivateNextFrame={vi.fn()}
        onCheckDetailedExecution={vi.fn()}
      />,
    )

    expect(screen.getByText("24주 훈련 방향")).toBeVisible()
    expect(screen.getByText(/1\/18번째 계획/u)).toBeVisible()
    expect(screen.getByRole("progressbar", { name: "24주 훈련 방향 진행 위치" }))
      .toHaveAttribute("aria-valuenow", "1")
    expect(screen.getByText(/자동으로 올리지는 않아요/u)).toBeVisible()
  })
})
