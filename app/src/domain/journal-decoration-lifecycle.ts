import { loadDecorationState, saveDecorationState } from "./decorations"
import { JOURNAL_STORAGE_KEY, journalStorage } from "./journal-local-storage"
import { parseJournalEntryList } from "./journal-schema"

function activeJournalDates(storage: Storage): ReadonlySet<string> | null {
  try {
    const raw = storage.getItem(JOURNAL_STORAGE_KEY)
    if (raw === null) return new Set()
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return null
    return new Set(parseJournalEntryList(value).map((entry) => entry.date))
  } catch {
    return null
  }
}

export function pruneUnusedJournalDecorations(
  candidateDates: readonly string[],
  recoverableTrashDates: readonly string[],
): boolean {
  const storage = journalStorage()
  if (storage === null) return false
  const activeDates = activeJournalDates(storage)
  if (activeDates === null) return false
  const candidates = new Set(candidateDates)
  const recoverable = new Set(recoverableTrashDates)
  const current = loadDecorationState()
  const pages = current.pages.filter((page) => (
    !candidates.has(page.date)
    || activeDates.has(page.date)
    || recoverable.has(page.date)
  ))
  if (pages.length === current.pages.length) return true
  return saveDecorationState({ ...current, pages }).ok
}
