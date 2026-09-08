import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { captureAccountPlanWrite } from "./account/account-plan-domain"
import { accountPlanService, accountPlansEnabled } from "./account/account-plan-service"
import { materializeAccountPlan } from "./account/account-plan-document-schema"
import { accountScopedStorageKey, localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { readStoredAdjustedPlanState, RETAINED_ADJUSTED_PLAN_EVIDENCE, type StoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import type { RetainedAdjustedPlanEvidence } from "./selected-adjusted-plan-content"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"

export const ADJUSTED_PLAN_ARCHIVE_KEY = "trainoracle.adjusted-plan-originals.v1"
type Entry = { readonly archivedAt: string; readonly state: StoredAdjustedPlanState }
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-original-archive.v1", value)
const invalid = () => ({ kind: "invalid" as const })
export function parseAdjustedOriginalArchive(raw: string | null, retained: readonly RetainedAdjustedPlanEvidence[], now: Date) {
  if (raw === null) return { kind: "loaded" as const, entries: [] as readonly Entry[] }
  try {
    const value = JSON.parse(raw)
    if (!hasCanonicalJsonTree(value) || value?.version !== 1 || !Array.isArray(value.entries)
      || value.entries.length > 18 || Object.keys(value).length !== 3) return invalid()
    const entries: Entry[] = []
    const seen = new Set<string>()
    for (const item of value.entries) {
      if (item === null || typeof item !== "object" || Object.keys(item).length !== 2) return invalid()
      const checked = readStoredAdjustedPlanState(item.state, retained, now)
      const date = new Date(item.archivedAt)
      if (checked.kind !== "loaded" || !Number.isFinite(date.getTime()) || date.toISOString() !== item.archivedAt
        || date > now || date < new Date(checked.state.updatedAt)) return invalid()
      if (seen.has(checked.state.selection.contentFingerprint)) return invalid()
      seen.add(checked.state.selection.contentFingerprint)
      entries.push({ archivedAt: item.archivedAt, state: checked.state })
    }
    const content = { version: 1, entries }
    if (hash({ ...content, contentFingerprint: hash(content) }) !== hash(value)) return invalid()
    return { kind: "loaded" as const, entries }
  } catch { return invalid() }
}

export function readAdjustedOriginalPlans(retained = RETAINED_ADJUSTED_PLAN_EVIDENCE, now = new Date()) {
  if (accountPlansEnabled()) {
    const view = accountPlanService()?.snapshot(), document = view?.confirmedDocument
    if (!document || ("historyLoaded" in view && !view.historyLoaded)) return invalid()
    const entries: Entry[] = []
    for (const entry of document.data.plans) {
      if (!entry.archivedAt || entry.snapshot.state.version !== 4) continue
      const read = readStoredAdjustedPlanState(materializeAccountPlan(entry).state, retained, now)
      if (read.kind !== "loaded") return invalid()
      entries.push({ archivedAt: entry.archivedAt, state: read.state })
    }
    return { kind: "loaded" as const, entries }
  }
  try { return parseAdjustedOriginalArchive(window.localStorage.getItem(accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_KEY)), retained, now) }
  catch { return invalid() }
}

/** Pure staging for the owning mutation transaction; does not acquire a lock or write. */
export function prepareAdjustedOriginalArchive(raw: string | null, state: StoredAdjustedPlanState,
  retained: readonly RetainedAdjustedPlanEvidence[], now: Date) {
  const archive = parseAdjustedOriginalArchive(raw, retained, now)
  const checked = readStoredAdjustedPlanState(state, retained, now)
  if (archive.kind !== "loaded" || checked.kind !== "loaded") return invalid()
  const same = archive.entries.find(item => item.state.selection.contentFingerprint === checked.state.selection.contentFingerprint)
  if (same?.state.contentFingerprint === checked.state.contentFingerprint && raw !== null) return { kind: "prepared" as const, raw }
  const entries = [...archive.entries.filter(item => item !== same), { archivedAt: now.toISOString(), state: checked.state }]
    .sort((a, b) => a.archivedAt.localeCompare(b.archivedAt)).slice(-18)
  const content = { version: 1, entries }
  return { kind: "prepared" as const, raw: JSON.stringify({ ...content, contentFingerprint: hash(content) }) }
}

/** Retains the current original without deleting/replacing the active plan.
 * Advancing a cycle remains a separate transaction and authority check. */
export async function retainAdjustedOriginalPlan(expectedFingerprint: string, options: {
  readonly retained?: readonly RetainedAdjustedPlanEvidence[]; readonly locks?: PlanMutationLockManager | null
} = {}) {
  const scope = localAccountScopeSnapshot()
  const key = accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_KEY)
  const activeKey = activePlanBetaStorageKey()
  const accountWrite = captureAccountPlanWrite(activeKey)
  const retained = options.retained ?? RETAINED_ADJUSTED_PLAN_EVIDENCE
  const locks = options.locks === undefined ? getPlanMutationLockManager() : options.locks
  const reject = (code: string) => ({ kind: "rejected" as const, code })
  if (locks === null) return reject("MUTATION_LOCK_UNAVAILABLE")
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock => {
      if (lock === null) return reject("MUTATION_LOCK_UNAVAILABLE")
      if (!localAccountScopeIsCurrent(scope)) return reject("STALE_BASE")
      let before: string | null = null
      let next: string | null = null
      try {
        const storage = accountWrite?.storage ?? window.localStorage
        before = storage.getItem(key)
        const activeRaw = storage.getItem(activeKey)
        const now = new Date()
        const active = readStoredAdjustedPlanState(activeRaw === null ? null : JSON.parse(activeRaw), retained, now)
        if (active.kind !== "loaded") return reject("INVALID_STORED_PLAN")
        if (active.state.contentFingerprint !== expectedFingerprint) return reject("STALE_BASE")
        if (accountWrite) return { kind: "retained" as const }
        const archive = prepareAdjustedOriginalArchive(before, active.state, retained, now)
        if (archive.kind !== "prepared") return reject("INVALID_STORED_PLAN")
        if (archive.raw === before) return { kind: "retained" as const }
        next = archive.raw
        if (!localAccountScopeIsCurrent(scope) || storage.getItem(key) !== before || storage.getItem(activeKey) !== activeRaw) return reject("STALE_BASE")
        storage.setItem(key, next)
        if (storage.getItem(key) !== next || storage.getItem(activeKey) !== activeRaw || !localAccountScopeIsCurrent(scope)) throw Error("Unconfirmed archive")
        return { kind: "retained" as const }
      } catch {
        try {
          const storage = window.localStorage
          if (next !== null && storage.getItem(key) === next) {
            if (before === null) storage.removeItem(key); else storage.setItem(key, before)
          }
          return reject(storage.getItem(key) === before ? "ARCHIVE_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN")
        } catch { return reject("PLAN_STORAGE_STATE_UNCERTAIN") }
      }
    })
  } catch { return reject("ARCHIVE_UNAVAILABLE") }
}
