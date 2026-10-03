import { assertNever } from "../shared/assert-never"
import type {
  PaceAnchorRecord,
  PrescriptionErrorCode,
  StructuredPrescription,
} from "./types"

function hasPositiveNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0
}

function hasRequiredCoreFacts(anchor: PaceAnchorRecord): boolean {
  return anchor.anchorId.length > 0
    && anchor.sourceRef.length > 0
    && hasPositiveNumber(anchor.eventDistanceM)
    && hasPositiveNumber(anchor.performanceSeconds)
}

export function isExplicitGoalPaceTemplate(templateId: string, version: string, eventDistanceM: number): boolean {
  const events: Readonly<Record<string, number>> = { "MD-800-01": 800, "MD-1500-01": 1500, "MD-3000-01": 3000, "V2-SEED-05": 5000 }
  return version === "1.0.0" && events[templateId] === eventDistanceM
}

/** Separate aspirational lane; the current-capability validator below stays actual-only. */
export function validateGoalPaceAnchor(input: {
  readonly anchor: PaceAnchorRecord
  readonly targetEventDistanceM: number
}): PrescriptionErrorCode | undefined {
  if (input.targetEventDistanceM < 60) return "SPRINT_RACE_PACE_FORBIDDEN"
  if (!hasRequiredCoreFacts(input.anchor)) return "ANCHOR_INCOMPLETE"
  if (input.anchor.kind !== "GOAL" || input.anchor.purpose !== "ASPIRATIONAL_TARGET"
    || input.anchor.achievedAt !== null || input.anchor.seasonId !== null
    || input.anchor.freshnessState !== "UNKNOWN" || input.anchor.verificationState === "UNVERIFIED") return "ANCHOR_PROVENANCE_INCOMPLETE"
  return input.anchor.eventDistanceM === input.targetEventDistanceM ? undefined : "CROSS_EVENT_MODEL_REQUIRED"
}

function currentAnchorError(anchor: PaceAnchorRecord): PrescriptionErrorCode | undefined {
  if (!hasRequiredCoreFacts(anchor)) {
    return "ANCHOR_INCOMPLETE"
  }
  if (anchor.freshnessState !== "CURRENT") {
    return "ANCHOR_NOT_CURRENT"
  }

  switch (anchor.kind) {
    case "RECENT_RESULT":
      return anchor.achievedAt === null || anchor.purpose !== "CURRENT_CAPABILITY"
        ? "ANCHOR_PROVENANCE_INCOMPLETE"
        : undefined
    case "PB":
      return anchor.achievedAt === null || anchor.purpose !== "CURRENT_CAPABILITY"
        ? "ANCHOR_PROVENANCE_INCOMPLETE"
        : undefined
    case "SB":
      return anchor.achievedAt === null
        || anchor.seasonId === null
        || anchor.purpose !== "SEASON_CONTEXT"
        ? "ANCHOR_PROVENANCE_INCOMPLETE"
        : undefined
    case "GOAL":
      return "GOAL_ANCHOR_FORBIDDEN"
    case "COACH_REFERENCE":
      return anchor.purpose === "CURRENT_CAPABILITY" || anchor.purpose === "SEASON_CONTEXT"
        ? undefined
        : "ANCHOR_PROVENANCE_INCOMPLETE"
    case "RPE_ONLY":
      return "ANCHOR_INCOMPLETE"
    case "SPRINT_BENCHMARK":
      return "SPRINT_RACE_PACE_FORBIDDEN"
    default:
      return assertNever(anchor.kind)
  }
}

export function validateRacePaceAnchor(
  input: {
    readonly anchor: PaceAnchorRecord
    readonly targetEventDistanceM: number
  },
): PrescriptionErrorCode | undefined {
  if (input.targetEventDistanceM < 60) {
    return "SPRINT_RACE_PACE_FORBIDDEN"
  }
  const anchorError = currentAnchorError(input.anchor)
  if (anchorError !== undefined) {
    return anchorError
  }
  if (input.anchor.eventDistanceM !== input.targetEventDistanceM) {
    return "CROSS_EVENT_MODEL_REQUIRED"
  }
  return undefined
}

export function validatePrescriptionAnchorReference(
  input: {
    readonly prescription: StructuredPrescription
    readonly anchor: PaceAnchorRecord
  },
): PrescriptionErrorCode | undefined {
  if (input.prescription.paceAnchorRef !== input.anchor.anchorId) {
    return "ANCHOR_REFERENCE_MISMATCH"
  }
  return validateRacePaceAnchor({
    anchor: input.anchor,
    targetEventDistanceM: input.prescription.paceTargetEventDistanceM,
  })
}
