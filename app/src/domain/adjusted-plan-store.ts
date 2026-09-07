import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { localAccountScopeIsCurrent, localAccountScopeSnapshot } from "./account/local-account-scope"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
import { selectAdjustedPlanForActivation } from "./adjusted-plan-selection"
import type { AdjustedPlanSelectionRequest, RetainedAdjustedPlanEvidence, SelectedAdjustedPlanState } from "./adjusted-plan-selection"
import { encodeStoredAdjustedPlanState, readStoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import type { ReviewedAdjustedPlanPolicy } from "./adjusted-plan-review-policy"

type LiveReview = {
  readonly source: AdjustedPlanSelectionRequest["preparation"]["source"]
  readonly explanation: AdjustedPlanSelectionRequest["preparation"]["explanation"]
  readonly policies: readonly ReviewedAdjustedPlanPolicy[]
  readonly retained: readonly RetainedAdjustedPlanEvidence[]
}
const reject = (code: string) => ({ kind: "rejected" as const, code })
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-save.v1", value)
function sameChoice(state: SelectedAdjustedPlanState) {
  const { generatedAt: _time, periodization: _period, contentFingerprint: _hash, adjustment, ...content } = state
  const { acceptedAt: _accepted, ...origin } = adjustment
  return hash({ ...content, adjustment: origin })
}

/** Real account-scoped active-plan write. Only a fresh, explicit whole-plan
 * selection can enter this path; editor snapshots cannot be saved directly.
 */
export async function saveSelectedAdjustedPlan(input: {
  readonly request: AdjustedPlanSelectionRequest
  readonly readReview: () => LiveReview
  readonly isCurrentDraft: () => boolean
  readonly locks?: PlanMutationLockManager | null
}) {
  try {
    if (!input.isCurrentDraft() || !hasCanonicalJsonTree(input.request)) return reject("STALE_CANDIDATE_SELECTION")
    const openingHash = hash(input.request)
    const request = structuredClone(input.request)
    const account = localAccountScopeSnapshot()
    const key = activePlanBetaStorageKey()
    const locks = input.locks === undefined ? getPlanMutationLockManager() : input.locks
    if (locks === null) return reject("MUTATION_LOCK_UNAVAILABLE")
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock => {
      if (lock === null) return reject("MUTATION_LOCK_UNAVAILABLE")
      const current = () => input.isCurrentDraft() && localAccountScopeIsCurrent(account)
        && hasCanonicalJsonTree(input.request) && hash(input.request) === openingHash
      if (!current()) return reject("STALE_CANDIDATE_SELECTION")
      let previous: string | null
      let encoded: string | null = null
      try {
        const storage = window.localStorage
        previous = storage.getItem(key)
        const live = input.readReview()
        if (!hasCanonicalJsonTree(live)) return reject("INVALID_ADJUSTED_REVIEW")
        const now = new Date()
        const selected = selectAdjustedPlanForActivation({ ...request,
          preparation: { ...request.preparation, source: live.source, explanation: live.explanation } }, live.policies, now)
        if (selected.kind !== "selected_adjusted") return selected
        if (!current() || storage.getItem(key) !== previous) return reject("STALE_BASE")
        if (previous !== null) {
          const old = readStoredAdjustedPlanState(JSON.parse(previous), live.retained, now)
          if (old.kind !== "loaded" || old.state.progress.length !== 0
              || sameChoice(old.state.selection) !== sameChoice(selected.state)) return reject("STALE_BASE")
          return { kind: "saved" as const, state: old.state, replayed: true }
        }
        const output = encodeStoredAdjustedPlanState(selected.state, [], now.toISOString(), live.retained, now)
        if (output.kind !== "encoded") return reject("ADJUSTED_PLAN_STORAGE_VALIDATION_FAILED")
        if (!current() || storage.getItem(key) !== previous) return reject("STALE_BASE")
        encoded = output.raw
        storage.setItem(key, encoded)
        if (storage.getItem(key) !== encoded || !current()) throw Error("Unconfirmed adjusted plan write")
        return { kind: "saved" as const, state: output.state, replayed: false }
      } catch {
        // Do not remove another writer's content when confirmation fails.
        try {
          const storage = window.localStorage
          const actual = storage.getItem(key)
          if (encoded !== null && actual === encoded) storage.removeItem(key)
          return reject(storage.getItem(key) === previous! ? "PLAN_STORAGE_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN")
        } catch { return reject("PLAN_STORAGE_STATE_UNCERTAIN") }
      }
    })
  } catch { return reject("ADJUSTED_PLAN_SAVE_UNAVAILABLE") }
}
