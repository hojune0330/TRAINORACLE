import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { bindDefaultCatalogSessions } from "@impl/prescription/catalog-session-binding"
import { PlanSchedulePreview } from "./PlanSchedulePreview"
import {
  candidateSessionSummary,
  candidateSharedSessionSummary,
  candidateDurationSummary,
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
  const originalScrollTo = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo")
  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, value: vi.fn(function (this: Element, options: ScrollToOptions) {
      this.scrollTop = options.top ?? this.scrollTop
    }) })
  })
  afterEach(() => {
    cleanup()
    if (originalScrollTo) Object.defineProperty(Element.prototype, "scrollTo", originalScrollTo)
    else Reflect.deleteProperty(Element.prototype, "scrollTo")
  })

  it("reads catalog execution in plain units without duplicating the step count or changing the prescription", () => {
    const bound = bindDefaultCatalogSessions([session(1, "AM", { minimum: 35, maximum: 35 })], 5000, "EXPERIENCED", 0)[0]!
    const before = JSON.stringify(bound)
    const steps = sessionExecutionSteps(bound)
    const mainInstruction = steps.find(step => step.title === "본운동")?.detail
    expect(mainInstruction).toBe("20분 · 힘든 정도 3/10 → 15분 · 힘든 정도 4/10 통증\u2060·\u2060어지럼\u2060·\u2060자세\u00a0무너짐이 생기면 시간을 채우지 말고 중단하세요.")
    expect(mainInstruction?.replace(/\u2060/g, "").replace(/\u00a0/g, " ")).toContain("통증·어지럼·자세 무너짐이 생기면 시간을 채우지 말고 중단하세요.")
    render(createElement(PlanSchedulePreview, { startDate: "2026-08-17", frameLengthDays: 7, sessions: [bound] }))
    fireEvent.click(screen.getByRole("button", { name: "8월 17일 월요일 오전 훈련 내용 보기" }))
    const main = within(screen.getByRole("dialog")).getByRole("list", { name: "본운동 순서" })
    expect(within(main).getAllByRole("listitem")).toHaveLength(2)
    expect(main).toHaveTextContent("20분힘든 정도(RPE) 3/10")
    expect(main).toHaveTextContent("15분힘든 정도(RPE) 4/10")
    expect(screen.queryByText(/본운동 \d+개 구간과/)).not.toBeInTheDocument()
    expect(JSON.stringify(bound)).toBe(before)
  })

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
      .toHaveTextContent("전체 20–30min")
    expect(screen.getByRole("group", { name: "8월 26일 수요일 · 훈련 2개" }))
      .toHaveTextContent("전체 15–25min")
    expect(screen.queryByRole("group", { name: /8월 27일/u })).not.toBeInTheDocument()
    expect(candidateSessionSummary({
      sessions,
      frame: { projectionLengthDays: 9.5 },
    })).toContain("9.5일 동안 표시된 시간 합계 1시간 5분~1시간 40분")
  })

  it("does not count a single evening session as two-a-day training", () => {
    expect(twoADayTrainingDayCount([session(4, "PM")])).toBe(0)
  })

  it("counts workouts as occurrences and counts only whole rest days once", () => {
    expect(candidateSharedSessionSummary({ sessions: [session(1, "AM"), session(1, "PM"),
      restSession(2, "AM"), session(2, "PM"), restSession(3, "AM"), restSession(3, "PM")] }))
      .toBe("운동 3회 · 기초·회복 3회 · 쉬는 날 1일 · 하루 2회 훈련 1일")
  })

  it("does not publish a plausible total from an unreadable catalog binding", () => {
    const bound = bindDefaultCatalogSessions([session(1, "AM", { minimum: 35, maximum: 35 })], 5000, "EXPERIENCED", 0)[0]!
    if (bound.prescription.kind !== "RPE_TIME_RANGE" || !bound.prescription.catalogWorkout) throw Error("Expected bound fixture")
    const invalid = { ...bound, prescription: { ...bound.prescription, catalogWorkout: {
      ...bound.prescription.catalogWorkout, calculationFingerprint: "invalid-synthetic-fingerprint",
    } } } as PlanSession
    expect(candidateDurationSummary({ sessions: [invalid] })).toBe("전체 시간 확인 필요 · 일부 운동의 시간을 읽지 못했어요")
  })

  it.each([
    [8480 / 60, "2시간 21분 20초"],
    [59.9999999999, "1시간"],
    [35 / 60, "35초"],
    [0, "0분"],
  ])("formats fractional catalog minutes without floating-point noise: %s", (minutes, label) => {
    const result = candidateSessionSummary({
      sessions: [session(1, "AM", { minimum: minutes, maximum: minutes })],
    })
    expect(result).toContain(`표시된 시간 합계 ${label}`)
    expect(result).not.toMatch(/\d\.\d{4}/u)
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
    expect(firstDay).toHaveTextContent("전체 30–50min @ RPE 7–8")
    expect(firstDay).toHaveTextContent("상세 구성 확인 필요 · 전체 시간은 본운동 시간이 아니에요.")
    fireEvent.click(within(firstDay).getByRole("button", { name: "8월 17일 월요일 오전 훈련 내용 보기" }))
    const reader = within(screen.getByRole("dialog"))
    expect(reader.getByText("준비", { exact: true })).toBeVisible()
    expect(reader.getByText("본운동", { exact: true })).toBeVisible()
    expect(reader.getByText(/강한 구간과 천천히 움직이는 회복 구간을 번갈아/u)).toBeVisible()
    expect(reader.getByText("정리", { exact: true })).toBeVisible()
    expect(reader.getByText(/같은 강도로 한 번 더 달릴 여유가 없으면 본운동을 끝내세요/u)).toBeVisible()
    fireEvent.click(reader.getByRole("button", { name: "훈련 방법과 이유" }))
    const explanation = within(screen.getByRole("tabpanel"))
    expect(explanation.getByText("표시한 시간은 준비·회복·정리를 포함한 전체 시간이에요. 전부 빠르게 달리는 시간이 아니에요.")).toBeVisible()
    fireEvent.click(screen.getByRole("tab", { name: "이유·근거" }))
    fireEvent.click(explanation.getByText("구성·회복의 이유와 근거", { selector: "summary" }))
    expect(explanation.getByText(/목표 페이스·고정 횟수는 추정하지 않습니다\./u)).toBeVisible()
    expect(explanation.getByText(/구간별 숫자가 없는 RPE 안내예요\. 반복과 회복의 구체적인 구성을 확인할 수 없어요\./u)).toBeVisible()
  })

  it.each([
    {
      intent: "GLY_INTENT" as const,
      endpoint: "자세나 속도가 흐트러지기 전에 끝내세요",
      restart: "숨이\u00a0가라앉으면 다음 구간을 시작하세요",
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
