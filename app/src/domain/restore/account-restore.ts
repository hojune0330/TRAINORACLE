import { accountJournalEntryFingerprint, accountJournalRecordsEnabled, hydrateAccountJournalRecords, persistAccountJournalRecord, readAccountJournalWriteBase, type AccountJournalWriteBase } from "../account/account-journal-record-service"
import { readAccountJournalPrivateEntry } from "../account/account-journal-projection"
import { validateAccountJournalRecordUpdate } from "../account/account-journal-record-schema"
import { accountDecorationStatus, hydrateAccountDecorations, persistAccountDecorations, readAccountDecorationState } from "../account/account-decoration-service"
import { createAccountImportScope, isAccountImportDeleted } from "../import/account-import"
import { parseJournalEntryForWrite, type JournalEntry } from "../journal-schema"
import { buildRestorePlan, type BackupReadResult, type DecorationRestoreMode, type RestoreMode, type RestorePlan } from "./backup-file"

export type AccountRestoreOutcome = {
  account: number; pending: number; conflicts: number; failed: number
  keptExisting: number; blockedByDeletion: number; total: number
  decorationRestore: "NOT_INCLUDED" | "INVALID_SKIPPED" | "KEPT_EXISTING" | "ACCOUNT" | "PENDING" | "CONFLICT" | "FAILED"
  decorationFailure: "NONE" | "READ_FAILED" | "STATE_CHANGED" | "OWNERSHIP_UNVERIFIED"
  commit: "COMPLETE" | "PARTIAL" | "PENDING" | "FAILED"
}

/** The review owns its account and original backup; no legacy store or rollback is used. */
export async function createAccountBackupRestoration(source: BackupReadResult) {
  const scope = createAccountImportScope()
  const read = structuredClone(source)
  if (!read.recognized || !scope.current() || !await hydrateAccountJournalRecords() || !scope.current()) {
    scope.dispose(); return null
  }
  const reviewed = new Map<string, JournalEntry>()
  const reviewedBases = new Map<string, Pick<AccountJournalWriteBase, "revision" | "contentFingerprint">>()
  const deletedIds = new Set<string>()
  for (const entry of read.entries) {
    if (await isAccountImportDeleted(scope.ownerId!, entry.id)) deletedIds.add(entry.id)
    if (!scope.current()) { scope.dispose(); return null }
    if (deletedIds.has(entry.id)) continue
    const base = await readAccountJournalWriteBase(entry.id)
    if (!scope.current() || !base) { scope.dispose(); return null }
    reviewedBases.set(entry.id, { revision: base.revision, contentFingerprint: base.contentFingerprint })
    if (base.entry) reviewed.set(entry.id, base.entry)
  }
  const plan: RestorePlan = buildRestorePlan(read.entries, [...reviewed.values()], deletedIds)
  let decorationBase: string | null = null
  if (read.decorationStatus === "included" && read.decorations) {
    try {
      if (await hydrateAccountDecorations() && scope.current()) {
        const state = readAccountDecorationState()
        if (state) decorationBase = JSON.stringify(state)
      }
    } catch { /* Journal restoration remains independently available. */ }
    if (!scope.current()) { scope.dispose(); return null }
  }
  const prepared = new Map<string, { entry: JournalEntry; expectedSavedAt?: string;
    expectedBase: Pick<AccountJournalWriteBase, "revision" | "contentFingerprint"> }>()
  const acknowledged = new Set<string>()
  let lastResult: AccountRestoreOutcome | null = null
  let running: Promise<AccountRestoreOutcome | null> | null = null
  let confirmedMode: RestoreMode | null = null
  let confirmedDecorationMode: DecorationRestoreMode | null = null
  let decorationAttempted = false
  const restoreDecorations = async (mode: DecorationRestoreMode): Promise<Pick<AccountRestoreOutcome, "decorationRestore" | "decorationFailure">> => {
    if (read.decorationStatus === "not-included") return { decorationRestore: "NOT_INCLUDED", decorationFailure: "NONE" }
    if (read.decorationStatus === "invalid" || !read.decorations) return { decorationRestore: "INVALID_SKIPPED", decorationFailure: "NONE" }
    if (mode !== "replace") return { decorationRestore: "KEPT_EXISTING", decorationFailure: "NONE" }
    if (lastResult?.decorationRestore === "ACCOUNT") return { decorationRestore: "ACCOUNT", decorationFailure: "NONE" }
    if (decorationBase === null) return { decorationRestore: "FAILED", decorationFailure: "READ_FAILED" }
    try {
      const hydrated = await hydrateAccountDecorations()
      if (!scope.current()) return { decorationRestore: "FAILED", decorationFailure: "READ_FAILED" }
      if (!hydrated) {
        const state = accountDecorationStatus()
        return state === "CONFLICT" ? { decorationRestore: "CONFLICT", decorationFailure: "STATE_CHANGED" }
          : lastResult?.decorationRestore === "PENDING" && state === "PENDING"
            ? { decorationRestore: "PENDING", decorationFailure: "NONE" }
            : { decorationRestore: "FAILED", decorationFailure: "READ_FAILED" }
      }
      const current = readAccountDecorationState()
      const serialized = current ? JSON.stringify(current) : null
      if (decorationAttempted && serialized === JSON.stringify(read.decorations)) {
        return { decorationRestore: "ACCOUNT", decorationFailure: "NONE" }
      }
      if (serialized !== decorationBase) return { decorationRestore: "CONFLICT", decorationFailure: "STATE_CHANGED" }
      if (!scope.current()) return { decorationRestore: "FAILED", decorationFailure: "READ_FAILED" }
      decorationAttempted = true
      const saved = await persistAccountDecorations(read.decorations, decorationBase)
      if (saved.ok) return { decorationRestore: saved.storage, decorationFailure: "NONE" }
      return saved.code === "STALE_STATE" ? { decorationRestore: "CONFLICT", decorationFailure: "STATE_CHANGED" }
        : { decorationRestore: "FAILED", decorationFailure: "OWNERSHIP_UNVERIFIED" }
    } catch { return { decorationRestore: "FAILED", decorationFailure: "OWNERSHIP_UNVERIFIED" } }
  }
  const run = async (mode: RestoreMode, decorationMode: DecorationRestoreMode): Promise<AccountRestoreOutcome | null> => {
    if (!scope.current() || !accountJournalRecordsEnabled()) return null
    const result: AccountRestoreOutcome = { account: 0, pending: 0, conflicts: 0, failed: 0,
      keptExisting: 0, blockedByDeletion: 0, total: plan.items.length,
      decorationRestore: "NOT_INCLUDED", decorationFailure: "NONE", commit: "FAILED" }
    const hydrated = await hydrateAccountJournalRecords()
    if (!scope.current()) return null
    if (!hydrated && lastResult) {
      const { account, pending, conflicts, failed, keptExisting, blockedByDeletion } = lastResult
      Object.assign(result, { account, pending, conflicts, failed, keptExisting, blockedByDeletion })
    }
    for (const { entry: original } of !hydrated && lastResult ? [] : plan.items) {
      if (!scope.current()) return null
      if (acknowledged.has(original.id)) { result.account++; continue }
      if (!hydrated) { result.failed++; continue }
      if (deletedIds.has(original.id) || await isAccountImportDeleted(scope.ownerId!, original.id)) {
        if (!scope.current()) return null
        result.blockedByDeletion++; continue
      }
      if (!scope.current()) return null
      const before = reviewed.get(original.id)
      let item = prepared.get(original.id)
      let current = readAccountJournalPrivateEntry(original.id)
      if (!item && current && mode === "keep-existing") { result.keptExisting++; continue }
      if (before || current) {
        if (!await hydrateAccountJournalRecords()) { if (!scope.current()) return null; result.failed++; continue }
        if (!scope.current()) return null
        if (await isAccountImportDeleted(scope.ownerId!, original.id)) {
          if (!scope.current()) return null
          result.blockedByDeletion++; continue
        }
        if (!scope.current()) return null
        current = readAccountJournalPrivateEntry(original.id)
      }
      if (!item) {
        const expectedBase = reviewedBases.get(original.id)
        const base = await readAccountJournalWriteBase(original.id)
        if (!scope.current()) return null
        if (!expectedBase || !base || base.revision !== expectedBase.revision
          || base.contentFingerprint !== expectedBase.contentFingerprint) { result.conflicts++; continue }
        current = base.entry
        // Safe exports have no memo authority: keep the full existing private text.
        const preservedMemo = read.kind === "safe" && current
          ? { ...(current.kind === "evening" ? { note: current.note } : { memo: current.memo }), ...(current.memoPurpose ? { memoPurpose: current.memoPurpose } : {}) }
          : {}
        const candidate = parseJournalEntryForWrite({ ...original, ...preservedMemo, syncState: "local",
          ...(current ? { savedAt: new Date(Math.max(Date.now(), Date.parse(current.savedAt) + 1)).toISOString() } : {}),
        })
        if (!candidate) { result.failed++; continue }
        // Reject, rather than silently rewrite, backup provenance/immutable facts.
        if (current && !validateAccountJournalRecordUpdate(
          { version: 2, kind: "JOURNAL", state: "FINALIZED", entry: { ...current, syncState: "local" } },
          { version: 2, kind: "JOURNAL", state: "FINALIZED", entry: candidate },
        )) { result.conflicts++; continue }
        item = { entry: candidate, expectedBase, ...(current ? { expectedSavedAt: current.savedAt } : {}) }
        prepared.set(original.id, item)
      }
      const currentFingerprint = current ? await accountJournalEntryFingerprint(current) : null
      const retryFingerprint = await accountJournalEntryFingerprint(item.entry)
      if (!scope.current()) return null
      if (currentFingerprint !== retryFingerprint && currentFingerprint !== item.expectedBase.contentFingerprint) { result.conflicts++; continue }
      try {
        const saved = await persistAccountJournalRecord(item.entry, item.expectedSavedAt, "MIGRATION", item.expectedBase)
        if (!scope.current()) return null
        if (!saved.ok) result.failed++
        else if (saved.storage === "CONFLICT") result.conflicts++
        else if (saved.storage === "PENDING") result.pending++
        else { acknowledged.add(original.id); result.account++ }
      } catch { if (!scope.current()) return null; result.failed++ }
    }
    if (!scope.current()) return null
    Object.assign(result, await restoreDecorations(decorationMode))
    if (!scope.current()) return null
    const successes = result.account + (result.decorationRestore === "ACCOUNT" ? 1 : 0)
    const waiting = result.pending + (result.decorationRestore === "PENDING" ? 1 : 0)
    const errors = result.failed + result.conflicts + (["FAILED", "CONFLICT", "INVALID_SKIPPED"].includes(result.decorationRestore) ? 1 : 0)
    result.commit = errors === 0 && waiting === 0 ? "COMPLETE"
      : successes > 0 ? "PARTIAL" : waiting > 0 && errors === 0 ? "PENDING" : "FAILED"
    lastResult = { ...result }
    return result
  }
  return { plan, read, decorationReady: decorationBase !== null,
    confirm: (mode: RestoreMode = "keep-existing", decorationMode: DecorationRestoreMode = "keep-existing") => {
      if (running) return running
      confirmedMode ??= mode
      confirmedDecorationMode ??= decorationMode
      running = run(confirmedMode, confirmedDecorationMode).finally(() => { running = null })
      return running
    },
    dispose: scope.dispose,
  }
}
