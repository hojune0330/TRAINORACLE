import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { readStoredMultiAdjustedPlanV6, type StoredMultiAdjustedPlanStateV6, type MultiAdjustedLiveReviewV3 } from "./adjusted-plan-storage-v6"
import { checkMultiAdjustedPlanReviewV3 } from "./adjusted-plan-multi-review-v3"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { activeLocalAccount } from "./account/local-journal-ownership"
import { evaluatePlanSafety, type PlanCurrentCheck } from "./plan-beta-flow"
import { planAnchorsStillCurrent } from "./plan-anchor-reconfirmation"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"

const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-active-restore.v3", value)
const reject = (code: string) => ({ kind: "rejected" as const, code })
export async function restoreMultiPlanAsCurrentV3(input: {
  readonly ownerId: string; readonly state: StoredMultiAdjustedPlanStateV6;
  readonly confirmsRestore: boolean; readonly currentCheck: PlanCurrentCheck;
  readonly isCurrentRequest: () => boolean; readonly readReview: () => MultiAdjustedLiveReviewV3;
  readonly locks?: PlanMutationLockManager | null;
}) {
  try {
    const owner = activeLocalAccount(), initial = hash(input.state), state = structuredClone(input.state)
    if (!owner || owner !== input.ownerId || input.confirmsRestore !== true) return reject("OWNER_RESTORE_CONFIRMATION_REQUIRED")
    const key = activePlanBetaStorageKey(), check = input.currentCheck
    const current = () => activeLocalAccount() === owner && input.ownerId === owner && activePlanBetaStorageKey() === key
      && input.confirmsRestore === true && input.currentCheck === check && hash(input.state) === initial && input.isCurrentRequest()
    const locks = input.locks === undefined ? getPlanMutationLockManager() : input.locks
    if (!locks) return reject("MUTATION_LOCK_UNAVAILABLE")
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock => {
      if (!lock || !current()) return reject("STALE_RESTORE")
      let raw: string | null = null
      try {
        if (localStorage.getItem(key) !== null) return reject("CURRENT_PLAN_EXISTS")
        const authorized = () => {
          if (!current()) return false
          const live = input.readReview(), at = new Date()
          const stored = readStoredMultiAdjustedPlanV6(state, live.retained, at)
          if (stored.kind !== "loaded" || evaluatePlanSafety(check, at).kind !== "passed"
            || !live.preparations.every(p => planAnchorsStillCurrent(p.candidate, at))) return false
          const preparations = live.preparations.map(p => "experienceBand" in p
            ? { ...p, source: { ...p.source, nowMs: at.getTime() } }
            : { ...p, source: { ...p.source, nowMs: at.getTime() } })
          const reviewed = checkMultiAdjustedPlanReviewV3(preparations, state.selection.intake.experienceBand, live.rpeBindings, live.policies)
          return reviewed.kind === "reviewed_scope"
            && reviewed.candidate.contentFingerprint === state.selection.adjustments.selectedCandidateFingerprint
            && hash(reviewed.policy) === hash(state.selection.adjustments.reviewPolicy)
        }
        if (!authorized() || localStorage.getItem(key) !== null) return reject("CURRENT_RESTORE_REVIEW_REQUIRED")
        raw = JSON.stringify(state)
        localStorage.setItem(key, raw)
        if (!authorized() || localStorage.getItem(key) !== raw) throw Error("Unconfirmed restore")
        return { kind: "restored_current" as const, state, progressPreserved: true as const }
      } catch {
        try {
          if (raw !== null && localStorage.getItem(key) === raw) localStorage.removeItem(key)
          return reject(localStorage.getItem(key) === null ? "RESTORE_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN")
        } catch { return reject("PLAN_STORAGE_STATE_UNCERTAIN") }
      }
    })
  } catch { return reject("RESTORE_UNAVAILABLE") }
}
