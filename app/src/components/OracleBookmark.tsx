import { useEffect, useMemo, useReducer, useState } from "react"
import { Bookmark, Check } from "lucide-react"
import type { OracleTopicId } from "../domain/oracle-exploration"
import { createOracleReturnStore, ORACLE_RETURN_STATE_EVENT } from "../domain/oracle-return-state"

export function OracleBookmark({ topicId, fingerprint }: {
  readonly topicId: OracleTopicId
  /** Supplied only while the personal result is actually visible. */
  readonly fingerprint?: string | null | undefined
}) {
  const store = useMemo(() => createOracleReturnStore(), [])
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  const [message, setMessage] = useState("")
  const snapshot = store.read()
  const saved = snapshot.state.savedTopicIds.includes(topicId)
  useEffect(() => {
    const scopeChanged = () => { setMessage(""); refresh() }
    const unsubscribe = store.onScopeChange(scopeChanged)
    window.addEventListener(ORACLE_RETURN_STATE_EVENT, refresh)
    return () => { unsubscribe(); window.removeEventListener(ORACLE_RETURN_STATE_EVENT, refresh) }
  }, [store])
  useEffect(() => {
    if (saved && fingerprint) store.markTopicSeen(topicId, fingerprint)
  }, [store, saved, topicId, fingerprint])
  function toggle() {
    if (!snapshot.state.optedIn) {
      const enabled = store.enableOptIn()
      if (!enabled.ok) { setMessage("이 기기에 저장하지 못했어요. 계정과 저장 공간을 확인해 주세요."); return }
    }
    const result = saved ? store.removeInterest(topicId) : store.saveInterest(topicId)
    if (!result.ok) { setMessage("관심 주제를 저장하지 못했어요."); return }
    if (!saved) {
      store.selectTopic(topicId)
      if (fingerprint) store.markTopicSeen(topicId, fingerprint)
    }
    setMessage(saved ? "관심 주제에서 뺐어요." : "홈에서 다시 볼 수 있어요.")
  }
  return <div className="oracle-bookmark">
    <button type="button" aria-pressed={saved} onClick={toggle}>
      {saved ? <Check size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}
      {saved ? "관심 주제로 저장됨" : "관심 주제로 저장"}
    </button>
    <small>{message || "이 기기에 저장해요."}</small>
    {message && <span className="sr-only" role="status">{message}</span>}
  </div>
}
