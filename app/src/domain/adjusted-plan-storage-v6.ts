import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { captureAccountPlanWrite } from "./account/account-plan-domain"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { selectMultiAdjustedPlanV3, type SelectedMultiAdjustedPlanV3,
  type RetainedMultiAdjustedEvidenceV3, type MultiAdjustedPlanSelectionRequestV3 } from "./selected-multi-adjusted-plan-v3"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"

import { readStoredMultiAdjustedPlanV6, encodeStoredMultiAdjustedPlanV6, type StoredMultiAdjustedPlanStateV6 } from "./adjusted-plan-storage-v6-schema"
export { readStoredMultiAdjustedPlanV6, encodeStoredMultiAdjustedPlanV6, RETAINED_MULTI_ADJUSTED_EVIDENCE_V3 } from "./adjusted-plan-storage-v6-schema"
export type { StoredMultiAdjustedPlanStateV6 } from "./adjusted-plan-storage-v6-schema"
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-storage.v6", value)
const reject = (code: string) => ({ kind: "rejected" as const, code })

export type MultiAdjustedLiveReviewV3 = { readonly preparations: MultiAdjustedPlanSelectionRequestV3["preparations"];
  readonly rpeBindings: RetainedMultiAdjustedEvidenceV3["rpeBindings"]; readonly policies: RetainedMultiAdjustedEvidenceV3["policies"];
  readonly retained: readonly RetainedMultiAdjustedEvidenceV3[] }
const reviewIdentity = (review: MultiAdjustedLiveReviewV3) => hash({ ...review,
  preparations: review.preparations.map(p => ({ ...p, source: { ...p.source, nowMs: 0 } })) })
function sameChoice(state: SelectedMultiAdjustedPlanV3) {
  const { generatedAt, periodization, contentFingerprint, adjustments, ...base } = state
  const { acceptedAt, ...origin } = adjustments
  return hash({ ...base, adjustments: origin })
}

export async function saveSelectedMultiAdjustedPlanV6(input: { readonly request: MultiAdjustedPlanSelectionRequestV3;
  readonly readReview: () => MultiAdjustedLiveReviewV3; readonly isCurrentDraft: () => boolean; readonly locks?: PlanMutationLockManager | null }) {
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
        const storage = accountWrite?.storage ?? window.localStorage, live = input.readReview(), at = new Date()
        previous = storage.getItem(key)
        if (!hasCanonicalJsonTree(live)) return reject("INVALID_ADJUSTED_REVIEW")
        const selected = selectMultiAdjustedPlanV3({ ...request, preparations: live.preparations }, live.rpeBindings, live.policies, at)
        if (selected.kind !== "selected_multi_adjusted") return selected
        const expectedReview = reviewIdentity(live)
        const authorized = () => {
          if (!current()) return false
          const fresh = input.readReview()
          if (!hasCanonicalJsonTree(fresh) || reviewIdentity(fresh) !== expectedReview) return false
          const checked = selectMultiAdjustedPlanV3({ ...request, preparations: fresh.preparations }, fresh.rpeBindings, fresh.policies, new Date())
          return checked.kind === "selected_multi_adjusted" && sameChoice(checked.state) === sameChoice(selected.state)
        }
        if (!authorized() || storage.getItem(key) !== previous) return reject("STALE_BASE")
        if (previous !== null) {
          const old = readStoredMultiAdjustedPlanV6(JSON.parse(previous), live.retained, at)
          if (old.kind !== "loaded" || old.state.progress.length || sameChoice(old.state.selection) !== sameChoice(selected.state)
            || !authorized() || storage.getItem(key) !== previous) return reject("STALE_BASE")
          return { kind: "saved" as const, state: old.state, replayed: true }
        }
        const output = encodeStoredMultiAdjustedPlanV6(selected.state, [], at.toISOString(), live.retained, at)
        if (output.kind !== "encoded") return reject("ADJUSTED_PLAN_STORAGE_VALIDATION_FAILED")
        if (accountWrite) {
          const code = await accountWrite.save(output.state, live.retained, authorized)
          return code ? reject(code) : { kind: "saved" as const, state: output.state, replayed: false }
        }
        if (!authorized() || storage.getItem(key) !== previous) return reject("STALE_BASE")
        written = output.raw; storage.setItem(key, written)
        if (!authorized() || storage.getItem(key) !== written) throw Error("Unconfirmed multi-plan write")
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
