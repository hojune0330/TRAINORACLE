import { useCallback, useEffect, useMemo, useReducer } from "react"
import { loadEntries, loadJournalEntriesSnapshot } from "../domain/journal-store"
import { activeLocalAccount, localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { LOCAL_JOURNALS_CHANGED } from "../domain/journal-change-events"
import { accountJournalProjectionStatus } from "../domain/account/account-journal-projection"
import { accountAuthState, ACCOUNT_AUTH_STATE_EVENT } from "../domain/account/account-auth-state"
import { accountFeatureEnabled } from "../domain/account/config"
import { calendarReadiness } from "../domain/calendar-context"
import { accountJournalRecordsEnabled, hydrateAccountJournalRecords } from "../domain/account/account-journal-record-service"

interface CalendarSnapshot {
  entries: ReturnType<typeof loadEntries>
  owner: ReturnType<typeof activeLocalAccount>
  status: ReturnType<typeof calendarReadiness>
  revision: number
  retry?: (() => void) | undefined
}

/** Read the existing owner-scoped projection, never the raw storage or memo vault. */
export function useCalendarSnapshot(): CalendarSnapshot {
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
  const snapshot = useMemo(() => {
    const entries = loadEntries()
    const owner = activeLocalAccount()
    const localComplete = loadJournalEntriesSnapshot().readStatus === "complete"
    const retryAccount = accountJournalRecordsEnabled() && accountJournalProjectionStatus() === "FAILED"
    const status = calendarReadiness({ owner, entryCount: entries.length, accountEnabled: accountFeatureEnabled(),
      auth: accountAuthState(), online: accountJournalProjectionStatus(), localComplete })
    return { entries, owner, status, revision, generation: localJournalScopeGeneration(), canRetry: !localComplete || retryAccount }
  }, [revision])
  const retry = useCallback(() => {
    // A stale button cannot start a request for a different account. Network
    // retries use the existing guarded recovery, never reset or clear drafts.
    if (activeLocalAccount() !== snapshot.owner || localJournalScopeGeneration() !== snapshot.generation) return
    refresh()
    if (accountJournalRecordsEnabled() && accountJournalProjectionStatus() === "FAILED") {
      void hydrateAccountJournalRecords()
    }
  }, [snapshot.owner, snapshot.generation])
  return { entries: snapshot.entries, owner: snapshot.owner, status: snapshot.status,
    revision: snapshot.revision, retry: snapshot.canRetry ? retry : undefined }
}

export function useCalendarEntries() { return useCalendarSnapshot().entries }
