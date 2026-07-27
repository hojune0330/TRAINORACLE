import { assertNever } from "../shared/assert-never"
import type {
  ExperienceBand,
  PlanBetaCode,
  PlanCandidate,
  PlanCandidateKind,
  PlanGenerationRequest,
  PlanSession,
  PlannedEnergyIntent,
  EasyEnergyIntent,
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

type CandidateBuildInput = {
  readonly request: PlanGenerationRequest
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

function restSession(day: number): PlanSession {
  return Object.freeze({
    day,
    slot: "AM",
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

function easyIntent(input: CandidateBuildInput): "RECOVERY_INTENT" | "BASE_INTENT" {
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

function restsAvailableRecoveryDays(input: CandidateBuildInput): boolean {
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
): PlanSession {
  return Object.freeze({
    day,
    slot: "AM",
    role: "QUALITY",
    plannedEnergyIntent,
    prescription: freezeRange({
      kind: "RPE_TIME_RANGE",
      rpe: rpeForIntent(plannedEnergyIntent),
      durationMinutes,
    }),
  })
}

function recoverySecondSessionDays(input: CandidateBuildInput): readonly number[] {
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
  const limit = input.request.requestedFrameLength === 7 ? 1 : 2
  if (eligibleDays.length <= limit) return Object.freeze([...eligibleDays])

  const selected: number[] = []
  for (let index = 1; index <= limit; index += 1) {
    const day = eligibleDays[Math.floor((index * eligibleDays.length) / (limit + 1))]
    if (day !== undefined) selected.push(day)
  }
  return Object.freeze(selected)
}

function qualityIntentFor(request: PlanGenerationRequest): QualityEnergyIntent {
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

function makeSessions(input: CandidateBuildInput): readonly PlanSession[] {
  const ranges = rangesFor(input.request.profile.experienceBand)
  const availableDays = new Set(input.request.profile.availableTrainingDays)
  const qualityDays = new Set(input.qualityDays)
  const recoverySecondDays = new Set(recoverySecondSessionDays(input))
  const sessions: PlanSession[] = []

  for (let day = 1; day <= input.request.requestedFrameLength; day += 1) {
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

function sourceCodes(request: PlanGenerationRequest): readonly PlanBetaCode[] {
  const continuityCode =
    request.continuity === undefined ? [] : ["PREVIOUS_FRAME_CONTEXT_RETAINED" as const]
  switch (request.journalSource.kind) {
    case "NO_USABLE_JOURNAL":
      return Object.freeze([
        "PROFILE_ONLY_LIMITED_CONTEXT",
        "BETA_DURATION_RPE_ONLY",
        "BETA_NON_UNIVERSAL_FORMATION_SCOPE",
        ...continuityCode,
      ])
    case "RECENT_JOURNAL_CONTEXT":
      return Object.freeze([
        "RECENT_JOURNAL_CONTEXT_PRESENT",
        "BETA_DURATION_RPE_ONLY",
        "BETA_NON_UNIVERSAL_FORMATION_SCOPE",
        ...continuityCode,
      ])
    default:
      return assertNever(request.journalSource)
  }
}

function frameFor(request: PlanGenerationRequest): PlanCandidate["frame"] {
  switch (request.requestedFrameLength) {
    case 7:
      return Object.freeze({
        lengthDays: 7,
        continuity: Object.freeze({
          kind: "SEVEN_DAY_CONTINUITY",
          nextFrameInput: "SELECTED_PLAN_AND_PROGRESS",
        }),
      })
    case 9:
      return Object.freeze({
        lengthDays: 9,
        continuity: Object.freeze({ kind: "STANDARD_FRAME" }),
      })
    case 10:
      return Object.freeze({
        lengthDays: 10,
        continuity: Object.freeze({ kind: "STANDARD_FRAME" }),
      })
    default:
      return assertNever(request.requestedFrameLength)
  }
}

function candidateId(input: CandidateBuildInput): string {
  return [
    "beta",
    input.kind.toLowerCase(),
    input.request.profile.eventGroup.toLowerCase(),
    input.request.profile.experienceBand.toLowerCase(),
    input.request.selectedEnergyIntent.toLowerCase(),
    input.request.profile.secondSessionMode.toLowerCase(),
    input.request.requestedFrameLength,
    input.request.profile.availableTrainingDays.join("-"),
    input.request.journalSource.kind.toLowerCase(),
    continuityIdentity(input.request),
  ].join(":")
}

function continuityIdentity(request: PlanGenerationRequest): string {
  if (request.continuity === undefined) {
    return "no-continuity"
  }
  return [
    request.continuity.previousCandidateKind.toLowerCase(),
    request.continuity.progressStateCounts
      .map((entry) => `${entry.state.toLowerCase()}-${entry.count}`)
      .join("-"),
  ].join(":")
}

function continuityContextFor(request: PlanGenerationRequest): PlanCandidate["continuityContext"] {
  if (request.continuity === undefined) {
    return Object.freeze({ kind: "NO_PREVIOUS_FRAME_CONTEXT" })
  }
  return Object.freeze({
    kind: "PREVIOUS_FRAME_CONTEXT_RETAINED",
    previousCandidateKind: request.continuity.previousCandidateKind,
    progressStateCounts: Object.freeze(
      request.continuity.progressStateCounts.map((entry) => Object.freeze({ ...entry })),
    ),
  })
}

function buildCandidate(input: CandidateBuildInput): PlanCandidate {
  return Object.freeze({
    candidateId: candidateId(input),
    kind: input.kind,
    eventGroup: input.request.profile.eventGroup,
    selectedEnergyIntent: input.request.selectedEnergyIntent,
    sourceMode:
      input.request.journalSource.kind === "NO_USABLE_JOURNAL"
        ? "PROFILE_ONLY"
        : "JOURNAL_CONTEXT_ONLY",
    confidence: "LIMITED",
    beta: Object.freeze({
      designation: "BETA",
      prescriptionBasis: "DURATION_RPE_ONLY",
      formationMethodClaim: "NOT_UNIVERSAL",
    }),
    continuityContext: continuityContextFor(input.request),
    selectionAuthority: input.request.selectionAuthority,
    frame: frameFor(input.request),
    rationaleCodes: sourceCodes(input.request),
    sessions: makeSessions(input),
  })
}

function balancedQualityDays(request: PlanGenerationRequest): readonly number[] {
  if (
    request.selectedEnergyIntent === "RECOVERY_INTENT"
    || request.selectedEnergyIntent === "BASE_INTENT"
  ) {
    return Object.freeze([])
  }
  const availableDays = request.profile.availableTrainingDays
  const firstQualityDay = availableDays[Math.min(1, availableDays.length - 1)]
  if (firstQualityDay === undefined) {
    return Object.freeze([])
  }

  if (
    request.requestedFrameLength === 7
    || request.profile.experienceBand === "NEW_TO_RUNNING"
    || availableDays.length < 4
  ) {
    return Object.freeze([firstQualityDay])
  }

  for (let index = availableDays.length - 1; index >= 0; index -= 1) {
    const candidate = availableDays[index]
    if (candidate !== undefined && candidate - firstQualityDay >= 3) {
      return Object.freeze([firstQualityDay, candidate])
    }
  }
  return Object.freeze([firstQualityDay])
}

export function createDeterministicCandidates(
  request: PlanGenerationRequest,
): readonly [PlanCandidate, PlanCandidate] {
  const balanced = buildCandidate({
    request,
    kind: "BALANCED",
    qualityDays: balancedQualityDays(request),
  })
  const conservative = buildCandidate({
    request,
    kind: "CONSERVATIVE",
    qualityDays: Object.freeze([]),
  })
  return Object.freeze([balanced, conservative])
}
