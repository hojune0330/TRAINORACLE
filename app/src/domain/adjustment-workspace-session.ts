import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { createAdjustmentCommitController, validateInitialAdjustmentWorkspace } from "./prescription-adjustment-commit"
import type { AdjustmentCommitAdapter, AdjustmentCommitState } from "./prescription-adjustment-commit"
import { accountScopedStorageKeyFor, localAccountScopeIsCurrent, localAccountScopeSnapshot } from "./account/local-account-scope"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"
import type { PlanMutationLockManager } from "./plan-mutation-lock"

export const ADJUSTMENT_WORKSPACE_SESSION_KEY = "trainoracle.plan-adjustment.workspace.v1"
type EnvironmentPort = Pick<AdjustmentCommitAdapter, "readEnvironment" | "now">
type SessionStoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">
type Envelope = { readonly version: 1; readonly base: AdjustmentCommitState; readonly state: AdjustmentCommitState }

const same = (a: unknown, b: unknown) => hasCanonicalJsonTree(a) && hasCanonicalJsonTree(b)
  && canonicalJsonFingerprint("adjustment-session-v1", a) === canonicalJsonFingerprint("adjustment-session-v1", b)
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })

/** Exact baseline is supplied by the current candidate, never recovered from storage.
 * A modified snapshot must pass the existing controller's full replay verification.
 */
export async function restoreAdjustmentWorkspace(raw: string, base: AdjustmentCommitState, environment: EnvironmentPort) {
  try {
    const value: unknown = JSON.parse(raw)
    if (!hasCanonicalJsonTree(value) || value === null || typeof value !== "object" || Array.isArray(value)
        || Reflect.ownKeys(value).length !== 3 || !Reflect.ownKeys(value).every(key => ["version", "base", "state"].includes(String(key)))) {
      return unavailable("INVALID_WORKSPACE_ENVELOPE")
    }
    const envelope = value as Envelope
    if (envelope.version !== 1 || !same(envelope.base, base)) return unavailable("WORKSPACE_BASE_CHANGED")
    if (!validateInitialAdjustmentWorkspace(base, environment.readEnvironment())) return unavailable("WORKSPACE_CONTEXT_CHANGED")
    if (same(envelope.state, base)) return { kind: "restored" as const, state: structuredClone(base) }
    if (envelope.state?.lastCommit === null || envelope.state?.lastCommit === undefined) return unavailable("INVALID_WORKSPACE_RECEIPT")
    const checked = await createAdjustmentCommitController({ ...environment,
      readState: () => envelope.state, compareAndSwap: () => false,
    }).commit({ base, receipt: envelope.state.lastCommit.receipt, prescription: envelope.state.prescription })
    return checked.kind === "replayed" ? { kind: "restored" as const, state: checked.state }
      : unavailable("WORKSPACE_REPLAY_REJECTED")
  } catch { return unavailable("INVALID_WORKSPACE_ENVELOPE") }
}

/** One account-scoped workspace per tab, in sessionStorage only. Opening is an
 * explicit editor action. No active plan, history, cloud backup or export write.
 */
export async function openAdjustmentSessionWorkspace(input: EnvironmentPort & {
  readonly base: AdjustmentCommitState
  readonly storage?: SessionStoragePort
  readonly locks?: PlanMutationLockManager | null
}) {
  const scope = localAccountScopeSnapshot()
  const key = accountScopedStorageKeyFor(ADJUSTMENT_WORKSPACE_SESSION_KEY, scope)
  try {
    if (!hasCanonicalJsonTree(input.base)) return unavailable("INVALID_WORKSPACE_BASE")
    const base = structuredClone(input.base)
    const storage = input.storage ?? window.sessionStorage
    const locks = input.locks === undefined ? getPlanMutationLockManager() : input.locks
    if (locks === null) return unavailable("MUTATION_LOCK_UNAVAILABLE")
    const port = { readEnvironment: () => input.readEnvironment(), now: () => input.now() }
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (lock === null) return unavailable("MUTATION_LOCK_UNAVAILABLE")
      if (!localAccountScopeIsCurrent(scope)) return unavailable("WORKSPACE_ACCOUNT_CHANGED")
      const previous = storage.getItem(key)
      if (!validateInitialAdjustmentWorkspace(base, port.readEnvironment())) return unavailable("WORKSPACE_CONTEXT_CHANGED")
      const restored = previous === null ? { kind: "restored" as const, state: base }
        : await restoreAdjustmentWorkspace(previous, base, port)
      if (restored.kind !== "restored") return restored
      if (!localAccountScopeIsCurrent(scope) || storage.getItem(key) !== previous) return unavailable("WORKSPACE_CHANGED")
      let state = structuredClone(restored.state)
      let encoded = previous ?? JSON.stringify({ version: 1, base, state } satisfies Envelope)
      let invalidated = false
      if (previous === null) {
        if (!validateInitialAdjustmentWorkspace(base, port.readEnvironment())) return unavailable("WORKSPACE_CONTEXT_CHANGED")
        storage.setItem(key, encoded)
        if (storage.getItem(key) !== encoded) return unavailable("WORKSPACE_WRITE_UNCONFIRMED")
      }
      const current = () => !invalidated && localAccountScopeIsCurrent(scope) && storage.getItem(key) === encoded
      const readState = () => {
        if (!current()) throw new Error("WORKSPACE_CHANGED")
        return structuredClone(state)
      }
      const compareAndSwap: AdjustmentCommitAdapter["compareAndSwap"] = async (expected, next, validate) => {
        try {
          return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async writeLock => {
            if (writeLock === null || !current() || !same(expected, state) || !hasCanonicalJsonTree(next)) return false
            const nextEncoded = JSON.stringify({ version: 1, base, state: next } satisfies Envelope)
            const checked = await restoreAdjustmentWorkspace(nextEncoded, base, port)
            if (checked.kind !== "restored" || !current() || !same(expected, state) || !validate()) return false
            storage.setItem(key, nextEncoded)
            if (storage.getItem(key) !== nextEncoded || !localAccountScopeIsCurrent(scope)) {
              invalidated = true
              return false
            }
            state = structuredClone(checked.state)
            encoded = nextEncoded
            return true
          })
        } catch { invalidated = true; return false }
      }
      const discard = async () => {
        try {
          return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, discardLock => {
            if (discardLock === null || !current()) return false
            storage.removeItem(key)
            invalidated = true
            return storage.getItem(key) === null
          })
        } catch { invalidated = true; return false }
      }
      return { kind: "opened" as const, adapter: { ...port, readState, compareAndSwap } satisfies AdjustmentCommitAdapter, discard }
    })
  } catch { return unavailable("WORKSPACE_STORAGE_UNAVAILABLE") }
}
