import { describe, expect, it, vi } from "vitest"
import * as catalogBinding from "@impl/prescription/catalog-session-binding"
import * as candidateBuilder from "@impl/plan-generator/candidates"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { evaluateD9ColloquialLayer } from "@impl/d9/evaluator"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { parseFormation } from "@impl/plan-generator/formation-parser"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { listPermittedActivePlanEditTargets, prepareActivePlanEdit } from "./active-plan-edit"
import { TEN_K_GOAL_MINUTES } from "./goal-program-calendar"
import {
  createGoalTrainingProgramPreview, generateGoalTrainingProgram, projectGoalTrainingProgramFrames,
  goalTrainingProgramDurationReview, regenerateGoalTrainingProgram, validateGoalTrainingProgram,
  type GoalTrainingProgram, type GoalTrainingProgramPreviewInput,
} from "./goal-training-program"

const input: GoalTrainingProgramPreviewInput = {
  goalMinutes: 45, dateChoice: { kind: "START", startDate: "2026-10-11" },
  today: "2026-10-11", generatedAt: "2026-10-11T00:00:00.000Z",
  experienceBand: "DEVELOPING", availableDayCount: 4, trainingTimePreference: "VARIES",
}
const cleared = decideSafetyGate(mapD9ResultToRveSignal(evaluateD9ColloquialLayer("통증은 없고 몸 상태는 평소와 같아요")))
const blocked = decideSafetyGate(mapD9ResultToRveSignal(evaluateD9ColloquialLayer("무릎 통증이 있어요")))
function program(overrides: Partial<GoalTrainingProgramPreviewInput> = {}): GoalTrainingProgram {
  const result = generateGoalTrainingProgram({ ...input, ...overrides, longerDurationConfirmed: true, safetyGate: cleared })
  expect(result.kind).toBe("ready")
  if (result.kind !== "ready") throw new Error(`Fixture generation failed: ${JSON.stringify(result)}`)
  return result.program
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe("three-frame goal program", () => {
  it.each(TEN_K_GOAL_MINUTES)("offers the %i-minute goal without turning it into a current record", goalMinutes => {
    const value = program({ goalMinutes })
    expect(value.goalMinutes).toBe(goalMinutes)
    expect(value.frames).toHaveLength(3)
    expect(value.days).toHaveLength(29)
    expect(value.frames.every(frame => frame.plan.activePlan.eventDistanceM === 10000)).toBe(true)
    expect(value.frames.every(frame => frame.plan.progress.length === 0)).toBe(true)
    const sources = value.days.flatMap(day => day.session.prescription.kind === "RPE_TIME_RANGE"
      && day.session.prescription.catalogWorkout ? [day.session.prescription.catalogWorkout.inputs] : [])
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.every(source => source.fiveK === null && source.segmentPaces.length === 0
      && (source.paceReferences?.length ?? 0) === 0)).toBe(true)
  })

  it("retains the full 57-half-day axis, actual dates and PM start of cycle two", () => {
    const value = program()
    expect(value.window.halfDays).toHaveLength(57)
    expect(value.window.startDate).toBe("2026-10-11")
    expect(value.window.endDate).toBe("2026-11-08")
    expect(value.frames.map(frame => frame.halfDayOffset)).toEqual([0, 19, 38])
    expect(value.frames.map(frame => frame.formation.slots.length)).toEqual([19, 19, 19])
    expect(value.frames[0]!.formation.slots.at(-1)).toMatchObject({ localDayKey: "2026-10-20", slot: "AM" })
    expect(value.frames[1]!.formation.slots[0]).toMatchObject({ localDayKey: "2026-10-20", slot: "PM" })
    expect(value.frames[1]!.formation.slots.at(-1)).toMatchObject({ localDayKey: "2026-10-29", slot: "PM" })
    expect(value.frames[2]!.formation.slots[0]).toMatchObject({ localDayKey: "2026-10-30", slot: "AM" })
    expect(value.frames[1]!.plan.activePlan.frame).toMatchObject({ startSlot: "PM", lengthDays: 9.5, slotCount: 19 })
    expect("startSlot" in value.frames[0]!.plan.activePlan.frame).toBe(false)
    expect(value.frames.every(frame => parseFormation(frame.formation) !== undefined
      && planBetaStateV3Schema.safeParse(frame.plan).success)).toBe(true)
    expect(new Set(value.days.map(day => day.date)).size).toBe(29)
    expect(value.days.filter(day => day.date === "2026-10-20")).toHaveLength(1)
    expect(value.frames[1]!.plan.activePlan.sessions[0]).toMatchObject({ day: 1, slot: "PM", role: "REST" })
  })

  it.each([3, 4, 5, 6] as const)("preserves %i training dates in each source frame without a boundary collision", availableDayCount => {
    const value = program({ availableDayCount })
    expect(value.frames.map(frame => frame.plan.activePlan.sessions.filter(session => session.role !== "REST").length))
      .toEqual([availableDayCount, availableDayCount, availableDayCount])
    expect(projectGoalTrainingProgramFrames(value).kind).toBe("ready")
  })

  it("counts an all-days setting against the nine exclusively owned dates in the middle frame", () => {
    const value = program({ availableDayCount: "EVERY_DAY" })
    expect(value.frames.map(frame => frame.plan.activePlan.sessions.filter(session => session.role !== "REST").length)).toEqual([10, 9, 10])
    expect(value.days).toHaveLength(29)
  })

  it("preserves the deadline as calendar arithmetic without creating a race, taper or compressed frame", () => {
    const value = program({ dateChoice: { kind: "DEADLINE", deadline: "2026-11-08" } })
    expect(value.window.deadline).toBe("2026-11-08")
    expect(value.window.startDate).toBe("2026-10-11")
    expect(value.frames.every(frame => !Reflect.ownKeys(frame.plan.intake).includes("targetRaceDate"))).toBe(true)
    expect(generateGoalTrainingProgram({ ...input, dateChoice: { kind: "DEADLINE", deadline: "2026-11-07" }, safetyGate: cleared }))
      .toEqual({ kind: "start-in-past", requiredStartDate: "2026-10-10", suggestedStartDate: "2026-10-11" })
  })

  it("produces a non-actionable preview with the same reviewed sessions and no candidate identity or passed safety", () => {
    const result = createGoalTrainingProgramPreview(input)
    expect(result.kind).toBe("preview")
    if (result.kind !== "preview") return
    const value = program()
    expect(result.preview.days).toEqual(value.days)
    expect(result.preview).toMatchObject({ activationAllowed: false, safetyState: "NOT_CHECKED" })
    expect(JSON.stringify(result.preview)).not.toMatch(/candidateId|SELECTED_BETA_SNAPSHOT|safetyGate|PREVIOUS_FRAME/)
    expect(validateGoalTrainingProgram(result.preview).kind).toBe("invalid")
    expect(generateGoalTrainingProgram({ ...input, safetyGate: blocked }).kind).toBe("blocked")
  })

  it.each(["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const)("retains %s input eligibility and source fingerprints", experienceBand => {
    const value = program({ experienceBand })
    for (const day of value.days) {
      const prescription = day.session.prescription
      if (prescription.kind !== "RPE_TIME_RANGE" || !prescription.catalogWorkout) continue
      expect(prescription.catalogWorkout.inputs.experience).toBe(experienceBand)
      expect(resolveCatalogBinding(prescription.catalogWorkout)).not.toBeNull()
    }
    expect(validateGoalTrainingProgram(clone(value)).kind).toBe("valid")
  })

  it("replays source content rather than accepting a newly hashed forged dose or completion", () => {
    const value = program()
    const forged = clone(value) as any
    const session = forged.frames[0].plan.activePlan.sessions.find((entry: any) => entry.role === "QUALITY")
    session.prescription.durationMinutes.maximum += 1
    const { programId: _id, ...content } = forged
    forged.programId = `goal-program:${canonicalJsonFingerprint("trainoracle.goal-program.v1", content)}`
    expect(validateGoalTrainingProgram(forged)).toMatchObject({ kind: "invalid", code: "SOURCE_REPLAY_MISMATCH" })
    const completed = clone(value) as any
    completed.frames[0].plan.progress.push({ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" })
    expect(validateGoalTrainingProgram(completed).kind).toBe("invalid")
  })

  it("rejects two workouts on the shared civil date, missing days and a PM frame's out-of-frame AM session", () => {
    const value = program()
    const overlap = clone(value.frames) as any
    const work = overlap[0].plan.activePlan.sessions.find((session: any) => session.role !== "REST")
    overlap[1].plan.activePlan.sessions[0] = { ...work, day: 1, slot: "PM" }
    expect(projectGoalTrainingProgramFrames(value, overlap)).toMatchObject({ kind: "invalid", code: "DUPLICATE_WORKOUT_DATE" })
    const missing = clone(value.frames) as any
    missing[2].plan.activePlan.sessions.pop()
    expect(projectGoalTrainingProgramFrames(value, missing)).toMatchObject({ kind: "invalid", code: "MISSING_FRAME_DATE" })
    const invalidPm = clone(value.frames[1]!.plan) as any
    invalidPm.activePlan.sessions[0].slot = "AM"
    expect(planBetaStateV3Schema.safeParse(invalidPm).success).toBe(false)
    const topology = clone(value.frames[1]!.formation) as any
    delete topology.startSlot
    expect(parseFormation(topology)).toBeUndefined()
  })

  it("reprojects a changed active frame without modifying the program's original planned content", () => {
    const value = program()
    const frames = clone(value.frames) as any
    const target = frames[0].plan.activePlan.sessions.find((session: any) => session.role !== "REST")
    target.role = "REST"
    target.plannedEnergyIntent = "RECOVERY_INTENT"
    target.prescription = { kind: "REST" }
    const projection = projectGoalTrainingProgramFrames(value, frames)
    expect(projection.kind).toBe("ready")
    if (projection.kind === "ready") expect(projection.days[0]!.session.role).toBe("REST")
    expect(value.days[0]!.session.role).toBe("EASY")
  })

  it("requires a fresh real safety gate and current dates to regenerate for application", () => {
    const value = program()
    expect(regenerateGoalTrainingProgram(value, cleared, "2026-10-11")).toMatchObject({ kind: "ready", program: value })
    expect(regenerateGoalTrainingProgram(value, blocked, "2026-10-11").kind).toBe("blocked")
    expect(regenerateGoalTrainingProgram(value, cleared, "2026-10-12").kind).toBe("start-in-past")
    expect(generateGoalTrainingProgram({ ...input, goalMinutes: 35 as never, safetyGate: cleared }).kind).toBe("unavailable")
  })

  it("preserves a PM-start frame through the existing accepted active-edit receipt and calendar override", () => {
    const value = program({ availableDayCount: 5 })
    const state = value.frames[1]!.plan
    const edit = prepareActivePlanEdit({ state, entries: [], today: "2026-10-20", now: "2026-10-20T03:00:00.000Z",
      timeZone: "Asia/Seoul", journalGuard: null, unstartedConfirmed: true, noFixedFutureCommitments: true,
      action: "SWAP", source: { day: 3, slot: "AM" }, target: { day: 2, slot: "AM" } })
    expect(edit.kind).toBe("ready")
    if (edit.kind !== "ready") throw Error(edit.reasonCode)
    expect(edit.proposal.after.activePlan.frame).toHaveProperty("startSlot", "PM")
    expect(edit.proposal.after.activePlan.sessions[0]).toMatchObject({ day: 1, slot: "PM", role: "REST" })
    expect(edit.proposal.after.activePlanEdit?.startDate).toBe("2026-10-20")
    expect(edit.proposal.after.progress).toEqual([])
    expect(planBetaStateV3Schema.safeParse(edit.proposal.after).success).toBe(true)
    const projection = projectGoalTrainingProgramFrames(value, value.frames.map(frame => frame.cycle === 2
      ? { ...frame, plan: edit.proposal.after } : frame))
    expect(projection.kind).toBe("ready")
    if (projection.kind === "ready") {
      expect(projection.days).toHaveLength(29)
      expect(projection.days.find(day => day.date === "2026-10-21")).toMatchObject({ cycle: 2, session: { day: 2, slot: "AM", role: "QUALITY" } })
    }
    expect(state.activePlan.sessions.find(session => session.day === 2)?.role).toBe("EASY")
    expect(validateGoalTrainingProgram(value).kind).toBe("valid")
  })

  it("does not offer or accept an invented AM position before the PM-start frame", () => {
    const state = program({ availableDayCount: 5 }).frames[1]!.plan
    const permitted = listPermittedActivePlanEditTargets({ state, entries: [], today: "2026-10-20", noFixedFutureCommitments: true })
    expect(permitted.flatMap(target => [target.address, ...target.swapTargets]))
      .not.toContainEqual({ day: 1, slot: "AM" })
    expect(prepareActivePlanEdit({ state, entries: [], today: "2026-10-20", now: "2026-10-20T03:00:00.000Z",
      timeZone: "Asia/Seoul", journalGuard: null, unstartedConfirmed: true, noFixedFutureCommitments: true,
      action: "SWAP", source: { day: 3, slot: "AM" }, target: { day: 1, slot: "AM" } }).kind).toBe("blocked")
  })

  it("blocks moving an evening MAIN into the PM opening REST that shares the preceding frame's workout date", () => {
    const state = program({ availableDayCount: 5, trainingTimePreference: "EVENING" }).frames[1]!.plan
    expect(state.activePlan.sessions[0]).toMatchObject({ day: 1, slot: "PM", role: "REST" })
    const permitted = listPermittedActivePlanEditTargets({ state, entries: [], today: "2026-10-20", noFixedFutureCommitments: true })
    expect(permitted.flatMap(target => target.swapTargets)).not.toContainEqual({ day: 1, slot: "PM" })
    expect(prepareActivePlanEdit({ state, entries: [], today: "2026-10-20", now: "2026-10-20T03:00:00.000Z",
      timeZone: "Asia/Seoul", journalGuard: null, unstartedConfirmed: true, noFixedFutureCommitments: true,
      action: "SWAP", source: { day: 3, slot: "PM" }, target: { day: 1, slot: "PM" } }))
      .toMatchObject({ kind: "blocked", reasonCode: "TARGET_PROTECTED" })
  })

  it("shows the exact extended full times in preview and requires separate explicit acceptance for actual generation", () => {
    const preview = createGoalTrainingProgramPreview(input)
    expect(preview.kind).toBe("preview")
    if (preview.kind !== "preview") throw Error("Preview required")
    expect(goalTrainingProgramDurationReview(preview.preview)).toMatchObject({ required: true, maximumSeconds: 2780 })
    expect(preview.preview.inputs.longerDurationConfirmed).toBe(false)
    expect(generateGoalTrainingProgram({ ...input, safetyGate: cleared }))
      .toEqual({ kind: "blocked", code: "DURATION_CONFIRMATION_REQUIRED" })
    expect(generateGoalTrainingProgram({ ...input, longerDurationConfirmed: false, safetyGate: cleared }))
      .toEqual({ kind: "blocked", code: "DURATION_CONFIRMATION_REQUIRED" })
    const accepted = program()
    expect(accepted.inputs.longerDurationConfirmed).toBe(true)
    expect(validateGoalTrainingProgram(accepted).kind).toBe("valid")
    const denied = clone(accepted) as any
    denied.inputs.longerDurationConfirmed = false
    expect(validateGoalTrainingProgram(denied)).toMatchObject({ kind: "invalid", code: "SOURCE_DURATION_CONFIRMATION_MISSING" })
  })

  it("does not demand extra duration acceptance when all reviewed workouts fit the original envelopes", () => {
    const result = generateGoalTrainingProgram({ ...input, experienceBand: "NEW_TO_RUNNING", safetyGate: cleared })
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(goalTrainingProgramDurationReview(result.program)).toMatchObject({ required: false, maximumSeconds: 1920, longerWorkoutCount: 0 })
    expect(result.program.inputs.longerDurationConfirmed).toBe(false)
    expect(validateGoalTrainingProgram(result.program).kind).toBe("valid")
  })
})

describe("explicit 10km goal pace in the existing race-pace lane", () => {
  it.each(TEN_K_GOAL_MINUTES)("uses the %i-minute goal as GOAL provenance while preserving the reviewed repetitions and recovery", goalMinutes => {
    const value = program({ goalMinutes, experienceBand: "EXPERIENCED", goalPaceConfirmed: true })
    expect(value.inputs).toMatchObject({ goalPaceConfirmed: true, trainingFocus: "MIXED_INTENT", experienceBand: "EXPERIENCED" })
    const work = value.days.filter(day => day.session.role === "QUALITY")
    expect(work.length).toBeGreaterThan(0)
    for (const day of work) {
      const prescription = day.session.prescription
      expect(prescription.kind).toBe("RPE_TIME_RANGE")
      if (prescription.kind !== "RPE_TIME_RANGE") continue
      const binding = prescription.catalogWorkout!
      expect(binding.inputs.paceReferences!.every(reference => reference.kind === "GOAL"
        && reference.achievedOn === null && reference.performanceSeconds === goalMinutes * 60)).toBe(true)
      const calculation = resolveCatalogBinding(binding)!
      const main = calculation.steps.filter(step => step.phase === "main" && step.kind === "WORK")
      expect(main.every(step => step.targetModel === "GOAL_RACE_REFERENCE"
        && step.paceSecondsPerKm?.minimum === goalMinutes * 6)).toBe(true)
      expect(main.length === 3 || main.length === 5).toBe(true)
      expect(calculation.steps.some(step => step.phase === "warmup")).toBe(true)
      expect(calculation.steps.some(step => step.phase === "cooldown")).toBe(true)
    }
    expect(validateGoalTrainingProgram(clone(value)).kind).toBe("valid")
  })

  it.each(["NEW_TO_RUNNING", "DEVELOPING"] as const)("uses only the %s reviewed race-pace structure, including its full total time", experienceBand => {
    const value = program({ experienceBand, goalPaceConfirmed: true })
    const work = value.days.find(day => day.session.role === "QUALITY")!.session.prescription
    if (work.kind !== "RPE_TIME_RANGE") throw new Error("Expected goal-reference RPE lane")
    const calculation = resolveCatalogBinding(work.catalogWorkout!)!
    expect(calculation.steps.filter(step => step.phase === "main" && step.kind === "WORK")).toHaveLength(experienceBand === "NEW_TO_RUNNING" ? 2 : 3)
    expect(work.durationMinutes.maximum).toBe(calculation.totals.seconds!.maximum / 60)
    if (experienceBand === "DEVELOPING") expect(work.catalogWorkout!.acceptedDurationSeconds).toBe(calculation.totals.seconds!.maximum)
  })

  it("requires explicit goal-pace consent and rejects pretending a goal RP is LT or an actual achievement", () => {
    const ordinary = program()
    expect(ordinary.inputs.goalPaceConfirmed).toBe(false)
    expect(generateGoalTrainingProgram({ ...input, goalPaceConfirmed: true, trainingFocus: "LT_INTENT", safetyGate: cleared }).kind).toBe("unavailable")
    const forged = clone(program({ goalPaceConfirmed: true })) as any
    const quality = forged.frames[0].plan.activePlan.sessions.find((session: any) => session.role === "QUALITY")
    quality.prescription.catalogWorkout.inputs.paceReferences[0].kind = "ACTUAL"
    expect(validateGoalTrainingProgram(forged).kind).toBe("invalid")
  })

  it("does not treat target-pace consent as consent to a longer reviewed duration", () => {
    const goal = { ...input, goalPaceConfirmed: true }
    const preview = createGoalTrainingProgramPreview(goal)
    expect(preview.kind).toBe("preview")
    if (preview.kind !== "preview") return
    expect(goalTrainingProgramDurationReview(preview.preview)).toMatchObject({ required: true, maximumSeconds: 3140 })
    expect(generateGoalTrainingProgram({ ...goal, safetyGate: cleared }))
      .toEqual({ kind: "blocked", code: "DURATION_CONFIRMATION_REQUIRED" })
    expect(generateGoalTrainingProgram({ ...goal, longerDurationConfirmed: true, safetyGate: cleared }).kind).toBe("ready")
  })

  it("reports unavailable goal-pace supply instead of offering a different prescription basis", () => {
    const binding = vi.spyOn(catalogBinding, "bindCatalogSession").mockReturnValue(null)
    try {
      const goal = { ...input, goalPaceConfirmed: true, longerDurationConfirmed: true }
      expect(createGoalTrainingProgramPreview(goal)).toEqual({ kind: "unavailable", code: "GOAL_RACE_PACE_UNAVAILABLE" })
      expect(generateGoalTrainingProgram({ ...goal, safetyGate: cleared }))
        .toEqual({ kind: "unavailable", code: "GOAL_RACE_PACE_UNAVAILABLE" })
    } finally { binding.mockRestore() }
  })

  it("does not show a goal-pace preview when no QUALITY occurrence can carry the goal", () => {
    const original = candidateBuilder.createDeterministicCandidates
    const builder = vi.spyOn(candidateBuilder, "createDeterministicCandidates").mockImplementation((...args) => {
      const candidates = original(...args)
      const withoutQuality = (candidate: (typeof candidates)[number]) => ({ ...candidate,
        sessions: candidate.sessions.map(session => session.role !== "QUALITY" ? session
          : { day: session.day, slot: session.slot, role: "REST" as const, plannedEnergyIntent: "RECOVERY_INTENT" as const,
            prescription: { kind: "REST" as const } }) })
      return [withoutQuality(candidates[0]), withoutQuality(candidates[1])] as const
    })
    try {
      expect(createGoalTrainingProgramPreview({ ...input, goalPaceConfirmed: true }))
        .toEqual({ kind: "unavailable", code: "GOAL_RACE_PACE_UNAVAILABLE" })
    } finally { builder.mockRestore() }
  })
})
