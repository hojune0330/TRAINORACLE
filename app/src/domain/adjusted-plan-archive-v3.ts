import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { captureAccountPlanWrite } from "./account/account-plan-domain"
import { accountPlanService, accountPlansEnabled } from "./account/account-plan-service"
import { materializeAccountPlan } from "./account/account-plan-document-schema"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { readStoredAdjustedPlanStateV5, RETAINED_ADJUSTED_PLAN_EVIDENCE_V3 } from "./adjusted-plan-storage-v5"
import type { StoredAdjustedPlanStateV5 } from "./adjusted-plan-storage-v5"
import type { RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-v3"
import { accountScopedStorageKey, localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"

export const ADJUSTED_PLAN_ARCHIVE_V3_KEY = "trainoracle.adjusted-plan-originals.v3"
type Entry = { readonly archivedAt: string; readonly state: StoredAdjustedPlanStateV5 }
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-original-archive.v3", value)
const invalid = () => ({ kind: "invalid" as const })
export function parseAdjustedOriginalArchiveV3(raw: string | null, retained: readonly RetainedAdjustedPlanEvidenceV3[], at = new Date()) {
  if (raw === null) return { kind: "loaded" as const, entries: [] as readonly Entry[] }
  try {
    const value = JSON.parse(raw)
    if (!hasCanonicalJsonTree(value) || value?.version !== 3 || !Array.isArray(value.entries)
      || value.entries.length > 18 || Object.keys(value).length !== 3) return invalid()
    const entries: Entry[] = [], seen = new Set<string>()
    for (const item of value.entries) {
      if (!item || typeof item !== "object" || Object.keys(item).length !== 2) return invalid()
      const read = readStoredAdjustedPlanStateV5(item.state, retained, at), date = new Date(item.archivedAt)
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
export function readAdjustedOriginalPlansV3(retained = RETAINED_ADJUSTED_PLAN_EVIDENCE_V3, at = new Date()) {
  if (accountPlansEnabled()) {
    const view = accountPlanService()?.snapshot(), document = view?.confirmedDocument
    if (!document || ("historyLoaded" in view && !view.historyLoaded)) return invalid()
    const entries: Entry[] = []
    for (const entry of document.data.plans) {
      if (!entry.archivedAt || entry.snapshot.state.version !== 5) continue
      const read = readStoredAdjustedPlanStateV5(materializeAccountPlan(entry).state, retained, at)
      if (read.kind !== "loaded") return invalid()
      entries.push({ archivedAt: entry.archivedAt, state: read.state })
    }
    return { kind: "loaded" as const, entries }
  }
  try { return parseAdjustedOriginalArchiveV3(localStorage.getItem(accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_V3_KEY)), retained, at) }
  catch { return invalid() }
}
export function prepareAdjustedOriginalArchiveV3(raw: string | null, state: StoredAdjustedPlanStateV5,
  retained: readonly RetainedAdjustedPlanEvidenceV3[], at = new Date()) {
  const archive = parseAdjustedOriginalArchiveV3(raw, retained, at), read = readStoredAdjustedPlanStateV5(state, retained, at)
  if (archive.kind !== "loaded" || read.kind !== "loaded") return invalid()
  const same = archive.entries.find(e => e.state.selection.contentFingerprint === read.state.selection.contentFingerprint)
  if (same?.state.contentFingerprint === read.state.contentFingerprint && raw !== null) return { kind: "prepared" as const, raw }
  if (!same && archive.entries.length >= 18) return { kind: "full" as const }
  const entries = [...archive.entries.filter(e => e !== same), { archivedAt: at.toISOString(), state: read.state }]
    .sort((a, b) => a.archivedAt.localeCompare(b.archivedAt))
  const content = { version: 3, entries }
  return { kind: "prepared" as const, raw: JSON.stringify({ ...content, contentFingerprint: hash(content) }) }
}

export async function retainAdjustedOriginalPlanV3(expected: string, options: {
  readonly retained?: readonly RetainedAdjustedPlanEvidenceV3[]; readonly locks?: PlanMutationLockManager | null;
} = {}) {
  const scope = localAccountScopeSnapshot(), key = accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_V3_KEY), activeKey = activePlanBetaStorageKey()
  const retained = options.retained ?? RETAINED_ADJUSTED_PLAN_EVIDENCE_V3
  const accountWrite = captureAccountPlanWrite(activeKey)
  const locks = options.locks === undefined ? getPlanMutationLockManager() : options.locks
  const reject = (code: string) => ({ kind: "rejected" as const, code })
  if (locks === null) return reject("MUTATION_LOCK_UNAVAILABLE")
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock => {
      if (!lock || !localAccountScopeIsCurrent(scope)) return reject("STALE_BASE")
      let before: string | null = null, next: string | null = null
      try {
        const storage = accountWrite?.storage ?? window.localStorage, activeRaw = storage.getItem(activeKey), at = new Date()
        before = storage.getItem(key)
        const read = readStoredAdjustedPlanStateV5(activeRaw === null ? null : JSON.parse(activeRaw), retained, at)
        if (read.kind !== "loaded" || read.state.contentFingerprint !== expected) return reject("STALE_BASE")
        if (accountWrite) return { kind: "retained" as const }
        const archive = prepareAdjustedOriginalArchiveV3(before, read.state, retained, at)
        if (archive.kind !== "prepared") return reject(archive.kind === "full" ? "ARCHIVE_CAPACITY_REACHED" : "INVALID_STORED_ARCHIVE")
        if (archive.raw === before) return { kind: "retained" as const }
        if (!localAccountScopeIsCurrent(scope) || storage.getItem(key) !== before || storage.getItem(activeKey) !== activeRaw) return reject("STALE_BASE")
        next = archive.raw
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
