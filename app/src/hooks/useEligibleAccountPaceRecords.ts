import { useCallback, useEffect, useReducer } from "react"
import { loadAthleteRecords, type AthleteRecord } from "../domain/athlete-records"
import { readEligibleAccountPaceRecords } from "../domain/account/eligible-account-pace-records"
import { ACCOUNT_ATHLETE_RECORD_EVENT } from "../domain/account/account-athlete-record-service"
import { localAccountScopeSnapshot } from "../domain/account/local-account-scope"
import { onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"

export function useEligibleAccountPaceRecords(loadDeviceRecords: () => readonly AthleteRecord[] = loadAthleteRecords) {
  const [, refresh] = useReducer((revision: number) => revision + 1, 0)
  const readRecords = useCallback(() => readEligibleAccountPaceRecords(
    localAccountScopeSnapshot() === null ? loadDeviceRecords() : [],
  ), [loadDeviceRecords])
  useEffect(() => {
    const events = [ACCOUNT_ATHLETE_RECORD_EVENT, "storage", "focus"]
    events.forEach(event => window.addEventListener(event, refresh))
    const stop = onLocalJournalScopeChange(refresh)
    refresh()
    return () => { stop(); events.forEach(event => window.removeEventListener(event, refresh)) }
  }, [])
  return { records: readRecords(), readRecords, refresh }
}
