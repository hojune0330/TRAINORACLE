import React from "react"
import { useVisibleRefresh } from "../../hooks/useVisibleRefresh"
import { activeLocalAccount, onLocalJournalScopeChange } from "./local-journal-ownership"
import { accountJournalRecordsEnabled, disposeAccountJournalRecords, hydrateAccountJournalRecords, refreshAccountJournalRecordsInBackground } from "./account-journal-record-service"
import { disposeAccountDecorations, hydrateAccountDecorations } from "./account-decoration-service"
import { disposeAccountCalendarDecorations, hydrateAccountCalendarDecorations } from "./account-calendar-decoration-service"
import { accountPlanService, disposeAccountPlans } from "./account-plan-service"
import { disposeAccountRewards, hydrateAccountRewards } from "./account-reward-service"

export function useAccountJournalRuntime(enabled: boolean) {
  const owner = React.useSyncExternalStore(onLocalJournalScopeChange, activeLocalAccount, () => null)
  useVisibleRefresh(refreshAccountJournalRecordsInBackground, enabled && accountJournalRecordsEnabled(), owner)
  React.useEffect(() => {
    if (!enabled) return
    let scope = activeLocalAccount()
    const refresh = () => {
      if (scope !== activeLocalAccount()) { disposeAccountJournalRecords(); disposeAccountDecorations(); disposeAccountCalendarDecorations(); disposeAccountPlans(); disposeAccountRewards(); scope = activeLocalAccount() }
      if (accountJournalRecordsEnabled()) {
        void hydrateAccountJournalRecords()
        void hydrateAccountDecorations()
        void hydrateAccountCalendarDecorations()
        void accountPlanService()?.hydrate()
        void hydrateAccountRewards()
      }
    }
    const unsubscribe = onLocalJournalScopeChange(refresh)
    window.addEventListener("online", refresh)
    refresh()
    return () => { unsubscribe(); window.removeEventListener("online", refresh); disposeAccountJournalRecords(); disposeAccountDecorations(); disposeAccountCalendarDecorations(); disposeAccountPlans(); disposeAccountRewards() }
  }, [enabled])
}
