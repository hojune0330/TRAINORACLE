import type { RveRuleEvaluatorSignal } from "../rve/signal"
import { assertNever } from "../shared/assert-never"

export type SafetyGateBlocked = {
  readonly kind: "blocked"
  readonly action: "BLOCK" | "BLOCK_OR_HUMAN_REVIEW"
  readonly planGenerationAllowed: false
  readonly requiredNextAction: "HUMAN_REVIEW" | "MORE_INFO_OR_HUMAN_REVIEW"
  readonly nonSensitiveReasonCodes: readonly string[]
  readonly audit: {
    readonly event: "PLAN_SAFETY_GATE_BLOCKED"
    readonly privacy: "REASON_CODES_ONLY"
  }
}

export type SafetyGatePassed = {
  readonly kind: "passed"
  readonly action: "CONTINUE_WITH_OTHER_GATES"
  readonly planGenerationAllowed: true
  readonly nonSensitiveReasonCodes: readonly string[]
  readonly audit: {
    readonly event: "PLAN_SAFETY_GATE_PASSED"
    readonly privacy: "REASON_CODES_ONLY"
  }
}

export type SafetyGateDecision = SafetyGateBlocked | SafetyGatePassed

export function decideSafetyGate(signal: RveRuleEvaluatorSignal): SafetyGateDecision {
  switch (signal.storedStatus) {
    case "ACTIVE":
      return {
        kind: "blocked",
        action: "BLOCK",
        planGenerationAllowed: false,
        requiredNextAction: "HUMAN_REVIEW",
        nonSensitiveReasonCodes: signal.nonSensitiveReasonCodes,
        audit: {
          event: "PLAN_SAFETY_GATE_BLOCKED",
          privacy: "REASON_CODES_ONLY",
        },
      }
    case "UNKNOWN":
      return {
        kind: "blocked",
        action: "BLOCK_OR_HUMAN_REVIEW",
        planGenerationAllowed: false,
        requiredNextAction: "MORE_INFO_OR_HUMAN_REVIEW",
        nonSensitiveReasonCodes: signal.nonSensitiveReasonCodes,
        audit: {
          event: "PLAN_SAFETY_GATE_BLOCKED",
          privacy: "REASON_CODES_ONLY",
        },
      }
    case "CLEARED":
      return {
        kind: "passed",
        action: "CONTINUE_WITH_OTHER_GATES",
        planGenerationAllowed: true,
        nonSensitiveReasonCodes: signal.nonSensitiveReasonCodes,
        audit: {
          event: "PLAN_SAFETY_GATE_PASSED",
          privacy: "REASON_CODES_ONLY",
        },
      }
    default:
      return assertNever(signal.storedStatus)
  }
}
