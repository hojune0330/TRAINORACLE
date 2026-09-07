import type React from "react"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree } from "../../domain/plan-beta-schema"
import type { PlanAdjustmentResolver } from "../PlanBeta"
import type { MultiAdjustedPlanEditFlowV3 } from "./MultiAdjustedPlanEditFlowV3"

export type MultiAdjustmentEditorEntryV3 = Pick<React.ComponentProps<typeof MultiAdjustedPlanEditFlowV3>,
  "seed" | "readReview" | "readReviewForEdits" | "orderedChoicesFor" | "locks">
export type PlanMultiAdjustmentResolverV3 = (context: Parameters<PlanAdjustmentResolver>[0]) => MultiAdjustmentEditorEntryV3 | null

export function matchingMultiAdjustmentEntryV3(resolver: PlanMultiAdjustmentResolverV3 | undefined,
  context: Parameters<PlanMultiAdjustmentResolverV3>[0]) {
  try {
    const entry = resolver?.(context)
    if (!entry || !hasCanonicalJsonTree(entry.seed) || entry.seed.preparations.length === 0) return null
    const candidate = context.generated.candidates.find(item => item.candidateId === context.candidateId)
    const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-adjustment-entry.v3", value)
    if (!candidate || hash(entry.seed.generated) !== hash(context.generated)
      || hash(entry.seed.intake) !== hash(context.intake) || hash(entry.seed.athleteEvidence) !== hash(context.athleteEvidence)
      || hash(entry.seed.gate) !== hash(context.gate) || entry.seed.currentCheck !== context.currentCheck
      || entry.seed.preparations.some(p => hash(p.candidate) !== hash(candidate) || p.startDate !== context.startDate)) return null
    return entry
  } catch { return null }
}
