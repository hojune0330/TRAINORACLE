import type { D9Disposition, D9Result } from "../d9/evaluator"
import { assertNever } from "../shared/assert-never"

export type RveStoredStatus = "ACTIVE" | "UNKNOWN" | "CLEARED"

export type EvaluatorFailureKind = "timeout" | "exception" | "stale_version"

export type RveRuleEvaluatorSignal = {
  readonly ruleRef: "RULE_SPEC_D1_D9.D-9"
  readonly storedStatus: RveStoredStatus
  readonly blocksPlanGeneration: boolean
  readonly requiresHumanReview: boolean
  readonly nonSensitiveReasonCodes: readonly string[]
  readonly audit: {
    readonly event: "RVE_SIGNAL_CREATED"
    readonly privacy: "REASON_CODES_ONLY"
  }
}

const D9_RESULT_KEYS = [
  "disposition",
  "blocksPlanGeneration",
  "reasonCodes",
  "evidence",
] as const
const D9_EVIDENCE_KEYS = [
  "ruleId",
  "family",
  "route",
  "reasonCode",
  "clauseIndex",
  "clause",
  "matchedBy",
] as const

const ACTIVE_REASON_CODES: ReadonlySet<string> = new Set([
  "D9_ACTIVE_ACUTE_INJURY_OR_FUNCTIONAL_LIMITATION",
  "D9_ACTIVE_MANUAL_OR_MEDICAL_HOLD",
  "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM",
  "D9_ACTIVE_RETURN_TO_PLAY_NOT_CLEARED",
])
const UNKNOWN_REASON_CODES: ReadonlySet<string> = new Set([
  "D9_UNKNOWN_ACUTE_BODYPART_INSUFFICIENT_CONTEXT",
  "D9_UNKNOWN_AMBIGUOUS_CONCERN_STANDALONE",
  "D9_UNKNOWN_ATHLETE_REQUESTS_PERMISSION_WITH_SYMPTOM",
  "D9_UNKNOWN_BODYPART_PAIN_INSUFFICIENT_CONTEXT",
  "D9_UNKNOWN_LOCAL_INFLAMMATION_SIGN",
  "D9_UNKNOWN_MILD_SYMPTOM_WORSENING",
  "D9_UNKNOWN_PAIN_WORSENING",
  "D9_UNKNOWN_RESPIRATORY_ILLNESS_CONTEXT",
  "D9_UNKNOWN_RISK_MASKING_WITH_SYMPTOM",
])
const ADVISORY_REASON_CODES: ReadonlySet<string> = new Set([
  "D9_ADVISORY_MILD_BODYPART_DISCOMFORT",
  "D9_ADVISORY_UNLOCALIZED_DISCOMFORT",
])
const CLEARED_REASON_CODES: ReadonlySet<string> = new Set([
  "D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL",
  "D9_COLLOQUIAL_NO_TEXT",
])
const CLEARED_ADVISORY_CODE = "D9_CLEARED_WITH_NON_BLOCKING_ADVISORY"

const EVIDENCE_REASON_CODES: Readonly<
  Record<D9Result["evidence"][number]["route"], ReadonlySet<string>>
> = {
  ACTIVE: ACTIVE_REASON_CODES,
  UNKNOWN: UNKNOWN_REASON_CODES,
  ADVISORY: ADVISORY_REASON_CODES,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isD9Disposition(value: unknown): value is D9Disposition {
  return value === "D9_ACTIVE" || value === "D9_UNKNOWN" || value === "D9_CLEARED"
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && item.length > 0)
}

function isD9Evidence(value: unknown): value is D9Result["evidence"][number] {
  if (!isRecord(value) || !hasOnlyKeys(value, D9_EVIDENCE_KEYS)) return false

  const route = value["route"]
  const clauseIndex = value["clauseIndex"]
  return typeof value["ruleId"] === "string"
    && typeof value["family"] === "string"
    && (route === "ACTIVE" || route === "UNKNOWN" || route === "ADVISORY")
    && typeof value["reasonCode"] === "string"
    && typeof clauseIndex === "number"
    && Number.isInteger(clauseIndex)
    && clauseIndex >= 0
    && typeof value["clause"] === "string"
    && isNonEmptyStringArray(value["matchedBy"])
}

function isD9ResultShape(value: unknown): value is D9Result {
  if (!isRecord(value) || !hasOnlyKeys(value, D9_RESULT_KEYS)) return false

  const disposition = value["disposition"]
  const blocksPlanGeneration = value["blocksPlanGeneration"]
  return isD9Disposition(disposition)
    && typeof blocksPlanGeneration === "boolean"
    && blocksPlanGeneration === (disposition !== "D9_CLEARED")
    && isNonEmptyStringArray(value["reasonCodes"])
    && Array.isArray(value["evidence"])
    && value["evidence"].every(isD9Evidence)
}

function hasAllowedResultReasonCodes(result: D9Result): boolean {
  switch (result.disposition) {
    case "D9_ACTIVE":
      return result.reasonCodes.every((code) => ACTIVE_REASON_CODES.has(code))
    case "D9_UNKNOWN":
      return result.reasonCodes.every((code) => UNKNOWN_REASON_CODES.has(code))
    case "D9_CLEARED": {
      const [firstCode, ...rest] = result.reasonCodes
      if (firstCode === undefined) return false
      if (CLEARED_REASON_CODES.has(firstCode)) return rest.length === 0
      return firstCode === CLEARED_ADVISORY_CODE
        && rest.length > 0
        && rest.every((code) => ADVISORY_REASON_CODES.has(code))
    }
    default:
      return assertNever(result.disposition)
  }
}

function isEvidenceCompatible(
  disposition: D9Disposition,
  route: D9Result["evidence"][number]["route"],
): boolean {
  switch (disposition) {
    case "D9_ACTIVE":
      return true
    case "D9_UNKNOWN":
      return route !== "ACTIVE"
    case "D9_CLEARED":
      return route === "ADVISORY"
    default:
      return assertNever(disposition)
  }
}

function isTrustedD9Result(value: unknown): value is D9Result {
  return isD9ResultShape(value)
    && hasAllowedResultReasonCodes(value)
    && value.evidence.every((evidence) =>
      EVIDENCE_REASON_CODES[evidence.route].has(evidence.reasonCode)
      && isEvidenceCompatible(value.disposition, evidence.route))
}

export function mapD9ResultToRveSignal(result: unknown): RveRuleEvaluatorSignal {
  try {
    if (!isTrustedD9Result(result)) {
      return createRveSignal("UNKNOWN", true, true, ["RVE_D9_INVALID_INPUT_SHAPE"])
    }

    switch (result.disposition) {
      case "D9_ACTIVE":
        return createRveSignal("ACTIVE", true, true, result.reasonCodes)
      case "D9_UNKNOWN":
        return createRveSignal("UNKNOWN", true, true, result.reasonCodes)
      case "D9_CLEARED":
        return createRveSignal("CLEARED", false, false, result.reasonCodes)
      default:
        return assertNever(result.disposition)
    }
  } catch {
    return createRveSignal("UNKNOWN", true, true, ["RVE_D9_INVALID_INPUT_SHAPE"])
  }
}

export function createEvaluatorFailureSignal(
  failure: EvaluatorFailureKind,
): RveRuleEvaluatorSignal {
  switch (failure) {
    case "timeout":
      return createRveSignal("UNKNOWN", true, true, ["RVE_D9_EVALUATOR_TIMEOUT"])
    case "exception":
      return createRveSignal("UNKNOWN", true, true, ["RVE_D9_EVALUATOR_EXCEPTION"])
    case "stale_version":
      return createRveSignal("UNKNOWN", true, true, ["RVE_D9_EVALUATOR_VERSION_STALE"])
    default:
      return assertNever(failure)
  }
}

function createRveSignal(
  storedStatus: RveStoredStatus,
  blocksPlanGeneration: boolean,
  requiresHumanReview: boolean,
  nonSensitiveReasonCodes: readonly string[],
): RveRuleEvaluatorSignal {
  return {
    ruleRef: "RULE_SPEC_D1_D9.D-9",
    storedStatus,
    blocksPlanGeneration,
    requiresHumanReview,
    nonSensitiveReasonCodes,
    audit: {
      event: "RVE_SIGNAL_CREATED",
      privacy: "REASON_CODES_ONLY",
    },
  }
}
