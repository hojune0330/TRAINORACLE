import { useId } from "react"
import type {
  InstantPlanActionState,
  InstantPlanDaySummary,
  InstantPlanRecommendation,
} from "../../domain/instant-plan-contract"
import "./instant-plan.css"

export type InstantPlanRecommendationViewProps = {
  readonly recommendation: InstantPlanRecommendation
  readonly actionState: InstantPlanActionState
  readonly onStart: (id: string) => void
  readonly onShowAlternatives?: () => void
  readonly onEditSchedule?: () => void
  readonly onRetry?: () => void
  readonly anchorLabel?: string
  readonly goalLabel?: string
  readonly programPurposeLabel?: string
}

const roleLabels: Record<InstantPlanDaySummary["sessions"][number]["role"], string> = {
  MAIN: "핵심 훈련",
  BASE: "기초 지구력",
  REC: "회복",
  OFF: "휴식",
  OTHER: "훈련",
}

function compactDateLabel(date: string): string {
  // A calendar display only: UTC prevents the supplied date moving by time zone.
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][parsed.getUTCDay()]
  return `${parsed.getUTCMonth() + 1}/${parsed.getUTCDate()} (${weekday})`
}

/** The integration boundary owns eligibility, recommendation selection and saving. */
export function InstantPlanRecommendationView({
  recommendation,
  actionState,
  onStart,
  onShowAlternatives,
  onEditSchedule,
  onRetry,
  anchorLabel,
  goalLabel,
  programPurposeLabel,
}: InstantPlanRecommendationViewProps) {
  const headingId = useId()
  const actionStatusId = useId()
  const saving = actionState.kind === "SAVING"
  const waiting = saving || actionState.kind === "PENDING"
  const ready = actionState.kind === "READY"
  const status = saving
    ? "계획을 저장하고 있어요. 저장이 확인될 때까지 기다려 주세요."
    : actionState.kind === "READY" ? null : actionState.message

  return (
    <section className="instant-plan" aria-labelledby={headingId}>
      <p className="instant-plan__eyebrow">내 추천 프로그램</p>
      <h2 id={headingId} className="instant-plan__heading">{recommendation.title}</h2>
      {recommendation.source.kind === "CREATOR" && (
        <p className="instant-plan__source">
          {recommendation.creatorLabel || "선택한 제작자 프로그램"}
        </p>
      )}
      <dl className="instant-plan__summary">
        <div><dt>기간</dt><dd>{recommendation.periodLabel}</dd></div>
        <div><dt>이 기간의 훈련</dt><dd>{recommendation.sessionCount}회</dd></div>
        <div><dt>훈련 시간</dt><dd>{recommendation.durationLabel}</dd></div>
        <div><dt>첫 훈련</dt><dd>{recommendation.firstSessionLabel}</dd></div>
        {anchorLabel && <div><dt>기준 기록</dt><dd>{anchorLabel}</dd></div>}
        {goalLabel && <div><dt>내 목표</dt><dd>{goalLabel}</dd></div>}
        {programPurposeLabel && <div><dt>이번 프로그램의 목적</dt><dd>{programPurposeLabel}</dd></div>}
      </dl>
      {goalLabel && (
        <p className="instant-plan__hint">목표 기록은 현재 능력이나 이 기간 안의 달성 보장을 뜻하지 않아요.</p>
      )}

      <section aria-label="이번 일정">
        <h3>이번 일정</h3>
        {recommendation.days.length === 0 ? (
          <p className="instant-plan__status">표시할 일정이 없어요.</p>
        ) : (
          <ol className="instant-plan__schedule">
            {recommendation.days.map(day => (
              <li className="instant-plan__day" key={day.date}>
                <h4><time dateTime={day.date}>{compactDateLabel(day.date)}</time></h4>
                {day.sessions.length === 0 ? <p>등록된 훈련 없음</p> : (
                  <ul className="instant-plan__day-slots">
                    {day.sessions.map(session => (
                      <li className="instant-plan__day-slot" key={session.id}>
                        <span>{session.slotLabel}</span>
                        <span className="instant-plan__role">{roleLabels[session.role]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {status !== null && (
        <p
          id={actionStatusId}
          className={actionState.kind === "FAILED" || actionState.kind === "BLOCKED"
            ? "instant-plan__error" : "instant-plan__status"}
          role={actionState.kind === "FAILED" || actionState.kind === "BLOCKED" ? "alert" : "status"}
        >{status}</p>
      )}
      <div className="instant-plan__actions">
        <button
          className="instant-plan__button"
          type="button"
          disabled={!ready}
          aria-describedby={status !== null ? actionStatusId : undefined}
          onClick={() => { if (ready) onStart(recommendation.id) }}
        >{saving ? "저장 중" : "이 일정으로 시작"}</button>
        {actionState.kind === "FAILED" && onRetry && (
          <button className="instant-plan__secondary" type="button" onClick={onRetry}>저장 다시 시도</button>
        )}
        {onEditSchedule && (
          <button className="instant-plan__secondary" type="button" disabled={waiting} onClick={onEditSchedule}>
            시작일·훈련일 바꾸기
          </button>
        )}
        {onShowAlternatives && (
          <button className="instant-plan__secondary" type="button" disabled={waiting} onClick={onShowAlternatives}>
            다른 계획 보기
          </button>
        )}
      </div>

      {recommendation.days.length > 0 && (
        <details className="instant-plan__disclosure">
          <summary>전체 훈련 내용</summary>
          <ol className="instant-plan__sessions">
            {recommendation.days.map(day => (
              <li className="instant-plan__day" key={day.date}>
                <h4><time dateTime={day.date}>{day.date}</time> · {day.dayLabel}</h4>
                {day.sessions.length === 0 ? <p>상세 훈련 없음</p> : (
                  <ul className="instant-plan__sessions">
                    {day.sessions.map(session => (
                      <li key={session.id}>
                        {session.slotLabel} · {roleLabels[session.role]} · {session.title}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
      {recommendation.reason && (
        <details className="instant-plan__disclosure">
          <summary>추천 이유</summary>
          <p>{recommendation.reason}</p>
        </details>
      )}
    </section>
  )
}
