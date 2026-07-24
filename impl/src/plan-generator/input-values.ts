import type { SafetyGateDecision } from "../safety-gate/gate"
import type {
  ExperienceBand,
  JournalSource,
  PlanEventGroup,
  PlanProfile,
  PlanSelectionAuthority,
} from "./types"

export type ParsedJournalSource =
  | {
      readonly kind: "parsed"
      readonly journalSource: JournalSource
    }
  | {
      readonly kind: "invalid"
    }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseCodes(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const codes: string[] = []
  for (const code of value) {
    if (typeof code !== "string") {
      return undefined
    }
    codes.push(code)
  }
  return codes
}

export function parseSafetyGate(value: unknown): SafetyGateDecision | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const codes = parseCodes(value["nonSensitiveReasonCodes"])
  if (codes === undefined) {
    return undefined
  }

  switch (value["kind"]) {
    case "passed":
      if (value["planGenerationAllowed"] !== true) {
        return undefined
      }
      return {
        kind: "passed",
        action: "CONTINUE_WITH_OTHER_GATES",
        planGenerationAllowed: true,
        nonSensitiveReasonCodes: codes,
        audit: {
          event: "PLAN_SAFETY_GATE_PASSED",
          privacy: "REASON_CODES_ONLY",
        },
      }
    case "blocked":
      if (value["planGenerationAllowed"] !== false) {
        return undefined
      }
      switch (value["action"]) {
        case "BLOCK":
          return {
            kind: "blocked",
            action: "BLOCK",
            planGenerationAllowed: false,
            requiredNextAction: "HUMAN_REVIEW",
            nonSensitiveReasonCodes: codes,
            audit: {
              event: "PLAN_SAFETY_GATE_BLOCKED",
              privacy: "REASON_CODES_ONLY",
            },
          }
        case "BLOCK_OR_HUMAN_REVIEW":
          return {
            kind: "blocked",
            action: "BLOCK_OR_HUMAN_REVIEW",
            planGenerationAllowed: false,
            requiredNextAction: "MORE_INFO_OR_HUMAN_REVIEW",
            nonSensitiveReasonCodes: codes,
            audit: {
              event: "PLAN_SAFETY_GATE_BLOCKED",
              privacy: "REASON_CODES_ONLY",
            },
          }
        default:
          return undefined
      }
    default:
      return undefined
  }
}

function parseEventGroup(value: unknown): PlanEventGroup | undefined {
  switch (value) {
    case "MIDDLE_DISTANCE":
    case "FIVE_K":
    case "TEN_K":
    case "GENERAL_ENDURANCE":
      return value
    default:
      return undefined
  }
}

function parseExperienceBand(value: unknown): ExperienceBand | undefined {
  switch (value) {
    case "NEW_TO_RUNNING":
    case "DEVELOPING":
    case "EXPERIENCED":
      return value
    default:
      return undefined
  }
}

export function parseSelectionAuthority(value: unknown): PlanSelectionAuthority | undefined {
  switch (value) {
    case "SELF":
    case "COACH_REQUIRED":
      return value
    default:
      return undefined
  }
}

export function parseFrameLength(value: unknown): 7 | 9 | 10 | undefined {
  switch (value) {
    case 7:
    case 9:
    case 10:
      return value
    default:
      return undefined
  }
}

function parseTrainingDays(value: unknown): readonly number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const days: number[] = []
  for (const day of value) {
    if (!Number.isInteger(day) || days.includes(day)) {
      return undefined
    }
    days.push(day)
  }
  return Object.freeze([...days].sort((left, right) => left - right))
}

export function parseProfile(value: unknown): PlanProfile | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const eventGroup = parseEventGroup(value["eventGroup"])
  const experienceBand = parseExperienceBand(value["experienceBand"])
  const availableTrainingDays = parseTrainingDays(value["availableTrainingDays"])
  if (
    eventGroup === undefined ||
    experienceBand === undefined ||
    availableTrainingDays === undefined
  ) {
    return undefined
  }

  return {
    eventGroup,
    experienceBand,
    availableTrainingDays,
  }
}

export function parseJournalSource(value: unknown): ParsedJournalSource {
  if (!isRecord(value)) {
    return { kind: "invalid" }
  }

  switch (value["kind"]) {
    case "NO_USABLE_JOURNAL":
      return {
        kind: "parsed",
        journalSource: { kind: "NO_USABLE_JOURNAL" },
      }
    case "RECENT_JOURNAL_CONTEXT": {
      const eligibleSessionCount = value["eligibleSessionCount"]
      if (
        typeof eligibleSessionCount !== "number" ||
        !Number.isInteger(eligibleSessionCount) ||
        eligibleSessionCount < 2 ||
        eligibleSessionCount > 28
      ) {
        return { kind: "invalid" }
      }
      return {
        kind: "parsed",
        journalSource: {
          kind: "RECENT_JOURNAL_CONTEXT",
          eligibleSessionCount,
        },
      }
    }
    default:
      return { kind: "invalid" }
  }
}
