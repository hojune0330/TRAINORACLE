import { assertNever } from "../shared/assert-never"
import type {
  CanonicalPlanGenerationRequest,
  EasyEnergyIntent,
  ExperienceBand,
  PlanCandidateKind,
  PlannedEnergyIntent,
  PlanSession,
  PlanSessionSlot,
  QualityEnergyIntent,
  RpeTimeRange,
} from "./types"

type DurationRange = {
  readonly minimum: number
  readonly maximum: number
}

type ExperienceRanges = {
  readonly easy: DurationRange
  readonly recoverySupport: DurationRange
  readonly quality: DurationRange
}

export type CandidateSessionBuildInput = {
  readonly request: CanonicalPlanGenerationRequest
  readonly kind: PlanCandidateKind
  readonly qualityDays: readonly number[]
}

function rangesFor(experienceBand: ExperienceBand): ExperienceRanges {
  switch (experienceBand) {
    case "NEW_TO_RUNNING":
      return {
        easy: { minimum: 20, maximum: 35 },
        recoverySupport: { minimum: 10, maximum: 20 },
        quality: { minimum: 20, maximum: 30 },
      }
    case "DEVELOPING":
      return {
        easy: { minimum: 30, maximum: 45 },
        recoverySupport: { minimum: 15, maximum: 25 },
        quality: { minimum: 25, maximum: 40 },
      }
    case "EXPERIENCED":
      return {
        easy: { minimum: 35, maximum: 60 },
        recoverySupport: { minimum: 20, maximum: 30 },
        quality: { minimum: 30, maximum: 50 },
      }
    default:
      return assertNever(experienceBand)
  }
}

function freezeRange(range: RpeTimeRange): RpeTimeRange {
  return Object.freeze({
    ...range,
    rpe: Object.freeze({ ...range.rpe }),
    durationMinutes: Object.freeze({ ...range.durationMinutes }),
  })
}

function restSession(day: number, slot: PlanSessionSlot = "AM"): PlanSession {
  return Object.freeze({
    day,
    slot,
    role: "REST",
    plannedEnergyIntent: "RECOVERY_INTENT",
    prescription: Object.freeze({ kind: "REST" }),
  })
}

function rpeForIntent(intent: PlannedEnergyIntent): RpeTimeRange["rpe"] {
  switch (intent) {
    case "RECOVERY_INTENT":
      return { minimum: 1, maximum: 2 }
    case "BASE_INTENT":
      return { minimum: 3, maximum: 4 }
    case "LT_INTENT":
      return { minimum: 5, maximum: 6 }
    case "VO2_INTENT":
    case "GLY_INTENT":
      return { minimum: 7, maximum: 8 }
    case "ATP_PC_INTENT":
      return { minimum: 8, maximum: 9 }
    case "MIXED_INTENT":
      return { minimum: 6, maximum: 7 }
    default:
      return assertNever(intent)
  }
}

function easyIntent(input: CandidateSessionBuildInput): "RECOVERY_INTENT" | "BASE_INTENT" {
  if (input.request.selectedEnergyIntent === "RECOVERY_INTENT") {
    return "RECOVERY_INTENT"
  }
  if (
    input.kind === "CONSERVATIVE"
    && input.request.selectedEnergyIntent === "BASE_INTENT"
  ) {
    return "RECOVERY_INTENT"
  }
  return "BASE_INTENT"
}

function restsAvailableRecoveryDays(input: CandidateSessionBuildInput): boolean {
  return (
    input.kind === "CONSERVATIVE"
    && input.request.selectedEnergyIntent === "RECOVERY_INTENT"
  )
}

function easyTrainingSession(
  day: number,
  slot: "AM" | "PM",
  durationMinutes: DurationRange,
  plannedEnergyIntent: EasyEnergyIntent,
): PlanSession {
  return Object.freeze({
    day,
    slot,
    role: "EASY",
    plannedEnergyIntent,
    prescription: freezeRange({
      kind: "RPE_TIME_RANGE",
      rpe: rpeForIntent(plannedEnergyIntent),
      durationMinutes,
    }),
  })
}

function qualityTrainingSession(
  day: number,
  durationMinutes: DurationRange,
  plannedEnergyIntent: QualityEnergyIntent,
  slot: PlanSessionSlot = "AM",
): PlanSession {
  return Object.freeze({
    day,
    slot,
    role: "QUALITY",
    plannedEnergyIntent,
    prescription: freezeRange({
      kind: "RPE_TIME_RANGE",
      rpe: rpeForIntent(plannedEnergyIntent),
      durationMinutes,
    }),
  })
}

function recoverySecondSessionDays(input: CandidateSessionBuildInput): readonly number[] {
  if (
    input.kind !== "BALANCED"
    || input.request.profile.secondSessionMode !== "RECOVERY_PM_ALLOWED"
    || input.request.selectedEnergyIntent === "RECOVERY_INTENT"
  ) {
    return Object.freeze([])
  }

  const qualityDays = new Set(input.qualityDays)
  const eligibleDays = input.request.profile.availableTrainingDays.filter(
    (day) => !qualityDays.has(day),
  )
  const limit = 2
  if (eligibleDays.length <= limit) return Object.freeze([...eligibleDays])

  const selected: number[] = []
  for (let index = 1; index <= limit; index += 1) {
    const day = eligibleDays[Math.floor((index * eligibleDays.length) / (limit + 1))]
    if (day !== undefined) selected.push(day)
  }
  return Object.freeze(selected)
}

function qualityIntentFor(request: CanonicalPlanGenerationRequest): QualityEnergyIntent {
  switch (request.selectedEnergyIntent) {
    case "LT_INTENT":
    case "VO2_INTENT":
    case "GLY_INTENT":
    case "ATP_PC_INTENT":
    case "MIXED_INTENT":
      return request.selectedEnergyIntent
    case "RECOVERY_INTENT":
    case "BASE_INTENT":
      throw new Error("A recovery or base intention cannot create a quality session")
    default:
      return assertNever(request.selectedEnergyIntent)
  }
}

export function makeCandidateSessions(input: CandidateSessionBuildInput): readonly PlanSession[] {
  const ranges = rangesFor(input.request.profile.experienceBand)
  const availableDays = new Set(input.request.profile.availableTrainingDays)
  const qualityDays = new Set(input.qualityDays)
  const recoverySecondDays = new Set(recoverySecondSessionDays(input))
  const sessions: PlanSession[] = []

  for (let day = 1; day <= 10; day += 1) {
    if (!availableDays.has(day) || restsAvailableRecoveryDays(input)) {
      sessions.push(restSession(day))
      continue
    }

    if (qualityDays.has(day)) {
      sessions.push(qualityTrainingSession(
        day,
        ranges.quality,
        qualityIntentFor(input.request),
      ))
      continue
    }

    sessions.push(easyTrainingSession(day, "AM", ranges.easy, easyIntent(input)))
    if (recoverySecondDays.has(day)) {
      sessions.push(easyTrainingSession(
        day,
        "PM",
        ranges.recoverySupport,
        "RECOVERY_INTENT",
      ))
    }
  }

  return Object.freeze(sessions)
}
