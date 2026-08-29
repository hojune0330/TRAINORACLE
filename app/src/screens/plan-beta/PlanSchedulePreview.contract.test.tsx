import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { PlanSchedulePreview } from "./PlanSchedulePreview"

const sessions: readonly PlanSession[] = [
  {
    day: 1,
    slot: "AM",
    role: "QUALITY",
    plannedEnergyIntent: "LT_INTENT",
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe: { minimum: 5, maximum: 6 },
      durationMinutes: { minimum: 25, maximum: 40 },
    },
  },
  {
    day: 1,
    slot: "PM",
    role: "EASY",
    plannedEnergyIntent: "RECOVERY_INTENT",
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe: { minimum: 1, maximum: 2 },
      durationMinutes: { minimum: 15, maximum: 25 },
    },
  },
  {
    day: 2,
    slot: "AM",
    role: "REST",
    plannedEnergyIntent: "RECOVERY_INTENT",
    prescription: { kind: "REST" },
  },
]

afterEach(cleanup)
afterEach(() => vi.useRealTimers())

describe("plan schedule preview", () => {
  it("projects only days 1-7 from a full canonical session list", () => {
    const dayEightSession: PlanSession = {
      day: 8,
      slot: "AM",
      role: "EASY",
      plannedEnergyIntent: "BASE_INTENT",
      prescription: {
        kind: "RPE_TIME_RANGE",
        rpe: { minimum: 3, maximum: 4 },
        durationMinutes: { minimum: 30, maximum: 45 },
      },
    }

    render(
      <PlanSchedulePreview
        startDate="2026-08-17"
        frameLengthDays={7}
        sessions={[...sessions, dayEightSession]}
      />,
    )

    expect(screen.getByLabelText("7일 훈련 흐름")).toBeVisible()
    expect(screen.getByRole("group", { name: /8월 23일 일요일/u })).toBeVisible()
    expect(screen.queryByRole("group", { name: /8월 24일 월요일/u })).not.toBeInTheDocument()
  })

  it("shows a chosen date as two separate same-day training slots", () => {
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

    const flow = screen.getByLabelText("9.5일 훈련 흐름")
    expect(flow).toContainElement(screen.getByRole("listitem", {
      name: "8월 17일 월요일 · 주요 훈련 LT · 회복 운동",
    }))
    expect(screen.getByRole("listitem", {
      name: "8월 17일 월요일 · 주요 훈련 LT · 회복 운동",
    })).toHaveTextContent("주요LT회복")

    const restFlowDay = screen.getByRole("listitem", {
      name: /8월 18일.*훈련 없음/u,
    })
    expect(restFlowDay).toHaveTextContent("휴식")

    const firstDay = screen.getByRole("group", {
      name: "8월 17일 월요일 · 훈련 2개",
    })
    expect(firstDay).toHaveTextContent("오전")
    expect(firstDay).toHaveTextContent("오후")
    expect(screen.getByRole("group", { name: "8월 17일 월요일 오전 세션" })).toBeVisible()
    expect(screen.getByRole("group", { name: "8월 17일 월요일 오후 세션" })).toBeVisible()
    expect(firstDay).toHaveTextContent("지속 페이스")
    expect(firstDay).toHaveTextContent("오후 회복 운동")

    expect(screen.getByRole("group", {
      name: "8월 18일 화요일 · 휴식",
    })).toHaveTextContent("휴식일")
  })

  it("keeps morning and afternoon in one swipe card and orders morning first", async () => {
    const user = userEvent.setup()
    render(
      <PlanSchedulePreview
        startDate="2026-08-17"
        sessions={[sessions[1]!, sessions[0]!, sessions[2]!]}
        displayMode="swipe"
        timelineHeading="날짜별 훈련"
      />,
    )

    const firstDay = screen.getByRole("group", {
      name: "8월 17일 월요일 · 훈련 2개",
    })
    const morning = screen.getByRole("group", { name: "8월 17일 월요일 오전 세션" })
    const afternoon = screen.getByRole("group", { name: "8월 17일 월요일 오후 세션" })

    expect(firstDay).toContainElement(morning)
    expect(firstDay).toContainElement(afternoon)
    expect(morning.compareDocumentPosition(afternoon) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(within(firstDay).getByText("본운동")).not.toBeVisible()

    await user.click(within(morning).getByText("오전 훈련 방법과 기록"))
    expect(within(firstDay).getByText("본운동")).toBeVisible()
    expect(screen.getByRole("button", { name: "이전 날짜" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "다음 날짜" })).toBeEnabled()
    expect(screen.getByText("1/10")).toBeVisible()
  })

  it("presents notation, plain execution, and optional RPE detail in order", async () => {
    const user = userEvent.setup()
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions.slice(0, 1)} />)

    const session = screen.getByRole("group", { name: "8월 17일 월요일 오전 세션" })
    expect(session).toHaveTextContent("총 25~40분 · RPE 5~6")
    expect(session).toHaveTextContent("본운동")
    expect(session).toHaveTextContent(/숨은 차지만.*짧은 문장이 가능/u)

    const rpeHelp = screen.getByRole("button", { name: "운동 자각도 RPE 설명 보기" })
    await user.click(rpeHelp)
    expect(screen.getByText(/내 몸의 느낌으로 매기는 1~10점/u)).toBeVisible()
    expect(screen.getByRole("link", { name: "왜 이런 이름인가요?" })).toHaveAttribute(
      "href",
      "?terms=1&term=rpe",
    )
  })

  it("opens beginner explanations from the legend and the dated session badge", async () => {
    const user = userEvent.setup()
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

    await user.click(screen.getByRole("button", { name: "주요 훈련 MAIN 일정표 구분 설명 보기" }))
    expect(screen.getByText(/준비 목표를 가장 직접적으로 다루는 훈련/u)).toBeVisible()

    await user.click(screen.getByRole("button", { name: "주요 훈련 MAIN, 지속 페이스 LT 훈련 설명 보기" }))
    expect(screen.getByText(/조금 힘든 느낌을 비교적 일정하게 유지/u)).toBeVisible()

    await user.click(screen.getByRole("button", { name: "회복 운동 REC 일정표 구분 설명 보기" }))
    expect(screen.getByText(/빠른 걷기.*아주 가벼운 조깅.*느린 자전거/u)).toBeVisible()
  })

  it("marks only today's date while the frame is being followed", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-17T12:00:00"))
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

    const today = screen.getByRole("listitem", {
      name: "8월 17일 월요일 · 주요 훈련 LT · 회복 운동",
    })
    expect(today).toHaveAttribute("aria-current", "date")
    expect(screen.getByRole("listitem", {
      name: "8월 24일 월요일 · 훈련 없음",
    })).not.toHaveAttribute("aria-current")
  })
})
