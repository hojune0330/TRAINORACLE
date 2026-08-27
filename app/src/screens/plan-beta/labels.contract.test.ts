import { cleanup, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { PlanSchedulePreview } from "./PlanSchedulePreview"
import {
  candidateSessionSummary,
  sessionExecutionSteps,
  twoADayTrainingDayCount,
} from "./labels"

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

function qualitySession(
  plannedEnergyIntent: Extract<PlanSession, { role: "QUALITY" }>["plannedEnergyIntent"] = "VO2_INTENT",
  rpe = { minimum: 7, maximum: 8 },
): PlanSession {
  return {
    day: 1,
    slot: "AM",
    role: "QUALITY",
    plannedEnergyIntent,
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe,
      durationMinutes: { minimum: 30, maximum: 50 },
    },
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
    })).toContain("9.5일 동안 표시된 시간 합계 1시간 5분~1시간 40분")
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

  it("renders an executable high-intensity session without inventing pace or distance", () => {
    render(
      createElement(PlanSchedulePreview, {
        startDate: "2026-08-17",
        frameLengthDays: 7,
        sessions: [qualitySession()],
      }),
    )

    const firstDay = screen.getByRole("group", { name: "8월 17일 월요일 · 훈련 1개" })
    expect(firstDay).toHaveTextContent("총 30~50분 · RPE 7~8")
    expect(firstDay).toHaveTextContent("준비")
    expect(firstDay).toHaveTextContent("본운동")
    expect(firstDay).toHaveTextContent("빠른 구간과 천천히 움직이는 회복 구간을 번갈아")
    expect(firstDay).toHaveTextContent("정리")
    expect(firstDay).toHaveTextContent("거리\u2060·\u2060목표 페이스는 지정하지 않음")
    expect(firstDay).toHaveTextContent("같은 강도로 한 번 더 달릴 여유가 없으면 본운동을 끝내세요")
  })

  it.each([
    {
      intent: "GLY_INTENT" as const,
      endpoint: "자세나 속도가 흐트러지기 전에 빠른\u00a0구간을 끝내세요",
      restart: "숨이\u00a0가라앉으면 다음\u00a0빠른\u00a0구간을 시작하세요",
    },
    {
      intent: "ATP_PC_INTENT" as const,
      endpoint: "한\u00a0번의\u00a0가속\u00a0구간을 끝내세요",
      restart: "숨과 다리가 편해지면 다음 가속을 시작",
    },
  ])("uses stored RPE and complete transitions for $intent", ({ intent, endpoint, restart }) => {
    const steps = sessionExecutionSteps(qualitySession(intent, { minimum: 6, maximum: 7 }))
    const main = steps.find((step) => step.title === "본운동")

    expect(main?.detail).toContain("RPE 6~7")
    expect(main?.detail).toContain(endpoint)
    expect(main?.detail).toContain(restart)
    expect(main?.detail).not.toContain("RPE 7~8")
  })
})
