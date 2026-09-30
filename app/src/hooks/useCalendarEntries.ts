import { useEffect, useMemo, useReducer } from "react"
import { loadEntries, loadJournalEntriesSnapshot } from "../domain/journal-store"
import { activeLocalAccount, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { LOCAL_JOURNALS_CHANGED } from "../domain/journal-change-events"
import { accountJournalProjectionStatus } from "../domain/account/account-journal-projection"
import { accountAuthState, ACCOUNT_AUTH_STATE_EVENT } from "../domain/account/account-auth-state"
import { accountFeatureEnabled } from "../domain/account/config"
import { calendarReadiness } from "../domain/calendar-context"

/** Read the existing owner-scoped projection, never the raw storage or memo vault. */
export function useCalendarSnapshot() {
  const [revision, refresh] = useReducer(value => value + 1, 0)
  useEffect(() => {
    const unsubscribe = onLocalJournalScopeChange(refresh)
    window.addEventListener(LOCAL_JOURNALS_CHANGED, refresh)
    window.addEventListener("trainoracle:account-journals-changed", refresh)
    window.addEventListener("storage", refresh)
    window.addEventListener("focus", refresh)
    window.addEventListener(ACCOUNT_AUTH_STATE_EVENT, refresh)
    return () => {
      unsubscribe()
      window.removeEventListener(LOCAL_JOURNALS_CHANGED, refresh)
      window.removeEventListener("trainoracle:account-journals-changed", refresh)
      window.removeEventListener("storage", refresh)
      window.removeEventListener("focus", refresh)
      window.removeEventListener(ACCOUNT_AUTH_STATE_EVENT, refresh)
    }
  }, [])
  return useMemo(() => {
    const entries = loadEntries()
    const owner = activeLocalAccount()
    const status = calendarReadiness({ owner, entryCount: entries.length, accountEnabled: accountFeatureEnabled(),
      auth: accountAuthState(), online: accountJournalProjectionStatus(), localComplete: loadJournalEntriesSnapshot().readStatus === "complete" })
    return { entries, owner, status, revision }
  }, [revision])
}

export function useCalendarEntries() { return useCalendarSnapshot().entries }
