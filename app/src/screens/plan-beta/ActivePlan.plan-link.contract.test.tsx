import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { ActivePlan } from "./ActivePlan"

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
})
