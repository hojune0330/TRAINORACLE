import { z } from "zod"
import { canonicalJsonFingerprint, rebindCandidatePairIdentity } from "@impl/plan-generator/candidate-identity"
import { createDeterministicCandidates } from "@impl/plan-generator/candidates"
import { compileExposureLedger } from "@impl/plan-generator/exposure-ledger"
import { generatePlanCandidates } from "@impl/plan-generator/generator"
import { createActiveSnapshot } from "@impl/plan-generator/selection"
import type {
  CanonicalPlanGenerationRequest, ExperienceBand, LocalCivilNinePointFiveFormation,
  PlanCandidate, PlanCandidateKind, PlannedEnergyIntent, PlanSession, TrainingTimePreference,
} from "@impl/plan-generator/types"
import { ALL_WORKOUT_CATALOG, type WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession, bindDefaultCatalogSessions, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import { createPlanFormation } from "./plan-beta-formation"
import { hasCanonicalJsonTree, planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import {
  GOAL_PROGRAM_CALENDAR_DAYS, GOAL_PROGRAM_HALF_DAYS, isTenKGoalMinutes, resolveGoalProgramWindow,
  type GoalProgramDateChoice, type GoalProgramWindow, type GoalProgramWindowResult, type TenKGoalMinutes,
} from "./goal-program-calendar"
import { isValidIsoDate, isoShift } from "./dates"

/** Product packaging of existing reviewed doses. This is not a coach/creator program,
 * a predicted finish time, a goal-as-current-record model, or a taper prescription. */
export const GOAL_TRAINING_PROGRAM_SOURCE = Object.freeze({
  id: "TRAINORACLE_REVIEWED_TIME_RPE_3_FRAME",
  version: "1.0.0",
  fingerprint: canonicalJsonFingerprint("trainoracle.goal-program-source.v1", {
    frames: 3, frameHalfDays: 19, calendarDays: GOAL_PROGRAM_CALENDAR_DAYS,
    sharedDatePolicy: "EARLIER_FRAME_OWNS_DATE_LATER_OPENING_REST",
    laterFrameAvailability: "REPLACE_OPENING_DAY_WITH_NEXT_CIVIL_DAY",
    doseAuthority: "ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT_SECTION_9",
    explicitGoalPaceAuthority: "SAME_EVENT_RACE_PACE_BINDING_CONTRACT_TEN_K_GOAL_ONLY",
    extendedDurationPolicy: "EXPLICIT_ACCEPTANCE_OF_FULL_PREVIEW_BEFORE_GENERATION",
    catalog: ALL_WORKOUT_CATALOG.map(entry => ({ id: entry.id, version: entry.version, fingerprint: entry.fingerprint })),
  }),
})

export type GoalTrainingProgramInputs = Readonly<{
  experienceBand: ExperienceBand
  availableDayCount: 3 | 4 | 5 | 6 | "EVERY_DAY"
  trainingTimePreference: TrainingTimePreference
  candidateKind: PlanCandidateKind
  trainingFocus: PlannedEnergyIntent
  goalPaceConfirmed: boolean
  /** Acceptance of the exact full program's longer reviewed workout times. */
  longerDurationConfirmed: boolean
}>

export type GoalTrainingProgramGenerationInput = Readonly<{
  goalMinutes: TenKGoalMinutes
  dateChoice: GoalProgramDateChoice
  today: string
  generatedAt: string
  experienceBand: ExperienceBand
  availableDayCount: GoalTrainingProgramInputs["availableDayCount"]
  trainingTimePreference: TrainingTimePreference
  candidateKind?: PlanCandidateKind
  trainingFocus?: PlannedEnergyIntent
  /** An explicit choice of a goal RP recipe, never proof of current ability. */
  goalPaceConfirmed?: boolean
  longerDurationConfirmed?: boolean
  safetyGate: SafetyGateDecision
}>
export type GoalTrainingProgramPreviewInput = Omit<GoalTrainingProgramGenerationInput, "safetyGate" | "longerDurationConfirmed">

export type GoalTrainingProgramFrame = Readonly<{
  cycle: 1 | 2 | 3
  halfDayOffset: 0 | 19 | 38
  formation: LocalCivilNinePointFiveFormation
  plan: PlanBetaStateV3
}>
export type GoalTrainingProgramDay = Readonly<{
  date: string
  cycle: 1 | 2 | 3
  halfDayOffset: number
  /** The day remains local to its source frame. */
  session: PlanSession
}>
export type GoalTrainingProgram = Readonly<{
  schemaVersion: 1
  programId: string
  source: typeof GOAL_TRAINING_PROGRAM_SOURCE
  goalMinutes: TenKGoalMinutes
  dateChoice: GoalProgramDateChoice
  window: GoalProgramWindow
  inputs: GoalTrainingProgramInputs
  generatedAt: string
  frames: readonly GoalTrainingProgramFrame[]
  days: readonly GoalTrainingProgramDay[]
}>
export type GoalTrainingProgramPreview = Readonly<{
  kind: "GOAL_TRAINING_PROGRAM_PREVIEW"
  activationAllowed: false
  safetyState: "NOT_CHECKED"
  goalMinutes: TenKGoalMinutes
  dateChoice: GoalProgramDateChoice
  window: GoalProgramWindow
  inputs: GoalTrainingProgramInputs
  generatedAt: string
  frames: readonly Readonly<Omit<GoalTrainingProgramFrame, "plan"> & { sessions: readonly PlanSession[] }>[]
  days: readonly GoalTrainingProgramDay[]
}>

type WindowFailure = Exclude<GoalProgramWindowResult, { kind: "ready" }>
type Failure = WindowFailure | { readonly kind: "unavailable"; readonly code: string }
export type GoalTrainingProgramGenerationResult = Failure
  | { readonly kind: "blocked"; readonly code: "SAFETY_CHECK_REQUIRED" | "DURATION_CONFIRMATION_REQUIRED" }
  | { readonly kind: "ready"; readonly program: GoalTrainingProgram }

const settingsSchema = z.object({
  goalMinutes: z.number().refine(isTenKGoalMinutes),
  dateChoice: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("START"), startDate: z.string().refine(isValidIsoDate) }).strict(),
    z.object({ kind: z.literal("DEADLINE"), deadline: z.string().refine(isValidIsoDate) }).strict(),
  ]),
  today: z.string().refine(isValidIsoDate),
  generatedAt: z.string().refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value),
  experienceBand: z.enum(["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"]),
  availableDayCount: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal("EVERY_DAY")]),
  trainingTimePreference: z.enum(["MORNING", "EVENING", "VARIES"]),
  candidateKind: z.enum(["BALANCED", "CONSERVATIVE"]).default("BALANCED"),
  trainingFocus: z.enum(["RECOVERY_INTENT", "BASE_INTENT", "LT_INTENT", "VO2_INTENT", "GLY_INTENT", "ATP_PC_INTENT", "MIXED_INTENT"])
    .default("LT_INTENT"),
  goalPaceConfirmed: z.boolean().default(false),
  longerDurationConfirmed: z.boolean().default(false),
}).strict()

// A mechanical recipe replay carries no observation about the user's body.
// This blocked value never reaches selection, activation, or a saved safety receipt.
const UNCHECKED_PREVIEW_GATE: SafetyGateDecision = Object.freeze({
  kind: "blocked", action: "BLOCK_OR_HUMAN_REVIEW", planGenerationAllowed: false,
  requiredNextAction: "MORE_INFO_OR_HUMAN_REVIEW", nonSensitiveReasonCodes: [],
  audit: { event: "PLAN_SAFETY_GATE_BLOCKED" as const, privacy: "REASON_CODES_ONLY" as const },
})

function readSettings(input: GoalTrainingProgramPreviewInput & { readonly longerDurationConfirmed?: boolean }) {
  if (!hasCanonicalJsonTree(input)) return null
  const parsed = settingsSchema.safeParse(input.goalPaceConfirmed && input.trainingFocus === undefined
    ? { ...input, trainingFocus: "MIXED_INTENT" } : input)
  return parsed.success && (!parsed.data.goalPaceConfirmed || parsed.data.trainingFocus === "MIXED_INTENT") ? parsed.data : null
}
type Settings = NonNullable<ReturnType<typeof readSettings>>
function settingsInputs(settings: Settings): GoalTrainingProgramInputs {
  return {
    experienceBand: settings.experienceBand, availableDayCount: settings.availableDayCount,
    trainingTimePreference: settings.trainingTimePreference, candidateKind: settings.candidateKind,
    trainingFocus: settings.trainingFocus,
    goalPaceConfirmed: settings.goalPaceConfirmed,
    longerDurationConfirmed: settings.longerDurationConfirmed,
  }
}

/** The temporary profile envelope is not permission to omit reviewed preparation,
 * recovery or cooldown. Surface exact full times, and require explicit acceptance
 * before creating an activation-capable source with an extended duration. */
export function goalTrainingProgramDurationReview(source: Pick<GoalTrainingProgramPreview, "days">):
  Readonly<{ required: boolean; maximumSeconds: number | null; longerWorkoutCount: number }> {
  let maximumSeconds: number | null = null
  let longerWorkoutCount = 0
  for (const day of source.days) {
    const prescription = day.session.prescription
    if (prescription.kind !== "RPE_TIME_RANGE") continue
    const seconds = prescription.catalogWorkout?.acceptedDurationSeconds
      ?? prescription.durationMinutes.maximum * 60
    maximumSeconds = maximumSeconds === null ? seconds : Math.max(maximumSeconds, seconds)
    const binding = prescription.catalogWorkout
    if (binding && prescription.durationMinutes.maximum > binding.originalEnvelope.durationMinutes.maximum) longerWorkoutCount++
  }
  return Object.freeze({ required: longerWorkoutCount > 0, maximumSeconds, longerWorkoutCount })
}

/** Same declared availability matrix as the current beta. The one shared civil
 * date has one owner: the later frame starts with explicit rest and uses day 2
 * instead of day 1. This preserves the requested number of training dates. */
function availableDays(inputs: GoalTrainingProgramInputs, cycle: 1 | 2 | 3): readonly number[] {
  const matrix = { 3: [1, 5, 9], 4: [1, 4, 7, 10], 5: [1, 3, 5, 7, 9], 6: [1, 3, 5, 6, 8, 10] } as const
  const days = inputs.availableDayCount === "EVERY_DAY"
    ? Array.from({ length: 10 }, (_, index) => index + 1)
    : [...matrix[inputs.availableDayCount]]
  // There are only nine exclusively owned dates in cycle 2; never add a second
  // workout on the shared date in order to meet an all-days preference.
  return cycle === 2 ? [...new Set(days.map(day => day === 1 ? 2 : day))] : days
}

function formationFor(window: GoalProgramWindow, cycle: 1 | 2 | 3, inputs: GoalTrainingProgramInputs): LocalCivilNinePointFiveFormation {
  const halfDayOffset = (cycle - 1) * 19
  const first = window.halfDays[halfDayOffset]!
  const exposureSource = createPlanFormation(first.date, availableDays(inputs, cycle), inputs.experienceBand)
  return {
    kind: "LOCAL_CIVIL_9_5", ...(first.slot === "PM" ? { startSlot: "PM" as const } : {}),
    slots: window.halfDays.slice(halfDayOffset, halfDayOffset + 19)
      .map((slot, slotIndex) => ({ slotIndex, localDayKey: slot.date, slot: slot.slot })),
    exposures: exposureSource.exposures,
  }
}

function requestFor(window: GoalProgramWindow, cycle: 1 | 2 | 3, inputs: GoalTrainingProgramInputs,
  gate: SafetyGateDecision): CanonicalPlanGenerationRequest {
  return {
    kind: "PLAN_BETA_GENERATION_REQUEST", safetyGate: gate,
    profile: { eventGroup: "TEN_K", eventDistanceM: 10000, experienceBand: inputs.experienceBand,
      availableTrainingDays: availableDays(inputs, cycle), secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: inputs.trainingTimePreference },
    formation: formationFor(window, cycle, inputs), requestedFrameLength: 9.5,
    selectedEnergyIntent: inputs.trainingFocus, selectedDetailedTemplateRef: null,
    journalSource: { kind: "NO_USABLE_JOURNAL" }, selectionAuthority: "SELF",
  }
}

function goalPaceSessionOptions(session: PlanSession, settings: Settings): readonly PlanSession[] {
  if (session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE") return []
  const maximumMinutes = session.prescription.durationMinutes.maximum
  const options = ALL_WORKOUT_CATALOG.filter(entry => entry.family === "MIX"
    && entry.segments.some(segment => segment.intent === "RACE_PACE" && segment.referenceEventDistanceM === 10000))
    .flatMap(entry => {
      const inputs: WorkoutCalculationInputs = {
        eventDistanceM: 10000, experience: settings.experienceBand, availableSeconds: null,
        confirmedRequirements: [], fiveK: null, segmentPaces: [],
        paceReferences: entry.segments.filter(segment => segment.intent === "RACE_PACE")
          .map(segment => ({ segmentId: segment.segmentId, kind: "GOAL", confirmed: true,
            recordId: `goal-program-10km-${settings.goalMinutes}`, recordVersion: settings.generatedAt,
            eventDistanceM: 10000, performanceSeconds: settings.goalMinutes * 60, achievedOn: null,
            evaluatedOn: settings.generatedAt.slice(0, 10), model: "RACE_AVERAGE_V1" })),
      }
      const bound = bindCatalogSession(session, entry.id, inputs, true)
      return bound ? [bound] : []
    })
  const minutes = (option: PlanSession) => option.prescription.kind === "RPE_TIME_RANGE" ? option.prescription.durationMinutes.maximum : Infinity
  const withinEnvelope = options.filter(option => minutes(option) <= maximumMinutes)
  const shortest = Math.min(...options.map(minutes))
  return withinEnvelope.length ? withinEnvelope : options.filter(option => minutes(option) === shortest)
}

function hasBoundGoalPaceQuality(sessions: readonly PlanSession[]): boolean {
  return sessions.some(session => {
    if (session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE") return false
    const binding = session.prescription.catalogWorkout
    if (!binding) return false
    const calculated = resolveCatalogBinding(binding)
    return calculated?.steps.some(step => step.phase === "main" && step.kind === "WORK"
      && step.targetModel === "GOAL_RACE_REFERENCE" && step.referenceEventDistanceM === 10000
      && step.paceSecondsPerKm !== null) ?? false
  })
}

function frameCandidates(request: CanonicalPlanGenerationRequest, cycle: 1 | 2 | 3,
  checkSafety: boolean, settings: Settings): readonly [PlanCandidate, PlanCandidate] | null {
  const ledger = compileExposureLedger(request.formation)
  if (ledger.kind !== "valid" || (ledger.mainExposureCount !== 2 && ledger.mainExposureCount !== 3)) return null
  const generated = checkSafety ? generatePlanCandidates(request) : null
  if (checkSafety && generated?.kind !== "generated") return null
  const candidates = generated?.kind === "generated" ? generated.candidates
    : createDeterministicCandidates(request, { ...ledger, mainExposureCount: ledger.mainExposureCount })
  const bound = candidates.map(candidate => {
    // Explicit goal RP replaces every QUALITY prescription below. Binding an
    // ordinary MAIN first would calculate and discard a different recipe.
    const ordinary = settings.goalPaceConfirmed
      ? candidate.sessions.map(session => session.role === "QUALITY" ? session
        : bindDefaultCatalogSessions([session], 10000, request.profile.experienceBand, cycle)[0]!)
      : bindDefaultCatalogSessions(candidate.sessions, 10000, request.profile.experienceBand, cycle)
    const sessions = ordinary
      .map((session, index) => {
        if (!settings.goalPaceConfirmed || session.role !== "QUALITY") return session
        const options = goalPaceSessionOptions(candidate.sessions[index]!, settings)
        return options.length ? options[(cycle + session.day) % options.length]! : null
      })
    return sessions.some(session => session === null) ? null : { ...candidate, sessions: sessions as readonly PlanSession[] }
  })
  return bound.some(candidate => candidate === null) ? null
    : rebindCandidatePairIdentity(bound as unknown as readonly [PlanCandidate, PlanCandidate])
}

type ProjectionFrame = Readonly<{ cycle: 1 | 2 | 3; halfDayOffset: 0 | 19 | 38; sessions: readonly PlanSession[] }>
function projectFrames(window: GoalProgramWindow, frames: readonly ProjectionFrame[]) {
  const invalid = (code: string) => ({ kind: "invalid" as const, code })
  if (frames.length !== 3 || window.halfDays.length !== GOAL_PROGRAM_HALF_DAYS) return invalid("INVALID_FRAME_COUNT")
  const byDate = new Map<string, GoalTrainingProgramDay>()
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index]!
    if (frame.cycle !== index + 1 || frame.halfDayOffset !== index * 19) return invalid("INVALID_FRAME_ORDER")
    const first = window.halfDays[frame.halfDayOffset]!
    const phase = first.slot === "PM" ? 1 : 0
    const localDates = new Set<string>()
    for (const session of frame.sessions) {
      const relativeOffset = (session.day - 1) * 2 + (session.slot === "PM" ? 1 : 0) - phase
      if (!Number.isInteger(session.day) || !["AM", "PM"].includes(session.slot)
        || relativeOffset < 0 || relativeOffset >= 19) return invalid("SESSION_OUTSIDE_FRAME")
      const halfDayOffset = frame.halfDayOffset + relativeOffset
      const slot = window.halfDays[halfDayOffset]!
      if (slot.date !== isoShift(first.date, session.day - 1) || slot.slot !== session.slot) return invalid("INVALID_SESSION_DATE")
      if (localDates.has(slot.date)) return invalid("DUPLICATE_WORKOUT_DATE")
      localDates.add(slot.date)
      const old = byDate.get(slot.date)
      if (old && old.session.role !== "REST" && session.role !== "REST") return invalid("DUPLICATE_WORKOUT_DATE")
      // Never drop a workout. The shared boundary's explicit rest is a frame
      // boundary fact, while the calendar has only one entry for that date.
      if (!old || (old.session.role === "REST" && session.role !== "REST")) {
        byDate.set(slot.date, { date: slot.date, cycle: frame.cycle, halfDayOffset, session })
      }
    }
    if (localDates.size !== 10) return invalid("MISSING_FRAME_DATE")
  }
  if (byDate.size !== GOAL_PROGRAM_CALENDAR_DAYS) return invalid("MISSING_PROGRAM_DATE")
  return { kind: "ready" as const, days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) }
}

/** Applies current frame overrides to the calendar without changing the original
 * program or copying execution progress into its planned source. */
export function projectGoalTrainingProgramFrames(program: Pick<GoalTrainingProgram, "window" | "frames">,
  frames: readonly GoalTrainingProgramFrame[] = program.frames) {
  try {
    for (const frame of frames) {
      const first = program.window.halfDays[frame.halfDayOffset]
      if (!first || frame.plan.intake.startDate !== first.date
        || frame.plan.activePlan.frame.lengthDays !== 9.5
        || !("formationKind" in frame.plan.activePlan.frame)
        || (frame.plan.activePlan.frame.startSlot ?? "AM") !== first.slot) {
        return { kind: "invalid" as const, code: "INVALID_FRAME_START" }
      }
    }
    return projectFrames(program.window, frames.map(frame => ({ ...frame, sessions: frame.plan.activePlan.sessions })))
  } catch { return { kind: "invalid" as const, code: "INVALID_PROGRAM" } }
}

function makeProgram(settings: Settings, window: GoalProgramWindow, gate: SafetyGateDecision,
  checkSafety: boolean): GoalTrainingProgram | null {
  const inputs = settingsInputs(settings)
  const frames: GoalTrainingProgramFrame[] = []
  for (const cycle of [1, 2, 3] as const) {
    const request = requestFor(window, cycle, inputs, gate)
    const candidates = frameCandidates(request, cycle, checkSafety, settings)
    if (!candidates) return null
    const candidate = candidates.find(item => item.kind === inputs.candidateKind)!
    const halfDayOffset = ((cycle - 1) * 19) as 0 | 19 | 38
    const state = {
      version: 3,
      intake: { eventGroup: "TEN_K", eventDistanceM: 10000, competitionDivision: "NOT_PROVIDED",
        experienceBand: inputs.experienceBand, availableDayCount: inputs.availableDayCount,
        requestedFrameLength: 9.5, trainingFocus: inputs.trainingFocus, secondSessionMode: "SINGLE_SESSION_ONLY",
        trainingTimePreference: inputs.trainingTimePreference, selectedDetailedTemplateRef: null,
        startDate: window.halfDays[halfDayOffset]!.date },
      activePlan: createActiveSnapshot(candidate, "SELF"), progress: [], generatedAt: settings.generatedAt,
    }
    const parsed = planBetaStateV3Schema.safeParse(state)
    if (!parsed.success) return null
    frames.push({ cycle, halfDayOffset, formation: request.formation, plan: parsed.data })
  }
  const projected = projectGoalTrainingProgramFrames({ window, frames })
  if (projected.kind !== "ready") return null
  const content = { schemaVersion: 1 as const, source: GOAL_TRAINING_PROGRAM_SOURCE,
    goalMinutes: settings.goalMinutes as TenKGoalMinutes, dateChoice: settings.dateChoice, window,
    inputs, generatedAt: settings.generatedAt, frames, days: projected.days }
  return deepFreeze({ ...content, programId: `goal-program:${canonicalJsonFingerprint("trainoracle.goal-program.v1", content)}` })
}

export function generateGoalTrainingProgram(input: GoalTrainingProgramGenerationInput): GoalTrainingProgramGenerationResult {
  try {
    const { safetyGate, ...rawSettings } = input
    const settings = readSettings(rawSettings)
    if (!settings) return { kind: "unavailable", code: "INVALID_SETTINGS" }
    const resolved = resolveGoalProgramWindow(settings.dateChoice, settings.today)
    if (resolved.kind !== "ready") return resolved
    if (safetyGate.kind !== "passed" || safetyGate.planGenerationAllowed !== true) return { kind: "blocked", code: "SAFETY_CHECK_REQUIRED" }
    const program = makeProgram(settings, resolved.window, safetyGate, true)
    // New requests must visibly supply the requested basis. This creation check
    // does not reinterpret the immutable version 1 source during legacy replay.
    if (settings.goalPaceConfirmed && (!program
      || !program.frames.every(frame => hasBoundGoalPaceQuality(frame.plan.activePlan.sessions)))) {
      return { kind: "unavailable", code: "GOAL_RACE_PACE_UNAVAILABLE" }
    }
    if (program && goalTrainingProgramDurationReview(program).required && !settings.longerDurationConfirmed) {
      return { kind: "blocked", code: "DURATION_CONFIRMATION_REQUIRED" }
    }
    return program ? { kind: "ready", program } : { kind: "unavailable", code: "REVIEWED_FRAME_UNAVAILABLE" }
  } catch { return { kind: "unavailable", code: "INVALID_SETTINGS" } }
}

export function createGoalTrainingProgramPreview(input: GoalTrainingProgramPreviewInput): Failure
  | { readonly kind: "preview"; readonly preview: GoalTrainingProgramPreview } {
  try {
    // A preview can never carry an acceptance as if it were activation authority.
    const settings = readSettings({ ...input, longerDurationConfirmed: false })
    if (!settings) return { kind: "unavailable", code: "INVALID_SETTINGS" }
    const resolved = resolveGoalProgramWindow(settings.dateChoice, settings.today)
    if (resolved.kind !== "ready") return resolved
    const inputs = settingsInputs(settings)
    const frames = []
    for (const cycle of [1, 2, 3] as const) {
      const request = requestFor(resolved.window, cycle, inputs, UNCHECKED_PREVIEW_GATE)
      const candidates = frameCandidates(request, cycle, false, settings)
      if (!candidates) return { kind: "unavailable", code: settings.goalPaceConfirmed
        ? "GOAL_RACE_PACE_UNAVAILABLE" : "REVIEWED_FRAME_UNAVAILABLE" }
      const selected = candidates.find(candidate => candidate.kind === inputs.candidateKind)!
      if (settings.goalPaceConfirmed && !hasBoundGoalPaceQuality(selected.sessions)) {
        return { kind: "unavailable", code: "GOAL_RACE_PACE_UNAVAILABLE" }
      }
      frames.push({ cycle, halfDayOffset: ((cycle - 1) * 19) as 0 | 19 | 38,
        formation: request.formation, sessions: selected.sessions })
    }
    const projection = projectFrames(resolved.window, frames)
    if (projection.kind !== "ready") return { kind: "unavailable", code: projection.code }
    return { kind: "preview", preview: deepFreeze({ kind: "GOAL_TRAINING_PROGRAM_PREVIEW", activationAllowed: false,
      safetyState: "NOT_CHECKED", goalMinutes: settings.goalMinutes as TenKGoalMinutes,
      dateChoice: settings.dateChoice, window: resolved.window, inputs, generatedAt: settings.generatedAt,
      frames, days: projection.days }) }
  } catch { return { kind: "unavailable", code: "INVALID_SETTINGS" } }
}

type ValidationReplay = Readonly<{
  program: GoalTrainingProgram
  fingerprint: string
  durationConfirmationRequired: boolean
  bytes: number
}>
const validationReplays = new Map<string, ValidationReplay>()
const VALIDATION_REPLAY_MAX_ENTRIES = 32
const VALIDATION_REPLAY_MAX_BYTES = 4 * 1024 * 1024
let validationReplaySource = "", validationReplayBytes = 0

function validationReplayKey(settings: Settings, window: GoalProgramWindow): string {
  // Catalog JSON is mutable at the module boundary. A changed sequence or
  // eligibility must invalidate old recipes even when its declared hash is unchanged.
  const source = JSON.stringify({ source: GOAL_TRAINING_PROGRAM_SOURCE, catalog: ALL_WORKOUT_CATALOG })
  if (source !== validationReplaySource) {
    validationReplays.clear(); validationReplayBytes = 0; validationReplaySource = source
  }
  return JSON.stringify({ settings, window })
}

function retainValidationReplay(key: string, replay: ValidationReplay): void {
  if (replay.bytes > VALIDATION_REPLAY_MAX_BYTES) return
  while (validationReplays.size >= VALIDATION_REPLAY_MAX_ENTRIES
    || validationReplayBytes + replay.bytes > VALIDATION_REPLAY_MAX_BYTES) {
    const oldest = validationReplays.keys().next().value
    if (oldest === undefined) break
    validationReplayBytes -= validationReplays.get(oldest)!.bytes
    validationReplays.delete(oldest)
  }
  validationReplays.set(key, replay); validationReplayBytes += replay.bytes
}

/** Restores exact proposals by replaying reviewed recipes, inputs and dates.
 * Hash agreement alone never makes edited quantities or source claims valid. */
export function validateGoalTrainingProgram(value: unknown):
  { readonly kind: "valid"; readonly program: GoalTrainingProgram } | { readonly kind: "invalid"; readonly code: string } {
  try {
    if (!hasCanonicalJsonTree(value) || !value || typeof value !== "object") return { kind: "invalid", code: "INVALID_PROGRAM" }
    const program = value as GoalTrainingProgram
    const settings = readSettings({ goalMinutes: program.goalMinutes, dateChoice: program.dateChoice,
      today: program.window.startDate, generatedAt: program.generatedAt, ...program.inputs })
    if (!settings || !isValidIsoDate(program.window.startDate)) return { kind: "invalid", code: "INVALID_SETTINGS" }
    const resolved = resolveGoalProgramWindow(settings.dateChoice, program.window.startDate)
    if (resolved.kind !== "ready") return { kind: "invalid", code: "INVALID_WINDOW" }
    const key = validationReplayKey(settings, resolved.window)
    const retained = validationReplays.get(key)
    // Only the immutable expected recipe is reused. Current frame validators and
    // the entire incoming body comparison still run; approval and activation do not.
    if (retained && !retained.program.frames.every(frame => planBetaStateV3Schema.safeParse(frame.plan).success)) {
      return { kind: "invalid", code: "SOURCE_REPLAY_MISMATCH" }
    }
    const replay = retained?.program ?? makeProgram(settings, resolved.window, UNCHECKED_PREVIEW_GATE, false)
    const durationConfirmationRequired = retained?.durationConfirmationRequired
      ?? (replay !== null && goalTrainingProgramDurationReview(replay).required)
    if (replay && durationConfirmationRequired && !settings.longerDurationConfirmed) {
      return { kind: "invalid", code: "SOURCE_DURATION_CONFIRMATION_MISSING" }
    }
    const expectedFingerprint = retained?.fingerprint
      ?? (replay && canonicalJsonFingerprint("trainoracle.goal-program-compare.v1", replay))
    if (!replay || canonicalJsonFingerprint("trainoracle.goal-program-compare.v1", program)
      !== expectedFingerprint) return { kind: "invalid", code: "SOURCE_REPLAY_MISMATCH" }
    if (!retained) retainValidationReplay(key, { program: replay, fingerprint: expectedFingerprint!,
      durationConfirmationRequired, bytes: new TextEncoder().encode(key + JSON.stringify(replay)).byteLength })
    return { kind: "valid", program: replay }
  } catch { return { kind: "invalid", code: "INVALID_PROGRAM" } }
}

/** Current application still needs a fresh real safety decision. */
export function regenerateGoalTrainingProgram(program: GoalTrainingProgram, safetyGate: SafetyGateDecision, today: string): GoalTrainingProgramGenerationResult {
  const validated = validateGoalTrainingProgram(program)
  if (validated.kind !== "valid") return { kind: "unavailable", code: validated.code }
  return generateGoalTrainingProgram({ goalMinutes: program.goalMinutes, dateChoice: program.dateChoice,
    today, generatedAt: program.generatedAt, ...program.inputs, safetyGate })
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}
