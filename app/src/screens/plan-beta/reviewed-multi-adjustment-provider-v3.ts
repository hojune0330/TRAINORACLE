import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { checkMultiAdjustedPlanReviewV3 } from "../../domain/adjusted-plan-multi-review-v3"
import { hasCanonicalJsonTree } from "../../domain/plan-beta-schema"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "../../domain/account/local-account-scope"
import type { MultiAdjustedLiveReviewV3 } from "../../domain/adjusted-plan-storage-v6"
import type { AddressedAdjustmentV3 } from "../../domain/stage-multi-adjustment-v3"
import type { PlanMutationLockManager } from "../../domain/plan-mutation-lock"
import type { PlanMultiAdjustmentResolverV3, MultiAdjustmentEditorEntryV3 } from "./multi-adjustment-entry-v3"

type Context = Parameters<PlanMultiAdjustmentResolverV3>[0]
export type CurrentMultiMaterialsReaderV3 = (context: Context, changes: readonly AddressedAdjustmentV3[], at: Date) => MultiAdjustedLiveReviewV3 | null
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-provider.v3", value)

/** Adapts current reviewed material to the editor. It never constructs approval policies. */
export function createReviewedMultiAdjustmentProviderV3(options: {
  readonly readMaterials: CurrentMultiMaterialsReaderV3;
  readonly locks?: PlanMutationLockManager | null;
  readonly orderedChoicesFor?: MultiAdjustmentEditorEntryV3["orderedChoicesFor"];
  readonly now?: () => Date;
}): PlanMultiAdjustmentResolverV3 {
  return requested => {
    try {
      if (!hasCanonicalJsonTree(requested)) return null
      const context = structuredClone(requested), opening = hash(context), account = localAccountScopeSnapshot()
      const candidate = context.generated.candidates.find(c => c.candidateId === context.candidateId)
      if (!candidate) return null
      const read = (changes: readonly AddressedAdjustmentV3[]) => {
        if (!localAccountScopeIsCurrent(account) || hash(requested) !== opening || !hasCanonicalJsonTree(changes)) throw Error("STALE_MULTI_PROVIDER")
        const at = options.now?.() ?? new Date()
        if (!Number.isFinite(at.getTime())) throw Error("INVALID_MULTI_PROVIDER_TIME")
        const material = options.readMaterials(structuredClone(context), structuredClone(changes), at)
        if (!material || !hasCanonicalJsonTree(material) || !localAccountScopeIsCurrent(account)) throw Error("CURRENT_MULTI_MATERIALS_UNAVAILABLE")
        const review = structuredClone(material)
        if (!review.preparations.length || review.preparations.some(p => hash(p.candidate) !== hash(candidate)
          || p.startDate !== context.startDate || p.source.nowMs !== at.getTime())) throw Error("MULTI_PROVIDER_ORIGIN_MISMATCH")
        const checked = checkMultiAdjustedPlanReviewV3(review.preparations, context.intake.experienceBand, review.rpeBindings, review.policies)
        if (checked.kind !== "reviewed_scope") throw Error(checked.code)
        return { review, checked }
      }
      const initial = read([])
      const seed = { action: "USER_EXPLICIT" as const, preparations: initial.review.preparations,
        generated: context.generated, gate: context.gate, intake: context.intake, athleteEvidence: context.athleteEvidence,
        currentCheck: context.currentCheck, expectedCandidateFingerprint: initial.checked.candidate.contentFingerprint }
      return {
        seed, locks: options.locks, orderedChoicesFor: options.orderedChoicesFor,
        readReview: () => read([]).review,
        readReviewForEdits: (request, changes) => {
          if (hash({ ...request, preparations: [], expectedCandidateFingerprint: "" })
            !== hash({ ...seed, preparations: [], expectedCandidateFingerprint: "" })) throw Error("MULTI_PROVIDER_REQUEST_CHANGED")
          return read(changes).review
        },
      }
    } catch { return null }
  }
}
