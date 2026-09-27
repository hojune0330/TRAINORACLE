import { useEffect, useReducer } from "react"
import { loadEntries } from "../domain/journal-store"
import { onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { LOCAL_JOURNALS_CHANGED } from "../domain/journal-change-events"

/** Read the existing owner-scoped projection, never the raw storage or memo vault. */
export function useCalendarEntries() {
  const [, refresh] = useReducer(value => value + 1, 0)
  useEffect(() => {
    const unsubscribe = onLocalJournalScopeChange(refresh)
    window.addEventListener(LOCAL_JOURNALS_CHANGED, refresh)
    window.addEventListener("trainoracle:account-journals-changed", refresh)
    window.addEventListener("storage", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      unsubscribe()
      window.removeEventListener(LOCAL_JOURNALS_CHANGED, refresh)
      window.removeEventListener("trainoracle:account-journals-changed", refresh)
      window.removeEventListener("storage", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [])
  return loadEntries()
}
