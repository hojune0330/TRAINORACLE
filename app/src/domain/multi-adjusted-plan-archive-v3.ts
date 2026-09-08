import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { readStoredMultiAdjustedPlanV6, RETAINED_MULTI_ADJUSTED_EVIDENCE_V3, type StoredMultiAdjustedPlanStateV6 } from "./adjusted-plan-storage-v6"
import type { RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-v3"
import { accountScopedStorageKey, localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"

export const MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY = "trainoracle.multi-adjusted-plan-originals.v3"
type Entry = { readonly archivedAt: string; readonly state: StoredMultiAdjustedPlanStateV6 }
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-adjusted-original-archive.v3", value)
const invalid = () => ({ kind: "invalid" as const })
export function parseMultiAdjustedOriginalArchiveV3(raw: string | null, retained: readonly RetainedMultiAdjustedEvidenceV3[], at = new Date()) {
  if (raw === null) return { kind: "loaded" as const, entries: [] as readonly Entry[] }
  try {
    const value = JSON.parse(raw)
    if (value?.version !== 3 || !Array.isArray(value.entries) || value.entries.length > 18 || Object.keys(value).length !== 3) return invalid()
    const entries: Entry[] = [], seen = new Set<string>()
    for (const item of value.entries) {
      if (!item || typeof item !== "object" || Object.keys(item).length !== 2) return invalid()
      const read = readStoredMultiAdjustedPlanV6(item.state, retained, at), date = new Date(item.archivedAt)
      if (read.kind !== "loaded" || !Number.isFinite(date.getTime()) || date.toISOString() !== item.archivedAt
        || date > at || date < new Date(read.state.updatedAt) || seen.has(read.state.selection.contentFingerprint)) return invalid()
      seen.add(read.state.selection.contentFingerprint)
      entries.push({ archivedAt: item.archivedAt, state: read.state })
    }
    const content = { version: 3, entries }
    if (hash({ ...content, contentFingerprint: hash(content) }) !== hash(value)) return invalid()
    return { kind: "loaded" as const, entries }
  } catch { return invalid() }
}
export function readMultiAdjustedOriginalPlansV3(retained = RETAINED_MULTI_ADJUSTED_EVIDENCE_V3, at = new Date()) {
  try { return parseMultiAdjustedOriginalArchiveV3(localStorage.getItem(accountScopedStorageKey(MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY)), retained, at) }
  catch { return invalid() }
}
export function prepareMultiAdjustedOriginalArchiveV3(raw: string | null, state: StoredMultiAdjustedPlanStateV6,
  retained: readonly RetainedMultiAdjustedEvidenceV3[], at = new Date()) {
  const archive = parseMultiAdjustedOriginalArchiveV3(raw, retained, at), read = readStoredMultiAdjustedPlanV6(state, retained, at)
  if (archive.kind !== "loaded" || read.kind !== "loaded") return invalid()
  const same = archive.entries.find(e => e.state.selection.contentFingerprint === read.state.selection.contentFingerprint)
  if (same?.state.contentFingerprint === read.state.contentFingerprint && raw !== null) return { kind: "prepared" as const, raw }
  if (!same && archive.entries.length >= 18) return { kind: "full" as const }
  const entries = [...archive.entries.filter(e => e !== same), { archivedAt: at.toISOString(), state: read.state }]
    .sort((a, b) => a.archivedAt.localeCompare(b.archivedAt))
  const content = { version: 3, entries }
  return { kind: "prepared" as const, raw: JSON.stringify({ ...content, contentFingerprint: hash(content) }) }
}
export async function retainMultiAdjustedOriginalPlanV3(expected: string, options: {
  readonly retained?: readonly RetainedMultiAdjustedEvidenceV3[]; readonly locks?: PlanMutationLockManager | null;
} = {}) {
  const scope = localAccountScopeSnapshot(), key = accountScopedStorageKey(MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY), activeKey = activePlanBetaStorageKey()
  const retained = options.retained ?? RETAINED_MULTI_ADJUSTED_EVIDENCE_V3
  const locks = options.locks === undefined ? getPlanMutationLockManager() : options.locks
  const reject = (code: string) => ({ kind: "rejected" as const, code })
  if (locks === null) return reject("MUTATION_LOCK_UNAVAILABLE")
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock => {
      if (!lock || !localAccountScopeIsCurrent(scope)) return reject("STALE_BASE")
      let before: string | null = null, next: string | null = null
      try {
        const storage = window.localStorage, activeRaw = storage.getItem(activeKey), at = new Date()
        before = storage.getItem(key)
        const read = readStoredMultiAdjustedPlanV6(activeRaw === null ? null : JSON.parse(activeRaw), retained, at)
        if (read.kind !== "loaded" || read.state.contentFingerprint !== expected) return reject("STALE_BASE")
        const archive = prepareMultiAdjustedOriginalArchiveV3(before, read.state, retained, at)
        if (archive.kind !== "prepared") return reject(archive.kind === "full" ? "ARCHIVE_CAPACITY_REACHED" : "INVALID_STORED_ARCHIVE")
        if (!localAccountScopeIsCurrent(scope) || storage.getItem(key) !== before || storage.getItem(activeKey) !== activeRaw) return reject("STALE_BASE")
        if (archive.raw === before) return { kind: "retained" as const }
        next = archive.raw; storage.setItem(key, next)
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
