import type { JournalEntry } from "./journal-schema"
import { hasPrivateMemoText } from "./private-memo-vault"
import { JOURNAL_STORAGE_KEY } from "./journal-storage-keys"
import { announceLocalJournalChange } from "./journal-change-events"
import { journalWriteRetainsBodyMetadata } from "./body-part-metadata"
import { canonicalJournalAccess, canonicalJournalRawStorage } from "./canonical-journal-access"
import { CANONICAL_JOURNAL_MANIFEST_KEY, isCanonicalJournalWritable } from "./canonical-journal-storage"

export { JOURNAL_STORAGE_KEY }
export const JOURNAL_STORAGE_PROBE_KEY = "__to_probe__"

function sameEpoch(storage: Storage, epoch: string | null): boolean {
  try { return canonicalJournalRawStorage(storage).getItem(CANONICAL_JOURNAL_MANIFEST_KEY) === epoch }
  catch { return false }
}

export function journalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    const localStorage = window.localStorage
    const probe = JOURNAL_STORAGE_PROBE_KEY
    localStorage.setItem(probe, "1")
    localStorage.removeItem(probe)
    return canonicalJournalAccess(localStorage)
  } catch {
    return null
  }
}

export function writeJournalEntries(
  localStorage: Storage,
  entries: readonly JournalEntry[],
  expected: string | null | undefined = undefined,
): boolean {
  localStorage = canonicalJournalAccess(localStorage)
  if (entries.some(hasPrivateMemoText)) return false
  try {
    const epoch = canonicalJournalRawStorage(localStorage).getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
    const serialized = JSON.stringify(entries)
    const previous = localStorage.getItem(JOURNAL_STORAGE_KEY)
    if (!journalWriteRetainsBodyMetadata(previous, entries)) return false
    if (expected !== undefined && previous !== expected) return false
    try {
      if (!sameEpoch(localStorage, epoch)) return false
      localStorage.setItem(JOURNAL_STORAGE_KEY, serialized)
      if (localStorage.getItem(JOURNAL_STORAGE_KEY) === serialized
        && sameEpoch(localStorage, epoch)
        && isCanonicalJournalWritable(canonicalJournalRawStorage(localStorage))) {
        announceLocalJournalChange()
        return true
      }
    } catch {}

    restoreUnconfirmedJournalValue(localStorage, previous, serialized, epoch)
    return false
  } catch {
    return false
  }
}

function restoreUnconfirmedJournalValue(
  localStorage: Storage,
  previous: string | null,
  attempted: string,
  epoch: string | null,
): void {
  // A changed legacy source must stop a commit, not prevent restoring our own
  // unconfirmed write. The existing newer-value check still protects other tabs.
  localStorage = canonicalJournalRawStorage(localStorage)
  try {
    if (!sameEpoch(localStorage, epoch)) return
    const current = localStorage.getItem(JOURNAL_STORAGE_KEY)
    if (current === null || current === previous || current !== attempted && isCompleteJson(current)) return
    if (!sameEpoch(localStorage, epoch) || localStorage.getItem(JOURNAL_STORAGE_KEY) !== current) return
    if (previous === null) localStorage.removeItem(JOURNAL_STORAGE_KEY)
    else localStorage.setItem(JOURNAL_STORAGE_KEY, previous)
  } catch {}
}

function isCompleteJson(raw: string): boolean {
  try { JSON.parse(raw); return true }
  catch { return false }
}
