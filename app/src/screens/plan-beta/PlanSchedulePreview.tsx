import type { ReactNode } from "react"
import type { PlanSession } from "@impl/plan-generator/types"
import { isoShift, isoToDate } from "../../domain/dates"
import { PlanSessionDetails } from "./PlanSessionDetails"
import { sessionSlotLabel } from "./labels"

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const
const PLAN_DAY_COUNT = 10

export function PlanSchedulePreview({
  startDate,
  sessions,
  renderSessionFooter,
}: {
  readonly startDate: string
  readonly sessions: readonly PlanSession[]
  readonly renderSessionFooter?: (session: PlanSession) => ReactNode
}) {
  return (
    <ol className="plan-schedule-preview" aria-label="날짜별 계획 미리보기">
      {Array.from({ length: PLAN_DAY_COUNT }, (_, index) => index + 1).map((day) => {
        const date = isoShift(startDate, day - 1)
        const daySessions = sessions.filter((session) => session.day === day)
        const label = `${calendarDateLabel(date)} · ${daySummary(daySessions)}`
        return (
          <li key={date} role="group" aria-label={label}>
            <header>
              <time dateTime={date}>{calendarDateLabel(date)}</time>
              <span>{day === 1 ? "시작" : day === PLAN_DAY_COUNT ? "마지막 반일" : ""}</span>
            </header>
            <div
              className="plan-schedule-preview__sessions"
              data-session-count={daySessions.length}
            >
              {daySessions.map((session) => (
                <section key={`${session.day}-${session.slot}`}>
                  <span className="plan-schedule-preview__slot">
                    {sessionSlotLabel(session.slot)}
                  </span>
                  <PlanSessionDetails session={session} />
                  {renderSessionFooter?.(session)}
                </section>
              ))}
              {daySessions.length === 0 && <p>비워 둔 날</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function calendarDateLabel(iso: string): string {
  const date = isoToDate(iso)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}`
}

function daySummary(sessions: readonly PlanSession[]): string {
  if (sessions.length === 0) return "비움"
  if (sessions.every((session) => session.role === "REST")) return "휴식"
  return `훈련 ${sessions.length}개`
}
