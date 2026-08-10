import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
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

describe("plan schedule preview", () => {
  it("shows a chosen date as two separate same-day training slots", () => {
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

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
})
