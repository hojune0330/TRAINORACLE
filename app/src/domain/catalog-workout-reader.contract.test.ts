import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { ALL_WORKOUT_CATALOG, type WorkoutCalculationInputs, type WorkoutCatalogEntry } from "@impl/prescription/all-workout-calculator"
import * as catalogBinding from "@impl/prescription/catalog-session-binding"
import type { SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { catalogWorkoutReader } from "./catalog-workout-reader"
import { sessionWorkoutNotation } from "./workout-notation"
import { catalogDeliveryProfile } from "@impl/prescription/catalog-delivery"
import { prescriptionLabel, sessionExecutionSteps, sessionLabel } from "../screens/plan-beta/labels"

afterEach(() => vi.restoreAllMocks())
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw Error("Expected a verified synthetic reader fixture")
  return value
}
function source(id: string): WorkoutCatalogEntry {
  return required(ALL_WORKOUT_CATALOG.find(entry => entry.id === id))
}
function bound(id = "RP-10000-TIMED", overrides: Partial<WorkoutCalculationInputs> = {},
  kind: "ACTUAL" | "GOAL" = "GOAL", performanceSeconds = 2700): PlanSession {
  const entry = source(id)
  const experience = entry.experience[0] as WorkoutCalculationInputs["experience"]
  const easy = entry.family === "BASE"
  const intent = entry.family === "LT" ? "LT_INTENT"
    : entry.family === "GLY" ? "GLY_INTENT" : "MIXED_INTENT"
  const maximum = { NEW_TO_RUNNING: easy ? 35 : 30, DEVELOPING: easy ? 45 : 40, EXPERIENCED: easy ? 60 : 50 }[experience]
  const prescription = { kind: "RPE_TIME_RANGE" as const,
    rpe: easy ? { minimum: 3, maximum: 4 } : { minimum: 6, maximum: 7 }, durationMinutes: { minimum: maximum, maximum } }
  const session: PlanSession = easy
    ? { day: 1, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT", prescription }
    : { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: intent, prescription }
  const inputs: WorkoutCalculationInputs = { eventDistanceM: 10000, experience, availableSeconds: null,
    confirmedRequirements: [], fiveK: null, segmentPaces: [],
    ...(entry.segments.some(segment => segment.intent === "RACE_PACE") ? { paceReferences: entry.segments.map(segment => ({
      segmentId: segment.segmentId, kind, confirmed: true as const, recordId: `synthetic-reader-${kind.toLowerCase()}`,
      recordVersion: "2026-10-11T00:00:00.000Z", eventDistanceM: 10000, performanceSeconds,
      achievedOn: kind === "ACTUAL" ? "2026-10-10" : null, evaluatedOn: "2026-10-11", model: "RACE_AVERAGE_V1" as const,
    })) } : {}), ...overrides }
  return required(catalogBinding.bindCatalogSession(session, id, inputs, true))
}
function calculation(session: PlanSession) {
  if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Expected a catalog prescription")
  return required(catalogBinding.resolveCatalogBinding(required(session.prescription.catalogWorkout)))
}
function phase(session: PlanSession, role: "PREPARATION" | "MAIN" | "COOLDOWN"): string {
  return required(sessionExecutionSteps(session, true).find(step => step.role === role)).detail
}
const safety = "힘들면 속도를 낮추거나 중단하세요. 실제 힘든 정도(RPE)는 따로 기록해요."

describe("explicit easy catalog reader", () => {
  it("reads the 45-minute goal as seven minutes three times with one-minute jogs without changing stored numbers", () => {
    const session = bound()
    const entry = source("RP-10000-TIMED")
    const calculated = calculation(session)
    const before = JSON.stringify({ session, entry, calculated })
    const reading = required(catalogWorkoutReader(session))
    expect(sessionLabel(session, true)).toBe("10km 목표 속도 연습 (RP) · 7분씩 3번")
    expect(reading.summary).toBe(`7분씩 3번 · 1km에 4분 30초 · 10km 목표 기록 기준 · 사이 1분 조깅. ${safety}`)
    expect(prescriptionLabel(session, true)).toBe(reading.summary)
    expect(phase(session, "MAIN")).toBe(reading.summary)
    expect(sessionExecutionSteps(session, true).map(step => step.role)).toEqual(["TOTAL_DURATION", "PREPARATION", "MAIN", "COOLDOWN"])
    expect(sessionExecutionSteps(session, true)[0]?.detail).toBe("준비·회복·정리 포함 52분 20초")
    expect(phase(session, "COOLDOWN")).toContain("10분 · 힘든 정도(RPE) 1–2/10")
    expect(phase(session, "COOLDOWN")).toContain("통증\u2060·\u2060어지럼\u2060·\u2060자세\u00a0무너짐이 생기면 시간을 채우지 말고 중단하세요.")
    expect(reading.name).toContain("(RP)")
    expect(reading.summary).toContain("힘든 정도(RPE)")
    expect(reading.summary).not.toMatch(/\b(LT|VO2|min)\b|초\/km|역치|산소섭취/)
    expect(calculated.steps.filter(step => step.phase === "main" && step.kind === "WORK").map(step => step.seconds))
      .toEqual(Array.from({ length: 3 }, () => ({ minimum: 420, maximum: 420 })))
    expect(calculated.steps.filter(step => step.phase === "main" && step.kind === "RECOVERY").map(step => step.seconds))
      .toEqual(Array.from({ length: 2 }, () => ({ minimum: 60, maximum: 60 })))
    expect(JSON.stringify({ session, entry, calculated })).toBe(before)
  })

  it("retains four buildup occurrences, three 40-second gaps and the final 60-second walk", () => {
    const session = bound()
    const calculated = calculation(session)
    expect(phase(session, "PREPARATION")).toBe("15분 · 힘든 정도(RPE) 2–3/10 → 20초 가속 달리기 4번 (전력질주 아님) · 사이 40초 걷기 · 마지막 뒤 1분 걷기")
    expect(calculated.steps.filter(step => step.phase === "warmup" && step.kind === "BUILDUP")).toHaveLength(4)
    expect(calculated.steps.filter(step => step.phase === "warmup" && step.kind === "RECOVERY").map(step => step.seconds))
      .toEqual([40, 40, 40, 60].map(value => ({ minimum: value, maximum: value })))
    expect(calculated.totals.seconds).toEqual({ minimum: 3140, maximum: 3140 })
  })

  it.each([
    [3600, "6분"], [3000, "5분"], [2700, "4분 30초"], [2400, "4분"], [1800, "3분"],
  ])("reads the existing %i-second goal speed without changing its timed termination", (seconds, label) => {
    const session = bound("RP-10000-TIMED", {}, "GOAL", seconds)
    const before = JSON.stringify(session)
    expect(prescriptionLabel(session, true)).toContain(`7분씩 3번 · 1km에 ${label} · 10km 목표 기록 기준`)
    expect(calculation(session).steps.filter(step => step.kind === "WORK").every(step => step.seconds?.minimum === 420)).toBe(true)
    expect(JSON.stringify(session)).toBe(before)
  })

  it.each(["ACTUAL", "GOAL"] as const)("keeps %s provenance and the existing whole-second pace rounding separate", kind => {
    const session = bound("RP-10000-TIMED", {}, kind, 3007.3)
    const calculated = calculation(session)
    const before = JSON.stringify({ session, calculated })
    const text = prescriptionLabel(session, true)
    expect(text).toContain(`1km에 약 5분 1초 · 10km ${kind === "ACTUAL" ? "실제" : "목표"} 기록 기준`)
    expect(text).not.toContain(kind === "ACTUAL" ? "목표 기록 기준" : "실제 기록 기준")
    expect(text).not.toContain("synthetic-reader")
    expect(calculated.steps.find(step => step.kind === "WORK")?.paceSecondsPerKm?.minimum).toBeCloseTo(300.73, 10)
    expect(JSON.stringify({ session, calculated })).toBe(before)
  })

  it.each(["ACTUAL", "GOAL"] as const)("keeps five 1km distance stops and tenth-second targets for %s references", kind => {
    const session = bound("RP-10000-DISTANCE", {}, kind, 3007.3)
    const calculated = calculation(session)
    const before = JSON.stringify({ session, calculated })
    expect(prescriptionLabel(session, true)).toContain(`1km씩 5번 · 한 번에 약 5분 0.7초 · 10km ${kind === "ACTUAL" ? "실제" : "목표"} 기록 기준 · 사이 1분 조깅`)
    expect(calculated.steps.filter(step => step.kind === "WORK").map(step => step.distanceM)).toEqual([1000, 1000, 1000, 1000, 1000])
    expect(calculated.steps.filter(step => step.phase === "main" && step.kind === "RECOVERY")).toHaveLength(4)
    expect(calculated.steps.find(step => step.kind === "WORK")?.seconds?.minimum).toBeCloseTo(300.73, 10)
    expect(JSON.stringify({ session, calculated })).toBe(before)
  })

  it("keeps directly supplied decimal seconds distinct from any actual or goal record", () => {
    const session = bound("RP-10000-DISTANCE", { paceReferences: [], segmentSeconds: [{ segmentId: "X-LT-01-1-1", seconds: 312.3456 }] })
    const before = JSON.stringify(session)
    expect(prescriptionLabel(session, true)).toContain("한 번에 약 5분 12.3초 · 직접 정한 시간 · 경기 기록 환산 아님")
    expect(prescriptionLabel(session, true)).not.toMatch(/실제 기록 기준|목표 기록 기준/)
    expect(calculation(session).steps.find(step => step.kind === "WORK")?.seconds?.minimum).toBe(312.3456)
    expect(JSON.stringify(session)).toBe(before)
  })

  it("retains the two-buildup introduction sequence and exactly one main jog", () => {
    const session = bound("RP-10000-INTRO")
    expect(sessionLabel(session, true)).toBe("10km 목표 속도 연습 (RP) · 4분씩 2번")
    expect(phase(session, "PREPARATION")).toBe("5분 · 힘든 정도(RPE) 2–3/10 → 20초 가속 달리기 2번 (전력질주 아님) · 사이 1분 걷기 · 마지막 뒤 1분 걷기")
    expect(calculation(session).steps.filter(step => step.phase === "main" && step.kind === "RECOVERY")).toHaveLength(1)
    expect(sessionExecutionSteps(session, true)[0]?.detail).toBe("준비·회복·정리 포함 21분 40초")
  })

  it.each([
    ["P-BASE-B", 1920, "10분씩 3번"], ["X-BASE-01", 2700, "45분"],
    ["X-BASE-09", 2820, null], ["P-INTRO-LT-C", 1240, "8분"],
    ["P-INTRO-LT-S", 1300, "4분씩 2번"], ["P-LT-B-480", 2780, "8분씩 2번"],
    ["P-LT-C", 2960, "20분"], ["X-LT-05", 2960, null], ["X-LT-06", 2960, null],
  ] as const)("preserves every source cue, numeric total and phase for the inspected time-only source %s", (id, seconds, title) => {
    const session = bound(id)
    const entry = source(id)
    const calculated = calculation(session)
    const before = JSON.stringify({ session, entry, calculated })
    const reading = required(catalogWorkoutReader(session))
    expect(reading.name).toBe(title ? `${catalogDeliveryProfile(entry).name} · ${title}` : catalogDeliveryProfile(entry).name)
    expect(sessionLabel(session, false, "original")).toBe(entry.name)
    expect(reading.summary).not.toMatch(/1km에|목표 기록 기준|실제 기록 기준|초\/km/)
    expect(calculated.totals.seconds).toEqual({ minimum: seconds, maximum: seconds })
    if (id === "P-BASE-B") expect(reading.summary).toContain("대화할 수 있는 강도 · 힘든 정도(RPE) 3–4/10")
    if (id.startsWith("P-") && id.includes("LT")) expect(reading.summary).toContain("고르게 유지 · 힘든 정도(RPE) 6–7/10")
    if (id === "X-BASE-09") expect(reading.summary).toBe("22분 · 힘든 정도(RPE) 3–4/10 → 끝낸 뒤 2분 걷기 → 23분 · 힘든 정도(RPE) 3–4/10")
    if (id === "X-LT-05" || id === "X-LT-06") {
      const values = id === "X-LT-05" ? [4, 6, 8] : [8, 6, 4]
      expect(reading.summary).toBe(`${values[0]}분 · 힘든 정도(RPE) 6–7/10 → 끝낸 뒤 1분 조깅 → ${values[1]}분 · 힘든 정도(RPE) 6–7/10 → 끝낸 뒤 1분 조깅 → ${values[2]}분 · 힘든 정도(RPE) 6–7/10`)
    }
    expect(JSON.stringify({ session, entry, calculated })).toBe(before)
  })

  it.each(["version", "extra cue", "terrain", "modality"] as const)("declines an unreviewed %s instead of discarding source information", field => {
    const session = bound()
    const entry = source("RP-10000-TIMED")
    const calculated = calculation(session)
    const before = JSON.stringify({ session, entry, calculated })
    const extraCue = (nodes: readonly SequenceNodeV3[]): readonly SequenceNodeV3[] => nodes.map(node => node.kind === "group"
      ? { ...node, children: extraCue(node.children) }
      : { ...node, target: { kind: "EFFORT_GUIDANCE", cue: "추가 자세·속도 지시는 보존해야 해요." } })
    const changed: WorkoutCatalogEntry = field === "version" ? { ...entry, version: "unreviewed-source-version" }
      : field === "extra cue" ? { ...entry, sequence: { ...required(entry.sequence), main: extraCue(required(entry.sequence).main) } }
        : { ...entry, segments: entry.segments.map(segment => ({ ...segment,
          ...(field === "terrain" ? { terrain: "UPHILL" } : { modality: "BIKE" }) })) }
    vi.spyOn(catalogBinding, "resolveCatalogBinding").mockReturnValue(calculated)
    vi.spyOn(ALL_WORKOUT_CATALOG, "find").mockReturnValue(changed)
    expect(catalogWorkoutReader(session)).toBeNull()
    expect(sessionLabel(session, true)).toBe(sessionLabel(session))
    expect(prescriptionLabel(session, true)).toBe(sessionWorkoutNotation(session, "PLAIN"))
    expect(sessionExecutionSteps(session, true)).toEqual(sessionExecutionSteps(session))
    expect(JSON.stringify({ session, entry, calculated })).toBe(before)
  })

  it("retains numeric distance-work and its original safety cue in the execution reading", () => {
    const session = bound("P-GLY-D", { segmentSeconds: [{ segmentId: "part-0", seconds: 40.125 }] })
    const before = JSON.stringify(session)
    expect(catalogWorkoutReader(session)).toBeNull()
    expect(prescriptionLabel(session, true)).toBe(sessionWorkoutNotation(session, "PLAIN"))
    expect(phase(session, "MAIN")).toContain("200m씩 6번")
    expect(phase(session, "MAIN")).toContain("한 번에 약 40.1초")
    expect(phase(session, "MAIN")).toContain("사이 2분 걷기")
    expect(phase(session, "MAIN")).toContain("첫 회 전력 기록 경쟁은 하지 않음")
    expect(JSON.stringify(session)).toBe(before)
  })

  it("does not publish reader targets from an invalid binding", () => {
    const session = bound()
    if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Expected a catalog fixture")
    const invalid = { ...session, prescription: { ...session.prescription, catalogWorkout: {
      ...required(session.prescription.catalogWorkout), calculationFingerprint: "invalid-synthetic-fingerprint",
    } } } as PlanSession
    const before = JSON.stringify(invalid)
    expect(catalogWorkoutReader(invalid)).toBeNull()
    expect(sessionExecutionSteps(invalid, true)).toEqual([])
    expect(prescriptionLabel(invalid, true)).toBe(sessionWorkoutNotation(invalid, "PLAIN"))
    expect(JSON.stringify(invalid)).toBe(before)
  })

  it("changes only explicit easy labels and keeps default execution and professional notation unchanged", () => {
    const session = bound()
    const before = JSON.stringify(session)
    const professional = sessionWorkoutNotation(session)
    const execution = sessionExecutionSteps(session)
    expect(sessionLabel(session)).toBe("10km 페이스 연습")
    expect(sessionLabel(session, false, "original")).toBe(source("RP-10000-TIMED").name)
    expect(prescriptionLabel(session)).toBe(professional)
    expect(execution.find(step => step.role === "MAIN")?.detail).toContain("3 × 7분 · 270초/km · 목표기록 기준 · RP · 반복 사이 60초 조깅")
    sessionLabel(session, true)
    prescriptionLabel(session, true)
    sessionExecutionSteps(session, true)
    expect(sessionWorkoutNotation(session)).toBe(professional)
    expect(sessionExecutionSteps(session)).toEqual(execution)
    expect(JSON.stringify(session)).toBe(before)
  })
})
