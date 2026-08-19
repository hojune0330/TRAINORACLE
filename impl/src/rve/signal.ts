import type { D9Disposition, D9Result } from "../d9/evaluator"
import { assertNever } from "../shared/assert-never"

declare const structuredClone: <T>(value: T) => T

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

const ACTIVE_REASON_CODE_VALUES = [
  "D9_ACTIVE_ACUTE_INJURY_OR_FUNCTIONAL_LIMITATION",
  "D9_ACTIVE_MANUAL_OR_MEDICAL_HOLD",
  "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM",
  "D9_ACTIVE_RETURN_TO_PLAY_NOT_CLEARED",
] as const
const UNKNOWN_REASON_CODE_VALUES = [
  "D9_UNKNOWN_ACUTE_BODYPART_INSUFFICIENT_CONTEXT",
  "D9_UNKNOWN_AMBIGUOUS_CONCERN_STANDALONE",
  "D9_UNKNOWN_ATHLETE_REQUESTS_PERMISSION_WITH_SYMPTOM",
  "D9_UNKNOWN_BODYPART_PAIN_INSUFFICIENT_CONTEXT",
  "D9_UNKNOWN_LOCAL_INFLAMMATION_SIGN",
  "D9_UNKNOWN_MILD_SYMPTOM_WORSENING",
  "D9_UNKNOWN_PAIN_WORSENING",
  "D9_UNKNOWN_RESPIRATORY_ILLNESS_CONTEXT",
  "D9_UNKNOWN_RISK_MASKING_WITH_SYMPTOM",
] as const
const ADVISORY_REASON_CODE_VALUES = [
  "D9_ADVISORY_MILD_BODYPART_DISCOMFORT",
  "D9_ADVISORY_UNLOCALIZED_DISCOMFORT",
] as const
const CLEARED_REASON_CODE_VALUES = [
  "D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL",
  "D9_COLLOQUIAL_NO_TEXT",
] as const
const CLEARED_ADVISORY_CODE = "D9_CLEARED_WITH_NON_BLOCKING_ADVISORY"
const RVE_FAILURE_REASON_CODE_VALUES = [
  "RVE_D9_INVALID_INPUT_SHAPE",
  "RVE_D9_EVALUATOR_TIMEOUT",
  "RVE_D9_EVALUATOR_EXCEPTION",
  "RVE_D9_EVALUATOR_VERSION_STALE",
] as const

export const RVE_NON_SENSITIVE_REASON_CODES = [
  ...ACTIVE_REASON_CODE_VALUES,
  ...UNKNOWN_REASON_CODE_VALUES,
  ...ADVISORY_REASON_CODE_VALUES,
  ...CLEARED_REASON_CODE_VALUES,
  CLEARED_ADVISORY_CODE,
  ...RVE_FAILURE_REASON_CODE_VALUES,
] as const

const ACTIVE_REASON_CODES: ReadonlySet<string> = new Set(ACTIVE_REASON_CODE_VALUES)
const UNKNOWN_REASON_CODES: ReadonlySet<string> = new Set(UNKNOWN_REASON_CODE_VALUES)
const ADVISORY_REASON_CODES: ReadonlySet<string> = new Set(ADVISORY_REASON_CODE_VALUES)
const CLEARED_REASON_CODES: ReadonlySet<string> = new Set(CLEARED_REASON_CODE_VALUES)

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

function hasOnlyDataProperties(value: Record<string, unknown>, keys: readonly string[]): boolean {
  if (Object.getPrototypeOf(value) !== Object.prototype) return false

  const ownKeys = Reflect.ownKeys(value)
  return ownKeys.length === keys.length
    && ownKeys.every((key) => typeof key === "string" && keys.includes(key))
    && keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return descriptor !== undefined
        && "value" in descriptor
        && descriptor.enumerable
    })
}

function isDensePlainArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length")
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor)
    || typeof lengthDescriptor.value !== "number" || Reflect.ownKeys(value).length !== lengthDescriptor.value + 1) return false

  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      return false
    }
  }
  return true
}

function isD9Disposition(value: unknown): value is D9Disposition {
  return value === "D9_ACTIVE" || value === "D9_UNKNOWN" || value === "D9_CLEARED"
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return isDensePlainArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && item.length > 0)
}

function isD9Evidence(value: unknown): value is D9Result["evidence"][number] {
  if (!isRecord(value) || !hasOnlyDataProperties(value, D9_EVIDENCE_KEYS)) return false

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
  if (!isRecord(value) || !hasOnlyDataProperties(value, D9_RESULT_KEYS)) return false

  const disposition = value["disposition"]
  const blocksPlanGeneration = value["blocksPlanGeneration"]
  const evidence = value["evidence"]
  return isD9Disposition(disposition)
    && typeof blocksPlanGeneration === "boolean"
    && blocksPlanGeneration === (disposition !== "D9_CLEARED")
    && isNonEmptyStringArray(value["reasonCodes"])
    && isDensePlainArray(evidence)
    && evidence.every(isD9Evidence)
}

function reasonCodesMatch(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return actual.length === expected.length
    && actual.every((code, index) => code === expected[index])
}

function hasCanonicalResultCorrespondence(result: D9Result): boolean {
  let evidenceRoute: "ACTIVE" | "UNKNOWN"

  switch (result.disposition) {
    case "D9_ACTIVE":
      evidenceRoute = "ACTIVE"
      break
    case "D9_UNKNOWN":
      evidenceRoute = "UNKNOWN"
      break
    case "D9_CLEARED": {
      if (result.evidence.length === 0) {
        const [reasonCode] = result.reasonCodes
        return result.reasonCodes.length === 1
          && reasonCode !== undefined
          && CLEARED_REASON_CODES.has(reasonCode)
      }
      return reasonCodesMatch(result.reasonCodes, [
        CLEARED_ADVISORY_CODE,
        ...new Set(result.evidence.map((evidence) => evidence.reasonCode)),
      ])
    }
    default:
      return assertNever(result.disposition)
  }

  return reasonCodesMatch(result.reasonCodes, [
    ...new Set(
      result.evidence
        .filter((evidence) => evidence.route === evidenceRoute)
        .map((evidence) => evidence.reasonCode),
    ),
  ])
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
    && value.evidence.every((evidence) =>
      EVIDENCE_REASON_CODES[evidence.route].has(evidence.reasonCode)
      && isEvidenceCompatible(value.disposition, evidence.route))
    && hasCanonicalResultCorrespondence(value)
}

function freezeD9Result(result: D9Result): void {
  Object.freeze(result.reasonCodes)
  for (const evidence of result.evidence) {
    Object.freeze(evidence.matchedBy)
    Object.freeze(evidence)
  }
  Object.freeze(result.evidence)
  Object.freeze(result)
}

export function mapD9ResultToRveSignal(result: unknown): RveRuleEvaluatorSignal {
  try {
    if (!isTrustedD9Result(result)) {
      return createRveSignal("UNKNOWN", true, true, ["RVE_D9_INVALID_INPUT_SHAPE"])
    }

    const snapshot = structuredClone(result)
    freezeD9Result(snapshot)

    switch (snapshot.disposition) {
      case "D9_ACTIVE":
        return createRveSignal("ACTIVE", true, true, snapshot.reasonCodes)
      case "D9_UNKNOWN":
        return createRveSignal("UNKNOWN", true, true, snapshot.reasonCodes)
      case "D9_CLEARED":
        return createRveSignal("CLEARED", false, false, snapshot.reasonCodes)
      default:
        return assertNever(snapshot.disposition)
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
