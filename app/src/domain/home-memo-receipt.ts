import { loadEntries, loadJournalEntriesSnapshot, type JournalEntry } from "./journal-store"
import { activeLocalAccount, localJournalScopeGeneration } from "./account/local-journal-ownership"
import { calendarReadiness } from "./calendar-context"
import { accountFeatureEnabled } from "./account/config"
import { accountAuthState } from "./account/account-auth-state"
import { accountJournalProjectionStatus } from "./account/account-journal-projection"
import { accountJournalRecordsEnabled } from "./account/account-journal-record-service"

/** Navigation metadata only. Never retain memo plaintext on the home receipt. */
export type HomeMemoReceipt = {
  readonly scopeGeneration: number
  readonly id: string
  readonly kind: JournalEntry["kind"]
  readonly date: string
  readonly savedAt: string
  readonly storage: string
  readonly storageStatus?: "LOCAL" | "ACCOUNT" | "UNKNOWN"
  readonly review?: string
}

/** Classify only a confirmed save callback; never infer success from UI copy. */
export function homeMemoReceiptStorageStatus(entry: Pick<JournalEntry, "syncState">): NonNullable<HomeMemoReceipt["storageStatus"]> {
  if (accountJournalRecordsEnabled()) return entry.syncState === "synced" ? "ACCOUNT" : "UNKNOWN"
  return entry.syncState === "local" ? "LOCAL" : "UNKNOWN"
}

export function resolveHomeMemoReceipt(receipt: HomeMemoReceipt): { status: "READY"; entry: JournalEntry } | { status: "CHANGED" | "UNAVAILABLE" } {
  if (receipt.scopeGeneration !== localJournalScopeGeneration()) return { status: "CHANGED" }
  const entries = loadEntries()
  const readiness = calendarReadiness({ localComplete: loadJournalEntriesSnapshot().readStatus === "complete",
    owner: activeLocalAccount(), accountEnabled: accountFeatureEnabled(), auth: accountAuthState(),
    online: accountJournalProjectionStatus(), entryCount: entries.length })
  if (readiness !== "READY") return { status: "UNAVAILABLE" }
  const entry = entries.find(entry => entry.id === receipt.id && entry.kind === receipt.kind
    && entry.date === receipt.date && entry.savedAt === receipt.savedAt)
  return entry ? { status: "READY", entry } : { status: "CHANGED" }
}
