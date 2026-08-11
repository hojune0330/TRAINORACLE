import { parseJournalEntryList } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"
import { hasPrivateMemoText } from "./private-memo-vault"
import { JOURNAL_STORAGE_KEY } from "./journal-storage-keys"

export { JOURNAL_STORAGE_KEY }

export function journalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    const localStorage = window.localStorage
    const probe = "__to_probe__"
    localStorage.setItem(probe, "1")
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

export function writeJournalEntries(
  localStorage: Storage,
  entries: readonly JournalEntry[],
  expected: string | null | undefined = undefined,
): boolean {
  if (entries.some(hasPrivateMemoText)) return false
  try {
    const serialized = JSON.stringify(entries)
    const previous = localStorage.getItem(JOURNAL_STORAGE_KEY)
    if (expected !== undefined && previous !== expected) return false
    try {
      localStorage.setItem(JOURNAL_STORAGE_KEY, serialized)
      if (localStorage.getItem(JOURNAL_STORAGE_KEY) === serialized) return true
    } catch {}

    restoreUnconfirmedJournalValue(localStorage, previous, serialized)
    return false
  } catch {
    return false
  }
}

function restoreUnconfirmedJournalValue(
  localStorage: Storage,
  previous: string | null,
  attempted: string,
): void {
  try {
    const current = localStorage.getItem(JOURNAL_STORAGE_KEY)
    if (current === null || (current !== attempted && isValidJournalList(current))) return
    if (previous === null) localStorage.removeItem(JOURNAL_STORAGE_KEY)
    else localStorage.setItem(JOURNAL_STORAGE_KEY, previous)
  } catch {}
}

function isValidJournalList(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parseJournalEntryList(parsed).length === parsed.length
  } catch {
    return false
  }
}
