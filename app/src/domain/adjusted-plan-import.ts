import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { readAdjustedPlanBackup } from "./adjusted-plan-backup"
import { ADJUSTED_PLAN_ARCHIVE_KEY, parseAdjustedOriginalArchive } from "./adjusted-plan-archive"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { accountScopedStorageKey, localAccountScopeSnapshot } from "./account/local-account-scope"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE } from "./adjusted-plan-storage-schema"
import type { RetainedAdjustedPlanEvidence } from "./selected-adjusted-plan-content"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"

export async function importAdjustedPlanHistory(input: {
  readonly raw: string; readonly confirmsOwnFile: boolean; readonly isCurrentRequest: () => boolean;
  readonly readEvidence?: () => readonly RetainedAdjustedPlanEvidence[]; readonly locks?: PlanMutationLockManager | null;
}) {
  const reject = (code: string) => ({ kind: "rejected" as const, code })
  if (input.confirmsOwnFile !== true || typeof input.raw !== "string") return reject("OWN_FILE_CONFIRMATION_REQUIRED")
  const raw = input.raw
  const account = localAccountScopeSnapshot()
  const key = accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_KEY)
  const activeKey = activePlanBetaStorageKey()
  const locks = input.locks === undefined ? getPlanMutationLockManager() : input.locks
  if (!locks) return reject("MUTATION_LOCK_UNAVAILABLE")
  const current = () => account === localAccountScopeSnapshot() && input.raw === raw && input.confirmsOwnFile === true && input.isCurrentRequest()
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock => {
      if (!lock || !current()) return reject("STALE_IMPORT")
      const evidence = input.readEvidence?.() ?? RETAINED_ADJUSTED_PLAN_EVIDENCE
      const now = new Date()
      const incoming = readAdjustedPlanBackup(raw, evidence, now)
      if (incoming.kind !== "read_only") return reject("INVALID_PLAN_FILE")
      const before = localStorage.getItem(key)
      const activeBefore = localStorage.getItem(activeKey)
      const archive = parseAdjustedOriginalArchive(before, evidence, now)
      const active = readPlanBetaStateFromStorage(evidence)
      if (archive.kind !== "loaded" || active.kind === "invalid" || active.kind === "storage_error") return reject("INVALID_EXISTING_PLAN")
      const entries = [...archive.entries]
      const seen = new Set(entries.map(entry => entry.state.selection.contentFingerprint))
      if (active.kind === "adjusted_loaded") seen.add(active.state.selection.contentFingerprint)
      let keptExisting = 0
      // Existing local versions win; within the file, its active snapshot is newer
      // than an earlier retained copy of the same immutable selection.
      for (const entry of [{ archivedAt: incoming.exportedAt, state: incoming.active }, ...incoming.entries]) {
        if (seen.has(entry.state.selection.contentFingerprint)) { keptExisting += 1; continue }
        seen.add(entry.state.selection.contentFingerprint); entries.push(entry)
      }
      if (entries.length > 18) return reject("ARCHIVE_CAPACITY_EXCEEDED")
      const added = entries.length - archive.entries.length
      const unchanged = () => current() && localStorage.getItem(activeKey) === activeBefore
      if (!unchanged() || localStorage.getItem(key) !== before) return reject("STALE_IMPORT")
      if (added === 0) return { kind: "restored_history" as const, added, keptExisting, activePlanChanged: false as const }
      entries.sort((a, b) => a.archivedAt.localeCompare(b.archivedAt))
      const content = { version: 1, entries }
      const next = JSON.stringify({ ...content, contentFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-original-archive.v1", content) })
      if (parseAdjustedOriginalArchive(next, evidence, now).kind !== "loaded") return reject("INVALID_PLAN_FILE")
      if (!unchanged() || localStorage.getItem(key) !== before) return reject("STALE_IMPORT")
      try {
        localStorage.setItem(key, next)
        if (!unchanged() || localStorage.getItem(key) !== next) throw Error("Unconfirmed import")
        return { kind: "restored_history" as const, added, keptExisting, activePlanChanged: false as const }
      } catch {
        try {
          if (localStorage.getItem(key) === next) {
            if (before === null) localStorage.removeItem(key); else localStorage.setItem(key, before)
          }
          return reject(localStorage.getItem(key) === before ? "IMPORT_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN")
        } catch { return reject("PLAN_STORAGE_STATE_UNCERTAIN") }
      }
    })
  } catch { return reject("IMPORT_UNAVAILABLE") }
}
