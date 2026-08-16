import type { ReactNode } from "react"
import type { PlanSession } from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { isValidIsoDate, isoShift, isoToDate } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import {
  ENERGY_INTENT_LABELS,
  prescriptionLabel,
  sessionExecution,
  sessionExecutionSteps,
  sessionGuidance,
  sessionIntentLabel,
  sessionLabel,
  sessionSlotLabel,
} from "./labels"

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const
const CALENDAR_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const
type FrameLengthDays = 7 | 9 | 9.5 | 10

type ScheduleDay = {
  readonly date: string
  readonly day: number
  readonly sessions: readonly PlanSession[]
}

export function PlanSchedulePreview({
  startDate,
  frameLengthDays = 9.5,
  sessions,
  renderSessionFooter,
}: {
  readonly startDate: string
  readonly frameLengthDays?: FrameLengthDays
  readonly sessions: readonly PlanSession[]
  readonly renderSessionFooter?: (session: PlanSession) => ReactNode
}) {
  if (!isValidIsoDate(startDate)) return null

  const dayCount = Math.ceil(frameLengthDays)
  const days = buildScheduleDays(startDate, sessions, dayCount)
  return (
    <>
      <div className="plan-rpe-guide">
        <strong>RPE 기준<TermHelp term="rpe" /></strong>
        <span>
          1~2는 회복 움직임 · 3~4는 대화 가능한 쉬운 유산소 · 5~6은 꾸준히 힘든 수준 · 7~8은 말하기 어려운 고강도 · 9는 매우 강한 짧은 노력 · 10은 최대{`\u00a0`}노력에 가까운{`\u00a0`}느낌
        </span>
        <small>몸의 느낌을 설명하는 기준이며 의료 판단이 아닙니다.</small>
      </div>
      <PlanScheduleCalendar days={days} today={todayISO()} frameLengthDays={frameLengthDays} />
      <ol className="plan-schedule-preview" aria-label="날짜별 계획 미리보기">
      {days.map(({ date, day, sessions: daySessions }) => {
        const label = `${calendarDateLabel(date)} · ${daySummary(daySessions)}`
        return (
          <li key={date} role="group" aria-label={label}>
            <header>
              <time dateTime={date}>{calendarDateLabel(date)}</time>
              <span>{day === 1 ? "시작" : day === dayCount ? frameLengthDays === 9.5 ? "마지막 반일" : "마지막 날" : ""}</span>
            </header>
            <div
              className="plan-schedule-preview__sessions"
              data-session-count={daySessions.length}
            >
              {daySessions.map((session) => (
                <section
                  key={`${session.day}-${session.slot}`}
                  role="group"
                  aria-label={`${calendarDateLabel(date)} ${sessionSlotLabel(session.slot)} 세션`}
                >
                  <span className="plan-schedule-preview__slot">
                    {sessionSlotLabel(session.slot)}
                  </span>
                  <div className="plan-session-content">
                    <strong>{sessionLabel(session)}</strong>
                    <small className={session.role === "REST" ? "plan-session-help" : "plan-session-metric"}>
                      {prescriptionLabel(session)}
                    </small>
                    <p className="plan-session-execution">{sessionExecution(session)}</p>
                    {sessionExecutionSteps(session).length > 0 && (
                      <ol className="plan-session-steps" aria-label="훈련 실행 순서">
                        {sessionExecutionSteps(session).map((step) => (
                          <li key={step.title}>
                            <strong>{step.title}</strong>
                            <span>{step.detail}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    <details className="plan-session-guidance">
                      <summary>목적·수치 설명 보기</summary>
                      <p>
                        훈련 의도 · {sessionIntentLabel(session)}
                        <TermHelp term={ENERGY_INTENT_LABELS[session.plannedEnergyIntent].term} />
                        <br />
                        {sessionGuidance(session)}
                      </p>
                    </details>
                  </div>
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
  frameLengthDays,
}: {
  readonly days: readonly ScheduleDay[]
  readonly today: string
  readonly frameLengthDays: FrameLengthDays
}) {
  const first = days[0]
  if (first === undefined) return null
  const leadingBlankCount = (isoToDate(first.date).getDay() + 6) % 7

  return (
    <section className="plan-schedule-calendar" aria-label={`${frameLengthDays}일 달력 요약`}>
      <header>
        <strong>한눈에 보는 {frameLengthDays}일</strong>
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

function buildScheduleDays(
  startDate: string,
  sessions: readonly PlanSession[],
  dayCount: number,
): readonly ScheduleDay[] {
  return Array.from({ length: dayCount }, (_, index) => {
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
