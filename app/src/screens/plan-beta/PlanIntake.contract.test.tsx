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
        onDivision={vi.fn()}
        onExperience={vi.fn()}
        onFocus={vi.fn()}
        onDays={vi.fn()}
        onFrameLength={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /하루 두 번 운동할게요/u }))
      .toHaveTextContent("고른 모든 훈련일에 오전 주 훈련과 오후 회복 움직임을 보여줘요. 고강도 두 개를 자동으로 넣지는 않아요")
  })
})

describe("competition division intake", () => {
  it("asks for the current competition division without presenting it as an age or safety decision", async () => {
    const onDivision = vi.fn()
    render(
      <PlanIntake
        step="division"
        draft={{}}
        onBack={vi.fn()}
        onGoal={vi.fn()}
        onDivision={onDivision}
        onExperience={vi.fn()}
        onFocus={vi.fn()}
        onDays={vi.fn()}
        onFrameLength={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
      />,
    )

    expect(screen.getByText(/나이·성숙도.*의료 판단에 사용하지 않아요/u)).toBeVisible()
    await screen.getByRole("button", { name: /고등부/u }).click()
    expect(onDivision).toHaveBeenCalledWith("HIGH_SCHOOL")
  })
})

describe("plan length intake", () => {
  it("explains the continuing 7-day choice and keeps 9/10 wording factual", () => {
    render(
      <PlanIntake
        step="frame-length"
        draft={{}}
        onBack={vi.fn()}
        onGoal={vi.fn()}
        onDivision={vi.fn()}
        onExperience={vi.fn()}
        onFocus={vi.fn()}
        onDays={vi.fn()}
        onFrameLength={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /7일만 먼저 받기/u }))
      .toHaveTextContent("다음 계획으로 이어서")
    expect(screen.getByRole("button", { name: /9일 계획 받기/u }))
      .toHaveTextContent("9일 분량")
    expect(screen.getByRole("button", { name: /10일 계획 받기/u }))
      .toHaveTextContent("10일 분량")
  })
})
