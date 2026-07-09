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

export function mapD9ResultToRveSignal(result: D9Result): RveRuleEvaluatorSignal {
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
