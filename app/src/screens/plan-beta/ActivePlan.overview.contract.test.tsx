import { act, cleanup, render, screen, within } from "@testing-library/react"
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
    day: 3,
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
  it("shows the training flow and same-day sessions before collapsed notes", () => {
    render(<ActivePlan state={overviewState()} {...callbacks} />)

    expect(screen.getByRole("heading", { level: 1, name: "9일 훈련 계획" })).toBeVisible()
    expect(screen.getByText("8월 27일(목) - 9월 4일(금)")).toBeVisible()
    const buildSummary = screen.getByRole("list", { name: "계획 구성 요약" })
    const summaryItems = within(buildSummary).getAllByRole("listitem")
    expect(summaryItems[0]).toHaveTextContent("5000m")
    expect(summaryItems[1]).toHaveTextContent("지속 페이스 · LT")
    expect(summaryItems[2]).toHaveTextContent("하루 2회 포함")
    expect(within(buildSummary).getByRole("button", { name: "LT 설명 보기" })).toBeVisible()

    const flow = screen.getByLabelText("9일 훈련 흐름")
    const information = screen.getByText("계획 정보와 유의사항").closest("details")
    const timeline = screen.getByRole("list", { name: "날짜별 계획 미리보기" })
    const trainingDay = screen.getByRole("group", {
      name: "8월 29일 토요일 · 훈련 2개",
    })

    expect(flow).toHaveTextContent(/MAINLT.*REC/u)
    expect(trainingDay).toHaveTextContent(/오전.*MAINLT.*지속 페이스.*오후.*REC.*오후 회복 운동/u)
    expect(flow.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(timeline.compareDocumentPosition(information as Node) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(information).not.toHaveAttribute("open")
    expect(screen.getByText(/1~2 회복 움직임/u)).not.toBeVisible()
    expect(screen.getByText("오전 훈련 방법과 기록").closest("details")).not.toHaveAttribute("open")
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
