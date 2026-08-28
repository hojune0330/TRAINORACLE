import type { SafetyGateDecision } from "../safety-gate/gate"
import { RVE_NON_SENSITIVE_REASON_CODES } from "../rve/signal"
import type {
  ExperienceBand,
  JournalSource,
  PlanEventGroup,
  PlanProfile,
  PlanSelectionAuthority,
  PlannedEnergyIntent,
  SecondSessionMode,
  TrainingTimePreference,
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
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return false
    return Reflect.ownKeys(value).every((key) => {
      if (typeof key !== "string") return false
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return descriptor !== undefined && "value" in descriptor
    })
  } catch {
    return false
  }
}

const SAFETY_REASON_CODES: ReadonlySet<string> = new Set(RVE_NON_SENSITIVE_REASON_CODES)

function hasExactDataKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  try {
    if (!isRecord(value)) return false
    const ownKeys = Reflect.ownKeys(value)
    return ownKeys.length === keys.length
      && ownKeys.every((key) => typeof key === "string" && keys.includes(key))
  } catch {
    return false
  }
}

function parseCodes(value: unknown): readonly string[] | undefined {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return undefined
    }
    const ownKeys = Reflect.ownKeys(value)
    if (ownKeys.some((key) => typeof key !== "string" || (key !== "length" && !/^(?:0|[1-9]\d*)$/u.test(key)))
        || Object.keys(value).length !== value.length
        || !value.every((code) => typeof code === "string" && SAFETY_REASON_CODES.has(code))) {
      return undefined
    }
    return Object.freeze([...value])
  } catch {
    return undefined
  }
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
      if (!hasExactDataKeys(value, ["kind", "action", "planGenerationAllowed", "nonSensitiveReasonCodes", "audit"])
          || value["action"] !== "CONTINUE_WITH_OTHER_GATES"
          || value["planGenerationAllowed"] !== true
          || !isRecord(value["audit"])
          || !hasExactDataKeys(value["audit"], ["event", "privacy"])
          || value["audit"]["event"] !== "PLAN_SAFETY_GATE_PASSED"
          || value["audit"]["privacy"] !== "REASON_CODES_ONLY") {
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
      if (!hasExactDataKeys(value, ["kind", "action", "planGenerationAllowed", "requiredNextAction", "nonSensitiveReasonCodes", "audit"])
          || value["planGenerationAllowed"] !== false
          || !isRecord(value["audit"])
          || !hasExactDataKeys(value["audit"], ["event", "privacy"])
          || value["audit"]["event"] !== "PLAN_SAFETY_GATE_BLOCKED"
          || value["audit"]["privacy"] !== "REASON_CODES_ONLY") {
        return undefined
      }
      switch (value["action"]) {
        case "BLOCK":
          if (value["requiredNextAction"] !== "HUMAN_REVIEW") return undefined
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
          if (value["requiredNextAction"] !== "MORE_INFO_OR_HUMAN_REVIEW") return undefined
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

export function parsePlannedEnergyIntent(
  value: unknown,
): PlannedEnergyIntent | undefined {
  switch (value) {
    case "RECOVERY_INTENT":
    case "BASE_INTENT":
    case "LT_INTENT":
    case "VO2_INTENT":
    case "GLY_INTENT":
    case "ATP_PC_INTENT":
    case "MIXED_INTENT":
      return value
    default:
      return undefined
  }
}

function parseTrainingDays(value: unknown): readonly number[] | undefined {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return undefined
    }
    const ownKeys = Reflect.ownKeys(value)
    if (ownKeys.some((key) => typeof key !== "string" || (key !== "length" && !/^(?:0|[1-9]\d*)$/u.test(key)))
        || Object.keys(value).length !== value.length) {
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
  } catch {
    return undefined
  }
}

function parseSecondSessionMode(value: unknown): SecondSessionMode | undefined {
  if (value === undefined) return "SINGLE_SESSION_ONLY"
  switch (value) {
    case "SINGLE_SESSION_ONLY":
      return "SINGLE_SESSION_ONLY"
    case "RECOVERY_PM_ALLOWED":
      return "RECOVERY_PM_ALLOWED"
    default:
      return undefined
  }
}

function parseTrainingTimePreference(value: unknown): TrainingTimePreference | undefined {
  if (value === undefined) return "VARIES"
  switch (value) {
    case "MORNING":
      return "MORNING"
    case "EVENING":
      return "EVENING"
    case "VARIES":
      return "VARIES"
    default:
      return undefined
  }
}

export function parseProfile(value: unknown): PlanProfile | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const allowedKeys = new Set([
    "eventGroup", "eventDistanceM", "experienceBand", "availableTrainingDays",
    "secondSessionMode", "trainingTimePreference",
  ])
  if (!Reflect.ownKeys(value).every((key) => typeof key === "string" && allowedKeys.has(key))) {
    return undefined
  }

  const eventGroup = parseEventGroup(value["eventGroup"])
  const rawEventDistanceM = value["eventDistanceM"]
  const eventDistanceM = parseSupportedEventDistance(rawEventDistanceM)
  const experienceBand = parseExperienceBand(value["experienceBand"])
  const availableTrainingDays = parseTrainingDays(value["availableTrainingDays"])
  const secondSessionMode = parseSecondSessionMode(value["secondSessionMode"])
  const trainingTimePreference = parseTrainingTimePreference(value["trainingTimePreference"])
  if (
    eventGroup === undefined ||
    eventDistanceM === undefined ||
    !eventDistanceMatchesGroup(eventDistanceM, eventGroup) ||
    experienceBand === undefined ||
    availableTrainingDays === undefined ||
    secondSessionMode === undefined ||
    trainingTimePreference === undefined
  ) {
    return undefined
  }

  return {
    eventGroup,
    eventDistanceM,
    experienceBand,
    availableTrainingDays,
    secondSessionMode,
    trainingTimePreference,
  }
}

function parseSupportedEventDistance(value: unknown): 800 | 1500 | 3000 | 5000 | 10000 | 21097 | 42195 | undefined {
  return value === 800 || value === 1500 || value === 3000 || value === 5000
    || value === 10000 || value === 21097 || value === 42195
    ? value
    : undefined
}

function eventDistanceMatchesGroup(
  distance: 800 | 1500 | 3000 | 5000 | 10000 | 21097 | 42195,
  eventGroup: PlanEventGroup,
): boolean {
  return eventGroup === "FIVE_K" ? distance === 5000
    : eventGroup === "TEN_K" ? distance === 10000
      : eventGroup === "GENERAL_ENDURANCE" ? distance === 21097 || distance === 42195
        : eventGroup === "MIDDLE_DISTANCE" && (distance === 800 || distance === 1500 || distance === 3000)
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
