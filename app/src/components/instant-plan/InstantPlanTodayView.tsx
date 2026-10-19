import { useEffect, useId, useState } from "react"
import { ChevronRight } from "lucide-react"
import type { InstantPlanToday, InstantPlanUnavailableReason } from "../../domain/instant-plan-contract"
import { IncompleteWorkoutNotice } from "./IncompleteWorkoutNotice"
import { AppHeading } from "../AppHeading"
import { TrainingInstructionCards } from "../TrainingInstructionCards"
import { CategoryCard } from "../CategoryCard"
import "./instant-plan.css"

export type InstantPlanTodayViewProps = {
  readonly today: InstantPlanToday
  readonly onRecordSession?: (id: string) => void
  readonly onViewSession?: (id: string) => void
  readonly onChangeSchedule?: (sessionId: string) => void
  readonly changeScheduleLabel?: string
  readonly onContinue?: () => void
  readonly compact?: boolean
  /** Entry cards open the existing complete session reader. */
  readonly navigationCards?: boolean
  /** Display only: supplied from the original session, never inferred from its time slot. */
  readonly sessionRoleLabel?: (sessionId: string) => string | undefined
  /** True only for a source EASY session; absent or unknown roles keep the full preview. */
  readonly compactSessionSummary?: (sessionId: string) => boolean
  /** An enclosing plan already supplies date navigation and the full date. */
  readonly dateContext?: "standalone" | "embedded"
  readonly unavailableAction?: { readonly label: string; readonly onClick: () => void }
}

const stateMessages: Record<InstantPlanToday["state"], string> = {
  BEFORE_START: "아직 시작일 전이에요. 아래에서 첫 일정을 확인해요.",
  SCHEDULED: "오늘 예정된 훈련이에요. 수행 후 기록을 남길 수 있어요.",
  PARTLY_RECORDED: "일부 세션에 남긴 기록이 있어요. 다른 세션도 나누어 확인해요.",
  RECORDED: "오늘 남긴 기록과 다음 일정을 확인해요.",
  REST: "오늘은 계획에 정해진 휴식일이에요.",
  RETURN_AFTER_GAP: "이어서 시작하기 전에 필요한 내용을 확인해요. 기록이 없다고 미수행으로 판단하지 않아요.",
  COMPLETED: "계획 기간이 끝났어요. 실제 수행 여부는 남긴 기록에서 확인해요.",
  UNAVAILABLE: "훈련을 불러올 수 없어요.",
}

const unavailableMessages: Record<InstantPlanUnavailableReason, string> = {
  PAIN_PROGRESS: "통증 기록이 있어 훈련 안내를 멈췄어요",
  INVALID_DATE: "계획 날짜를 읽을 수 없어 훈련을 불러올 수 없어요.",
  NO_SESSION: "이 날짜의 훈련을 불러올 수 없어요.",
  JOURNAL_REVIEW: "최근 몸 상태 기록 때문에 훈련 안내를 멈췄어요.",
  JOURNAL_UNREADABLE: "최근 일지를 모두 읽지 못해 훈련 안내를 멈췄어요.",
  CURRENT_BODY_REVIEW: "몸 상태가 괜찮은지 확인되지 않아 안내를 멈췄어요.",
  DETAILED_AUTHORITY: "이 훈련을 지금 시작해도 되는지 확인할 수 없어요.",
  EXECUTION_REVIEW: "훈련을 불러올 수 없어요.",
}

export function instantPlanUnavailableMessage(reason?: InstantPlanUnavailableReason): string {
  return reason ? unavailableMessages[reason] : stateMessages.UNAVAILABLE
}

const continueLabels: Partial<Record<InstantPlanToday["state"], string>> = {
  BEFORE_START: "전체 일정 확인",
  REST: "다음 일정 확인",
  RECORDED: "다음 일정 확인",
  RETURN_AFTER_GAP: "이어가기 전 확인",
  COMPLETED: "다음 단계 확인",
  UNAVAILABLE: "일정 보기",
}

type TodaySession = InstantPlanToday["sessions"][number]

function navigationSummary(session: TodaySession, compact: boolean): string {
  const totals = session.steps.filter(step => step.role === "TOTAL_DURATION")
  // Reuse the existing complete-session projection, never add up displayed
  // phase strings. Only explicitly supplied EASY roles may collapse
  // the preview; MAIN, unknown roles and unresolved work retain their content.
  const visible = compact && totals.length > 0 && !session.guidanceNotice
    ? totals : session.steps.filter(step => step.role === "TOTAL_DURATION" || step.role === "MAIN")
  return visible.map(step => step.instruction.replace(/^준비·회복·정리 포함 /u, "총 ")).join(" · ")
}

function SessionDetail({
  session,
  canRecord,
  onRecordSession,
  onViewSession,
  compact = false,
  showHeading = true,
  onChangeSchedule,
  changeScheduleLabel,
}: {
  readonly session: TodaySession
  readonly canRecord: boolean
  readonly onRecordSession?: (id: string) => void
  readonly onViewSession?: (id: string) => void
  readonly compact?: boolean
  readonly showHeading?: boolean
  readonly onChangeSchedule?: (id: string) => void
  readonly changeScheduleLabel?: string
}) {
  const primarySteps = session.steps.filter(step => step.role !== "METHOD" && step.role !== "OTHER")
  const visibleSteps = primarySteps
  const otherSteps = session.steps.filter(step => !visibleSteps.includes(step))
  const steps = (items: TodaySession["steps"]) => <TrainingInstructionCards steps={items.map(step => ({
    role: step.role, title: step.label, detail: step.instruction,
  }))} />
  return (
    <section className="instant-plan__session" aria-label={`${session.slotLabel} · ${session.title}`}>
      {showHeading && <><p className="instant-plan__eyebrow">{session.slotLabel}</p>
      <h3>{session.title}</h3></>}
      {(!compact || session.recorded) && <p className="instant-plan__hint">
        {session.recorded ? "남긴 기록 있음" : "아직 기록 없음"}
      </p>}
      {session.guidanceNotice && <IncompleteWorkoutNotice detail={session.guidanceNotice} />}
      {compact ? <>
        {steps(visibleSteps)}
        {!onViewSession && otherSteps.length > 0 && <details className="instant-plan__disclosure">
          <summary>훈련 방법</summary>{steps(otherSteps)}
        </details>}
      </> : steps(session.steps)}
      {onViewSession && <button className="instant-plan__content-open" type="button"
        aria-label={`${session.slotLabel} 훈련 내용 보기`} onClick={() => onViewSession(session.id)}>훈련 내용 보기<ChevronRight size={18} aria-hidden="true" /></button>}
      {canRecord && <div className="instant-plan__actions">
        {!session.recorded && onRecordSession && <button className="instant-plan__entry-record" type="button"
          aria-label={`${session.slotLabel} 훈련 기록 남기기`} onClick={() => onRecordSession(session.id)}>
          {compact ? "일지 쓰기" : `${session.slotLabel} 훈련 기록 남기기`}
        </button>}
        {compact && onChangeSchedule && <button className="instant-plan__secondary" type="button"
          onClick={() => onChangeSchedule(session.id)}>{changeScheduleLabel}</button>}
      </div>}
    </section>
  )
}

/** Renders the existing plan projection; never calculates a replacement workout. */
export function InstantPlanTodayView({
  today,
  onRecordSession,
  onViewSession,
  onChangeSchedule,
  changeScheduleLabel = "일정 확인",
  onContinue,
  compact = false,
  navigationCards = false,
  sessionRoleLabel,
  compactSessionSummary,
  dateContext = "standalone",
  unavailableAction,
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

  const dateDescription = dateContext === "embedded" ? today.dateLabel : undefined
  const unavailableMessage = instantPlanUnavailableMessage(today.unavailableReason)
  if (compact && today.state === "UNAVAILABLE") return <section
    className="instant-plan instant-plan--today-compact instant-plan--unavailable" aria-label="훈련 안내" aria-description={dateDescription}>
    {dateContext === "standalone" && <p className="instant-plan__eyebrow">{today.dateLabel}</p>}
    <p className="instant-plan__status" role="alert">{unavailableMessage}</p>
    {(unavailableAction || onContinue) && <div className="instant-plan__actions">
      <button className="instant-plan__secondary" type="button" onClick={unavailableAction?.onClick ?? onContinue}>
        {unavailableAction?.label ?? continueLabels.UNAVAILABLE}
      </button>
    </div>}
  </section>

  if (navigationCards && onViewSession) return <section className="instant-plan instant-plan--entry-cards" aria-labelledby={headingId} aria-description={dateDescription}>
    <header className="instant-plan__entry-heading">
      <AppHeading as="h2" variant="section" id={headingId}>{today.title}</AppHeading>
      {dateContext === "standalone" && <span className="instant-plan__hint">{today.dateLabel}</span>}
    </header>
    {today.sourceLabel && <p className="instant-plan__source">{today.sourceLabel}</p>}
    {showSessions ? <div className="category-card-grid">
      {today.sessions.map(session => {
        const roleLabel = sessionRoleLabel?.(session.id)
        const summary = navigationSummary(session, compactSessionSummary?.(session.id) === true)
        return <div className="instant-plan__entry-session" key={session.id}>
        <CategoryCard category="training" title={session.title} headingLevel={3}
          label={[session.slotLabel, roleLabel].filter(Boolean).join(" · ")}
          description={summary}
          aria-label={`${session.slotLabel} 훈련 내용 보기 · ${session.title}`}
          aria-description={[roleLabel, summary].filter(Boolean).join(" · ")}
          onClick={() => onViewSession(session.id)} />
        {session.recorded && <p className="instant-plan__hint">남긴 기록 있음</p>}
        {session.guidanceNotice && <IncompleteWorkoutNotice detail={session.guidanceNotice} />}
        {canRecord && !session.recorded && onRecordSession && <button className="instant-plan__entry-record" type="button"
          onClick={() => onRecordSession(session.id)} aria-label={`${session.slotLabel} 훈련 기록 남기기`}>일지 쓰기</button>}
      </div>})}
    </div> : <>
      {today.state === "UNAVAILABLE" && <p className="instant-plan__status" role="alert">{unavailableMessage}</p>}
      {onContinue && <CategoryCard category="training" title={today.state === "COMPLETED" ? "지난 훈련 보기" : "전체 일정 보기"} onClick={onContinue} />}
    </>}
  </section>

  return (
    <section className={`instant-plan${compact ? " instant-plan--today-compact" : ""}`} aria-labelledby={headingId} aria-description={dateDescription}>
      {dateContext === "standalone" && <p className="instant-plan__eyebrow">{today.dateLabel}</p>}
      {today.sourceLabel && <p className="instant-plan__source">{today.sourceLabel}</p>}
      <AppHeading as="h2" variant={compact ? "section" : "screen"} accent={!compact} id={headingId} className="instant-plan__heading">{today.title}</AppHeading>
      {(!compact || !["SCHEDULED", "PARTLY_RECORDED", "RECORDED"].includes(today.state)) && <p className="instant-plan__status" role={today.state === "UNAVAILABLE" ? "alert" : "status"}>
        {today.state === "UNAVAILABLE" ? unavailableMessage : stateMessages[today.state]}
      </p>}

      {showSessions && (
        <div className="instant-plan__sessions">
          {hasMultipleSessions ? (
            <>
              <div className="instant-plan__session-picker app-choice-group" role="group" aria-label="오늘 세션 선택">
                {today.sessions.map(session => (
                  <button
                    className="instant-plan__session-summary app-choice-control"
                    type="button"
                    key={session.id}
                    aria-pressed={session.id === selectedSessionId}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <span className="instant-plan__eyebrow">{session.slotLabel}</span>
                    <strong>{session.title}</strong>
                    {(!compact || session.recorded) && <span className="instant-plan__hint">
                      {session.recorded ? "남긴 기록 있음" : "아직 기록 없음"}
                    </span>}
                  </button>
                ))}
              </div>
              {selectedSession && (
                <SessionDetail
                  session={selectedSession}
                  compact={compact}
                  showHeading={!compact}
                  onChangeSchedule={onChangeSchedule}
                  changeScheduleLabel={changeScheduleLabel}
                  canRecord={canRecord}
                  onRecordSession={onRecordSession}
                  onViewSession={onViewSession}
                />
              )}
            </>
          ) : today.sessions.map(session => (
            <SessionDetail
              key={session.id}
              session={session}
              compact={compact}
              onChangeSchedule={onChangeSchedule}
              changeScheduleLabel={changeScheduleLabel}
              canRecord={canRecord}
              onRecordSession={onRecordSession}
              onViewSession={onViewSession}
            />
          ))}
        </div>
      )}

      <div className="instant-plan__actions">
        {!compact && canRecord && selectedSession && onChangeSchedule && (
          <button className="instant-plan__secondary" type="button" onClick={() => onChangeSchedule(selectedSession.id)}>{changeScheduleLabel}</button>
        )}
        {continueLabel && onContinue && (
          <button className="instant-plan__secondary" type="button" onClick={onContinue}>{continueLabel}</button>
        )}
      </div>
    </section>
  )
}
