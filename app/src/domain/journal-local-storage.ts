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

export function writeJournalEntries(localStorage: Storage, entries: readonly JournalEntry[]): boolean {
  if (entries.some(hasPrivateMemoText)) return false
  try {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}
