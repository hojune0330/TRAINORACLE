import { useEffect, useMemo, useReducer } from "react"
import { OracleReturnPanel } from "./OracleReturnPanel"
import { createOracleReturnStore, ORACLE_RETURN_STATE_EVENT } from "../domain/oracle-return-state"
import { buildOraclePersonalResult } from "../domain/oracle-personal-result"
import { loadEntries, todayISO } from "../domain/journal-store"
import { loadPlanBetaState } from "../domain/plan-beta-store"
import { usePlanEvidenceHistory } from "../hooks/usePlanEvidenceHistory"
import { useAthleteRecordsSnapshot } from "../hooks/useAthleteRecordsSnapshot"
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
  const athleteRecords = useAthleteRecordsSnapshot()
  const history = usePlanEvidenceHistory(false)
  const currentFingerprints: Partial<Record<OracleTopicId, string | null>> = {}
  if (snapshot.status === "ready" && snapshot.state.savedTopicIds.length > 0) {
    const inputs = { entries: loadEntries(), planState: loadPlanBetaState(), planHistory: history.history, athleteRecords: athleteRecords.records, today: todayISO() }
    for (const topicId of snapshot.state.savedTopicIds) currentFingerprints[topicId] = !history.journalReadComplete && (topicId === "focus" || topicId === "priority")
      || athleteRecords.status !== "READY" && topicId === "level"
      ? null : buildOraclePersonalResult({ ...inputs, topicId }).fingerprint
  }
  return <OracleReturnPanel currentFingerprints={currentFingerprints} onOpenTopic={onOpenTopic} compact={compact} />
}
