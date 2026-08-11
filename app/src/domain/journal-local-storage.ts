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
    const serialized = JSON.stringify(entries)
    const previous = localStorage.getItem(JOURNAL_STORAGE_KEY)
    try {
      localStorage.setItem(JOURNAL_STORAGE_KEY, serialized)
      if (localStorage.getItem(JOURNAL_STORAGE_KEY) === serialized) return true
    } catch {}

    try {
      if (previous === null) localStorage.removeItem(JOURNAL_STORAGE_KEY)
      else localStorage.setItem(JOURNAL_STORAGE_KEY, previous)
    } catch {}
    return false
  } catch {
    return false
  }
}
