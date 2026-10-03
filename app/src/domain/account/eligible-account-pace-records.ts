import { loadAthleteRecords, type AthleteRecord } from "../athlete-records"
import { readAccountAthleteRecordsState, type AccountAthleteRecordsState } from "./account-athlete-record-service"
import { localAccountScopeSnapshot } from "./local-account-scope"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { canonicalPaceDistance } from "@impl/prescription/record-pace"

/** Device records remain intact, but cannot stand in for confirmed signed-in evidence. */
export function eligibleAccountPaceRecords(
  deviceRecords: readonly AthleteRecord[],
  accountScope: string | null,
  accountState: AccountAthleteRecordsState,
): readonly AthleteRecord[] {
  const source = accountScope === null ? deviceRecords
    : accountState.ownerId === accountScope && accountState.status === "READY" && accountState.confirmed
      ? accountState.records : []
  const counts = new Map<string, number>()
  for (const record of source) counts.set(record.id, (counts.get(record.id) ?? 0) + 1)
  return source.filter(record => record.verificationState !== "UNVERIFIED" && counts.get(record.id) === 1)
}

/** Read synchronously at render and again at action time; this never fetches or writes. */
export function readEligibleAccountPaceRecords(deviceRecords?: readonly AthleteRecord[]): readonly AthleteRecord[] {
  const scope = localAccountScopeSnapshot()
  return eligibleAccountPaceRecords(scope === null ? deviceRecords ?? loadAthleteRecords() : [],
    scope, readAccountAthleteRecordsState())
}

export function isEligiblePaceRecordCurrent(record: AthleteRecord, deviceRecords?: readonly AthleteRecord[]): boolean {
  const current = readEligibleAccountPaceRecords(deviceRecords).find(row => row.id === record.id)
  return current !== undefined && Object.keys(record).every(key =>
    current[key as keyof AthleteRecord] === record[key as keyof AthleteRecord])
}

/** Recheck supplied pace sources at the UI action boundary, without recalculating targets. */
export function areCatalogPaceSourcesCurrent(inputs: WorkoutCalculationInputs): boolean {
  if (!inputs.fiveK && !inputs.paceReferences?.length) return true
  const records = readEligibleAccountPaceRecords()
  const legacy = inputs.fiveK
  if (legacy && !records.some(record => record.id === legacy.recordId && record.eventDistanceM === 5000
    && record.purpose !== "RACE_GOAL" && record.performanceSeconds === legacy.seconds && record.achievedOn === legacy.achievedAt)) return false
  return (inputs.paceReferences ?? []).every(ref => records.some(record => record.id === ref.recordId
    && record.savedAt === ref.recordVersion && canonicalPaceDistance(record.eventDistanceM) === ref.eventDistanceM
    && record.performanceSeconds === ref.performanceSeconds && record.achievedOn === ref.achievedOn
    && (record.purpose === "RACE_GOAL" ? "GOAL" : "ACTUAL") === ref.kind))
}
