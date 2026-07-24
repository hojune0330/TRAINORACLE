import type { SafetyGatePassed } from "../safety-gate/gate"
import { assertNever } from "../shared/assert-never"
import { createDeterministicCandidates } from "./candidates"
import { parsePlanGenerationRequest } from "./parser"
import type {
  PlanBetaAudit,
  PlanBetaCode,
  PlanGenerationRequest,
  PlanGenerationResult,
  PlanSourceMode,
} from "./types"

export { recordPlanProgress } from "./progress"
export { selectPlanCandidate } from "./selection"

export type PlanDraft = {
  readonly kind: "plan_draft"
  readonly source: "BETA_PLAN_ENGINE"
}

function audit(
  event: PlanBetaAudit["event"],
  codes: readonly PlanBetaCode[],
): PlanBetaAudit {
  return Object.freeze({
    event,
    codes: Object.freeze([...codes]),
    privacy: "STRUCTURED_CODES_ONLY",
  })
}

function noCandidates(): readonly [] {
  const candidates: [] = []
  return Object.freeze(candidates)
}

function sourceModeFor(request: PlanGenerationRequest): PlanSourceMode {
  switch (request.journalSource.kind) {
    case "NO_USABLE_JOURNAL":
      return "PROFILE_ONLY"
    case "RECENT_JOURNAL_CONTEXT":
      return "JOURNAL_CONTEXT_ONLY"
    default:
      return assertNever(request.journalSource)
  }
}

function generatedResult(request: PlanGenerationRequest): PlanGenerationResult {
  return {
    kind: "generated",
    sourceMode: sourceModeFor(request),
    confidence: "LIMITED",
    selectionAuthority: request.selectionAuthority,
    candidates: createDeterministicCandidates(request),
    audit: audit("PLAN_BETA_GENERATED", ["BETA_DURATION_RPE_ONLY"]),
  }
}

function blockedResult(code: "SAFETY_GATE_ACTIVE" | "SAFETY_GATE_UNKNOWN"): PlanGenerationResult {
  return {
    kind: "blocked",
    code,
    candidates: noCandidates(),
    audit: audit("PLAN_BETA_BLOCKED", [code]),
  }
}

function rejectedResult(
  code:
    | "MALFORMED_INPUT"
    | "UNSUPPORTED_FRAME_LENGTH"
    | "INSUFFICIENT_AVAILABLE_DAYS"
    | "INVALID_AVAILABLE_DAY"
    | "INVALID_JOURNAL_CONTEXT"
    | "INVALID_CONTINUITY_CONTEXT",
): PlanGenerationResult {
  return {
    kind: "rejected",
    code,
    candidates: noCandidates(),
    audit: audit("PLAN_BETA_REJECTED", [code]),
  }
}

export function generatePlanCandidates(input: unknown): PlanGenerationResult {
  const parsed = parsePlanGenerationRequest(input)
  switch (parsed.kind) {
    case "rejected":
      return rejectedResult(parsed.code)
    case "parsed":
      switch (parsed.request.safetyGate.kind) {
        case "passed":
          return generatedResult(parsed.request)
        case "blocked":
          {
            const safetyAction = parsed.request.safetyGate.action
            switch (safetyAction) {
            case "BLOCK":
              return blockedResult("SAFETY_GATE_ACTIVE")
            case "BLOCK_OR_HUMAN_REVIEW":
              return blockedResult("SAFETY_GATE_UNKNOWN")
            default:
              return assertNever(safetyAction)
            }
          }
        default:
          return assertNever(parsed.request.safetyGate)
      }
    default:
      return assertNever(parsed)
  }
}

export function createPlanDraft(_gate: SafetyGatePassed): PlanDraft {
  return Object.freeze({
    kind: "plan_draft",
    source: "BETA_PLAN_ENGINE",
  })
}
