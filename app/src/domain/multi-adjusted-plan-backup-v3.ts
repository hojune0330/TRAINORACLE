import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { accountPlansEnabled } from "./account/account-plan-service"
import { importAccountPlanHistory, accountPlanExportStorage } from "./account/account-plan-domain"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { accountScopedStorageKey, localAccountScopeSnapshot } from "./account/local-account-scope"
import { MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY, parseMultiAdjustedOriginalArchiveV3 } from "./multi-adjusted-plan-archive-v3"
import { readStoredMultiAdjustedPlanV6, RETAINED_MULTI_ADJUSTED_EVIDENCE_V3 } from "./adjusted-plan-storage-v6"
import type { RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-v3"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"

const FORMAT = "trainoracle.multi-adjusted-plan.personal-backup.v3"
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-adjusted-plan-backup.v3", value)
const invalid = () => ({ kind: "invalid" as const })
export function readMultiAdjustedPlanBackupV3(raw: string, retained = RETAINED_MULTI_ADJUSTED_EVIDENCE_V3, at = new Date()) {
  try {
    const value = JSON.parse(raw)
    if (value?.format !== FORMAT || value.app !== "TRAINORACLE" || Object.keys(value).length !== 6) return invalid()
    const exported = new Date(value.exportedAt)
    if (!Number.isFinite(exported.getTime()) || exported.toISOString() !== value.exportedAt || exported > at) return invalid()
    const active = readStoredMultiAdjustedPlanV6(value.active, retained, exported)
    const archive = parseMultiAdjustedOriginalArchiveV3(value.archive === null ? null : JSON.stringify(value.archive), retained, exported)
    if (active.kind !== "loaded" || archive.kind !== "loaded") return invalid()
    const content = { app: "TRAINORACLE", format: FORMAT, exportedAt: value.exportedAt, active: active.state, archive: value.archive }
    if (hash({ ...content, contentFingerprint: hash(content) }) !== hash(value)) return invalid()
    return { kind: "read_only" as const, exportedAt: value.exportedAt as string, active: active.state, entries: archive.entries,
      executionAuthority: "NONE" as const, storageState: "NOT_RESTORED" as const }
  } catch { return invalid() }
}
export function exportMultiAdjustedPlanBackupV3(expected: string, retained = RETAINED_MULTI_ADJUSTED_EVIDENCE_V3, at = new Date()) {
  try {
    const account = localAccountScopeSnapshot(), activeKey = activePlanBetaStorageKey(), archiveKey = accountScopedStorageKey(MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY)
    const storage = accountPlanExportStorage(activeKey, archiveKey, 6)
    const activeRaw = storage.getItem(activeKey), archiveRaw = storage.getItem(archiveKey)
    const active = readStoredMultiAdjustedPlanV6(activeRaw === null ? null : JSON.parse(activeRaw), retained, at)
    if (active.kind !== "loaded" || active.state.contentFingerprint !== expected) return invalid()
    const content = { app: "TRAINORACLE", format: FORMAT, exportedAt: at.toISOString(), active: active.state,
      archive: archiveRaw === null ? null : JSON.parse(archiveRaw) }
    const raw = JSON.stringify({ ...content, contentFingerprint: hash(content) }, null, 2)
    const checked = readMultiAdjustedPlanBackupV3(raw, retained, at)
    if (checked.kind !== "read_only" || account !== localAccountScopeSnapshot()
      || storage.getItem(activeKey) !== activeRaw || storage.getItem(archiveKey) !== archiveRaw) return invalid()
    return { kind: "exported" as const, raw, archivedCount: checked.entries.length }
  } catch { return invalid() }
}
export async function importMultiAdjustedPlanHistoryV3(input: {
  readonly raw: string; readonly confirmsOwnFile: boolean; readonly isCurrentRequest: () => boolean;
  readonly readEvidence?: () => readonly RetainedMultiAdjustedEvidenceV3[]; readonly locks?: PlanMutationLockManager | null;
}) {
  const reject = (code: string) => ({ kind: "rejected" as const, code })
  if (input.confirmsOwnFile !== true || typeof input.raw !== "string") return reject("OWN_FILE_CONFIRMATION_REQUIRED")
  const raw = input.raw, account = localAccountScopeSnapshot(), key = accountScopedStorageKey(MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY), activeKey = activePlanBetaStorageKey()
  const locks = input.locks === undefined ? getPlanMutationLockManager() : input.locks
  if (!locks) return reject("MUTATION_LOCK_UNAVAILABLE")
  const current = () => account === localAccountScopeSnapshot() && input.raw === raw && input.confirmsOwnFile === true && input.isCurrentRequest()
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock || !current()) return reject("STALE_IMPORT")
      const evidence = input.readEvidence?.() ?? RETAINED_MULTI_ADJUSTED_EVIDENCE_V3, at = new Date()
      const incoming = readMultiAdjustedPlanBackupV3(raw, evidence, at)
      if (incoming.kind !== "read_only") return reject("INVALID_PLAN_FILE")
      if (accountPlansEnabled()) return importAccountPlanHistory([incoming.active, ...incoming.entries.map(e => e.state)], evidence, current)
      const before = localStorage.getItem(key), activeBefore = localStorage.getItem(activeKey)
      const archive = parseMultiAdjustedOriginalArchiveV3(before, evidence, at)
      if (archive.kind !== "loaded") return reject("INVALID_EXISTING_PLAN")
      const entries = [...archive.entries], seen = new Set(entries.map(e => e.state.selection.contentFingerprint))
      let keptExisting = 0
      for (const entry of [{ archivedAt: incoming.exportedAt, state: incoming.active }, ...incoming.entries]) {
        if (seen.has(entry.state.selection.contentFingerprint)) { keptExisting++; continue }
        seen.add(entry.state.selection.contentFingerprint); entries.push(entry)
      }
      if (entries.length > 18) return reject("ARCHIVE_CAPACITY_EXCEEDED")
      const added = entries.length - archive.entries.length
      const unchanged = () => current() && localStorage.getItem(activeKey) === activeBefore
      if (!unchanged() || localStorage.getItem(key) !== before) return reject("STALE_IMPORT")
      if (!added) return { kind: "restored_history" as const, added, keptExisting, activePlanChanged: false as const }
      entries.sort((a, b) => a.archivedAt.localeCompare(b.archivedAt))
      const content = { version: 3, entries }
      const next = JSON.stringify({ ...content, contentFingerprint: canonicalJsonFingerprint("trainoracle.multi-adjusted-original-archive.v3", content) })
      if (parseMultiAdjustedOriginalArchiveV3(next, evidence, at).kind !== "loaded") return reject("INVALID_PLAN_FILE")
      if (!unchanged() || localStorage.getItem(key) !== before) return reject("STALE_IMPORT")
      try {
        localStorage.setItem(key, next)
        if (!unchanged() || localStorage.getItem(key) !== next) throw Error("Unconfirmed import")
        return { kind: "restored_history" as const, added, keptExisting, activePlanChanged: false as const }
      } catch {
        try {
          if (localStorage.getItem(key) === next) { if (before === null) localStorage.removeItem(key); else localStorage.setItem(key, before) }
          return reject(localStorage.getItem(key) === before ? "IMPORT_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN")
        } catch { return reject("PLAN_STORAGE_STATE_UNCERTAIN") }
      }
    })
  } catch { return reject("IMPORT_UNAVAILABLE") }
}
