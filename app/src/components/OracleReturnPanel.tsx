import { Bookmark, Check, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { getOracleTopic, type OracleTopicId } from "../domain/oracle-exploration"
import {
  createOracleReturnStore,
  ORACLE_RETURN_STATE_EVENT,
  type OracleParticipationAction,
  type OracleWeekday,
} from "../domain/oracle-return-state"
import "./oracle-return-panel.css"

export type OracleReturnPanelProps = {
  readonly currentFingerprints?: Partial<Record<OracleTopicId, string | null>>
  readonly onOpenTopic: (topicId: OracleTopicId) => void
  readonly compact?: boolean
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const
const PARTICIPATION_LABELS: Record<OracleParticipationAction, string> = {
  "journal-saved": "일지 저장",
  "plan-reviewed": "계획 확인",
  "rest-recorded": "쉬는 날 기록",
}

function resultMessage(code: string): string {
  switch (code) {
    case "OPT_IN_REQUIRED": return "관심 저장을 선택한 뒤 참여 기록을 켤 수 있어요."
    case "ALREADY_RECORDED": return "오늘 참여는 이미 기록되어 있어요."
    case "NO_DAYS_SELECTED": return "참여할 요일을 먼저 선택해 주세요."
    case "SCOPE_UNAVAILABLE": return "계정 확인이 끝난 뒤 다시 시도해 주세요."
    case "INVALID_STORAGE": return "저장된 참여 설정을 확인하지 못했어요. 변경하지 않고 멈췄습니다."
    default: return "저장하지 못했어요. 현재 상태는 그대로예요."
  }
}

export function OracleReturnPanel({ currentFingerprints = {}, onOpenTopic, compact = false }: OracleReturnPanelProps) {
  const store = useRef(createOracleReturnStore()).current
  const [, setRefresh] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const snapshot = store.read()
  const state = snapshot.state
  const [weekdays, setWeekdays] = useState<OracleWeekday[]>([...state.selectedWeekdays])
  const selectedWeekdayKey = state.selectedWeekdays.join(",")

  useEffect(() => {
    const refresh = () => setRefresh(value => value + 1)
    const unsubscribeScope = store.onScopeChange(refresh)
    if (typeof window !== "undefined") window.addEventListener(ORACLE_RETURN_STATE_EVENT, refresh)
    return () => {
      unsubscribeScope()
      if (typeof window !== "undefined") window.removeEventListener(ORACLE_RETURN_STATE_EVENT, refresh)
    }
  }, [store])

  useEffect(() => {
    setWeekdays([...state.selectedWeekdays])
  }, [snapshot.scope.kind === "account" ? snapshot.scope.id : snapshot.scope.kind, selectedWeekdayKey])

  const summary = store.getParticipationSummary()
  const savedTopics = useMemo(() => {
    const orderedIds = [...state.savedTopicIds]
    if (state.lastSelectedTopicId !== null) {
      const selectedIndex = orderedIds.indexOf(state.lastSelectedTopicId)
      if (selectedIndex > 0) orderedIds.unshift(...orderedIds.splice(selectedIndex, 1))
    }
    return (compact ? orderedIds.slice(0, 2) : orderedIds).map(id => getOracleTopic(id))
  }, [compact, state.lastSelectedTopicId, state.savedTopicIds.join(",")])

  function showResult(result: { readonly ok: boolean; readonly code?: string }) {
    if (!result.ok) setMessage(resultMessage(result.code ?? "STORAGE_UNAVAILABLE"))
    else setMessage(null)
    if (result.ok) setRefresh(value => value + 1)
  }

  function selectTopic(topicId: OracleTopicId) {
    const result = store.selectTopic(topicId)
    showResult(result)
    onOpenTopic(topicId)
  }

  function toggleWeekday(day: OracleWeekday) {
    setWeekdays(current => current.includes(day) ? current.filter(value => value !== day) : [...current, day].sort() as OracleWeekday[])
  }

  function saveWeekdays() {
    showResult(store.setParticipationWeekdays(weekdays))
  }

  function enableParticipation() {
    showResult(store.enableOptIn())
  }

  if (compact && (snapshot.status === "unresolved" || savedTopics.length === 0)) return null

  if (snapshot.status === "unresolved") {
    return <section className="oracle-return-panel" data-testid="oracle-return-panel" aria-live="polite">
      <h2>관심 주제 이어보기</h2>
      <p className="oracle-return-panel__muted">계정 확인이 끝나면 저장한 주제를 불러옵니다.</p>
    </section>
  }

  return <section className={`oracle-return-panel${compact ? " oracle-return-panel--compact" : ""}`} data-testid="oracle-return-panel" aria-labelledby="oracle-return-heading">
    <div className="oracle-return-panel__heading">
      <div>
        <h2 id="oracle-return-heading">{compact ? "저장한 분석" : "관심 주제 이어보기"}</h2>
        {!compact && <p className="oracle-return-panel__muted">저장한 주제에 실제 분석 자료가 바뀐 경우에만 새 표시가 나타납니다.</p>}
      </div>
      <Bookmark size={18} aria-hidden="true" />
    </div>

    {savedTopics.length === 0
      ? <p className="oracle-return-panel__empty">관심 저장한 주제가 없습니다. 둘러보다 다시 보고 싶은 주제를 저장해 보세요.</p>
      : <ul className="oracle-return-panel__topics">
        {savedTopics.map(topic => {
          const fingerprint = currentFingerprints[topic.id]
          const unread = typeof fingerprint === "string" && store.isTopicUnread(topic.id, fingerprint)
          return <li key={topic.id}>
            <button type="button" className="oracle-return-panel__topic" onClick={() => selectTopic(topic.id)}>
              <span>
                <strong>{topic.title}</strong>
                {!compact && <small>{topic.question}</small>}
              </span>
              {unread && <span className="oracle-return-panel__unread">{compact ? "업데이트" : "새 분석 자료"}</span>}
            </button>
            {!compact && <button type="button" className="oracle-return-panel__remove" onClick={() => showResult(store.removeInterest(topic.id))} aria-label={`${topic.title} 관심 해제`}>
              관심 해제
            </button>}
          </li>
        })}
      </ul>}

    {!compact && <>
      <details className="oracle-return-panel__participation">
        <summary>
          <span><strong>기록할 요일</strong><small>일지를 남긴 날과 쉬는 날을 구분해 보관</small></span>
          <span className="oracle-return-panel__counts"><strong>{summary.streak}</strong> 연속 · <strong>{summary.cumulative}</strong> 누적</span>
        </summary>
        <div className="oracle-return-panel__participation-body" aria-labelledby="oracle-participation-heading">
          <h3 id="oracle-participation-heading" className="oracle-return-panel__sr-only">기록할 요일</h3>
          {!state.optedIn
            ? <>
              <p className="oracle-return-panel__muted">선택한 참여 설정을 이 기기에만 보관합니다. 운동량·보상·알림은 바꾸지 않습니다.</p>
              <button type="button" className="oracle-return-panel__save-days" onClick={enableParticipation}>참여 기록 켜기</button>
            </>
            : <>
              <p className="oracle-return-panel__muted">일지를 남긴 날을 세고, 쉬는 날도 별도로 기록할 수 있어요. 추가 운동은 요구하지 않습니다.</p>
              <div className="oracle-return-panel__weekdays" aria-label="참여 요일 선택">
                {WEEKDAY_LABELS.map((label, day) => <button
                  key={label}
                  type="button"
                  className="oracle-return-panel__weekday"
                  aria-pressed={weekdays.includes(day as OracleWeekday)}
                  onClick={() => toggleWeekday(day as OracleWeekday)}
                >{label}</button>)}
                <button type="button" className="oracle-return-panel__save-days" onClick={saveWeekdays}>요일 저장</button>
              </div>
              <button type="button" className="oracle-return-panel__save-days" onClick={() => showResult(store.recordParticipation("rest-recorded"))}>
                <Check size={15} aria-hidden="true" />{PARTICIPATION_LABELS["rest-recorded"]}
              </button>
            </>}
        </div>
      </details>
      <p className="oracle-return-panel__note"><RotateCcw size={14} aria-hidden="true" /> 쉬는 날도 누적 기록을 지우지 않고 보존합니다.</p>
    </>}
    {message && <p className="oracle-return-panel__message" role="status">{message}</p>}
  </section>
}
