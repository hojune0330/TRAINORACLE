import { useEffect, useMemo, useReducer, useState } from "react"
import { ACCOUNT_PLAN_EVENT, accountPlanService, accountPlansEnabled } from "../domain/account/account-plan-service"
import { ensureAccountPlanHistory } from "../domain/account/account-plan-domain"
import { localAccountScopeSnapshot } from "../domain/account/local-account-scope"
import { onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { readArchivedOriginalPlans } from "../domain/plan-beta-store"
import type { PlanJournalHistory } from "../domain/plan-journal-evidence"
import { LOCAL_JOURNALS_CHANGED } from "../domain/journal-change-events"
import { loadEntriesForPlanSafety } from "../domain/journal-store"
import { accountJournalProjectionStatus } from "../domain/account/account-journal-projection"

const unavailable: PlanJournalHistory = { kind: "unavailable" }

/** Load originals on demand. Never turn a current-only account projection into an empty archive. */
export function usePlanEvidenceHistory(active: boolean, readHistory: () => PlanJournalHistory = readArchivedOriginalPlans) {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0)
  const [retryRevision, retry] = useReducer((value: number) => value + 1, 0)
  const onlineAccount = accountPlansEnabled()
  const service = onlineAccount ? accountPlanService() : null
  const scope = localAccountScopeSnapshot()
  const [request, setRequest] = useState<{ service: typeof service; scope: typeof scope; loading: boolean } | null>(null)
  const view = service?.snapshot()
  const canLoad = !!view?.confirmedDocument
  const history = useMemo(() => {
    try { return readHistory() } catch { return unavailable }
  }, [readHistory, revision, retryRevision, scope, service])
  const journalReadComplete = loadEntriesForPlanSafety().status === "complete"
    && (!onlineAccount || accountJournalProjectionStatus() === "READY")

  useEffect(() => {
    const unsubscribe = onLocalJournalScopeChange(refresh)
    window.addEventListener(ACCOUNT_PLAN_EVENT, refresh)
    window.addEventListener("storage", refresh)
    window.addEventListener(LOCAL_JOURNALS_CHANGED, refresh)
    window.addEventListener("trainoracle:account-journals-changed", refresh)
    return () => {
      unsubscribe()
      window.removeEventListener(ACCOUNT_PLAN_EVENT, refresh)
      window.removeEventListener("storage", refresh)
      window.removeEventListener(LOCAL_JOURNALS_CHANGED, refresh)
      window.removeEventListener("trainoracle:account-journals-changed", refresh)
    }
  }, [])

  useEffect(() => {
    if (!active || !onlineAccount || !service || !canLoad || history.kind === "loaded") return
    let current = true
    setRequest({ service, scope, loading: true })
    void ensureAccountPlanHistory().catch(() => false).then(() => {
      if (!current || localAccountScopeSnapshot() !== scope || accountPlanService() !== service) return
      setRequest({ service, scope, loading: false })
      refresh()
    })
    // Closing this view invalidates its response, not another view's shared history request.
    return () => { current = false }
  }, [active, onlineAccount, service, scope, canLoad, history.kind, retryRevision])

  const currentRequest = request?.service === service && request.scope === scope ? request : null
  const loading = active && onlineAccount && history.kind !== "loaded"
    && (view && "historyStatus" in view && view.historyStatus === "LOADING"
      || currentRequest?.loading === true
      || !canLoad && (view?.status === "IDLE" || view?.status === "LOADING"))
  const status = history.kind === "loaded" ? "ready" as const : loading ? "loading" as const
    : onlineAccount && !canLoad ? "account-unavailable" as const : "unavailable" as const
  return { history, status, retry, revision, scope, journalReadComplete }
}
