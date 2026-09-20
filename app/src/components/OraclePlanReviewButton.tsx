import { useEffect, useMemo, useReducer, useState } from "react"
import { createOracleReturnStore, ORACLE_RETURN_STATE_EVENT } from "../domain/oracle-return-state"

/** Mounted only below a real active plan. Viewing a tab never counts as review. */
export function OraclePlanReviewButton() {
  const store = useMemo(() => createOracleReturnStore(), [])
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  const [message, setMessage] = useState("")
  const snapshot = store.read()
  useEffect(() => {
    const unsubscribe = store.onScopeChange(() => { setMessage(""); refresh() })
    window.addEventListener(ORACLE_RETURN_STATE_EVENT, refresh)
    return () => { unsubscribe(); window.removeEventListener(ORACLE_RETURN_STATE_EVENT, refresh) }
  }, [store])
  if (snapshot.status !== "ready" || !snapshot.state.optedIn || snapshot.state.selectedWeekdays.length === 0) return null
  return <div className="oracle-plan-review">
    <button type="button" className="plan-text-action" onClick={() => {
      const result = store.recordParticipation("plan-reviewed")
      setMessage(result.ok ? "오늘 확인한 날로 남겼어요." : result.code === "ALREADY_RECORDED" ? "오늘 이미 기록되어 있어요." : "확인 기록을 저장하지 못했어요.")
    }}>계획을 읽고 확인했어요</button>
    {message && <p role="status">{message}</p>}
  </div>
}
