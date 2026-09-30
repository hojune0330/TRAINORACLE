import { parseAccountJournalRecord } from "./account-journal-record-schema"
import { journalProtectsPlanSlot } from "../recorded-plan-slots"
import { executionReplanEvidence, replanFingerprint } from "../execution-replan"
import { isoShift } from "../dates"
import { catalogReplacementLocalDate, type CatalogReplacementReceipt } from "../catalog-replacement-policy"
import { replayExecutionReplan, replanKey, type ExecutionReplanReceipt } from "../execution-replan-policy"

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
    protectsSource: journalProtectsPlanSlot(record.entry, date, receipt.source.slot) }
}

export function projectExecutionReplanJournal(value: unknown, receipt: ExecutionReplanReceipt) {
  const record = parseAccountJournalRecord(value), after = replayExecutionReplan(receipt)
  if (!record || !after) return null
  const changed = receipt.baseSessions.filter(before => replanFingerprint(before)
    !== replanFingerprint(after.find(next => replanKey(next) === replanKey(before))))
  // Moving into an occupied slot is forbidden even when both workout structures happen to match.
  const affected = [...changed, receipt.source, ...(receipt.action === "MOVE_LATER" && receipt.target ? [receipt.target] : [])]
  return { evidence: executionReplanEvidence([record.entry])[0]!,
    protectsSource: affected.some(slot => journalProtectsPlanSlot(record.entry,
      isoShift(receipt.startDate, slot.day - 1), slot.slot)) }
}

export function validateCatalogReplacementJournalFacts(receipt: Pick<CatalogReplacementReceipt, "evidenceFingerprint">,
  facts: readonly NonNullable<ReturnType<typeof projectCatalogReplacementJournal>>[]) {
  if (facts.some(fact => fact.protectsSource)) return false
  const evidence = facts.map(fact => fact.evidence).sort((a, b) => a.id.localeCompare(b.id))
  return new Set(evidence.map(entry => entry.id)).size === evidence.length
    && replanFingerprint(evidence) === receipt.evidenceFingerprint
}
