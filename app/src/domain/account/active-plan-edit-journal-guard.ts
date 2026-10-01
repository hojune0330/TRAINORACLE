import { parseAccountJournalRecord } from "./account-journal-record-schema"
import { activePlanEditFingerprint, type ActivePlanEditReceipt } from "../active-plan-edit-policy"
import { executionReplanEvidence } from "../execution-replan"
import { isoShift } from "../dates"
import type { JournalEntry } from "../journal-schema"

const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/u.test(date)

function protectsSlot(entry: JournalEntry, date: string, slot: "AM" | "PM") {
  if (entry.kind !== "post-session") return false
  const link = entry.plannedSessionLink
  const actualDateMatches = entry.date === date
  const plannedDateMatches = link?.plannedDate === date && link.sessionSlot === slot
  if (plannedDateMatches) return true
  if (!actualDateMatches) return false
  if (link?.sessionSlot === slot) return true
  const actualSlot = entry.activitySlot
  return actualSlot === undefined || actualSlot === "UNSPECIFIED" || actualSlot === "SINGLE" || actualSlot === slot
}

/** Server-memory projection only. Raw memo and all journal text stay inside this function's caller. */
export function projectActivePlanEditJournal(value: unknown, receipt: ActivePlanEditReceipt) {
  const record = parseAccountJournalRecord(value)
  if (!record) return null
  const sourceDate = isoShift(receipt.startDate, receipt.source.day - 1)
  const targetDate = receipt.target ? isoShift(receipt.startDate, receipt.target.day - 1) : null
  return {
    evidence: executionReplanEvidence([record.entry])[0]!,
    protectsSource: protectsSlot(record.entry, sourceDate, receipt.source.slot),
    protectsTarget: !!receipt.target && targetDate !== null && protectsSlot(record.entry, targetDate, receipt.target.slot),
  }
}

export function validateActivePlanEditJournalFacts(receipt: ActivePlanEditReceipt,
  facts: readonly NonNullable<ReturnType<typeof projectActivePlanEditJournal>>[]) {
  if (facts.some(fact => fact.protectsSource || fact.protectsTarget)) return false
  const evidence = facts.map(fact => fact.evidence).sort((a, b) => a.id.localeCompare(b.id))
  return new Set(evidence.map(entry => entry.id)).size === evidence.length
    && activePlanEditFingerprint(evidence) === receipt.evidenceFingerprint
}

export function activePlanEditClockIsCurrent(receipt: ActivePlanEditReceipt, now: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: receipt.timeZone,
      year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
    const value = (type: string) => parts.find(part => part.type === type)?.value
    const today = `${value("year")}-${value("month")}-${value("day")}`
    const sourceDate = isoShift(receipt.startDate, receipt.source.day - 1)
    const targetDate = receipt.target ? isoShift(receipt.startDate, receipt.target.day - 1) : null
    return validDate(today) && today === receipt.today && validDate(sourceDate) && sourceDate >= today
      && (targetDate === null || validDate(targetDate) && targetDate >= today)
      && Date.parse(receipt.acceptedAt) <= now.getTime()
  } catch { return false }
}
