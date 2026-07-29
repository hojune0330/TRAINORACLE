import { hasImportedField } from "./field-provenance"
import { journalStorage, writeJournalEntries } from "./journal-local-storage"
import { parseJournalEntryForWrite } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"
import { loadEntries } from "./journal-store"

export type UpdateEntryResult = {
  readonly ok: boolean
  readonly total: number
}

function keepsImmutableIdentity(previous: JournalEntry, next: JournalEntry): boolean {
  return previous.id === next.id
    && previous.kind === next.kind
    && previous.date === next.date
    && previous.savedAt === next.savedAt
    && previous.syncState === next.syncState
}

function preserveLegacyProvenance(previous: JournalEntry, next: JournalEntry): JournalEntry {
  if (previous.fieldProvenance !== undefined) return next
  const { fieldProvenance: _discardedProvenance, ...legacyEntry } = next
  return legacyEntry
}

export function updateEntry(entry: unknown): UpdateEntryResult {
  const entries = loadEntries()
  const nextEntry = parseJournalEntryForWrite(entry)
  if (nextEntry === null) return { ok: false, total: entries.length }

  const entryIndex = entries.findIndex((current) => current.id === nextEntry.id)
  if (entryIndex < 0) return { ok: false, total: entries.length }
  const previous = entries[entryIndex]
  if (previous === undefined) return { ok: false, total: entries.length }
  if (previous.syncState !== "local" || hasImportedField(previous.fieldProvenance)) {
    return { ok: false, total: entries.length }
  }
  if (!keepsImmutableIdentity(previous, nextEntry)) return { ok: false, total: entries.length }

  const localStorage = journalStorage()
  if (localStorage === null) return { ok: false, total: entries.length }
  const nextEntries = entries.slice()
  nextEntries[entryIndex] = preserveLegacyProvenance(previous, nextEntry)
  return { ok: writeJournalEntries(localStorage, nextEntries), total: entries.length }
}
