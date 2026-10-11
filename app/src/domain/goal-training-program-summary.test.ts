import { describe, expect, it } from "vitest"
import { calculateCatalogWorkout, type WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import {
  createGoalTrainingProgramPreview, generateGoalTrainingProgram, GOAL_TRAINING_PROGRAM_SOURCE,
  regenerateGoalTrainingProgram, validateGoalTrainingProgram,
  type GoalTrainingProgramPreview, type GoalTrainingProgramPreviewInput,
} from "./goal-training-program"
import { summarizeGoalTrainingProgram } from "./goal-training-program-summary"

const input: GoalTrainingProgramPreviewInput = {
  goalMinutes: 45, dateChoice: { kind: "START", startDate: "2026-10-11" }, today: "2026-10-11",
  generatedAt: "2026-10-11T00:00:00.000Z", experienceBand: "DEVELOPING",
  availableDayCount: 4, trainingTimePreference: "VARIES",
}
const gate: SafetyGateDecision = { kind: "passed", action: "CONTINUE_WITH_OTHER_GATES", planGenerationAllowed: true,
  nonSensitiveReasonCodes: [], audit: { event: "PLAN_SAFETY_GATE_PASSED", privacy: "REASON_CODES_ONLY" } }
const goals = [60, 50, 45, 40, 30] as const
const experiences = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const
const matrix = goals.flatMap(goalMinutes => experiences.map(experienceBand => ({ goalMinutes, experienceBand })))
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function preview(overrides: Partial<GoalTrainingProgramPreviewInput> = {}): GoalTrainingProgramPreview {
  const result = createGoalTrainingProgramPreview({ ...input, ...overrides })
  expect(result.kind).toBe("preview")
  if (result.kind !== "preview") throw new Error(`Preview fixture failed: ${JSON.stringify(result)}`)
  return result.preview
}

describe("goal program summary from reviewed source frames", () => {
  it.each(matrix)("compares explicit goal pace with time/RPE for $goalMinutes minutes / $experienceBand", settings => {
    const goalSource = preview({ ...settings, goalPaceConfirmed: true })
    const effortSource = preview(settings)
    const goalSummary = summarizeGoalTrainingProgram(goalSource)
    const effortSummary = summarizeGoalTrainingProgram(effortSource)
    expect(goalSummary.basis).toBe("GOAL_RACE_PACE")
    expect(effortSummary.basis).toBe("TIME_RPE")
    expect(goalSummary.goal).toEqual({ kind: "GOAL", purpose: "ASPIRATIONAL_TARGET", eventDistanceM: 10000,
      performanceSeconds: settings.goalMinutes * 60, paceSecondsPerKm: settings.goalMinutes * 6 })
    expect(goalSummary.frames.map(frame => frame.cycle)).toEqual([1, 2, 3])
    expect(goalSummary.frames.map(({ qualityCount, easyCount, restCount }) => ({ qualityCount, easyCount, restCount })))
      .toEqual(effortSummary.frames.map(({ qualityCount, easyCount, restCount }) => ({ qualityCount, easyCount, restCount })))
    for (const frame of goalSummary.frames) {
      expect(frame.qualityCount).toBeGreaterThan(0)
      expect(frame.qualityCount + frame.easyCount + frame.restCount).toBe(10)
      expect(frame.qualityIntents).toEqual(["MIXED_INTENT"])
      expect(frame.goalPaceSecondsPerKm).toEqual({ minimum: settings.goalMinutes * 6, maximum: settings.goalMinutes * 6 })
      for (const workout of frame.workouts.filter(workout => workout.role === "QUALITY")) {
        const expectedId = settings.experienceBand === "NEW_TO_RUNNING" ? "RP-10000-INTRO"
          : settings.experienceBand === "EXPERIENCED" && settings.goalMinutes === 30 ? "RP-10000-DISTANCE" : "RP-10000-TIMED"
        const expectedSeconds = expectedId === "RP-10000-INTRO" ? 1300
          : expectedId === "RP-10000-DISTANCE" ? 2900 : 3140
        expect(workout.catalogId).toBe(expectedId)
        expect(workout.catalogState).toBe("VALID")
        expect(workout.name).toContain("10km 페이스 연습")
        expect(workout.totalSeconds).toEqual({ minimum: expectedSeconds, maximum: expectedSeconds })
        expect(workout.mainWork).toHaveLength(expectedId === "RP-10000-INTRO" ? 2 : expectedId === "RP-10000-DISTANCE" ? 5 : 3)
        expect(workout.mainWork.every(step => step.goalPaceSecondsPerKm?.minimum === settings.goalMinutes * 6)).toBe(true)
      }
      expect(frame.workouts.filter(workout => workout.role === "EASY").every(workout => workout.goalPaceSecondsPerKm === null)).toBe(true)
    }
    expect(effortSummary.frames.every(frame => frame.goalPaceSecondsPerKm === null
      && frame.workouts.every(workout => workout.goalPaceSecondsPerKm === null))).toBe(true)
    expect(goalSource.activationAllowed).toBe(false)
    expect(goalSource.safetyState).toBe("NOT_CHECKED")
  })

  it("keeps version 1 source, content and replay unchanged when a saved program is summarized", () => {
    expect(GOAL_TRAINING_PROGRAM_SOURCE).toEqual({ id: "TRAINORACLE_REVIEWED_TIME_RPE_3_FRAME", version: "1.0.0",
      fingerprint: "sha256:3de1ddf9d5b9b3a550e0300ce8c3eb6df6906d4038a1c80c143808a5c5834980" })
    for (const goalPaceConfirmed of [false, true]) {
      const result = generateGoalTrainingProgram({ ...input, goalPaceConfirmed, longerDurationConfirmed: true, safetyGate: gate })
      expect(result.kind).toBe("ready")
      if (result.kind !== "ready") throw new Error("Expected saved program")
      const savedBytes = JSON.stringify(result.program)
      const restored = clone(result.program)
      const firstSummary = summarizeGoalTrainingProgram(restored)
      const secondSummary = summarizeGoalTrainingProgram(restored)
      expect(secondSummary).toEqual(firstSummary)
      expect(JSON.stringify(restored)).toBe(savedBytes)
      expect(validateGoalTrainingProgram(restored)).toEqual({ kind: "valid", program: restored })
      expect(regenerateGoalTrainingProgram(restored, gate, input.today)).toEqual({ kind: "ready", program: restored })
    }
  })

  it("counts the shared opening rest from its own source without inventing a thirtieth calendar date", () => {
    const source = preview()
    const summary = summarizeGoalTrainingProgram(source)
    expect(source.days).toHaveLength(29)
    expect(source.frames[1]!.sessions[0]).toMatchObject({ day: 1, slot: "PM", role: "REST" })
    expect(summary.frames.reduce((count, frame) => count + frame.qualityCount + frame.easyCount + frame.restCount, 0)).toBe(30)
    for (const frame of summary.frames) {
      const original = source.frames.find(row => row.cycle === frame.cycle)!
      expect(frame.restCount).toBe(original.sessions.filter(session => session.role === "REST").length)
    }
  })

  it("leaves full time and goal targets unknown when a catalog snapshot cannot be replayed", () => {
    const source = clone(preview({ goalPaceConfirmed: true }))
    const session = source.frames[0]!.sessions.find(session => session.role === "QUALITY")!
    if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) throw new Error("Expected catalog")
    Object.assign(session.prescription.catalogWorkout, { catalogFingerprint: "unverified" })
    const item = summarizeGoalTrainingProgram(source).frames[0]!.workouts.find(workout => workout.day === session.day && workout.slot === session.slot)!
    expect(item).toMatchObject({ catalogState: "UNAVAILABLE", catalogId: null, name: null, totalSeconds: null,
      mainWork: [], goalPaceSecondsPerKm: null })
  })

  it("does not relabel a valid actual-race target as a goal target", () => {
    const source = preview({ goalPaceConfirmed: true })
    const original = source.frames[0]!.sessions.find(session => session.role === "QUALITY")!
    if (original.prescription.kind !== "RPE_TIME_RANGE" || !original.prescription.catalogWorkout) throw new Error("Expected goal catalog")
    const binding = original.prescription.catalogWorkout
    const actual = bindCatalogSession(original, binding.catalogId, { ...binding.inputs,
      paceReferences: binding.inputs.paceReferences!.map(reference => ({ ...reference, kind: "ACTUAL", achievedOn: input.today })) }, true)
    expect(actual).not.toBeNull()
    const actualSource = { ...source, frames: source.frames.map((frame, index) => index === 0
      ? { ...frame, sessions: frame.sessions.map(session => session === original ? actual! : session) } : frame) }
    const item = summarizeGoalTrainingProgram(actualSource).frames[0]!.workouts.find(workout => workout.day === original.day && workout.slot === original.slot)!
    expect(item.catalogState).toBe("VALID")
    expect(item.totalSeconds).toEqual({ minimum: 3140, maximum: 3140 })
    expect(item.mainWork).toHaveLength(3)
    expect(item.goalPaceSecondsPerKm).toBeNull()
    expect(item.mainWork.every(step => step.goalPaceSecondsPerKm === null)).toBe(true)
  })
})

describe("exact RP source totals for the separate dose review", () => {
  const distanceTotals = { 60: 3800, 50: 3500, 45: 3350, 40: 3200, 30: 2900 } as const
  it.each(goals)("preserves all three existing RP structures for a %i-minute goal", goalMinutes => {
    for (const [catalogId, experience, workCount, workSeconds, totalSeconds] of [
      ["RP-10000-INTRO", "NEW_TO_RUNNING", 2, 480, 1300],
      ["RP-10000-TIMED", "DEVELOPING", 3, 1260, 3140],
      ["RP-10000-DISTANCE", "EXPERIENCED", 5, goalMinutes * 30, distanceTotals[goalMinutes]],
    ] as const) {
      const inputs: WorkoutCalculationInputs = { eventDistanceM: 10000, experience, availableSeconds: null,
        confirmedRequirements: [], fiveK: null, segmentPaces: [], paceReferences: [{ segmentId: catalogId.endsWith("DISTANCE")
          ? "X-LT-01-1-1" : "part-0", kind: "GOAL", confirmed: true, recordId: "synthetic-goal", recordVersion: input.generatedAt,
          eventDistanceM: 10000, performanceSeconds: goalMinutes * 60, achievedOn: null, evaluatedOn: input.today, model: "RACE_AVERAGE_V1" }] }
      const calculated = calculateCatalogWorkout(catalogId, inputs)!
      expect(calculated.unavailable).toEqual([])
      const work = calculated.steps.filter(step => step.phase === "main" && step.kind === "WORK")
      const recovery = calculated.steps.filter(step => step.phase === "main" && step.kind === "RECOVERY")
      expect(work).toHaveLength(workCount)
      expect(work.reduce((seconds, step) => seconds + step.seconds!.minimum, 0)).toBe(workSeconds)
      expect(recovery).toHaveLength(workCount - 1)
      expect(recovery.every(step => step.seconds?.minimum === 60)).toBe(true)
      expect(calculated.totals.seconds).toEqual({ minimum: totalSeconds, maximum: totalSeconds })
      expect(calculated.steps.filter(step => step.phase === "warmup").reduce((seconds, step) => seconds + step.seconds!.minimum, 0))
        .toBe(catalogId.endsWith("INTRO") ? 460 : 1160)
      expect(calculated.steps.filter(step => step.phase === "cooldown").reduce((seconds, step) => seconds + step.seconds!.minimum, 0))
        .toBe(catalogId.endsWith("INTRO") ? 300 : 600)
    }
  })
})
