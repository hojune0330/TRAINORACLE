import { parseAccountJournalRecord } from "./account-journal-record-schema"
import { journalProtectsCatalogSlot } from "../catalog-replacement"
import { executionReplanEvidence, replanFingerprint } from "../execution-replan"
import { isoShift } from "../dates"
import { catalogReplacementLocalDate, type CatalogReplacementReceipt } from "../catalog-replacement-policy"

export function catalogReplacementClockIsCurrent(receipt: CatalogReplacementReceipt, now: Date) {
  const today = catalogReplacementLocalDate(now, receipt.timeZone)
  return today !== null && today === receipt.today && isoShift(receipt.startDate, receipt.source.day - 1) > today
}

/** Server-memory projection only. Raw memo/title and their hashes never enter the guard. */
export function projectCatalogReplacementJournal(value: unknown, receipt: CatalogReplacementReceipt) {
  const record = parseAccountJournalRecord(value)
  if (!record) return null
  const date = isoShift(receipt.startDate, receipt.source.day - 1)
  return { evidence: executionReplanEvidence([record.entry])[0]!,
    protectsSource: journalProtectsCatalogSlot(record.entry, date, receipt.source.slot) }
}

export function validateCatalogReplacementJournalFacts(receipt: CatalogReplacementReceipt,
  facts: readonly NonNullable<ReturnType<typeof projectCatalogReplacementJournal>>[]) {
  if (facts.some(fact => fact.protectsSource)) return false
  const evidence = facts.map(fact => fact.evidence).sort((a, b) => a.id.localeCompare(b.id))
  return new Set(evidence.map(entry => entry.id)).size === evidence.length
    && replanFingerprint(evidence) === receipt.evidenceFingerprint
}
