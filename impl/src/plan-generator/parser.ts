import {
  isRecord,
  parseFrameLength,
  parseJournalSource,
  parseProfile,
  parseSafetyGate,
  parseSelectionAuthority,
} from "./input-values"
import { parseContinuityInput } from "./continuity"
import type { PlanGenerationRequest, PlanProfile } from "./types"

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
      readonly request: PlanGenerationRequest
    }
  | {
      readonly kind: "rejected"
      readonly code: ParseRejectionCode
    }

function reject(code: ParseRejectionCode): ParsedPlanRequest {
  return { kind: "rejected", code }
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

export function parsePlanGenerationRequest(input: unknown): ParsedPlanRequest {
  if (!isRecord(input) || input["kind"] !== "PLAN_BETA_GENERATION_REQUEST") {
    return reject("MALFORMED_INPUT")
  }

  const requestedFrameLength = parseFrameLength(input["requestedFrameLength"])
  if (requestedFrameLength === undefined) {
    return reject("UNSUPPORTED_FRAME_LENGTH")
  }

  const safetyGate = parseSafetyGate(input["safetyGate"])
  const profile = parseProfile(input["profile"])
  const journal = parseJournalSource(input["journalSource"])
  const selectionAuthority = parseSelectionAuthority(input["selectionAuthority"])
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
    selectionAuthority === undefined
  ) {
    return reject("MALFORMED_INPUT")
  }

  const dayError = profileDayError(profile, requestedFrameLength)
  if (dayError !== undefined) {
    return reject(dayError)
  }

  const request: Omit<PlanGenerationRequest, "continuity"> = {
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate,
    profile,
    requestedFrameLength,
    journalSource: journal.journalSource,
    selectionAuthority,
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
