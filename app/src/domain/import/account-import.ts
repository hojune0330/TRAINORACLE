import type { JournalEntry, PostSessionEntry } from "../journal-schema"
import { activeLocalAccount, onLocalJournalScopeChange } from "../account/local-journal-ownership"
import { accountJournalDeletedDocuments, accountJournalDocumentId, accountJournalEntryFingerprint, accountJournalRecordsEnabled, hydrateAccountJournalRecords, persistAccountJournalRecord, readAccountJournalWriteBase, type AccountJournalWriteBase } from "../account/account-journal-record-service"
import { readAccountJournalPrivateEntry, readAccountJournalProjection } from "../account/account-journal-projection"
import { buildImportDrafts, importedProvenance, isWaitingCandidate, toImportedEntry } from "./import-draft"
import type { ImportDraftSelection, ImportFormat, ImportSaveResult } from "./import-draft"
import type { ImportedActivity } from "./activity-file"

/** A scope stays invalid after A -> B -> A, even if no promise settled in B. */
export function createAccountImportScope() {
  const ownerId = activeLocalAccount()
  let cancelled = false
  const unsubscribe = onLocalJournalScopeChange(() => {
    if (activeLocalAccount() !== ownerId) cancelled = true
  })
  return {
    ownerId,
    current: () => !cancelled && ownerId !== null && activeLocalAccount() === ownerId && accountJournalRecordsEnabled(),
    dispose: () => { cancelled = true; unsubscribe() },
  }
}

export async function isAccountImportDeleted(ownerId: string, entryId: string) {
  const documentId = await accountJournalDocumentId(ownerId, entryId)
  return accountJournalDeletedDocuments().some(item => item.documentId === documentId)
}

export async function buildAccountImportDrafts(activities: readonly ImportedActivity[]) {
  const scope = createAccountImportScope()
  try {
    if (!scope.current() || !await hydrateAccountJournalRecords() || !scope.current()) return null
    const drafts = buildImportDrafts(activities, readAccountJournalProjection().map(entry => ({ ...entry, syncState: "local" })))
    const bases = new Map<string, WriteBase>()
    for (const candidate of drafts.flatMap(draft => draft.reconciliationCandidates)) {
      if (bases.has(candidate.id)) continue
      const base = await readAccountJournalWriteBase(candidate.id)
      if (!scope.current() || !base?.entry || base.entry.savedAt !== candidate.savedAt) return null
      bases.set(candidate.id, { revision: base.revision, contentFingerprint: base.contentFingerprint })
    }
    return drafts.map((draft, sourceIndex) => ({ ...draft, sourceIndex,
      accountWriteBases: Object.fromEntries(draft.reconciliationCandidates.map(candidate => [candidate.id, bases.get(candidate.id)!])),
    }))
  } finally { scope.dispose() }
}

type WriteBase = Pick<AccountJournalWriteBase, "revision" | "contentFingerprint">
type Prepared = { entry: JournalEntry; expectedSavedAt?: string; expectedBase?: WriteBase; merged: boolean; identified?: boolean }

function sameImportedSnapshot(left: JournalEntry, right: JournalEntry) {
  const normalized = (entry: JournalEntry) => {
    const { savedAt: _time, syncState: _transport, ...body } = entry
    return JSON.stringify(body, (_key, value) => value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
  }
  return normalized(left) === normalized(right)
}

/** One confirmed batch freezes IDs, timestamps and bodies across retries. No file is uploaded. */
export function createAccountImportConfirmation(selections: readonly ImportDraftSelection[], format: ImportFormat) {
  const scope = createAccountImportScope()
  const chosen = structuredClone(selections)
  const prepared = new Map<number, Prepared>()
  const acknowledged = new Set<number>()
  let lastResult: ImportSaveResult | null = null
  let running: Promise<ImportSaveResult | null> | null = null
  for (const [index, selection] of chosen.entries()) {
    if (selection.intent.kind === "SAVE_SEPARATE") prepared.set(index, {
      entry: toImportedEntry(selection.draft.activity, format), merged: false,
    })
  }
  const run = async (): Promise<ImportSaveResult | null> => {
    const result = { account: 0, pending: 0, saved: 0, merged: 0, conflicts: 0, failed: 0, total: chosen.length }
    if (!scope.current()) return null
    if (!await hydrateAccountJournalRecords()) return scope.current() ? { ...(lastResult ?? { ...result, failed: chosen.length }) } : null
    for (const [index, { draft, intent }] of chosen.entries()) {
      if (!scope.current()) return null
      let item = prepared.get(index)
      if (item && !item.merged && !item.identified) {
        // Stable across reopening the same parsed file, including repeated rows.
        const id = await accountJournalDocumentId(scope.ownerId!, JSON.stringify([
          "confirmed-activity-import-v1", format, draft.sourceIndex ?? index, draft.activity,
        ]))
        if (!scope.current()) return null
        item.entry = { ...item.entry, id }; item.identified = true
        item.expectedBase = { revision: 0, contentFingerprint: null }
        const existing = readAccountJournalPrivateEntry(id)
        if (existing && sameImportedSnapshot(existing, item.entry)) item.entry = { ...existing, syncState: "local" }
      }
      if (acknowledged.has(index)) {
        result.account++; if (item?.merged) result.merged++; else result.saved++
        continue
      }
      const entryId = intent.kind === "ADD_TO_EXISTING" ? intent.entryId : item?.entry.id
      if (!entryId) { result.failed++; continue }
      // Rehydrate immediately before overwriting, including on retry.
      if (intent.kind === "ADD_TO_EXISTING" && !await hydrateAccountJournalRecords()) {
        if (!scope.current()) return null
        result.failed++; continue
      }
      if (!scope.current()) return null
      const deleted = await isAccountImportDeleted(scope.ownerId!, entryId)
      if (!scope.current()) return null
      if (deleted) { result.conflicts++; continue }
      if (!item && intent.kind === "ADD_TO_EXISTING") {
        const expectedBase = draft.accountWriteBases?.[intent.entryId]
        const base = await readAccountJournalWriteBase(intent.entryId)
        if (!scope.current()) return null
        if (!expectedBase || !base || base.revision !== expectedBase.revision
          || base.contentFingerprint !== expectedBase.contentFingerprint) { result.conflicts++; continue }
        const full = base.entry
        const current = full ? { ...full, syncState: "local" as const } : null
        if (!current || !isWaitingCandidate(current, draft.activity.date)
          || current.savedAt !== intent.expectedSavedAt || current.fieldProvenance === undefined) {
          result.conflicts++; continue
        }
        const imported = importedProvenance(draft.activity, format)
        const entry: PostSessionEntry = { ...current,
          savedAt: new Date(Math.max(Date.now(), Date.parse(current.savedAt) + 1)).toISOString(),
          objectiveDataState: "CONFIRMED", distanceKm: draft.activity.distanceKm,
          durationMin: draft.activity.durationMin, avgPace: draft.activity.avgPace,
          fieldProvenance: { ...current.fieldProvenance,
            distanceKm: imported.distanceKm!, durationMin: imported.durationMin!, avgPace: imported.avgPace! },
        }
        item = { entry, expectedSavedAt: intent.expectedSavedAt, expectedBase, merged: true }
        prepared.set(index, item)
      }
      if (!item || !scope.current()) return null
      const current = readAccountJournalPrivateEntry(entryId)
      const fingerprint = current ? await accountJournalEntryFingerprint(current) : null
      const retryFingerprint = await accountJournalEntryFingerprint(item.entry)
      if (!scope.current()) return null
      if (fingerprint !== retryFingerprint && fingerprint !== item.expectedBase?.contentFingerprint) { result.conflicts++; continue }
      try {
        const saved = await persistAccountJournalRecord(item.entry, item.expectedSavedAt, "MIGRATION", item.expectedBase)
        if (!scope.current()) return null
        if (!saved.ok) result.failed++
        else if (saved.storage === "CONFLICT") result.conflicts++
        else if (saved.storage === "PENDING") result.pending++
        else { acknowledged.add(index); result.account++; if (item.merged) result.merged++; else result.saved++ }
      } catch { if (!scope.current()) return null; result.failed++ }
    }
    lastResult = { ...result }
    return result
  }
  return {
    confirm: () => {
      if (running) return running
      running = run().finally(() => { running = null })
      return running
    },
    dispose: scope.dispose,
  }
}
