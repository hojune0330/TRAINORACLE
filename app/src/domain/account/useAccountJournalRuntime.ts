import React from "react"
import { activeLocalAccount, onLocalJournalScopeChange } from "./local-journal-ownership"
import { accountJournalRecordsEnabled, disposeAccountJournalRecords, hydrateAccountJournalRecords } from "./account-journal-record-service"
import { disposeAccountDecorations, hydrateAccountDecorations } from "./account-decoration-service"
import { accountPlanService, disposeAccountPlans } from "./account-plan-service"
import { disposeAccountRewards, hydrateAccountRewards } from "./account-reward-service"

export function useAccountJournalRuntime(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return
    let scope = activeLocalAccount()
    const refresh = () => {
      if (scope !== activeLocalAccount()) { disposeAccountJournalRecords(); disposeAccountDecorations(); disposeAccountPlans(); disposeAccountRewards(); scope = activeLocalAccount() }
      if (accountJournalRecordsEnabled()) {
        void hydrateAccountJournalRecords()
        void hydrateAccountDecorations()
        void accountPlanService()?.hydrate()
        void hydrateAccountRewards()
      }
    }
    const unsubscribe = onLocalJournalScopeChange(refresh)
    window.addEventListener("online", refresh)
    refresh()
    return () => { unsubscribe(); window.removeEventListener("online", refresh); disposeAccountJournalRecords(); disposeAccountDecorations(); disposeAccountPlans(); disposeAccountRewards() }
  }, [enabled])
}
