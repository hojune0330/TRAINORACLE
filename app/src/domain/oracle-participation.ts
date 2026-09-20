import { isEligibleForAnalysis } from "./field-provenance"
import type { JournalEntry } from "./journal-store"
import { createSavedFactReceipt } from "./save-receipt"
import { createOracleReturnStore, type OracleReturnStore } from "./oracle-return-state"

/** A successful structured save, not opening the app or writing private text. */
export function recordOracleJournalParticipation(entry: JournalEntry, store: OracleReturnStore = createOracleReturnStore()) {
  const rest = entry.kind === "post-session" && isEligibleForAnalysis("system", entry.fieldProvenance) && entry.system === "rest"
  const rpe = entry.kind === "post-session" && isEligibleForAnalysis("rpe", entry.fieldProvenance)
    && Number.isInteger(entry.rpe) && entry.rpe >= 1 && entry.rpe <= 10
  if (!rest && !rpe && createSavedFactReceipt(entry).kind === "generic") return null
  return store.recordParticipation(rest ? "rest-recorded" : "journal-saved")
}
