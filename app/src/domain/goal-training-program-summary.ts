import { ALL_WORKOUT_CATALOG, type CalculatedWorkout } from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { PlanSession, PlannedEnergyIntent } from "@impl/plan-generator/types"
import type { GoalTrainingProgram, GoalTrainingProgramPreview } from "./goal-training-program"

export type GoalTrainingProgramSummarySource = Pick<GoalTrainingProgram | GoalTrainingProgramPreview,
  "goalMinutes" | "inputs" | "frames">
export type GoalTrainingProgramSummaryRange = Readonly<{ minimum: number; maximum: number }>
export type GoalTrainingProgramWorkoutSummary = Readonly<{
  day: number
  slot: "AM" | "PM"
  role: "QUALITY" | "EASY"
  energyIntent: PlannedEnergyIntent
  catalogId: string | null
  name: string | null
  catalogState: "VALID" | "UNAVAILABLE" | "NOT_BOUND"
  /** Full session, including the source preparation, all recovery and cooldown. */
  totalSeconds: GoalTrainingProgramSummaryRange | null
  mainWork: readonly Readonly<{
    occurrence: number
    distanceM: number | null
    seconds: GoalTrainingProgramSummaryRange | null
    goalPaceSecondsPerKm: GoalTrainingProgramSummaryRange | null
  }>[]
  goalPaceSecondsPerKm: GoalTrainingProgramSummaryRange | null
}>
export type GoalTrainingProgramFrameSummary = Readonly<{
  cycle: 1 | 2 | 3
  qualityCount: number
  easyCount: number
  /** Source-frame rest occurrences; the shared civil date belongs to both frames. */
  restCount: number
  qualityIntents: readonly PlannedEnergyIntent[]
  goalPaceSecondsPerKm: GoalTrainingProgramSummaryRange | null
  workouts: readonly GoalTrainingProgramWorkoutSummary[]
}>
export type GoalTrainingProgramSummary = Readonly<{
  basis: "GOAL_RACE_PACE" | "TIME_RPE"
  goal: Readonly<{
    kind: "GOAL"
    purpose: "ASPIRATIONAL_TARGET"
    eventDistanceM: 10000
    performanceSeconds: number
    /** Goal reference only. Actual bound targets are reported on each workout. */
    paceSecondsPerKm: number
  }>
  frames: readonly GoalTrainingProgramFrameSummary[]
}>

function rangeUnion(ranges: readonly (GoalTrainingProgramSummaryRange | null)[]): GoalTrainingProgramSummaryRange | null {
  const known = ranges.filter((range): range is GoalTrainingProgramSummaryRange => range !== null)
  return known.length ? { minimum: Math.min(...known.map(range => range.minimum)),
    maximum: Math.max(...known.map(range => range.maximum)) } : null
}

function goalRange(workout: CalculatedWorkout, step: CalculatedWorkout["steps"][number]): GoalTrainingProgramSummaryRange | null {
  if (step.phase !== "main" || step.kind !== "WORK" || step.targetModel !== "GOAL_RACE_REFERENCE") return null
  const reference = workout.inputs.paceReferences?.find(row => row.segmentId === step.segmentId)
  return reference?.kind === "GOAL" && reference.confirmed && reference.achievedOn === null
    && reference.eventDistanceM === 10000 && reference.model === "RACE_AVERAGE_V1"
    && step.referenceEventDistanceM === 10000 ? step.paceSecondsPerKm : null
}

function workoutSummary(session: Exclude<PlanSession, { role: "REST" }>): GoalTrainingProgramWorkoutSummary {
  const binding = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout : undefined
  const calculated = binding ? resolveCatalogBinding(binding) : null
  const entry = calculated ? ALL_WORKOUT_CATALOG.find(row => row.id === calculated.catalogId
    && row.fingerprint === calculated.catalogFingerprint) : undefined
  const mainWork = calculated?.steps.filter(step => step.phase === "main" && step.kind === "WORK")
    .map(step => ({ occurrence: step.occurrence, distanceM: step.distanceM, seconds: step.seconds,
      goalPaceSecondsPerKm: goalRange(calculated, step) })) ?? []
  // An unreadable catalog snapshot is unknown. Its old envelope is not a verified
  // replacement for the source's full elapsed time or main-work structure.
  const totalSeconds = binding ? calculated?.totals.seconds ?? null : session.prescription.kind === "RPE_TIME_RANGE"
    ? { minimum: session.prescription.durationMinutes.minimum * 60,
      maximum: session.prescription.durationMinutes.maximum * 60 } : null
  return { day: session.day, slot: session.slot, role: session.role, energyIntent: session.plannedEnergyIntent,
    catalogId: calculated?.catalogId ?? null, name: entry?.name ?? null,
    catalogState: binding ? calculated ? "VALID" : "UNAVAILABLE" : "NOT_BOUND",
    totalSeconds, mainWork, goalPaceSecondsPerKm: rangeUnion(mainWork.map(step => step.goalPaceSecondsPerKm)) }
}

/** Read-only projection of an already validated source or preview. This does not
 * assign phase roles, change doses, forecast performance, or authorize application. */
export function summarizeGoalTrainingProgram(source: GoalTrainingProgramSummarySource): GoalTrainingProgramSummary {
  const frames = source.frames.map(frame => {
    const sessions = "plan" in frame ? frame.plan.activePlan.sessions : frame.sessions
    const quality = sessions.filter(session => session.role === "QUALITY")
    const workouts = sessions.filter((session): session is Exclude<PlanSession, { role: "REST" }> => session.role !== "REST")
      .map(workoutSummary)
    return { cycle: frame.cycle, qualityCount: quality.length,
      easyCount: sessions.filter(session => session.role === "EASY").length,
      restCount: sessions.filter(session => session.role === "REST").length,
      qualityIntents: [...new Set(quality.map(session => session.plannedEnergyIntent))],
      goalPaceSecondsPerKm: rangeUnion(workouts.map(workout => workout.goalPaceSecondsPerKm)), workouts }
  })
  return { basis: source.inputs.goalPaceConfirmed ? "GOAL_RACE_PACE" : "TIME_RPE",
    goal: { kind: "GOAL", purpose: "ASPIRATIONAL_TARGET", eventDistanceM: 10000,
      performanceSeconds: source.goalMinutes * 60, paceSecondsPerKm: source.goalMinutes * 6 }, frames }
}
