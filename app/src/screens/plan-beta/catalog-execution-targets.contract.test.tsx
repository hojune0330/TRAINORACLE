import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { rangesFor, rpeForIntent } from "@impl/plan-generator/session-builder"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout, calculatedWorkoutSequence } from "@impl/prescription/all-workout-calculator"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { AthleteRecord } from "../../domain/athlete-records"
import { createSegmentRecordReference } from "../../domain/catalog-pace-reference"
import { projectInstantExecutionSteps } from "./instant-plan-today"
import { sessionExecutionSteps, sessionLabel } from "./labels"
import { presentSessionWorkoutNotation } from "./workout-notation-presentation"
import { PlanSchedulePreview } from "./PlanSchedulePreview"
import { sequencePhaseNotation } from "../../domain/workout-notation"

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw Error("Expected a verified synthetic catalog fixture")
  return value
}

function inputs(overrides: Partial<WorkoutCalculationInputs> = {}): WorkoutCalculationInputs {
  return { eventDistanceM: 10000, experience: "EXPERIENCED", availableSeconds: null,
    confirmedRequirements: [], fiveK: null, segmentPaces: [], ...overrides }
}

// Synthetic values prove display plumbing, not an athlete's ability or recommended dose.
function record(kind: "ACTUAL" | "GOAL"): AthleteRecord {
  const base = { schemaVersion: 1 as const, id: `synthetic-10k-${kind.toLowerCase()}`,
    eventDistanceM: 10000, performanceSeconds: 3007.3, enteredBy: "ATHLETE" as const,
    verificationState: "SELF_REPORTED" as const, sourceRef: "athlete-record:synthetic-10k",
    savedAt: "2026-10-02T00:00:00.000Z", seasonId: null }
  return kind === "ACTUAL"
    ? { ...base, purpose: "RECENT_RESULT", achievedOn: "2026-10-01" }
    : { ...base, purpose: "RACE_GOAL", achievedOn: null }
}

function bind(id: string, calculationInputs: WorkoutCalculationInputs,
  intent: Extract<PlanSession, { role: "QUALITY" }>["plannedEnergyIntent"] = "MIXED_INTENT"): PlanSession {
  const session: PlanSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: intent,
    prescription: { kind: "RPE_TIME_RANGE", rpe: rpeForIntent(intent),
      durationMinutes: rangesFor(calculationInputs.experience).quality } }
  return required(bindCatalogSession(session, id, calculationInputs, true))
}

function calculation(session: PlanSession) {
  if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Expected a catalog prescription")
  return required(resolveCatalogBinding(required(session.prescription.catalogWorkout)))
}

function mainInstruction(session: PlanSession): string {
  return required(sessionExecutionSteps(session).find(step => step.role === "MAIN")).detail
}

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-02T09:00:00+09:00"))
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true,
    value: function (this: HTMLDialogElement) { this.setAttribute("open", "") } })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal")
})

describe("verified catalog targets in execution steps", () => {
  const formats = [
    { format: "distance", id: "RP-10000-DISTANCE", segmentId: "X-LT-01-1-1", repetitions: 5, work: "1km", target: "≈300.7s/1000m" },
    { format: "timed", id: "RP-10000-TIMED", segmentId: "part-0", repetitions: 3, work: "7분", target: "≈301초/km" },
  ] as const

  it.each(formats.flatMap(format => (["ACTUAL", "GOAL"] as const).map(kind => ({ ...format, kind }))))
    ("preserves existing $kind $format RP numbers and provenance in first/today execution", ({ id, segmentId, format, kind, repetitions, work, target }) => {
      const sourceRecord = record(kind)
      const session = bind(id, inputs({ paceReferences: [createSegmentRecordReference(segmentId, sourceRecord, "2026-10-02")] }))
      const calculated = calculation(session)
      const source = required(ALL_WORKOUT_CATALOG.find(entry => entry.id === id)).sequence
      const before = JSON.stringify({ sourceRecord, session, calculated, source })
      const steps = sessionExecutionSteps(session)
      const main = mainInstruction(session)
      const basis = kind === "ACTUAL" ? "실제 기록 기준" : "목표기록 기준"

      expect(steps.map(step => step.role)).toEqual(["TOTAL_DURATION", "PREPARATION", "MAIN", "COOLDOWN"])
      expect(main).toContain(`${repetitions} × ${work}`)
      expect(main).toContain(`${target} · ${basis} · RP`)
      expect(main).toContain("반복 사이 60초 조깅")
      expect(main).not.toContain(kind === "ACTUAL" ? "목표기록 기준" : "실제 기록 기준")
      expect(main).not.toContain("직접 정한 목표")
      expect(main).not.toContain(sourceRecord.id)
      expect(projectInstantExecutionSteps(session)).toEqual(steps.map(step => ({ role: step.role, label: step.title, instruction: step.detail })))
      expect(presentSessionWorkoutNotation(session).notation).toBe(main)
      const workSteps = calculated.steps.filter(step => step.phase === "main" && step.kind === "WORK")
      expect(workSteps).toHaveLength(repetitions)
      expect(workSteps.every(step => step.targetModel === (kind === "ACTUAL" ? "ACTUAL_RACE_REFERENCE" : "GOAL_RACE_REFERENCE"))).toBe(true)
      expect(required(workSteps[0]?.paceSecondsPerKm).minimum).toBeCloseTo(300.73, 10)
      if (format === "timed") expect(workSteps.map(step => step.seconds)).toEqual(Array.from({ length: repetitions }, () => ({ minimum: 420, maximum: 420 })))
      else expect(required(workSteps[0]?.seconds).minimum).toBeCloseTo(300.73, 10)
      expect(JSON.stringify({ sourceRecord, session, calculated, source })).toBe(before)
    })

  it.each([
    { format: "distance", id: "RP-10000-DISTANCE", calculationInputs: inputs({ segmentSeconds: [{ segmentId: "X-LT-01-1-1", seconds: 312.3456 }] }), target: "≈312.3s/1000m" },
    { format: "timed", id: "RP-10000-TIMED", calculationInputs: inputs({ segmentPaces: [{ segmentId: "part-0", secondsPerKm: 312.4 }] }), target: "≈312초/km" },
  ])("keeps a directly chosen $format target separate from actual and goal records", ({ id, calculationInputs, target }) => {
    const session = bind(id, calculationInputs)
    const before = JSON.stringify({ session, calculationInputs })
    const main = mainInstruction(session)
    expect(main).toContain(`${target} · 직접 정한 목표`)
    expect(main).not.toMatch(/실제 기록 기준|목표기록 기준/)
    expect(projectInstantExecutionSteps(session).find(step => step.role === "MAIN")?.instruction).toBe(main)
    expect(presentSessionWorkoutNotation(session).notation).toBe(main)
    expect(calculation(session).steps.filter(step => step.kind === "WORK").every(step => step.referenceRecordId === null)).toBe(true)
    expect(JSON.stringify({ session, calculationInputs })).toBe(before)
  })

  it("does not invent numeric RP when a required reference is missing", () => {
    const missing = inputs()
    expect(required(calculateCatalogWorkout("RP-10000-TIMED", missing)).unavailable).toContain("RACE_PACE_REFERENCE_REQUIRED")
    const unbound: PlanSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "MIXED_INTENT",
      prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 30, maximum: 50 } } }
    expect(bindCatalogSession(unbound, "RP-10000-TIMED", missing, true)).toBeNull()
    expect(projectInstantExecutionSteps(unbound).map(step => step.instruction).join(" "))
      .not.toMatch(/s\/\d+m|초\/km|실제 기록 기준|목표기록 기준|직접 정한 목표/)
  })

  it("keeps effort-only duration work without a guessed numeric pace", () => {
    const session = bind("P-LT-S", inputs({ eventDistanceM: 5000 }), "LT_INTENT")
    const before = JSON.stringify(session)
    expect(mainInstruction(session)).toContain("3 × 7분")
    expect(mainInstruction(session)).toContain("힘든 정도 6–7/10")
    expect(mainInstruction(session)).not.toMatch(/s\/\d+m|초\/km|실제 기록 기준|목표기록 기준|직접 정한 목표/)
    expect(JSON.stringify(session)).toBe(before)
  })

  it("does not expose numeric targets from an invalid calculation binding", () => {
    const session = bind("RP-10000-DISTANCE", inputs({ paceReferences: [createSegmentRecordReference("X-LT-01-1-1", record("GOAL"), "2026-10-02")] }))
    if (session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Expected a quality catalog fixture")
    const invalid: PlanSession = { ...session, prescription: { ...session.prescription, catalogWorkout: {
      ...required(session.prescription.catalogWorkout), calculationFingerprint: "invalid-synthetic-fingerprint",
    } } }
    const before = JSON.stringify(invalid)
    expect(sessionExecutionSteps(invalid)).toEqual([])
    expect(projectInstantExecutionSteps(invalid).map(step => step.instruction).join(" ")).not.toContain("300.7s/1000m")
    expect(presentSessionWorkoutNotation(invalid).notation).not.toContain("300.7s/1000m")
    expect(JSON.stringify(invalid)).toBe(before)
  })

  it("shows existing actual-distance and goal-timed numbers in the selected date reader", () => {
    const distance = bind("RP-10000-DISTANCE", inputs({ paceReferences: [createSegmentRecordReference("X-LT-01-1-1", record("ACTUAL"), "2026-10-02")] }))
    const timed = { ...bind("RP-10000-TIMED", inputs({ paceReferences: [createSegmentRecordReference("part-0", record("GOAL"), "2026-10-02")] })), day: 2 }
    const sessions = [distance, timed]
    const before = JSON.stringify(sessions)
    render(<PlanSchedulePreview startDate="2026-10-02" frameLengthDays={7} sessions={sessions}
      presentation="prescription-calendar" detailsExpanded={false} />)

    const calendar = screen.getByRole("grid", { name: "2026년 10월 달력" })
    fireEvent.click(required(calendar.querySelector('button[data-date="2026-10-02"]')))
    const firstReader = screen.getByRole("dialog", { name: "2026년 10월 2일 금요일" })
    const firstSession = within(firstReader).getByRole("group", { name: "10월 2일 금요일 오전 세션" })
    const firstMain = within(firstSession).getAllByRole("term").find(term => term.textContent === "본운동")
    const firstExecution = within(required(required(firstMain).parentElement)).getByRole("definition")
    expect(within(firstExecution).getByText(required(sessionExecutionSteps(distance, true).find(step => step.role === "MAIN")).detail)).toBeVisible()
    expect(firstExecution).toHaveTextContent("1km씩 5번")
    expect(firstExecution).toHaveTextContent("한 번에 약 5분 0.7초 · 10km 실제 기록 기준")
    expect(firstExecution).toHaveTextContent("사이 1분 조깅")
    fireEvent.click(within(firstReader).getByRole("button", { name: "크게 보기 다음 날짜" }))
    const nextReader = screen.getByRole("dialog", { name: "2026년 10월 3일 토요일" })
    const nextSession = within(nextReader).getByRole("group", { name: "10월 3일 토요일 오전 세션" })
    const nextMain = within(nextSession).getAllByRole("term").find(term => term.textContent === "본운동")
    const nextExecution = within(required(required(nextMain).parentElement)).getByRole("definition")
    expect(within(nextExecution).getByText(required(sessionExecutionSteps(timed, true).find(step => step.role === "MAIN")).detail)).toBeVisible()
    expect(nextExecution).toHaveTextContent("7분씩 3번")
    expect(nextExecution).toHaveTextContent("1km에 약 5분 1초 · 10km 목표 기록 기준")
    expect(nextExecution).toHaveTextContent("사이 1분 조깅")
    expect(nextExecution).not.toHaveTextContent("301초/km")
    expect(nextReader.querySelector(".plan-session-metric")).toHaveTextContent("7분씩 3번")
    expect(nextReader.querySelector(".plan-session-metric")).toHaveTextContent("사이 1분 조깅")
    expect(within(nextReader).getByText(sessionLabel(timed))).toBeVisible()
    const originalNotation = within(nextReader).getByText("기존 훈련 표기").closest("details")!
    expect(originalNotation).not.toHaveAttribute("open")
    fireEvent.click(within(originalNotation).getByText("기존 훈련 표기"))
    expect(within(originalNotation).getByText(sessionLabel(timed, false, "original"))).toBeVisible()
    const originalSteps = within(originalNotation).getByRole("list", { name: "기존 훈련 표기 순서" })
    const originalItems = within(originalSteps).getAllByRole("listitem")
    expect(originalItems).toHaveLength(3)
    const originalSequence = required(calculatedWorkoutSequence(calculation(timed)))
    for (const [index, phase] of (["warmup", "main", "cooldown"] as const).entries()) {
      expect(within(required(originalItems[index])).getByText(sequencePhaseNotation(originalSequence, phase, [], "COACH"))).toBeVisible()
    }
    expect(originalSteps).toHaveTextContent("RPE")
    expect(originalSteps).toHaveTextContent("RP")
    expect(originalSteps).toHaveTextContent("40s Walk")
    expect(originalSteps).toHaveTextContent("10min")
    expect(JSON.stringify(sessions)).toBe(before)
  })
})
