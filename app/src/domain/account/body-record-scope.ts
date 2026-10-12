import type { JournalEntry } from "../journal-schema"
import { activeLocalAccount, filterJournalEntriesByExactOwner, localJournalScopeGeneration } from "./local-journal-ownership"
import { readAccountJournalProjection } from "./account-journal-projection"

/** Owner-private history/recent names only. Account acknowledged cache does not
 * need a device ownership ledger; guest records cannot become account history. */
export function filterOwnerBodyEntries(entries: readonly JournalEntry[]): JournalEntry[] {
  const ownerId = activeLocalAccount(), generation = localJournalScopeGeneration()
  const localIds = new Set(filterJournalEntriesByExactOwner(entries, ownerId).map(entry => entry.id))
  const confirmed = ownerId === null ? [] : readAccountJournalProjection()
  const confirmedById = new Map(confirmed.map(entry => [entry.id, entry]))
  const visible = entries.filter(entry => {
    const remote = confirmedById.get(entry.id)
    if (remote) return entry.kind === remote.kind && entry.date === remote.date && entry.savedAt === remote.savedAt
      && JSON.stringify(entry.bodyPartMetadata ?? null) === JSON.stringify(remote.bodyPartMetadata ?? null)
    return localIds.has(entry.id)
  })
  return activeLocalAccount() === ownerId && localJournalScopeGeneration() === generation ? visible : []
}
