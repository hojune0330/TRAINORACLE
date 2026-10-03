import React from "react"
import { cacheConfirmedAthleteRecords } from "../athlete-records"
import { activeLocalAccount, onLocalJournalScopeChange } from "./local-journal-ownership"
import { ACCOUNT_ATHLETE_RECORD_EVENT, accountAthleteRecordsEnabled, loadAccountAthleteRecords, readAccountAthleteRecordsState } from "./account-athlete-record-service"

export function useAccountAthleteRecordsRuntime(enabled = true): void {
  React.useEffect(() => {
    if (!enabled) return
    const refresh = () => {
      if (activeLocalAccount() && accountAthleteRecordsEnabled()) void loadAccountAthleteRecords().catch(() => undefined)
    }
    const project = () => {
      const current = readAccountAthleteRecordsState()
      if (current.confirmed && current.ownerId) cacheConfirmedAthleteRecords(current.records, current.ownerId)
    }
    window.addEventListener(ACCOUNT_ATHLETE_RECORD_EVENT, project)
    window.addEventListener("online", refresh)
    const stop = onLocalJournalScopeChange(refresh)
    refresh()
    return () => { stop(); window.removeEventListener(ACCOUNT_ATHLETE_RECORD_EVENT, project); window.removeEventListener("online", refresh) }
  }, [enabled])
}
