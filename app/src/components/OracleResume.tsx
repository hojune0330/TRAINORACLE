import { useEffect, useMemo, useReducer } from "react"
import { OracleReturnPanel } from "./OracleReturnPanel"
import { createOracleReturnStore, ORACLE_RETURN_STATE_EVENT } from "../domain/oracle-return-state"
import { buildOraclePersonalResult } from "../domain/oracle-personal-result"
import { loadEntries, todayISO } from "../domain/journal-store"
import { loadPlanBetaState } from "../domain/plan-beta-store"
import { loadAthleteRecords } from "../domain/athlete-records"
import type { OracleTopicId } from "../domain/oracle-exploration"

export function OracleResume({ onOpenTopic, compact = false }: {
  readonly onOpenTopic: (topic: OracleTopicId) => void
  readonly compact?: boolean
}) {
  const store = useMemo(() => createOracleReturnStore(), [])
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => {
    const unsubscribe = store.onScopeChange(refresh)
    window.addEventListener(ORACLE_RETURN_STATE_EVENT, refresh)
    window.addEventListener("trainoracle:account-journals-changed", refresh)
    return () => {
      unsubscribe()
      window.removeEventListener(ORACLE_RETURN_STATE_EVENT, refresh)
      window.removeEventListener("trainoracle:account-journals-changed", refresh)
    }
  }, [store])
  const snapshot = store.read()
  const currentFingerprints: Partial<Record<OracleTopicId, string | null>> = {}
  if (snapshot.status === "ready" && snapshot.state.savedTopicIds.length > 0) {
    const inputs = { entries: loadEntries(), planState: loadPlanBetaState(), athleteRecords: loadAthleteRecords(), today: todayISO() }
    for (const topicId of snapshot.state.savedTopicIds) currentFingerprints[topicId] = buildOraclePersonalResult({ ...inputs, topicId }).fingerprint
  }
  return <OracleReturnPanel currentFingerprints={currentFingerprints} onOpenTopic={onOpenTopic} compact={compact} />
}
