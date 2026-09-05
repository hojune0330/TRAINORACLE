import { assertNever } from "../shared/assert-never"
import { isReviewedMainPlacement, type ReviewedMainPlacementPolicy } from "./main-placement-policy"
import {
  continuityContextIdentity,
  detailedPrescriptionFingerprintFromSessions,
  deriveCandidateId,
  projectPlanCandidate,
  rebindCandidatePairIdentity,
} from "./candidate-identity"
import { makeCandidateSessions } from "./session-builder"
import type {
  CanonicalPlanGenerationRequest,
  PlanBetaCode,
  PlanCandidate,
  PlanCandidateKind,
  SupportedPlanEventDistanceM,
} from "./types"
import type { CompiledExposureLedger } from "./exposure-ledger"
import type { PaceTargetPlanPrescription, PlanSession } from "./session-types"

export type DetailedPrescriptionTarget = Pick<PlanSession, "day" | "slot">
export type DetailedPrescriptionPlacement = {
  readonly target: DetailedPrescriptionTarget
  readonly prescription: PaceTargetPlanPrescription
}

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

function frameFor(request: CanonicalPlanGenerationRequest): PlanCandidate["frame"] {
  return Object.freeze({
    formationKind: "LOCAL_CIVIL_9_5",
    lengthDays: 9.5,
    slotCount: 19,
    projectionLengthDays: request.requestedFrameLength,
    continuity: request.requestedFrameLength === 7
      ? Object.freeze({
          kind: "SEVEN_DAY_CONTINUITY",
          nextFrameInput: "SELECTED_PLAN_AND_PROGRESS",
        })
      : Object.freeze({ kind: "STANDARD_FRAME" }),
  })
}

function candidateId(input: CandidateBuildInput): string {
  return [
    "beta",
    input.kind.toLowerCase(),
    input.request.profile.eventGroup.toLowerCase(),
    `event-${candidateEventDistance(input.request) ?? "unbound"}`,
    input.request.profile.experienceBand.toLowerCase(),
    input.request.selectedEnergyIntent.toLowerCase(),
    input.request.profile.secondSessionMode.toLowerCase(),
    input.request.profile.trainingTimePreference.toLowerCase(),
    `projection-${input.request.requestedFrameLength}`,
    "local-civil-9-5",
    input.ledger.countedExposureIds.join("-"),
    input.request.profile.availableTrainingDays.join("-"),
    input.request.journalSource.kind.toLowerCase(),
    continuityIdentity(input.request),
    `template-${templateIdentity(input.request)}`,
  ].join(":")
}

function templateIdentity(request: CanonicalPlanGenerationRequest): string {
  const reference = request.selectedDetailedTemplateRef
  return reference === null
    ? "rpe-only"
    : `${reference.templateId.toLowerCase()}.${reference.version}.${reference.fingerprint.slice("sha256:".length)}`
}

export function planPairId(
  request: CanonicalPlanGenerationRequest,
  ledger: SelectableExposureLedger,
): string {
  return [
    "plan-pair", "v3", request.profile.eventDistanceM,
    templateIdentity(request), request.selectedEnergyIntent.toLowerCase(),
    ledger.countedExposureIds.join("-"), request.profile.availableTrainingDays.join("-"),
    continuityIdentity(request),
  ].join(":")
}

function continuityIdentity(request: CanonicalPlanGenerationRequest): string {
  return continuityContextIdentity(continuityContextFor(request))
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
  const pairId = planPairId(input.request, input.ledger)
  return Object.freeze({
    candidateId: candidateId(input),
    pairId,
    kind: input.kind,
    eventGroup: input.request.profile.eventGroup,
    eventDistanceM: candidateEventDistance(input.request),
    selectedDetailedTemplateRef: input.request.selectedDetailedTemplateRef,
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
    detailedPrescriptionFingerprint: null,
    continuityContext: continuityContextFor(input.request),
    selectionAuthority: input.request.selectionAuthority,
    frame: frameFor(input.request),
    mainExposureLedger: Object.freeze({
      mainExposureCount: input.ledger.mainExposureCount,
      fingerprint: input.ledger.countedExposureIds.join(":"),
      countedExposureIds: Object.freeze([...input.ledger.countedExposureIds]),
    }),
    rationaleCodes: sourceCodes(input.request),
    sessions: makeCandidateSessions(input),
  })
}

function candidateEventDistance(
  request: CanonicalPlanGenerationRequest,
): PlanCandidate["eventDistanceM"] {
  return request.profile.eventDistanceM
}

export function bindOneDetailedPrescriptionCandidate(
  candidate: PlanCandidate,
  prescription: PaceTargetPlanPrescription,
  target?: DetailedPrescriptionTarget,
): PlanCandidate | null {
  // Placement selection does not authorize another copy of the detailed dose.
  if (candidate.sessions.some((session) => session.prescription.kind === "PACE_TARGET")) return null
  if (target !== undefined && (
    target === null || typeof target !== "object"
    || !Number.isInteger(target.day) || target.day < 1
    || (target.slot !== "AM" && target.slot !== "PM")
  )) return null
  const qualityIndex = candidate.sessions.findIndex((session) => target === undefined
    ? session.role === "QUALITY" && session.prescription.kind === "RPE_TIME_RANGE"
    : session.day === target.day && session.slot === target.slot)
  if (qualityIndex < 0) return null
  const selected = candidate.sessions[qualityIndex]
  if (selected === undefined || selected.role !== "QUALITY"
      || selected.prescription.kind !== "RPE_TIME_RANGE"
      || selected.plannedEnergyIntent !== candidate.selectedEnergyIntent) return null
  if (candidate.sessions.filter((session) => (
    session.day === selected.day && session.slot === selected.slot
  )).length !== 1) return null
  const eventDistanceM = supportedEventDistance(prescription.targetEventDistanceM)
  if (eventDistanceM === null) return null
  if (candidate.eventGroup !== prescription.scope.eventGroup) return null
  if (candidate.eventDistanceM !== null
      && candidate.eventDistanceM !== eventDistanceM) return null
  if (candidate.selectedDetailedTemplateRef === null
      || candidate.selectedDetailedTemplateRef.templateId !== prescription.templateId
      || candidate.selectedDetailedTemplateRef.version !== prescription.templateVersion
      || candidate.selectedDetailedTemplateRef.fingerprint !== prescription.templateContentFingerprint) return null

  const sessions = candidate.sessions.map((session, index) => {
    if (index !== qualityIndex || session.role !== "QUALITY") return session
    return Object.freeze({
      ...session,
      prescription,
    })
  })
  const bound: PlanCandidate = Object.freeze({
    ...candidate,
    candidateId: `${candidate.candidateId.replace(
      ":event-unbound:",
      `:event-${eventDistanceM}:`,
    )}:pace-target:${prescription.prescriptionFingerprint}`,
    eventDistanceM,
    beta: Object.freeze({
      ...candidate.beta,
      prescriptionBasis: "ONE_TRUSTED_DETAILED_SESSION" as const,
    }),
    detailedPrescriptionFingerprint: prescription.prescriptionFingerprint,
    rationaleCodes: Object.freeze([
      ...candidate.rationaleCodes.filter((code) => code !== "BETA_DURATION_RPE_ONLY"),
      "PACE_TARGET_BOUND" as const,
    ]),
    sessions: Object.freeze(sessions),
  })
  return target === undefined ? bound : Object.freeze({
    ...bound,
    candidateId: deriveCandidateId(bound.candidateId, projectPlanCandidate(bound)),
  })
}

export function bindDetailedPrescriptionCandidateSet(
  candidate: PlanCandidate,
  placements: readonly DetailedPrescriptionPlacement[],
  placementPolicies?: readonly ReviewedMainPlacementPolicy[],
  athleteExperienceBand?: "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED",
): PlanCandidate | null {
  if (placements.length === 0 || candidate.sessions.some(session => session.prescription.kind === "PACE_TARGET")) return null
  const targetKeys = new Set<string>()
  const indexes: number[] = []
  for (const placement of placements) {
    const target = placement.target
    if (target === null || typeof target !== "object" || !Number.isInteger(target.day) || target.day < 1
        || (target.slot !== "AM" && target.slot !== "PM")) return null
    const targetKey = `${target.day}:${target.slot}`
    if (targetKeys.has(targetKey)) return null
    targetKeys.add(targetKey)
    const matches = candidate.sessions.flatMap((session, index) => session.day === target.day && session.slot === target.slot ? [index] : [])
    if (matches.length !== 1) return null
    const sessionIndex = matches[0]
    if (sessionIndex === undefined) return null
    const session = candidate.sessions[sessionIndex]
    const prescription = placement.prescription
    const eventDistanceM = supportedEventDistance(prescription.targetEventDistanceM)
    if (session === undefined || session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE"
        || session.plannedEnergyIntent !== candidate.selectedEnergyIntent || eventDistanceM === null
        || candidate.eventGroup !== prescription.scope.eventGroup || candidate.eventDistanceM !== eventDistanceM) return null
    indexes.push(sessionIndex)
  }
  const byIndex = new Map(indexes.map((index, placementIndex) => [index, placements[placementIndex]?.prescription] as const))
  const sessions = Object.freeze(candidate.sessions.map((session, index) => {
    const prescription = byIndex.get(index)
    return prescription === undefined || session.role !== "QUALITY"
      ? session
      : Object.freeze({ ...session, prescription })
  }))
  const detailedPrescriptionFingerprint = detailedPrescriptionFingerprintFromSessions(sessions)
  if (detailedPrescriptionFingerprint === null) return null
  const placementContext = athleteExperienceBand === undefined
    ? { ...candidate, sessions }
    : { ...candidate, sessions, athleteExperienceBand }
  if (!isReviewedMainPlacement(placementContext, placementPolicies)) return null
  const bound = Object.freeze({
    ...candidate,
    eventDistanceM: supportedEventDistance(placements[0]?.prescription.targetEventDistanceM ?? Number.NaN) ?? candidate.eventDistanceM,
    beta: Object.freeze({
      ...candidate.beta,
      prescriptionBasis: placements.length === 1
        ? "ONE_TRUSTED_DETAILED_SESSION" as const
        : "MULTIPLE_TRUSTED_DETAILED_SESSIONS" as const,
    }),
    detailedPrescriptionFingerprint,
    rationaleCodes: Object.freeze([
      ...candidate.rationaleCodes.filter(code => code !== "BETA_DURATION_RPE_ONLY"),
      "PACE_TARGET_BOUND" as const,
    ]),
    sessions,
  })
  return Object.freeze({
    ...bound,
    candidateId: deriveCandidateId(bound.candidateId, projectPlanCandidate(bound)),
  })
}

function supportedEventDistance(value: number): SupportedPlanEventDistanceM | null {
  return value === 800 || value === 1500 || value === 3000 || value === 5000
    || value === 10000 || value === 21097 || value === 42195
    ? value
    : null
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
    qualityDays: balancedQualityDays(request),
  })
  return rebindCandidatePairIdentity([balanced, conservative])
}
