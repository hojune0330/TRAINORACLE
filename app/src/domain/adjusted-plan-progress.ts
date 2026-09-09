import { activePlanBetaStorageKey } from "./plan-beta-store"
import { captureAccountPlanWrite } from "./account/account-plan-domain"
import { progressSchema, hasCanonicalJsonTree, type StoredPlanProgress } from "./plan-beta-schema"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"
import { encodeStoredAdjustedPlanState, readStoredAdjustedPlanState, RETAINED_ADJUSTED_PLAN_EVIDENCE } from "./adjusted-plan-storage-schema"
import type { RetainedAdjustedPlanEvidence } from "./selected-adjusted-plan-content"
import { encodeStoredAdjustedPlanStateV5, readStoredAdjustedPlanStateV5, RETAINED_ADJUSTED_PLAN_EVIDENCE_V3 } from "./adjusted-plan-storage-v5"
import type { RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-v3"
import { encodeStoredMultiAdjustedPlanV6, readStoredMultiAdjustedPlanV6, RETAINED_MULTI_ADJUSTED_EVIDENCE_V3 } from "./adjusted-plan-storage-v6"
import type { RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-v3"

const rejected = (code: string) => ({ kind: "rejected" as const, code })

/** Records an explicit outcome only. Never changes the immutable prescription,
 * grants execution authority, or fills journal measurements from planned values. */
export async function saveAdjustedPlanProgress(input: {
  readonly expectedFingerprint: string
  readonly progress: StoredPlanProgress
  readonly retained?: readonly RetainedAdjustedPlanEvidence[]
  readonly locks?: PlanMutationLockManager | null
}) {
  const retained = input.retained ?? RETAINED_ADJUSTED_PLAN_EVIDENCE
  return saveVersionedProgress(input, {
    read: (value, at) => { const result = readStoredAdjustedPlanState(value, retained, at); return result.kind === "loaded" ? result.state : null },
    encode: (selection, progress, at) => { const result = encodeStoredAdjustedPlanState(selection, progress, at.toISOString(), retained, at);
      return result.kind === "encoded" ? result : null },
  })
}

export async function saveAdjustedPlanProgressV3(input: {
  readonly expectedFingerprint: string; readonly progress: StoredPlanProgress;
  readonly retained?: readonly RetainedAdjustedPlanEvidenceV3[]; readonly locks?: PlanMutationLockManager | null;
}) {
  const retained = input.retained ?? RETAINED_ADJUSTED_PLAN_EVIDENCE_V3
  return saveVersionedProgress(input, {
    read: (value, at) => { const result = readStoredAdjustedPlanStateV5(value, retained, at); return result.kind === "loaded" ? result.state : null },
    encode: (selection, progress, at) => { const result = encodeStoredAdjustedPlanStateV5(selection, progress, at.toISOString(), retained, at);
      return result.kind === "encoded" ? result : null },
  })
}

export async function saveMultiAdjustedPlanProgressV3(input: {
  readonly expectedFingerprint: string; readonly progress: StoredPlanProgress;
  readonly retained?: readonly RetainedMultiAdjustedEvidenceV3[]; readonly locks?: PlanMutationLockManager | null;
}) {
  const retained = input.retained ?? RETAINED_MULTI_ADJUSTED_EVIDENCE_V3
  return saveVersionedProgress(input, {
    read: (value, at) => { const result = readStoredMultiAdjustedPlanV6(value, retained, at); return result.kind === "loaded" ? result.state : null },
    encode: (selection, progress, at) => { const result = encodeStoredMultiAdjustedPlanV6(selection, progress, at.toISOString(), retained, at);
      return result.kind === "encoded" ? result : null },
  })
}

type ProgressState = { readonly contentFingerprint: string; readonly progress: readonly StoredPlanProgress[];
  readonly selection: { readonly activePlan: { readonly sessions: readonly { readonly day: number; readonly slot: string; readonly role: string }[] } } }
async function saveVersionedProgress<S extends ProgressState>(input: {
  readonly expectedFingerprint: string; readonly progress: StoredPlanProgress; readonly locks?: PlanMutationLockManager | null;
}, codec: { readonly read: (value: unknown, at: Date) => S | null;
  readonly encode: (selection: S["selection"], progress: readonly StoredPlanProgress[], at: Date) => { readonly state: S; readonly raw: string } | null }) {
  const account = localAccountScopeSnapshot()
  const key = activePlanBetaStorageKey()
  const accountWrite = captureAccountPlanWrite(key)
  if (!hasCanonicalJsonTree(input.progress)) return rejected("INVALID_PROGRESS")
  const parsed = progressSchema.safeParse(input.progress)
  if (!parsed.success
    || !Object.hasOwn(input.progress, "sessionSlot")) return rejected("INVALID_PROGRESS")
  const progress = parsed.data
  const expected = input.expectedFingerprint
  const locks = input.locks === undefined ? getPlanMutationLockManager() : input.locks
  if (locks === null) return rejected("MUTATION_LOCK_UNAVAILABLE")
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (lock === null) return rejected("MUTATION_LOCK_UNAVAILABLE")
      if (!localAccountScopeIsCurrent(account)) return rejected("STALE_BASE")
      let previous: string | null = null
      let encoded: string | null = null
      try {
        const storage = accountWrite?.storage ?? window.localStorage
        previous = storage.getItem(key)
        const now = new Date()
        const state = previous === null ? null : codec.read(JSON.parse(previous), now)
        if (state === null) return rejected("INVALID_STORED_PLAN")
        if (state.contentFingerprint !== expected) return rejected("STALE_BASE")
        const session = state.selection.activePlan.sessions.find(item => item.day === progress.sessionDay && item.slot === progress.sessionSlot)
        if (session === undefined || (session.role === "REST" && progress.state === "COMPLETED")) return rejected("INVALID_PROGRESS")
        const old = state.progress.find(item => item.sessionDay === progress.sessionDay && item.sessionSlot === progress.sessionSlot)
        if (old?.state === "PAIN_CHECKIN" && progress.state !== "PAIN_CHECKIN") return rejected("PAIN_REVIEW_REQUIRED")
        if (old?.state === progress.state) return { kind: "saved" as const, state }
        const next = [...state.progress.filter(item => item.sessionDay !== progress.sessionDay || item.sessionSlot !== progress.sessionSlot), progress]
          .sort((a, b) => a.sessionDay - b.sessionDay || a.sessionSlot.localeCompare(b.sessionSlot))
        const output = codec.encode(state.selection, next, now)
        if (output === null) return rejected("INVALID_PROGRESS")
        if (accountWrite) {
          const evidence = accountWrite.packet?.evidence
          const code = await accountWrite.save(output.state, evidence ? [evidence] : [])
          return code ? rejected(code) : { kind: "saved" as const, state: output.state }
        }
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
