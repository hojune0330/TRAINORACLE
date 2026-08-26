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
  DetailedTemplateRef,
  PlanGenerationRequest,
  PlanProfile,
  PlanReviewReasonCode,
} from "./types"

const TEMPLATE_ID_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/u
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u

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

function parseProjectionLength(value: unknown): 7 | 9 | 9.5 | 10 | undefined {
  switch (value) {
    case 7:
      return 7
    case 9:
      return 9
    case 9.5:
      return 9.5
    case 10:
      return 10
    case undefined:
      return 9.5
    default:
      return undefined
  }
}

function parseDetailedTemplateRef(value: unknown): DetailedTemplateRef | null | undefined {
  if (value === undefined || value === null) return null
  if (!isRecord(value) || !hasOnlyKeys(value, ["templateId", "version", "fingerprint"])) return undefined
  const templateId = value["templateId"]
  const version = value["version"]
  const fingerprint = value["fingerprint"]
  return typeof templateId === "string" && TEMPLATE_ID_PATTERN.test(templateId)
    && typeof version === "string" && VERSION_PATTERN.test(version)
    && typeof fingerprint === "string" && FINGERPRINT_PATTERN.test(fingerprint)
    ? { templateId, version, fingerprint }
    : undefined
}

function localCivilDate(date: Date): string {
  const padded = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(date.getDate())}`
}

function parseTargetRaceDate(value: unknown): string | undefined | null {
  if (value === undefined) return undefined
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null
  return value > localCivilDate(new Date()) ? value : null
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  try {
    if (!isRecord(value)) return false
    const allowedKeys = new Set(allowed)
    return Reflect.ownKeys(value).every((key) => typeof key === "string" && allowedKeys.has(key))
  } catch {
    return false
  }
}

export function parsePlanGenerationRequest(input: unknown): ParsedPlanRequest {
  if (!isRecord(input) || input["kind"] !== "PLAN_BETA_GENERATION_REQUEST") {
    return reject("MALFORMED_INPUT")
  }
  if (!hasOnlyKeys(input, [
    "kind", "safetyGate", "profile", "requestedFrameLength", "selectedEnergyIntent",
    "selectedDetailedTemplateRef", "targetRaceDate", "journalSource", "selectionAuthority",
    "continuity", "formation",
  ])) return reject("MALFORMED_INPUT")

  const safetyGate = parseSafetyGate(input["safetyGate"])
  const profile = parseProfile(input["profile"])
  const journal = parseJournalSource(input["journalSource"])
  const selectionAuthority = parseSelectionAuthority(input["selectionAuthority"])
  const selectedEnergyIntent = parsePlannedEnergyIntent(input["selectedEnergyIntent"])
  const continuity = parseContinuityInput(input["continuity"])
  const selectedDetailedTemplateRef = parseDetailedTemplateRef(input["selectedDetailedTemplateRef"])
  const targetRaceDate = parseTargetRaceDate(input["targetRaceDate"])
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
    selectedEnergyIntent === undefined ||
    selectedDetailedTemplateRef === undefined ||
    targetRaceDate === null
  ) {
    return reject("MALFORMED_INPUT")
  }

  const formationValue = input["formation"]
  const legacyFrameValue = input["requestedFrameLength"]
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
  const requestedFrameLength = parseProjectionLength(legacyFrameValue)
  if (formation === undefined || requestedFrameLength === undefined) {
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
    requestedFrameLength,
    journalSource: journal.journalSource,
    selectionAuthority,
    selectedEnergyIntent,
    selectedDetailedTemplateRef,
    ...(targetRaceDate === undefined ? {} : { targetRaceDate }),
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
