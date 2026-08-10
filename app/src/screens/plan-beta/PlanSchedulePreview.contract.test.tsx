import { cleanup, render, screen } from "@testing-library/react"
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
  it("shows a chosen date as two separate same-day training slots", () => {
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

    const calendar = screen.getByLabelText("9.5일 달력 요약")
    expect(calendar).toContainElement(screen.getByRole("listitem", {
      name: "8월 17일 월요일 · 훈련 2개",
    }))
    expect(screen.getByRole("listitem", {
      name: "8월 17일 월요일 · 훈련 2개",
    })).toHaveTextContent("오전오후")

    const firstDay = screen.getByRole("group", {
      name: "8월 17일 월요일 · 훈련 2개",
    })
    expect(firstDay).toHaveTextContent("오전")
    expect(firstDay).toHaveTextContent("오후")
    expect(firstDay).toHaveTextContent("지속 페이스")
    expect(firstDay).toHaveTextContent("오후 회복 운동")

    expect(screen.getByRole("group", {
      name: "8월 18일 화요일 · 휴식",
    })).toHaveTextContent("휴식일")
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
