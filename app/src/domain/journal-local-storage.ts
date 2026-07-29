import type { JournalEntry } from "./journal-schema"

export const JOURNAL_STORAGE_KEY = "trainoracle.journal.v1"

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
  try {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}
