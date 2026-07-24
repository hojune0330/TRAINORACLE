import { assertNever } from "../shared/assert-never"
import type {
  ExperienceBand,
  PlanBetaCode,
  PlanCandidate,
  PlanCandidateKind,
  PlanGenerationRequest,
  PlanSession,
  RpeTimeRange,
} from "./types"

type DurationRange = {
  readonly minimum: number
  readonly maximum: number
}

type ExperienceRanges = {
  readonly easy: DurationRange
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
        quality: { minimum: 20, maximum: 30 },
      }
    case "DEVELOPING":
      return {
        easy: { minimum: 30, maximum: 45 },
        quality: { minimum: 25, maximum: 40 },
      }
    case "EXPERIENCED":
      return {
        easy: { minimum: 35, maximum: 60 },
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
    role: "REST",
    prescription: Object.freeze({ kind: "REST" }),
  })
}

function trainingSession(
  day: number,
  role: "EASY" | "QUALITY",
  durationMinutes: DurationRange,
): PlanSession {
  const rpe = role === "QUALITY" ? { minimum: 5, maximum: 6 } : { minimum: 2, maximum: 4 }
  return Object.freeze({
    day,
    role,
    prescription: freezeRange({
      kind: "RPE_TIME_RANGE",
      rpe,
      durationMinutes,
    }),
  })
}

function makeSessions(input: CandidateBuildInput): readonly PlanSession[] {
  const ranges = rangesFor(input.request.profile.experienceBand)
  const availableDays = new Set(input.request.profile.availableTrainingDays)
  const qualityDays = new Set(input.qualityDays)
  const sessions: PlanSession[] = []

  for (let day = 1; day <= input.request.requestedFrameLength; day += 1) {
    if (!availableDays.has(day)) {
      sessions.push(restSession(day))
      continue
    }

    if (qualityDays.has(day)) {
      sessions.push(trainingSession(day, "QUALITY", ranges.quality))
      continue
    }

    sessions.push(trainingSession(day, "EASY", ranges.easy))
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
