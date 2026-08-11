import type { ReactNode } from "react"
import type { PlanSession } from "@impl/plan-generator/types"
import { isValidIsoDate, isoShift, isoToDate } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import { PlanSessionDetails } from "./PlanSessionDetails"
import { sessionSlotLabel } from "./labels"

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const
const CALENDAR_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const
const PLAN_DAY_COUNT = 10

type ScheduleDay = {
  readonly date: string
  readonly day: number
  readonly sessions: readonly PlanSession[]
}

export function PlanSchedulePreview({
  startDate,
  sessions,
  renderSessionFooter,
}: {
  readonly startDate: string
  readonly sessions: readonly PlanSession[]
  readonly renderSessionFooter?: (session: PlanSession) => ReactNode
}) {
  if (!isValidIsoDate(startDate)) return null

  const days = buildScheduleDays(startDate, sessions)
  return (
    <>
      <PlanScheduleCalendar days={days} today={todayISO()} />
      <ol className="plan-schedule-preview" aria-label="날짜별 계획 미리보기">
      {days.map(({ date, day, sessions: daySessions }) => {
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
    </>
  )
}

function PlanScheduleCalendar({
  days,
  today,
}: {
  readonly days: readonly ScheduleDay[]
  readonly today: string
}) {
  const first = days[0]
  if (first === undefined) return null
  const leadingBlankCount = (isoToDate(first.date).getDay() + 6) % 7

  return (
    <section className="plan-schedule-calendar" aria-label="9.5일 달력 요약">
      <header>
        <strong>한눈에 보는 9.5일</strong>
        <span>날짜를 따라 확인하세요</span>
      </header>
      <div className="plan-schedule-calendar__weekdays" aria-hidden="true">
        {CALENDAR_WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <ol className="plan-schedule-calendar__days">
        {Array.from({ length: leadingBlankCount }, (_, index) => (
          <li key={`blank-${index}`} aria-hidden="true" />
        ))}
        {days.map((day) => {
          const isToday = day.date === today
          return (
            <li
              key={day.date}
              data-current-date={isToday ? "true" : undefined}
              data-session-count={day.sessions.length}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${calendarDateLabel(day.date)} · ${daySummary(day.sessions)}`}
            >
              <time dateTime={day.date}>{isoToDate(day.date).getDate()}</time>
              {isToday && <span className="plan-schedule-calendar__today">오늘</span>}
              {day.sessions.length > 0 && (
                <span className="plan-schedule-calendar__slots">
                  {day.sessions.map((session) => (
                    <span key={`${session.day}-${session.slot}`}>
                      {session.role === "REST" ? "휴식" : sessionSlotLabel(session.slot)}
                    </span>
                  ))}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function buildScheduleDays(startDate: string, sessions: readonly PlanSession[]): readonly ScheduleDay[] {
  return Array.from({ length: PLAN_DAY_COUNT }, (_, index) => {
    const day = index + 1
    return {
      date: isoShift(startDate, index),
      day,
      sessions: sessions.filter((session) => session.day === day),
    }
  })
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
