/* LEGACY_11STEP_FLOW: 2026-09 4질문 빠른 흐름 도입으로 옛 인테이크 클릭 순서를 전제한 테스트. 다듬기 경로로 재작성 예정(PR #341 본문). */
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DETAILED_PRESCRIPTION_APPROVALS } from "../../domain/detailed-prescription-approvals"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { PlanIntake } from "./PlanIntake"
import { firstUnansweredRefinement } from "./plan-intake-navigation"

afterEach(cleanup)

describe("question-first plan preparation", () => {
  const callbacks = {
    onBack: vi.fn(), onGoal: vi.fn(), onDivision: vi.fn(), onExperience: vi.fn(),
    onFocus: vi.fn(), onTemplate: vi.fn(), onDays: vi.fn(), onFrameLength: vi.fn(),
    onTrainingTime: vi.fn(), onSecondSession: vi.fn(), onManageRecords: vi.fn(),
    onOpenNotationReader: vi.fn(), onSafety: vi.fn(), onContinue: vi.fn(),
  }

  it("shows compact days before a single answer edit entry without calendar chrome", async () => {
    const onJump = vi.fn()
    render(<PlanIntake step="days" draft={{ ...stateFixture().intake, requestedFrameLength: 7 }}
      {...callbacks} onJump={onJump} />)
    const heading = screen.getByRole("heading", { name: "이번 7일 중 며칠 훈련할까요?" })
    const answers = screen.getByRole("button", { name: /선택한 내용 바꾸기/ })
    expect(screen.getByText("계획 준비 · 운동할 날")).toBeVisible()
    expect(heading.compareDocumentPosition(answers) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(answers.closest("details")).not.toHaveAttribute("open")
    expect(screen.queryByText(/일 달력 보기/)).not.toBeInTheDocument()
    expect(answers).toHaveAccessibleName("선택한 내용 바꾸기")
    const days = within(screen.getByRole("group", { name: "운동할 날 선택" }))
    expect(days.getAllByRole("button").map(button => button.textContent)).toEqual(["3일", "4일", "5일", "6일", "매일"])
    await userEvent.setup().click(days.getByRole("button", { name: "매일" }))
    expect(callbacks.onDays).toHaveBeenCalledWith("EVERY_DAY")
    await userEvent.setup().click(answers)
    await userEvent.setup().click(screen.getByRole("button", { name: "5000m" }))
    expect(onJump).toHaveBeenCalledWith("goal")
  })

  it("does not expose inert edit buttons when no jump action is provided", () => {
    render(<PlanIntake step="safety" draft={stateFixture().intake} {...callbacks} />)
    expect(screen.queryByRole("button", { name: "5000m" })).toBeNull()
    expect(screen.getByRole("button", { name: /통증·부상·몸 이상/ })).toBeVisible()
  })

  it("keeps the legacy half-day value and previews whole calendar dates", () => {
    const draft = { ...stateFixture().intake, requestedFrameLength: 9.5 as const }
    render(<PlanIntake step="goal" draft={draft} {...callbacks} />)
    expect(screen.getByText(/10일 달력 보기/)).toBeVisible()
    expect(draft.requestedFrameLength).toBe(9.5)
  })

  it("asks about actual experience without recommending an answer", async () => {
    render(<PlanIntake step="experience" draft={{}} {...callbacks} />)
    expect(screen.queryByText("추천")).not.toBeInTheDocument()
    expect(screen.queryByText(/구조화된/)).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련/ }))
    expect(callbacks.onExperience).toHaveBeenCalledWith("EXPERIENCED")
  })
})

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
  it("explains the current two-session option before it is chosen", async () => {
    const user = userEvent.setup()
    const onSecondSession = vi.fn()
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
        onSecondSession={onSecondSession}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
        onContinue={vi.fn()}
      />,
    )

    const single = screen.getByRole("button", { name: /하루 한 번 운동/u, pressed: true })
    const double = screen.getByRole("button", { name: /하루 두 번 운동할게요/u, pressed: false })
    expect(double).toHaveAccessibleName(/오전·오후 두 칸.*힘든 훈련은 하나만/u)
    expect(double).toBeVisible()
    expect(onSecondSession).not.toHaveBeenCalled()
    await user.click(double)
    expect(onSecondSession).toHaveBeenNthCalledWith(1, "RECOVERY_PM_ALLOWED")
    await user.click(single)
    expect(onSecondSession).toHaveBeenNthCalledWith(2, "SINGLE_SESSION_ONLY")
    expect(onSecondSession).toHaveBeenCalledTimes(2)
  })
})

describe("competition division intake", () => {
  it.skip("asks for the current competition division without presenting it as an age or safety decision", async () => {
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

    const help = screen.getByText("이 선택은 계획에 어떻게 쓰이나요?")
    expect(help.closest("details")).not.toHaveAttribute("open")
    await userEvent.click(help)
    expect(screen.getByText(/나이·성숙도.*의료 판단에 사용하지 않아요/u)).toBeVisible()
    expect(screen.getByRole("button", { name: /고등부/u })).toBeVisible()
    await screen.getByRole("button", { name: /선택하지 않음.*나중에 입력/u }).click()
    expect(onDivision).toHaveBeenCalledWith("NOT_PROVIDED")
  })
})

describe("plan length intake", () => {
  it("explains the continuing 7-day choice and keeps 9/10 wording factual", async () => {
    const user = userEvent.setup()
    const onFrameLength = vi.fn()
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
        onFrameLength={onFrameLength}
        onTrainingTime={vi.fn()}
        onSecondSession={vi.fn()}
        onManageRecords={vi.fn()}
        onOpenNotationReader={vi.fn()}
        onSafety={vi.fn()}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /7일만 먼저 받기/u }))
      .toHaveTextContent("이 계획이 끝나면 다음 계획 만들기")
    expect(onFrameLength).not.toHaveBeenCalled()
    for (const [index, days] of [7, 9, 10].entries()) {
      const choice = screen.getByRole("button", {
        name: days === 7 ? /7일만 먼저 받기/u : new RegExp(`${days}일 계획 받기`, "u"),
        pressed: false,
      })
      expect(choice).toBeVisible()
      if (days !== 7) expect(choice).toHaveAccessibleName(/한 번에 받아요/u)
      await user.click(choice)
      expect(onFrameLength).toHaveBeenNthCalledWith(index + 1, days)
    }
    expect(onFrameLength).toHaveBeenCalledTimes(3)
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
        draft={{ eventGroup: "MIDDLE_DISTANCE", eventDistanceM: 1500, trainingFocus: "MIXED_INTENT", experienceBand: "EXPERIENCED" }}
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

    const rpe = screen.getByRole("button", { name: /시간·힘든 정도로 받기/u, pressed: false })
    expect(rpe).toBeVisible()
    expect(rpe).toHaveAccessibleName(/기록 없이 바로.*힘든 정도\(1~10\)와 시간/u)
    const detailed = screen.getByRole("button", { name: /1500m 경기 페이스 상세 훈련 포함/u, pressed: false })
    expect(detailed).toHaveAccessibleName(/3 × 500m @ 1500m RP · r3min Stand.*내 기록으로 목표 시간 계산/u)
    expect(detailed).toBeVisible()
    expect(screen.getByText("준비·정리와 훈련 표기 보기").closest("details")).not.toHaveAttribute("open")
    await user.click(screen.getByText("준비·정리와 훈련 표기 보기"))
    expect(screen.getByText("3×500m @1500m RP · r180″ STAND")).toBeVisible()
    expect(screen.getByText(/준비 15분 RPE/u)).toBeVisible()
    expect(onTemplate).not.toHaveBeenCalled()
    await user.click(detailed)
    const approval = DETAILED_PRESCRIPTION_APPROVALS.find((item) => item.templateId === "MD-1500-01")
    if (approval === undefined) throw new Error("Expected the approved 1500m template")
    expect(onTemplate).toHaveBeenNthCalledWith(1, {
      templateId: approval.templateId,
      version: approval.templateVersion,
      fingerprint: approval.templateContentFingerprint,
    })
    await user.click(rpe)
    expect(onTemplate).toHaveBeenNthCalledWith(2, null)
    expect(onTemplate).toHaveBeenCalledTimes(2)
  })
})
