import { useEffect, useId, useState } from "react"
import type { InstantPlanToday } from "../../domain/instant-plan-contract"
import "./instant-plan.css"

export type InstantPlanTodayViewProps = {
  readonly today: InstantPlanToday
  readonly onRecordSession?: (id: string) => void
  readonly onChangeSchedule?: () => void
  readonly onContinue?: () => void
}

const stateMessages: Record<InstantPlanToday["state"], string> = {
  BEFORE_START: "아직 시작일 전이에요. 아래에서 첫 일정을 확인해요.",
  SCHEDULED: "오늘 예정된 훈련이에요. 수행 후 기록을 남길 수 있어요.",
  PARTLY_RECORDED: "일부 세션에 남긴 기록이 있어요. 다른 세션도 나누어 확인해요.",
  RECORDED: "오늘 남긴 기록과 다음 일정을 확인해요.",
  REST: "오늘은 계획에 정해진 휴식일이에요.",
  RETURN_AFTER_GAP: "이어서 시작하기 전에 필요한 내용을 확인해요. 기록이 없다고 미수행으로 판단하지 않아요.",
  COMPLETED: "계획 기간이 끝났어요. 실제 수행 여부는 남긴 기록에서 확인해요.",
  UNAVAILABLE: "지금은 이 계획의 훈련을 안내할 수 없어요. 계획 상태를 확인해 주세요.",
}

const continueLabels: Partial<Record<InstantPlanToday["state"], string>> = {
  BEFORE_START: "전체 일정 확인",
  REST: "다음 일정 확인",
  RECORDED: "다음 일정 확인",
  RETURN_AFTER_GAP: "이어가기 전 확인",
  COMPLETED: "다음 단계 확인",
  UNAVAILABLE: "계획 상태 확인",
}

type TodaySession = InstantPlanToday["sessions"][number]

function SessionDetail({
  session,
  canRecord,
  onRecordSession,
}: {
  readonly session: TodaySession
  readonly canRecord: boolean
  readonly onRecordSession?: (id: string) => void
}) {
  return (
    <section className="instant-plan__session" aria-label={`${session.slotLabel} · ${session.title}`}>
      <p className="instant-plan__eyebrow">{session.slotLabel}</p>
      <h3>{session.title}</h3>
      <p className="instant-plan__hint">
        {session.recorded ? "남긴 기록 있음" : "아직 기록 없음"}
      </p>
      <dl className="instant-plan__steps">
        {session.steps.map((step, index) => (
          <div key={`${index}-${step.label}`}>
            <dt>{step.label}</dt>
            <dd>{step.instruction}</dd>
          </div>
        ))}
      </dl>
      {canRecord && !session.recorded && onRecordSession && (
        <button className="instant-plan__secondary" type="button" onClick={() => onRecordSession(session.id)}>
          {session.slotLabel} 훈련 기록 남기기
        </button>
      )}
    </section>
  )
}

/** Renders the existing plan projection; never calculates a replacement workout. */
export function InstantPlanTodayView({
  today,
  onRecordSession,
  onChangeSchedule,
  onContinue,
}: InstantPlanTodayViewProps) {
  const headingId = useId()
  const canRecord = today.state === "SCHEDULED" || today.state === "PARTLY_RECORDED"
  const showSessions = canRecord || today.state === "BEFORE_START" || today.state === "RECORDED"
  const continueLabel = continueLabels[today.state]
  const defaultSessionId = today.sessions.find(session => !session.recorded)?.id ?? today.sessions[0]?.id
  const [selectedSessionId, setSelectedSessionId] = useState(defaultSessionId)
  const hasMultipleSessions = showSessions && today.sessions.length > 1
  const selectedSession = today.sessions.find(session => session.id === selectedSessionId) ?? today.sessions[0]

  useEffect(() => {
    if (!showSessions || today.sessions.some(session => session.id === selectedSessionId)) return
    setSelectedSessionId(defaultSessionId)
  }, [defaultSessionId, selectedSessionId, showSessions, today.sessions])

  return (
    <section className="instant-plan" aria-labelledby={headingId}>
      <p className="instant-plan__eyebrow">{today.dateLabel}</p>
      {today.sourceLabel && <p className="instant-plan__source">{today.sourceLabel}</p>}
      <h2 id={headingId} className="instant-plan__heading">{today.title}</h2>
      <p className="instant-plan__status" role={today.state === "UNAVAILABLE" ? "alert" : "status"}>
        {stateMessages[today.state]}
      </p>

      {showSessions && (
        <div className="instant-plan__sessions">
          {hasMultipleSessions ? (
            <>
              <div className="instant-plan__session-picker" role="group" aria-label="오늘 세션 선택">
                {today.sessions.map(session => (
                  <button
                    className="instant-plan__session-summary"
                    type="button"
                    key={session.id}
                    aria-pressed={session.id === selectedSessionId}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <span className="instant-plan__eyebrow">{session.slotLabel}</span>
                    <strong>{session.title}</strong>
                    <span className="instant-plan__hint">
                      {session.recorded ? "남긴 기록 있음" : "아직 기록 없음"}
                    </span>
                  </button>
                ))}
              </div>
              {selectedSession && (
                <SessionDetail
                  session={selectedSession}
                  canRecord={canRecord}
                  onRecordSession={onRecordSession}
                />
              )}
            </>
          ) : today.sessions.map(session => (
            <SessionDetail
              key={session.id}
              session={session}
              canRecord={canRecord}
              onRecordSession={onRecordSession}
            />
          ))}
        </div>
      )}

      <div className="instant-plan__actions">
        {canRecord && onChangeSchedule && (
          <button className="instant-plan__secondary" type="button" onClick={onChangeSchedule}>오늘은 어려워요</button>
        )}
        {continueLabel && onContinue && (
          <button className="instant-plan__secondary" type="button" onClick={onContinue}>{continueLabel}</button>
        )}
      </div>
    </section>
  )
}
