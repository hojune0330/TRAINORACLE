import { assertNever } from "../shared/assert-never"
import { makeCandidateSessions } from "./session-builder"
import type {
  CanonicalPlanGenerationRequest,
  PlanBetaCode,
  PlanCandidate,
  PlanCandidateKind,
} from "./types"
import type { CompiledExposureLedger } from "./exposure-ledger"

export type SelectableExposureLedger = Extract<
  CompiledExposureLedger,
  { readonly kind: "valid" }
> & {
  readonly mainExposureCount: 2 | 3
}

type CandidateBuildInput = {
  readonly request: CanonicalPlanGenerationRequest
  readonly ledger: SelectableExposureLedger
  readonly kind: PlanCandidateKind
  readonly qualityDays: readonly number[]
}

function sourceCodes(request: CanonicalPlanGenerationRequest): readonly PlanBetaCode[] {
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

function frameFor(): PlanCandidate["frame"] {
  return Object.freeze({
    formationKind: "LOCAL_CIVIL_9_5",
    lengthDays: 9.5,
    slotCount: 19,
    continuity: Object.freeze({ kind: "STANDARD_FRAME" }),
  })
}

function candidateId(input: CandidateBuildInput): string {
  return [
    "beta",
    input.kind.toLowerCase(),
    input.request.profile.eventGroup.toLowerCase(),
    input.request.profile.experienceBand.toLowerCase(),
    input.request.selectedEnergyIntent.toLowerCase(),
    input.request.profile.secondSessionMode.toLowerCase(),
    "local-civil-9-5",
    input.ledger.countedExposureIds.join("-"),
    input.request.profile.availableTrainingDays.join("-"),
    input.request.journalSource.kind.toLowerCase(),
    continuityIdentity(input.request),
  ].join(":")
}

function continuityIdentity(request: CanonicalPlanGenerationRequest): string {
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

function continuityContextFor(request: CanonicalPlanGenerationRequest): PlanCandidate["continuityContext"] {
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
    frame: frameFor(),
    mainExposureLedger: Object.freeze({
      mainExposureCount: input.ledger.mainExposureCount,
      fingerprint: input.ledger.countedExposureIds.join(":"),
      countedExposureIds: Object.freeze([...input.ledger.countedExposureIds]),
    }),
    rationaleCodes: sourceCodes(input.request),
    sessions: makeCandidateSessions(input),
  })
}

function balancedQualityDays(request: CanonicalPlanGenerationRequest): readonly number[] {
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
    request.profile.experienceBand === "NEW_TO_RUNNING"
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
  request: CanonicalPlanGenerationRequest,
  ledger: SelectableExposureLedger,
): readonly [PlanCandidate, PlanCandidate] {
  const balanced = buildCandidate({
    request,
    ledger,
    kind: "BALANCED",
    qualityDays: balancedQualityDays(request),
  })
  const conservative = buildCandidate({
    request,
    ledger,
    kind: "CONSERVATIVE",
    qualityDays: Object.freeze([]),
  })
  return Object.freeze([balanced, conservative])
}
