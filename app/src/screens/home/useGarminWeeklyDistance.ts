import { useEffect, useState, useSyncExternalStore } from "react"
import type { ConnectedWeeklyFactsModel } from "../../domain/connected-weekly-facts"
import { activeLocalAccount, localJournalScopeGeneration, onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { currentConfirmedAccountJournalRevision } from "../../domain/account/account-journal-projection"
import { isAccountStoragePaused } from "../../domain/account/storage-consent"
import { currentStorageConsentRevision } from "../../domain/account/storage-consent-revision"
import { requestGarminIntegration } from "../../domain/account/garmin-integration"
import type { GarminWeeklyDistance } from "../../domain/account/garmin-weekly-distance"

function subscribe(listener: () => void) {
  const unsubscribe = onLocalJournalScopeChange(listener)
  window.addEventListener("storage", listener)
  window.addEventListener("trainoracle:account-journals-changed", listener)
  return () => {
    unsubscribe()
    window.removeEventListener("storage", listener)
    window.removeEventListener("trainoracle:account-journals-changed", listener)
  }
}

export function useGarminWeeklyDistance(facts: ConnectedWeeklyFactsModel | null, connection: string | null) {
  const today = facts?.current.end
  const owner = activeLocalAccount()
  const snapshot = () => {
    if (!owner || owner !== activeLocalAccount() || !connection || !facts || isAccountStoragePaused(owner)) return ""
    const revision = currentStorageConsentRevision(owner)
    if (!revision) return ""
    const candidates = [...facts.current.records, ...facts.previous.records].flatMap(record => {
      if (!record.id.startsWith("garmin-") || record.source !== "IMPORTED") return []
      const version = currentConfirmedAccountJournalRevision(record.id)
      return version === null ? [] : [[record.id, version]]
    })
    return candidates.length ? JSON.stringify([owner, localJournalScopeGeneration(), connection, revision, today, candidates]) : ""
  }
  const key = useSyncExternalStore(subscribe, snapshot, () => "")
  const [result, setResult] = useState<{ key: string; data: GarminWeeklyDistance } | null>(null)
  useEffect(() => {
    setResult(null)
    if (!key || !owner || !today) return
    const controller = new AbortController()
    const current = () => !controller.signal.aborted && snapshot() === key
    void requestGarminIntegration(owner, { action: "weeklyDistance", today }, controller.signal, current)
      .then(response => {
        if (current() && response.ok && "weeklyDistance" in response.data) setResult({ key, data: response.data.weeklyDistance })
      }).catch(() => { /* Keep the local source totals if the service is unavailable. */ })
    return () => controller.abort()
  }, [key, owner, today])
  return result && result.key === key ? result.data : null
}
