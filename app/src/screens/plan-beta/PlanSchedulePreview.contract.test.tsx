import { cleanup, render, screen } from "@testing-library/react"
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

    expect(screen.getByLabelText("7일 달력 요약")).toBeVisible()
    expect(screen.getByRole("group", { name: /8월 23일 일요일/u })).toBeVisible()
    expect(screen.queryByRole("group", { name: /8월 24일 월요일/u })).not.toBeInTheDocument()
  })

  it("shows a chosen date as two separate same-day training slots", () => {
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

    const calendar = screen.getByLabelText("9.5일 달력 요약")
    expect(calendar).toContainElement(screen.getByRole("listitem", {
      name: "8월 17일 월요일 · 훈련 2개",
    }))
    expect(screen.getByRole("listitem", {
      name: "8월 17일 월요일 · 훈련 2개",
    })).toHaveTextContent("오전오후")

    const restCalendarDay = screen.getByRole("listitem", {
      name: /8월 18일.*휴식/u,
    })
    expect(restCalendarDay).toHaveTextContent("휴식")
    expect(restCalendarDay).not.toHaveTextContent("오전")

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

  it("presents notation, plain execution, and optional RPE detail in order", async () => {
    const user = userEvent.setup()
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions.slice(0, 1)} />)

    const session = screen.getByRole("group", { name: "8월 17일 월요일 오전 세션" })
    expect(session).toHaveTextContent("총 25~40분 · RPE 5~6")
    expect(session).toHaveTextContent("본운동")
    expect(session).toHaveTextContent(/숨은 차지만.*짧은 문장이 가능/u)

    const rpeHelp = screen.getByRole("button", { name: "RPE 설명 보기" })
    await user.click(rpeHelp)
    expect(screen.getByText(/1~2는 빨리 걷기.*3~4는.*기본 유산소.*10은 최대 노력/u)).toBeVisible()
    expect(screen.getByText(/의료 판단이 아닙니다/u)).toBeVisible()
  })

  it("marks only today's date while the frame is being followed", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-17T12:00:00"))
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

    const today = screen.getByRole("listitem", {
      name: "8월 17일 월요일 · 훈련 2개",
    })
    expect(today).toHaveAttribute("aria-current", "date")
    expect(today).toHaveTextContent("오늘")
    expect(screen.getByRole("listitem", {
      name: "8월 24일 월요일 · 비움",
    })).not.toHaveAttribute("aria-current")
  })
})
