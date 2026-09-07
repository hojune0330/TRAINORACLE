import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import { hasCanonicalJsonTree, planBetaStateV3Schema } from "./plan-beta-schema"
import type { PlanBetaIntake } from "./plan-beta-schema"
import { evaluatePlanSafety, selectPlanForActivation } from "./plan-beta-flow"
import type { PlanAthleteEvidence, PlanCurrentCheck } from "./plan-beta-flow"
import { planAnchorsStillCurrent } from "./plan-anchor-reconfirmation"
import { checkAdjustedPlanReviewPolicy, REVIEWED_ADJUSTED_PLAN_POLICIES } from "./adjusted-plan-review-policy"
import type { ReviewedAdjustedPlanPolicy } from "./adjusted-plan-review-policy"
import type { prepareAdjustedPlanCandidate } from "./adjusted-plan-candidate"
import { assembleAdjustedPlanSelection, adjustedPlanSelectionFingerprint as hash } from "./selected-adjusted-plan-content"
export { readSelectedAdjustedPlan } from "./selected-adjusted-plan-content"
export type { SelectedAdjustedPlanState, RetainedAdjustedPlanEvidence } from "./selected-adjusted-plan-content"

type Preparation = Parameters<typeof prepareAdjustedPlanCandidate>[0]
export type AdjustedPlanSelectionRequest = {
  readonly action: "USER_EXPLICIT"
  readonly preparation: Preparation
  readonly generated: PlanGenerationSuccess
  readonly gate: SafetyGateDecision
  readonly intake: PlanBetaIntake
  readonly athleteEvidence: PlanAthleteEvidence
  readonly currentCheck: PlanCurrentCheck
  readonly expectedCandidateFingerprint: string
}
const reject = (code: string) => ({ kind: "rejected" as const, code })

/** The owning UI/store calls this under its account/plan mutation lock. Source
 * authority and policies must come from trusted registries, never saved JSON.
 * Selection is not a write, an execution permit, or next-frame advancement.
 */
export function selectAdjustedPlanForActivation(
  request: AdjustedPlanSelectionRequest,
  policies: readonly ReviewedAdjustedPlanPolicy[] = REVIEWED_ADJUSTED_PLAN_POLICIES,
  evaluatedAt: Date = new Date(),
) {
  try {
    if (!hasCanonicalJsonTree(request) || !Number.isFinite(evaluatedAt.getTime())
        || request.action !== "USER_EXPLICIT" || Reflect.ownKeys(request).length !== 8
        || !Reflect.ownKeys(request).every(key => typeof key === "string" && ["action", "preparation", "generated",
          "gate", "intake", "athleteEvidence", "currentCheck", "expectedCandidateFingerprint"].includes(key))) {
      return reject("INVALID_ADJUSTED_SELECTION")
    }
    const input = structuredClone(request)
    const preparation = { ...input.preparation, source: { ...input.preparation.source, nowMs: evaluatedAt.getTime() } }
    const originals = input.generated.candidates.filter(candidate => candidate.candidateId === preparation.candidate.candidateId)
    if (originals.length !== 1 || hash(originals[0]) !== hash(preparation.candidate)) return reject("STALE_ORIGINAL_CANDIDATE")
    if (input.intake.trainingFocus !== preparation.candidate.selectedEnergyIntent) return reject("SELECTION_INTAKE_CHANGED")
    if (input.gate.kind !== "passed") return reject("SAFETY_GATE_RECHECK_BLOCKED")
    const safety = evaluatePlanSafety(input.currentCheck)
    if (safety.kind !== "passed") return reject(safety.code)
    if (!planAnchorsStillCurrent(preparation.candidate, evaluatedAt)) return reject("PACE_ANCHOR_RECONFIRMATION_REQUIRED")
    const intake = { ...input.intake, startDate: preparation.startDate }
    const base = selectPlanForActivation(preparation.candidate.candidateId, input.generated,
      safety.gate, intake, input.athleteEvidence, evaluatedAt)
    if (base.kind !== "selected") return base
    const parsed = planBetaStateV3Schema.safeParse(base.state)
    if (!parsed.success) return reject("INVALID_ORIGINAL_SELECTION")
    const review = checkAdjustedPlanReviewPolicy(preparation, intake.experienceBand, policies)
    if (review.kind !== "reviewed_scope") return reject(review.code)
    if (review.candidate.contentFingerprint !== input.expectedCandidateFingerprint) return reject("ADJUSTED_SELECTION_CHANGED")
    if (review.candidate.continuityContext.kind !== "NO_PREVIOUS_FRAME_CONTEXT") {
      return reject("ADJUSTED_SUCCESSOR_REQUIRES_CONTINUITY_TRANSACTION")
    }

    return assembleAdjustedPlanSelection(parsed.data, preparation, review, evaluatedAt)
  } catch { return reject("INVALID_ADJUSTED_SELECTION") }
}
