import { parseAccountJournalRecord } from "./account-journal-record-schema"
import { journalProtectsPlanSlot } from "../recorded-plan-slots"
import { executionReplanEvidence, replanFingerprint } from "../execution-replan"
import { isoShift } from "../dates"
import { catalogReplacementLocalDate, type CatalogReplacementReceipt } from "../catalog-replacement-policy"
import { replayExecutionReplan, replanKey, type ExecutionReplanReceipt } from "../execution-replan-policy"
import { resolveExecutionReplanSource } from "../execution-replan-source"
import { reviewPlanExecution } from "../plan-execution-review"
import { materializeAccountPlan, type AccountPlanDocument } from "./account-plan-document-schema"

export function executionReplanSourceContext(document: AccountPlanDocument | null) {
  const active = document?.data.plans.find(p => p.planId === document.data.currentPlanId && p.archivedAt === null)
  const state = active ? materializeAccountPlan(active).state : null
  if (state?.version !== 3 || state.progress.some(p => p.state === "PAIN_CHECKIN")) return null
  return { state, archivedPlans: document!.data.plans.filter(p => p.archivedAt !== null).map(p => materializeAccountPlan(p).state) }
}

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

export function projectExecutionReplanJournal(value: unknown, receipt: ExecutionReplanReceipt,
  context?: ReturnType<typeof executionReplanSourceContext>) {
  const record = parseAccountJournalRecord(value), after = replayExecutionReplan(receipt)
  if (!record || !after) return null
  const changed = receipt.baseSessions.filter(before => replanFingerprint(before)
    !== replanFingerprint(after.find(next => replanKey(next) === replanKey(before))))
  // Moving into an occupied slot is forbidden even when both workout structures happen to match.
  const affected = [...changed, receipt.source, ...(receipt.action === "MOVE_LATER" && receipt.target ? [receipt.target] : [])]
  const entry = record.entry
  let sourceEligible = false
  if (context && entry.id === receipt.sourceJournalId && entry.kind === "post-session"
    && entry.date <= receipt.today && entry.activityOutcome && entry.plannedSessionLink) {
    const original = resolveExecutionReplanSource(context.state, entry.plannedSessionLink, context.archivedPlans)
    if (original) {
      const review = reviewPlanExecution(entry, original)
      sourceEligible = !["SAFETY_REVIEW", "CONFLICT", "SOURCE_UNAVAILABLE"].includes(review.status)
        && review.repetitionComparison?.kind !== "unavailable"
    }
  }
  return { evidence: executionReplanEvidence([record.entry])[0]!,
    sourceEligible,
    protectsSource: affected.some(slot => journalProtectsPlanSlot(record.entry,
      isoShift(receipt.startDate, slot.day - 1), slot.slot)) }
}

export function validateExecutionReplanJournalFacts(receipt: ExecutionReplanReceipt,
  facts: readonly NonNullable<ReturnType<typeof projectExecutionReplanJournal>>[],
  context: ReturnType<typeof executionReplanSourceContext>) {
  if (!context || !validateCatalogReplacementJournalFacts(receipt, facts)) return false
  const source = facts.find(f => f.evidence.id === receipt.sourceJournalId)
  if (!source?.sourceEligible || !("link" in source.evidence) || !source.evidence.link) return false
  const link = source.evidence.link
  return facts.filter(f => "link" in f.evidence && f.evidence.link
    && (f.evidence.link.plannedSessionId === link.plannedSessionId
      || f.evidence.link.plannedDate === link.plannedDate && f.evidence.link.sessionDay === link.sessionDay
        && f.evidence.link.sessionSlot === link.sessionSlot
        && resolveExecutionReplanSource(context.state, f.evidence.link, context.archivedPlans))).length === 1
}

export function validateCatalogReplacementJournalFacts(receipt: Pick<CatalogReplacementReceipt, "evidenceFingerprint">,
  facts: readonly NonNullable<ReturnType<typeof projectCatalogReplacementJournal>>[]) {
  if (facts.some(fact => fact.protectsSource)) return false
  const evidence = facts.map(fact => fact.evidence).sort((a, b) => a.id.localeCompare(b.id))
  return new Set(evidence.map(entry => entry.id)).size === evidence.length
    && replanFingerprint(evidence) === receipt.evidenceFingerprint
}
