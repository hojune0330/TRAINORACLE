import { cleanup, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { PlanSchedulePreview } from "./PlanSchedulePreview"
import { candidateSessionSummary, twoADayTrainingDayCount } from "./labels"

function session(
  day: number,
  slot: PlanSession["slot"],
  durationMinutes = { minimum: 30, maximum: 45 },
): PlanSession {
  return {
    day,
    slot,
    role: "EASY",
    plannedEnergyIntent: "BASE_INTENT",
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe: { minimum: 3, maximum: 4 },
      durationMinutes,
    },
  }
}

function restSession(day: number, slot: PlanSession["slot"]): PlanSession {
  return {
    day,
    slot,
    role: "REST",
    plannedEnergyIntent: "RECOVERY_INTENT",
    prescription: { kind: "REST" },
  }
}

describe("two-a-day plan summary", () => {
  afterEach(cleanup)

  it("matches the 9.5-day preview total when day 10 has two sessions", () => {
    const sessions: readonly PlanSession[] = [
      session(1, "AM"),
      session(10, "AM", { minimum: 20, maximum: 30 }),
      session(10, "PM", { minimum: 15, maximum: 25 }),
      session(11, "AM"),
    ]

    render(
      createElement(PlanSchedulePreview, {
        startDate: "2026-08-17",
        frameLengthDays: 9.5,
        sessions,
      }),
    )

    expect(screen.getByRole("group", { name: "8월 26일 수요일 · 훈련 2개" }))
      .toHaveTextContent("20~30분")
    expect(screen.getByRole("group", { name: "8월 26일 수요일 · 훈련 2개" }))
      .toHaveTextContent("15~25분")
    expect(screen.queryByRole("group", { name: /8월 27일/u })).not.toBeInTheDocument()
    expect(candidateSessionSummary({
      sessions,
      frame: { projectionLengthDays: 9.5 },
    })).toContain("총 계획 시간 65~100분")
  })

  it("does not count a single evening session as two-a-day training", () => {
    expect(twoADayTrainingDayCount([session(4, "PM")])).toBe(0)
  })

  it("counts dates with two non-rest sessions, not afternoon slots", () => {
    expect(twoADayTrainingDayCount([
      session(4, "AM"),
      session(4, "PM"),
      session(7, "PM"),
    ])).toBe(1)
  })

  it("does not count a rest slot as the second training session", () => {
    expect(twoADayTrainingDayCount([
      restSession(4, "AM"),
      session(4, "PM"),
    ])).toBe(0)
  })
})
