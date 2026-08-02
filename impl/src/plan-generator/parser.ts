import {
  isRecord,
  parseFrameLength,
  parseJournalSource,
  parsePlannedEnergyIntent,
  parseProfile,
  parseSafetyGate,
  parseSelectionAuthority,
} from "./input-values"
import { parseContinuityInput } from "./continuity"
import { parseFormation } from "./formation-parser"
import type {
  CanonicalPlanGenerationRequest,
  PlanGenerationRequest,
  PlanProfile,
  PlanReviewReasonCode,
} from "./types"

type ParseRejectionCode =
  | "MALFORMED_INPUT"
  | "UNSUPPORTED_FRAME_LENGTH"
  | "INSUFFICIENT_AVAILABLE_DAYS"
  | "INVALID_AVAILABLE_DAY"
  | "INVALID_JOURNAL_CONTEXT"
  | "INVALID_CONTINUITY_CONTEXT"

type ParsedPlanRequest =
  | {
      readonly kind: "parsed"
      readonly request: CanonicalPlanGenerationRequest
    }
  | {
      readonly kind: "review"
      readonly code: PlanReviewReasonCode
    }
  | {
      readonly kind: "rejected"
      readonly code: ParseRejectionCode
    }

function reject(code: ParseRejectionCode): ParsedPlanRequest {
  return { kind: "rejected", code }
}

function review(code: PlanReviewReasonCode): ParsedPlanRequest {
  return { kind: "review", code }
}

function profileDayError(
  profile: PlanProfile,
  frameLength: 7 | 9 | 10,
): ParseRejectionCode | undefined {
  if (profile.availableTrainingDays.length < 2) {
    return "INSUFFICIENT_AVAILABLE_DAYS"
  }

  for (const day of profile.availableTrainingDays) {
    if (day < 1 || day > frameLength) {
      return "INVALID_AVAILABLE_DAY"
    }
  }
  return undefined
}

function canonicalProfileDayError(profile: PlanProfile): ParseRejectionCode | undefined {
  if (profile.availableTrainingDays.length < 2) {
    return "INSUFFICIENT_AVAILABLE_DAYS"
  }

  for (const day of profile.availableTrainingDays) {
    if (day < 1 || day > 10) {
      return "INVALID_AVAILABLE_DAY"
    }
  }
  return undefined
}

export function parsePlanGenerationRequest(input: unknown): ParsedPlanRequest {
  if (!isRecord(input) || input["kind"] !== "PLAN_BETA_GENERATION_REQUEST") {
    return reject("MALFORMED_INPUT")
  }

  const safetyGate = parseSafetyGate(input["safetyGate"])
  const profile = parseProfile(input["profile"])
  const journal = parseJournalSource(input["journalSource"])
  const selectionAuthority = parseSelectionAuthority(input["selectionAuthority"])
  const selectedEnergyIntent = parsePlannedEnergyIntent(input["selectedEnergyIntent"])
  const continuity = parseContinuityInput(input["continuity"])
  if (journal.kind === "invalid") {
    return reject("INVALID_JOURNAL_CONTEXT")
  }
  if (continuity.kind === "invalid") {
    return reject("INVALID_CONTINUITY_CONTEXT")
  }
  if (
    safetyGate === undefined ||
    profile === undefined ||
    selectionAuthority === undefined ||
    selectedEnergyIntent === undefined
  ) {
    return reject("MALFORMED_INPUT")
  }

  const formationValue = input["formation"]
  const legacyFrameValue = input["requestedFrameLength"]
  if (formationValue !== undefined && legacyFrameValue !== undefined) {
    return reject("MALFORMED_INPUT")
  }

  if (formationValue === undefined) {
    const requestedFrameLength = parseFrameLength(legacyFrameValue)
    if (requestedFrameLength === undefined) {
      return reject("UNSUPPORTED_FRAME_LENGTH")
    }

    const dayError = profileDayError(profile, requestedFrameLength)
    if (dayError !== undefined) {
      return reject(dayError)
    }
    return review("NON_CANONICAL_FRAME_REQUIRES_REVIEW")
  }

  const formation = parseFormation(formationValue)
  if (formation === undefined) {
    return reject("MALFORMED_INPUT")
  }

  const dayError = canonicalProfileDayError(profile)
  if (dayError !== undefined) {
    return reject(dayError)
  }

  const request: Omit<CanonicalPlanGenerationRequest, "continuity"> = {
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate,
    profile,
    formation,
    journalSource: journal.journalSource,
    selectionAuthority,
    selectedEnergyIntent,
  }
  switch (continuity.kind) {
    case "absent":
      return { kind: "parsed", request }
    case "parsed":
      return {
        kind: "parsed",
        request: {
          ...request,
          continuity: continuity.continuity,
        },
      }
    default:
      return reject("INVALID_CONTINUITY_CONTEXT")
  }
}
