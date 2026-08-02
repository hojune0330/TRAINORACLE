import type { SafetyGatePassed } from "../safety-gate/gate"
import { assertNever } from "../shared/assert-never"
import { createDeterministicCandidates } from "./candidates"
import { compileExposureLedger } from "./exposure-ledger"
import { parsePlanGenerationRequest } from "./parser"
import type { SelectableExposureLedger } from "./candidates"
import type {
  CanonicalPlanGenerationRequest,
  PlanBetaAudit,
  PlanBetaCode,
  PlanGenerationResult,
  PlanReviewReasonCode,
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

function reviewResult(
  request: CanonicalPlanGenerationRequest | undefined,
  reasonCodes: readonly PlanReviewReasonCode[],
): PlanGenerationResult {
  return {
    kind: "needs_review_with_reason",
    status: "NEEDS_REVIEW_WITH_REASON",
    reasonCodes: Object.freeze([...reasonCodes]),
    conservativeAlternative: "KEEP_CURRENT_PLAN_AND_RECOVERY_GUIDANCE",
    reviewNotice: "현재 입력으로는 후보를 만들지 않고, 기존 계획 유지와 회복 안내만 제공합니다.",
    candidates: noCandidates(),
    audit: audit("PLAN_BETA_REVIEW_REQUIRED", request === undefined
      ? reasonCodes
      : [...reasonCodes, "BETA_DURATION_RPE_ONLY"]),
  }
}

function generatedResult(
  request: CanonicalPlanGenerationRequest,
  ledger: SelectableExposureLedger,
): PlanGenerationResult {
  return {
    kind: "generated",
    sourceMode: request.journalSource.kind === "NO_USABLE_JOURNAL"
      ? "PROFILE_ONLY"
      : "JOURNAL_CONTEXT_ONLY",
    selectedEnergyIntent: request.selectedEnergyIntent,
    confidence: "LIMITED",
    selectionAuthority: request.selectionAuthority,
    candidates: createDeterministicCandidates(request, ledger),
    audit: audit("PLAN_BETA_GENERATED", ["BETA_DURATION_RPE_ONLY"]),
  }
}

function hasSelectableMainExposureCount(
  ledger: Extract<ReturnType<typeof compileExposureLedger>, { readonly kind: "valid" }>,
): ledger is SelectableExposureLedger {
  return ledger.mainExposureCount === 2 || ledger.mainExposureCount === 3
}

function mainExposureDaysAreAvailable(request: CanonicalPlanGenerationRequest, countedExposureIds: readonly string[]): boolean {
  const availableDays = new Set(request.profile.availableTrainingDays)
  const byExposureId = new Map(request.formation.exposures.map((exposure) => [exposure.exposureId, exposure] as const))
  const firstSlotForDay = new Map<string, number>()
  for (const slot of request.formation.slots) {
    if (!firstSlotForDay.has(slot.localDayKey)) {
      firstSlotForDay.set(slot.localDayKey, slot.slotIndex)
    }
  }

  return countedExposureIds.every((exposureId) => {
    const localDayKey = byExposureId.get(exposureId)?.localDayKey
    const slotIndex = localDayKey === undefined ? undefined : firstSlotForDay.get(localDayKey)
    return slotIndex !== undefined && availableDays.has(Math.floor(slotIndex / 2) + 1)
  })
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
    case "review":
      return reviewResult(undefined, [parsed.code])
    case "parsed":
      switch (parsed.request.safetyGate.kind) {
        case "passed": {
          const ledger = compileExposureLedger(parsed.request.formation)
          if (ledger.kind === "needs_review") {
            return reviewResult(parsed.request, ledger.reasonCodes)
          }
          if (!hasSelectableMainExposureCount(ledger)) {
            return reviewResult(parsed.request, ["MAIN_EXPOSURE_COUNT_REQUIRES_REVIEW"])
          }
          if (!mainExposureDaysAreAvailable(parsed.request, ledger.countedExposureIds)) {
            return reviewResult(parsed.request, ["MAIN_EXPOSURE_OUTSIDE_AVAILABILITY_REQUIRES_REVIEW"])
          }
          return generatedResult(parsed.request, ledger)
        }
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
