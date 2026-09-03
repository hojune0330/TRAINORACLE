import { canEditJournalEntry, keepsImportedObjectiveFacts, preserveJournalProvenance } from "./journal-edit-policy"
import { journalStorage, writeJournalEntries } from "./journal-local-storage"
import { isPrivateMemoEntry, removePrivateMemoWithJournalEntries } from "./private-memo-vault"
import { parseJournalEntryForWrite } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"
import { loadJournalEntriesSnapshot } from "./journal-store"
import { isJournalVisible } from "./account/local-journal-ownership"
import { samePlannedSessionLink } from "./planned-session-link"

export type UpdateEntryResult = {
  readonly ok: boolean
  readonly total: number
}

function keepsImmutableIdentity(previous: JournalEntry, next: JournalEntry): boolean {
  const keepsPlanLink = previous.kind !== "post-session" || next.kind !== "post-session"
    ? true
    : samePlannedSessionLink(previous.plannedSessionLink, next.plannedSessionLink)
  return previous.id === next.id
    && previous.kind === next.kind
    && previous.date === next.date
    && previous.syncState === next.syncState
    && keepsPlanLink
}

function hasNewerSavedAt(previous: JournalEntry, next: JournalEntry): boolean {
  const previousTime = Date.parse(previous.savedAt)
  const nextTime = Date.parse(next.savedAt)
  return Number.isFinite(nextTime)
    && (!Number.isFinite(previousTime) || nextTime > previousTime)
}

export function nextJournalSavedAt(previousSavedAt?: string): string {
  const previousTime = previousSavedAt === undefined ? Number.NaN : Date.parse(previousSavedAt)
  const nextTime = Number.isFinite(previousTime)
    ? Math.max(Date.now(), previousTime + 1)
    : Date.now()
  return new Date(nextTime).toISOString()
}

export function updateEntry(entry: unknown, expectedSavedAt: string): UpdateEntryResult {
  return updateEntryWithMemoMode(entry, expectedSavedAt, "EDIT")
}

/** Source reconciliation must not interpret a private storage shell as a memo deletion. */
export function updateEntryPreservingMemo(entry: unknown, expectedSavedAt: string): UpdateEntryResult {
  return updateEntryWithMemoMode(entry, expectedSavedAt, "PRESERVE")
}

function updateEntryWithMemoMode(entry: unknown, expectedSavedAt: string, memoMode: "EDIT" | "PRESERVE"): UpdateEntryResult {
  const snapshot = loadJournalEntriesSnapshot()
  const entries = snapshot.entries
  const nextEntry = parseJournalEntryForWrite(entry)
  if (nextEntry === null) return { ok: false, total: entries.length }
  if (!isJournalVisible(nextEntry.id)) return { ok: false, total: entries.filter((current) => isJournalVisible(current.id)).length }

  const matchingEntries = entries.filter((current) => current.id === nextEntry.id)
  if (matchingEntries.length !== 1) return { ok: false, total: entries.length }

  const entryIndex = entries.findIndex((current) => current.id === nextEntry.id)
  if (entryIndex < 0) return { ok: false, total: entries.length }
  const previous = entries[entryIndex]
  if (previous === undefined) return { ok: false, total: entries.length }
  if (!canEditJournalEntry(previous) || !keepsImportedObjectiveFacts(previous, nextEntry)) {
    return { ok: false, total: entries.length }
  }
  if (previous.savedAt !== expectedSavedAt) return { ok: false, total: entries.length }
  if (!keepsImmutableIdentity(previous, nextEntry)) return { ok: false, total: entries.length }
  if (!hasNewerSavedAt(previous, nextEntry)) return { ok: false, total: entries.length }

  const previousText = previous.kind === "evening" ? previous.note : previous.memo
  const nextText = nextEntry.kind === "evening" ? nextEntry.note : nextEntry.memo
  if (memoMode === "PRESERVE"
    && (previousText !== nextText || previous.memoPurpose !== nextEntry.memoPurpose)) {
    return { ok: false, total: entries.length }
  }

  const localStorage = journalStorage()
  if (localStorage === null) return { ok: false, total: entries.length }
  const nextEntries = entries.slice()
  nextEntries[entryIndex] = preserveJournalProvenance(previous, nextEntry)
  const removesPrivateMemo = memoMode === "EDIT" && isPrivateMemoEntry(previous)
    && (!isPrivateMemoEntry(nextEntry) || nextText.trim() === "")
  const ok = removesPrivateMemo
    ? removePrivateMemoWithJournalEntries(localStorage, nextEntries, previous.id, snapshot.raw)
    : writeJournalEntries(localStorage, nextEntries, snapshot.raw)
  return { ok, total: entries.length }
}
