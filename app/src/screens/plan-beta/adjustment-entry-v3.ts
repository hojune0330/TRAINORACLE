import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree } from "../../domain/plan-beta-schema"
import type { PlanAdjustmentResolver } from "../PlanBeta"
import type { AdjustedPlanSelectionRequestV3 } from "../../domain/selected-adjusted-plan-v3"
import type { AdjustedPlanLiveReviewV3 } from "../../domain/adjusted-plan-storage-v5"
import type { PlanMutationLockManager } from "../../domain/plan-mutation-lock"

export type AdjustmentEntryV3 = {
  readonly seed: AdjustedPlanSelectionRequestV3
  readonly readReview: () => AdjustedPlanLiveReviewV3
  readonly locks?: PlanMutationLockManager | null
}
export type PlanAdjustmentResolverV3 = (context: Parameters<PlanAdjustmentResolver>[0]) => AdjustmentEntryV3 | null

export function matchingAdjustmentEntryV3(resolver: PlanAdjustmentResolverV3 | undefined,
  context: Parameters<PlanAdjustmentResolverV3>[0]) {
  try {
    const entry = resolver?.(context)
    if (!entry || !hasCanonicalJsonTree(entry.seed)) return null
    const candidate = context.generated.candidates.find(item => item.candidateId === context.candidateId)
    const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjustment-entry.v3", value)
    if (!candidate || hash(entry.seed.generated) !== hash(context.generated)
      || hash(entry.seed.preparation.candidate) !== hash(candidate) || hash(entry.seed.intake) !== hash(context.intake)
      || hash(entry.seed.athleteEvidence) !== hash(context.athleteEvidence) || hash(entry.seed.gate) !== hash(context.gate)
      || entry.seed.currentCheck !== context.currentCheck || entry.seed.preparation.startDate !== context.startDate) return null
    return entry
  } catch { return null }
}
