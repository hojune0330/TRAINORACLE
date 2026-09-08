import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { captureAccountPlanWrite } from "./account/account-plan-domain"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { selectAdjustedPlanForActivationV3 } from "./selected-adjusted-plan-v3"
import type { SelectedAdjustedPlanStateV3, RetainedAdjustedPlanEvidenceV3, AdjustedPlanSelectionRequestV3 } from "./selected-adjusted-plan-v3"
import type { ReviewedAdjustedPlanPolicyV3 } from "./adjusted-plan-review-v3"
import { checkAdjustedPlanReviewPolicyV3 } from "./adjusted-plan-review-v3"
import { planAnchorsStillCurrent } from "./plan-anchor-reconfirmation"
import { evaluatePlanSafety } from "./plan-beta-flow"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"
import type { PlanMutationLockManager } from "./plan-mutation-lock"

import { readStoredAdjustedPlanStateV5, encodeStoredAdjustedPlanStateV5, type StoredAdjustedPlanStateV5 } from "./adjusted-plan-storage-v5-schema"
export { readStoredAdjustedPlanStateV5, encodeStoredAdjustedPlanStateV5, RETAINED_ADJUSTED_PLAN_EVIDENCE_V3 } from "./adjusted-plan-storage-v5-schema"
export type { StoredAdjustedPlanStateV5 } from "./adjusted-plan-storage-v5-schema"
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-storage.v5", value)
const reject = (code: string) => ({ kind: "rejected" as const, code })

export type AdjustedPlanLiveReviewV3 = { readonly source: AdjustedPlanSelectionRequestV3["preparation"]["source"];
  readonly explanation: AdjustedPlanSelectionRequestV3["preparation"]["explanation"];
  readonly policies: readonly ReviewedAdjustedPlanPolicyV3[]; readonly retained: readonly RetainedAdjustedPlanEvidenceV3[] }
function sameChoice(state: SelectedAdjustedPlanStateV3) {
  const { generatedAt, periodization, contentFingerprint, adjustment, ...content } = state
  const { acceptedAt, ...origin } = adjustment
  return hash({ ...content, adjustment: origin })
}

/** Version-aware active-plan writer. No UI entry until its read/progress consumers are connected. */
export async function saveSelectedAdjustedPlanV3(input: { readonly request: AdjustedPlanSelectionRequestV3;
  readonly readReview: () => AdjustedPlanLiveReviewV3; readonly isCurrentDraft: () => boolean; readonly locks?: PlanMutationLockManager | null }) {
  try {
    if (!input.isCurrentDraft() || !hasCanonicalJsonTree(input.request)) return reject("STALE_CANDIDATE_SELECTION")
    const opening = hash(input.request), request = structuredClone(input.request), account = localAccountScopeSnapshot()
    const key = activePlanBetaStorageKey(), locks = input.locks === undefined ? getPlanMutationLockManager() : input.locks
    const accountWrite = captureAccountPlanWrite(key)
    if (locks === null) return reject("MUTATION_LOCK_UNAVAILABLE")
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (lock === null) return reject("MUTATION_LOCK_UNAVAILABLE")
      const current = () => input.isCurrentDraft() && localAccountScopeIsCurrent(account)
        && hasCanonicalJsonTree(input.request) && hash(input.request) === opening
      if (!current()) return reject("STALE_CANDIDATE_SELECTION")
      let previous: string | null | undefined, written: string | null = null
      try {
        const storage = accountWrite?.storage ?? window.localStorage
        previous = storage.getItem(key)
        const live = input.readReview(), at = new Date()
        if (!hasCanonicalJsonTree(live)) return reject("INVALID_ADJUSTED_REVIEW")
        const selected = selectAdjustedPlanForActivationV3({ ...request, preparation: { ...request.preparation,
          source: live.source, explanation: live.explanation } }, live.policies, at)
        if (selected.kind !== "selected_adjusted") return selected
        const reviewIdentity = (review: AdjustedPlanLiveReviewV3) => hash({ ...review, source: { ...review.source, nowMs: 0 } })
        const originalReview = reviewIdentity(live)
        const authorized = () => {
          if (!current()) return false
          const fresh = input.readReview(), checkedAt = new Date()
          if (!hasCanonicalJsonTree(fresh) || reviewIdentity(fresh) !== originalReview
            || !planAnchorsStillCurrent(request.preparation.candidate, checkedAt)
            || evaluatePlanSafety(request.currentCheck, checkedAt).kind !== "passed") return false
          const review = checkAdjustedPlanReviewPolicyV3({ ...request.preparation,
            source: { ...fresh.source, nowMs: checkedAt.getTime() }, explanation: fresh.explanation },
          selected.state.intake.experienceBand, fresh.policies)
          return review.kind === "reviewed_scope" && hash(review.policy) === hash(selected.state.adjustment.reviewPolicy)
        }
        if (!authorized() || storage.getItem(key) !== previous) return reject("STALE_BASE")
        if (previous !== null) {
          const old = readStoredAdjustedPlanStateV5(JSON.parse(previous), live.retained, at)
          if (old.kind !== "loaded" || old.state.progress.length || sameChoice(old.state.selection) !== sameChoice(selected.state)) return reject("STALE_BASE")
          if (!authorized() || storage.getItem(key) !== previous) return reject("STALE_BASE")
          return { kind: "saved" as const, state: old.state, replayed: true }
        }
        const output = encodeStoredAdjustedPlanStateV5(selected.state, [], at.toISOString(), live.retained, at)
        if (output.kind !== "encoded") return reject("ADJUSTED_PLAN_STORAGE_VALIDATION_FAILED")
        if (accountWrite) {
          const code = await accountWrite.save(output.state, live.retained, authorized)
          return code ? reject(code) : { kind: "saved" as const, state: output.state, replayed: false }
        }
        if (!authorized() || storage.getItem(key) !== previous) return reject("STALE_BASE")
        written = output.raw
        storage.setItem(key, written)
        if (!authorized() || storage.getItem(key) !== written) throw Error("Unconfirmed V3 plan write")
        return { kind: "saved" as const, state: output.state, replayed: false }
      } catch {
        try {
          const storage = window.localStorage
          if (written !== null && storage.getItem(key) === written) storage.removeItem(key)
          return reject(storage.getItem(key) === previous ? "PLAN_STORAGE_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN")
        } catch { return reject("PLAN_STORAGE_STATE_UNCERTAIN") }
      }
    })
  } catch { return reject("ADJUSTED_PLAN_SAVE_UNAVAILABLE") }
}
