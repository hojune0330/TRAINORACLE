import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { ActivePlan } from "./ActivePlan"

afterEach(cleanup)
afterEach(() => vi.useRealTimers())

const callbacks = {
  onProgress: vi.fn(),
  onNextFrame: vi.fn(),
  onActivateNextFrame: vi.fn(),
  onCheckDetailedExecution: vi.fn(),
}

function overviewState() {
  const state = stateFixture()
  if (state.version !== 3) throw new Error("Expected a version 3 fixture")
  const qualitySession: PlanSession = {
    day: 3,
    slot: "AM",
    role: "QUALITY",
    plannedEnergyIntent: "LT_INTENT",
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe: { minimum: 6, maximum: 7 },
      durationMinutes: { minimum: 30, maximum: 40 },
    },
  }
  const easySession: PlanSession = {
    day: 4,
    slot: "PM",
    role: "EASY",
    plannedEnergyIntent: "RECOVERY_INTENT",
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe: { minimum: 1, maximum: 2 },
      durationMinutes: { minimum: 15, maximum: 20 },
    },
  }
  return {
    ...state,
    intake: {
      ...state.intake,
      startDate: "2026-08-27",
      secondSessionMode: "RECOVERY_PM_ALLOWED" as const,
    },
    activePlan: {
      ...state.activePlan,
      sessions: [qualitySession, easySession],
    },
  }
}

describe("active plan first-view overview", () => {
  it("shows dates and main sessions before the calendar, then keeps long notes collapsed", () => {
    render(<ActivePlan state={overviewState()} {...callbacks} />)

    expect(screen.getByRole("heading", { level: 1, name: "9일 훈련 계획" })).toBeVisible()
    expect(screen.getByText("8월 27일(목) - 9월 4일(금)")).toBeVisible()
    expect(screen.getByRole("list", { name: "계획 구성 요약" })).toHaveTextContent(
      "5000m지속 페이스 · LT2일 운동하루 2회 포함",
    )

    const mainTraining = screen.getByRole("heading", { level: 2, name: "메인 훈련일" }).closest("section")
    const calendar = screen.getByLabelText("9일 달력 요약")
    const information = screen.getByText("계획 정보와 유의사항").closest("details")
    const timeline = screen.getByRole("list", { name: "날짜별 계획 미리보기" })

    expect(mainTraining).toHaveTextContent(/8월 29일\(토\).*지속 페이스.*오전/u)
    expect((mainTraining?.compareDocumentPosition(calendar) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(calendar.compareDocumentPosition(information as Node) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect((information?.compareDocumentPosition(timeline) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(information).not.toHaveAttribute("open")
    expect(screen.getByText(/1~2 회복 움직임/u)).not.toBeVisible()
  })

  it("shows a one-shot creation confirmation and removes it automatically", () => {
    vi.useFakeTimers()
    render(
      <ActivePlan
        state={overviewState()}
        showCreatedCelebration
        {...callbacks}
      />,
    )

    expect(screen.getByText("훈련 계획이 완성됐어요")).toBeVisible()
    act(() => vi.advanceTimersByTime(3_000))
    expect(screen.queryByText("훈련 계획이 완성됐어요")).not.toBeInTheDocument()
  })

  it("does not celebrate an already stored plan opened later", () => {
    render(<ActivePlan state={overviewState()} {...callbacks} />)
    expect(screen.queryByText("훈련 계획이 완성됐어요")).not.toBeInTheDocument()
  })
})
