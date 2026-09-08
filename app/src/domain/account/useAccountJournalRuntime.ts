import React from "react"
import { activeLocalAccount, onLocalJournalScopeChange } from "./local-journal-ownership"
import { accountJournalRecordsEnabled, disposeAccountJournalRecords, hydrateAccountJournalRecords } from "./account-journal-record-service"

export function useAccountJournalRuntime(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return
    let scope = activeLocalAccount()
    const refresh = () => {
      if (scope !== activeLocalAccount()) { disposeAccountJournalRecords(); scope = activeLocalAccount() }
      if (accountJournalRecordsEnabled()) void hydrateAccountJournalRecords()
    }
    const unsubscribe = onLocalJournalScopeChange(refresh)
    window.addEventListener("online", refresh)
    refresh()
    return () => { unsubscribe(); window.removeEventListener("online", refresh); disposeAccountJournalRecords() }
  }, [enabled])
}
