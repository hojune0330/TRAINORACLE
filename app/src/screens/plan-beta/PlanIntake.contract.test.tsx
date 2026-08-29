import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { PlanIntake } from "./PlanIntake"
import { firstUnansweredRefinement } from "./plan-intake-navigation"

afterEach(cleanup)

describe("returning intake navigation", () => {
  it("maps each missing refinement to its first canonical question", () => {
    const intake = stateFixture().intake
    const { trainingFocus: _focus, ...withoutFocus } = intake
    const { availableDayCount: _days, ...withoutDays } = intake
    const { requestedFrameLength: _frame, ...withoutFrame } = intake
    const { trainingTimePreference: _time, ...withoutTime } = intake
    const { secondSessionMode: _sessions, ...withoutSessions } = intake

    expect(firstUnansweredRefinement(withoutFocus)).toBe("focus")
    expect(firstUnansweredRefinement(withoutDays)).toBe("days")
    expect(firstUnansweredRefinement(withoutFrame)).toBe("frame-length")
    expect(firstUnansweredRefinement(withoutTime)).toBe("training-time")
    expect(firstUnansweredRefinement(withoutSessions)).toBe("two-a-day")
  })
})

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
        onTemplate={vi.fn()}
        onDays={vi.fn()}
        onFrameLength={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /하루 두 번 운동할게요/u }))
      .toHaveTextContent("고른 시간대에 주요 훈련을 배치하고 다른 시간에는 쉬운 훈련이나 회복 운동을 안내해요. 주요 훈련 두 개를 자동으로 넣지는 않아요")
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
        onTemplate={vi.fn()}
        onDays={vi.fn()}
        onFrameLength={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByText(/나이·성숙도.*의료 판단에 사용하지 않아요/u)).toBeVisible()
    expect(screen.getByRole("button", { name: /고등부/u })).toBeVisible()
    await screen.getByRole("button", { name: /선택하지 않음.*나중에 입력/u }).click()
    expect(onDivision).toHaveBeenCalledWith("NOT_PROVIDED")
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
        onTemplate={vi.fn()}
        onDays={vi.fn()}
        onFrameLength={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
        onContinue={vi.fn()}
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

describe("optional target race date", () => {
  it("allows a no-date plan and enables preview only for a valid future date", async () => {
    const user = userEvent.setup()
    const onRaceDate = vi.fn()
    const onTargetRaceDateChange = vi.fn()
    const { rerender } = render(
      <PlanIntake
        step="race-date"
        draft={{}}
        targetRaceDate=""
        onTargetRaceDateChange={onTargetRaceDateChange}
        onRaceDate={onRaceDate}
        onBack={vi.fn()}
        onGoal={vi.fn()}
        onDivision={vi.fn()}
        onExperience={vi.fn()}
        onFocus={vi.fn()}
        onTemplate={vi.fn()}
        onDays={vi.fn()}
        onFrameLength={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: "날짜 없이 계획안 보기" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "이 날짜로 배치 미리보기" })).toBeDisabled()
    expect(screen.getByLabelText("목표 경기 날짜")).toHaveAttribute("aria-invalid", "false")
    await user.click(screen.getByRole("button", { name: "날짜 없이 계획안 보기" }))
    expect(onRaceDate).toHaveBeenCalledWith()

    rerender(
      <PlanIntake
        step="race-date"
        draft={{}}
        targetRaceDate="2099-08-23"
        onTargetRaceDateChange={onTargetRaceDateChange}
        onRaceDate={onRaceDate}
        onBack={vi.fn()}
        onGoal={vi.fn()}
        onDivision={vi.fn()}
        onExperience={vi.fn()}
        onFocus={vi.fn()}
        onTemplate={vi.fn()}
        onDays={vi.fn()}
        onFrameLength={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
        onContinue={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "이 날짜로 배치 미리보기" }))
    expect(onRaceDate).toHaveBeenLastCalledWith("2099-08-23")
    expect(screen.getByLabelText("목표 경기 날짜")).toHaveAttribute("aria-invalid", "false")
  })
})

describe("exact event and explicit detail selection", () => {
  it("offers the seven owner-approved initial events", async () => {
    const user = userEvent.setup()
    const onGoal = vi.fn()
    render(
      <PlanIntake
        step="goal"
        draft={{}}
        onBack={vi.fn()}
        onGoal={onGoal}
        onDivision={vi.fn()}
        onExperience={vi.fn()}
        onFocus={vi.fn()}
        onTemplate={vi.fn()}
        onDays={vi.fn()}
        onFrameLength={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getAllByRole("button", { name: /^(800m|1500m|3000m|5000m|10km|하프마라톤|마라톤)/u })).toHaveLength(7)
    await user.click(screen.getByRole("button", { name: /^1500m/u }))
    expect(onGoal).toHaveBeenCalledWith(1500)
  })

  it("requires an explicit RPE or authorized detailed-template choice", async () => {
    const user = userEvent.setup()
    const onTemplate = vi.fn()
    render(
      <PlanIntake
        step="template"
        draft={{ eventGroup: "MIDDLE_DISTANCE", eventDistanceM: 1500, trainingFocus: "MIXED_INTENT" }}
        onBack={vi.fn()}
        onGoal={vi.fn()}
        onDivision={vi.fn()}
        onExperience={vi.fn()}
        onFocus={vi.fn()}
        onTemplate={onTemplate}
        onDays={vi.fn()}
        onFrameLength={vi.fn()}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /RPE 기준으로 받기/u })).toBeVisible()
    const detailed = screen.getByRole("button", { name: /1500m 경기 페이스 상세 훈련 포함/u })
    expect(detailed).toHaveTextContent("3×500m @1500m RP · r180″ STAND")
    await user.click(detailed)
    expect(onTemplate).toHaveBeenCalledWith(expect.objectContaining({ templateId: "MD-1500-01" }))
  })
})
