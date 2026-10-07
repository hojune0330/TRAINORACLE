import { cacheConfirmedAthleteRecords, createSelfReportedAthleteRecord } from "../athlete-records"
import { prepareInstantPlanEntry, readInstantPlanEntry } from "../instant-plan-entry"
import { canonicalPaceDistance } from "@impl/prescription/record-pace"
import type { InstantPlanEntry } from "../instant-plan-contract"
import { localAccountScopeIsCurrent, localAccountScopeSnapshot } from "./local-account-scope"
import { localJournalScopeGeneration } from "./local-journal-ownership"
import { accountAthleteRecordsEnabled, addAccountAthleteRecord, loadAccountAthleteRecords } from "./account-athlete-record-service"
import { eligibleAccountPaceRecords } from "./eligible-account-pace-records"

export type AccountInstantPlanEntryResult =
  | { kind: "ready" | "cache_failed"; entry: InstantPlanEntry; recordId: string | null }
  | { kind: "invalid" | "storage_failed" | "pending" }

export async function prepareAccountInstantPlanEntry(value: unknown, now = new Date()): Promise<AccountInstantPlanEntryResult> {
  const scope = localAccountScopeSnapshot()
  const generation = localJournalScopeGeneration()
  const isCurrentScope = () => localAccountScopeIsCurrent(scope) && localJournalScopeGeneration() === generation
  if (!scope) return prepareInstantPlanEntry(value, now)
  const entry = readInstantPlanEntry(value, now)
  if (!entry) return { kind: "invalid" }
  if (entry.kind === "NO_RECORD") return { kind: "ready", entry, recordId: null }
  if (!accountAthleteRecordsEnabled()) return { kind: "storage_failed" }
  try {
    const current = await loadAccountAthleteRecords()
    if (!isCurrentScope()) return { kind: "storage_failed" }
    if (current.status === "PENDING") return { kind: "pending" }
    if (current.ownerId !== scope || !["READY", "EMPTY"].includes(current.status) || current.serverRevision === null
      || current.status === "READY" && !current.confirmed) return { kind: "storage_failed" }
    const existing = eligibleAccountPaceRecords([], scope, current).find(record => canonicalPaceDistance(record.eventDistanceM) === canonicalPaceDistance(entry.eventDistanceM)
      && record.performanceSeconds === entry.performanceSeconds
      && (entry.kind === "CURRENT_RECORD" ? record.purpose !== "RACE_GOAL" && record.achievedOn === entry.achievedOn : record.purpose === "RACE_GOAL"))
    if (existing) {
      // Reuse acknowledged server data on retry, even if the previous cache write failed.
      const cached = cacheConfirmedAthleteRecords(current.records, scope, now)
      return { kind: cached ? "ready" : "cache_failed", entry, recordId: entry.kind === "CURRENT_RECORD" ? existing.id : null }
    }
    const record = createSelfReportedAthleteRecord({ id: `instant-${crypto.randomUUID()}`, purpose: entry.kind === "CURRENT_RECORD" ? "RECENT_RESULT" : "RACE_GOAL",
      eventDistanceM: canonicalPaceDistance(entry.eventDistanceM), performanceSeconds: entry.performanceSeconds,
      achievedOn: entry.kind === "CURRENT_RECORD" ? entry.achievedOn : null, seasonId: null }, now)
    if (!record) return { kind: "invalid" }
    const result = await addAccountAthleteRecord(record, current.serverRevision)
    if (!isCurrentScope() || !result.ok) return { kind: "storage_failed" }
    if (result.storage !== "ACCOUNT") return { kind: "pending" }
    if (!eligibleAccountPaceRecords([], scope, result.state).some(saved => JSON.stringify(saved) === JSON.stringify(record))) {
      return { kind: "storage_failed" }
    }
    const cached = cacheConfirmedAthleteRecords(result.state.records, scope, now)
    return { kind: cached ? "ready" : "cache_failed", entry, recordId: entry.kind === "CURRENT_RECORD" ? record.id : null }
  } catch { return { kind: "storage_failed" } }
}
