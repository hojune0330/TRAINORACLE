import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlanIntake } from "./PlanIntake"

afterEach(cleanup)

describe("two-a-day intake", () => {
  it("explains the current two-session option before it is chosen", () => {
    render(
      <PlanIntake
        step="two-a-day"
        draft={{ secondSessionMode: "SINGLE_SESSION_ONLY" }}
        onBack={vi.fn()}
        onGoal={vi.fn()}
        onExperience={vi.fn()}
        onFocus={vi.fn()}
        onDays={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /하루 두 번 운동할게요/u }))
      .toHaveTextContent("고른 모든 훈련일에 오전 주 훈련과 오후 회복 움직임을 보여줘요")
  })
})
