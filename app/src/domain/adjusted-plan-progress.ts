import { activePlanBetaStorageKey } from "./plan-beta-store"
import { progressSchema, hasCanonicalJsonTree, type StoredPlanProgress } from "./plan-beta-schema"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"
import { encodeStoredAdjustedPlanState, readStoredAdjustedPlanState, RETAINED_ADJUSTED_PLAN_EVIDENCE } from "./adjusted-plan-storage-schema"
import type { RetainedAdjustedPlanEvidence } from "./selected-adjusted-plan-content"

const rejected = (code: string) => ({ kind: "rejected" as const, code })

/** Records an explicit outcome only. Never changes the immutable prescription,
 * grants execution authority, or fills journal measurements from planned values. */
export async function saveAdjustedPlanProgress(input: {
  readonly expectedFingerprint: string
  readonly progress: StoredPlanProgress
  readonly retained?: readonly RetainedAdjustedPlanEvidence[]
  readonly locks?: PlanMutationLockManager | null
}) {
  const account = localAccountScopeSnapshot()
  const key = activePlanBetaStorageKey()
  const parsed = progressSchema.safeParse(input.progress)
  if (!hasCanonicalJsonTree(input.progress) || !parsed.success
    || !Object.hasOwn(input.progress, "sessionSlot")) return rejected("INVALID_PROGRESS")
  const progress = parsed.data
  const expected = input.expectedFingerprint
  const retained = input.retained ?? RETAINED_ADJUSTED_PLAN_EVIDENCE
  const locks = input.locks === undefined ? getPlanMutationLockManager() : input.locks
  if (locks === null) return rejected("MUTATION_LOCK_UNAVAILABLE")
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock => {
      if (lock === null) return rejected("MUTATION_LOCK_UNAVAILABLE")
      if (!localAccountScopeIsCurrent(account)) return rejected("STALE_BASE")
      let previous: string | null = null
      let encoded: string | null = null
      try {
        const storage = window.localStorage
        previous = storage.getItem(key)
        const now = new Date()
        const read = previous === null ? null : readStoredAdjustedPlanState(JSON.parse(previous), retained, now)
        if (read?.kind !== "loaded") return rejected("INVALID_STORED_PLAN")
        if (read.state.contentFingerprint !== expected) return rejected("STALE_BASE")
        const session = read.state.selection.activePlan.sessions.find(item => item.day === progress.sessionDay && item.slot === progress.sessionSlot)
        if (session === undefined || (session.role === "REST" && progress.state === "COMPLETED")) return rejected("INVALID_PROGRESS")
        const old = read.state.progress.find(item => item.sessionDay === progress.sessionDay && item.sessionSlot === progress.sessionSlot)
        if (old?.state === "PAIN_CHECKIN" && progress.state !== "PAIN_CHECKIN") return rejected("PAIN_REVIEW_REQUIRED")
        if (old?.state === progress.state) return { kind: "saved" as const, state: read.state }
        const next = [...read.state.progress.filter(item => item.sessionDay !== progress.sessionDay || item.sessionSlot !== progress.sessionSlot), progress]
          .sort((a, b) => a.sessionDay - b.sessionDay || a.sessionSlot.localeCompare(b.sessionSlot))
        const output = encodeStoredAdjustedPlanState(read.state.selection, next, now.toISOString(), retained, now)
        if (output.kind !== "encoded") return rejected("INVALID_PROGRESS")
        if (!localAccountScopeIsCurrent(account) || storage.getItem(key) !== previous) return rejected("STALE_BASE")
        encoded = output.raw
        storage.setItem(key, encoded)
        if (storage.getItem(key) !== encoded || !localAccountScopeIsCurrent(account)) throw Error("Unconfirmed progress write")
        return { kind: "saved" as const, state: output.state }
      } catch {
        try {
          const storage = window.localStorage
          if (encoded !== null && storage.getItem(key) === encoded && previous !== null) storage.setItem(key, previous)
          return rejected(storage.getItem(key) === previous ? "PLAN_STORAGE_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN")
        } catch { return rejected("PLAN_STORAGE_STATE_UNCERTAIN") }
      }
    })
  } catch { return rejected("MUTATION_LOCK_UNAVAILABLE") }
}
