import React, { type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
import { DetailedPrescriptionView } from "./DetailedPrescriptionView"
import { PlanFlowCodeHelp } from "./PlanFlowCodeHelp"
import { SessionExplanationEntry } from "./SessionExplanation"
import type { SessionExplanationContext } from "../../domain/session-explanation"
import type { SessionExplanationEvidence } from "../../domain/session-explanation-evidence"

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const
type FrameLengthDays = 7 | 9 | 9.5 | 10
type ScheduleDisplayMode = "stack" | "swipe"
type SessionFlowKind = "main" | "base" | "recovery" | "off"

type ScheduleDay = {
  readonly date: string
  readonly day: number
  readonly sessions: readonly PlanSession[]
}

type SessionFlowLabel = {
  readonly primary: "MAIN" | "BASE" | "REC" | "OFF"
  readonly secondary?: "LT" | "VO2" | "GLY" | "ATP" | "MIX"
  readonly kind: SessionFlowKind
  readonly accessible: string
  readonly short: string
}

export function PlanSchedulePreview({
  startDate,
  frameLengthDays = 9.5,
  sessions,
  renderSessionFooter,
  renderAfterSchedule,
  showRpeGuide = true,
  timelineHeading,
  displayMode = "stack",
  explanationContext,
  loadEvidence,
}: {
  readonly startDate: string
  readonly frameLengthDays?: FrameLengthDays
  readonly sessions: readonly PlanSession[]
  readonly renderSessionFooter?: (session: PlanSession) => ReactNode
  readonly renderAfterSchedule?: ReactNode
  readonly showRpeGuide?: boolean
  readonly timelineHeading?: string
  readonly displayMode?: ScheduleDisplayMode
  readonly explanationContext?: SessionExplanationContext
  readonly loadEvidence?: (session: PlanSession) => SessionExplanationEvidence | null
}) {
  const validStartDate = isValidIsoDate(startDate)
  const dayCount = Math.ceil(frameLengthDays)
  const days = validStartDate ? buildScheduleDays(startDate, sessions, dayCount) : []
  const today = todayISO()
  const initialDayIndex = Math.max(0, days.findIndex((day) => day.date === today))
  const [activeDayIndex, setActiveDayIndex] = React.useState(initialDayIndex)
  const scheduleId = React.useId()
  const scheduleRef = React.useRef<HTMLOListElement>(null)

  React.useEffect(() => {
    const nextIndex = Math.max(0, days.findIndex((day) => day.date === todayISO()))
    setActiveDayIndex(nextIndex)
  }, [startDate, dayCount])

  const moveToDay = React.useCallback((nextIndex: number) => {
    const boundedIndex = Math.min(Math.max(nextIndex, 0), days.length - 1)
    setActiveDayIndex(boundedIndex)
    const list = scheduleRef.current
    const target = list?.children.item(boundedIndex) as HTMLElement | null
    if (list === null || target === null) return

    if (displayMode === "swipe" && typeof list.scrollTo === "function") {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
      list.scrollTo({ left: target.offsetLeft, behavior: reduceMotion ? "auto" : "smooth" })
      return
    }
    target.scrollIntoView?.({ behavior: "smooth", block: "start" })
  }, [days.length, displayMode])

  const syncActiveDay = React.useCallback(() => {
    if (displayMode !== "swipe") return
    const list = scheduleRef.current
    if (list === null) return
    const cards = Array.from(list.children) as HTMLElement[]
    const nearest = cards.reduce((bestIndex, card, index) => (
      Math.abs(card.offsetLeft - list.scrollLeft)
        < Math.abs(cards[bestIndex]!.offsetLeft - list.scrollLeft)
        ? index
        : bestIndex
    ), 0)
    setActiveDayIndex(nearest)
  }, [displayMode])

  if (!validStartDate) return null

  return (
    <>
      {showRpeGuide && <PlanRpeGuide />}
      <PlanTrainingFlow
        days={days}
        today={today}
        frameLengthDays={frameLengthDays}
        activeDayIndex={activeDayIndex}
      />
      <section
        className="plan-day-deck"
        data-display-mode={displayMode}
        aria-label="날짜별 훈련 카드"
      >
        {(timelineHeading !== undefined || displayMode === "swipe") && (
          <header className="plan-day-deck__header">
            <span>
              {timelineHeading !== undefined && <h2>{timelineHeading}</h2>}
            </span>
            {displayMode === "swipe" && (
              <div className="plan-day-deck__controls">
                <button
                  type="button"
                  onClick={() => moveToDay(activeDayIndex - 1)}
                  disabled={activeDayIndex === 0}
                  aria-label="이전 날짜"
                >
                  <ChevronLeft aria-hidden="true" size={19} />
                </button>
                <output aria-live="polite" aria-label="현재 날짜 위치">
                  {activeDayIndex + 1}/{dayCount}
                </output>
                <button
                  type="button"
                  onClick={() => moveToDay(activeDayIndex + 1)}
                  disabled={activeDayIndex === dayCount - 1}
                  aria-label="다음 날짜"
                >
                  <ChevronRight aria-hidden="true" size={19} />
                </button>
              </div>
            )}
          </header>
        )}
        <ol
          ref={scheduleRef}
          className="plan-schedule-preview"
          data-display-mode={displayMode}
          aria-label="날짜별 계획 미리보기"
          onScroll={syncActiveDay}
        >
          {days.map(({ date, day, sessions: daySessions }, index) => {
            const label = `${calendarDateLabel(date)} · ${daySummary(daySessions)}`
            return (
              <li
                id={`${scheduleId}-day-${day}`}
                key={date}
                role="group"
                aria-roledescription={displayMode === "swipe" ? "날짜 카드" : undefined}
                aria-label={label}
                data-active-card={displayMode === "swipe" && activeDayIndex === index ? "true" : undefined}
              >
                <header>
                  <span>
                    <time dateTime={date}>{calendarDateLabel(date)}</time>
                    <small>DAY {day}</small>
                  </span>
                  <em>
                    {date === today
                      ? "오늘"
                      : day === 1
                        ? "시작"
                        : day === dayCount
                          ? frameLengthDays === 9.5 ? "마지막 반일" : "마지막 날"
                          : ""}
                  </em>
                </header>
                <div
                  className="plan-schedule-preview__sessions"
                  data-session-count={daySessions.length}
                >
                  {daySessions.map((session) => (
                    <PlanSessionPreview
                      key={`${session.day}-${session.slot}`}
                      date={date}
                      session={session}
                      explanationContext={explanationContext}
                      loadEvidence={loadEvidence}
                      compact={displayMode === "swipe"}
                      footer={renderSessionFooter?.(session)}
                    />
                  ))}
                  {daySessions.length === 0 && (
                    <div className="plan-day-card__empty">
                      <div className="plan-day-card__empty-title">
                        <PlanFlowCodeHelp primary="OFF" kind="off" />
                        <strong>비워 둔 날</strong>
                      </div>
                      <span>훈련을 더 채우지 않고 회복 상태를 확인하세요.</span>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </section>
      {renderAfterSchedule}
    </>
  )
}

function PlanSessionPreview({
  date,
  session,
  compact,
  footer,
  explanationContext,
  loadEvidence,
}: {
  readonly date: string
  readonly session: PlanSession
  readonly compact: boolean
  readonly footer?: ReactNode
  readonly explanationContext?: SessionExplanationContext
  readonly loadEvidence?: (session: PlanSession) => SessionExplanationEvidence | null
}) {
  const flow = sessionFlowLabel(session)
  const details = (
    <>
      <p className="plan-session-execution">{sessionExecution(session)}</p>
      {session.prescription.kind === "PACE_TARGET" && (
        <DetailedPrescriptionView prescription={session.prescription} />
      )}
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
      {footer}
    </>
  )

  return (
    <section
      className="plan-day-card__session"
      data-flow-kind={flow.kind}
      role="group"
      aria-label={`${calendarDateLabel(date)} ${sessionSlotLabel(session.slot)} 세션`}
    >
      <header>
        <span className="plan-schedule-preview__slot">{sessionSlotLabel(session.slot)}</span>
        <PlanFlowCodeHelp
          primary={flow.primary}
          secondary={flow.secondary}
          kind={flow.kind}
        />
      </header>
      <div className="plan-session-content">
        <strong>{sessionLabel(session)}</strong>
        <small className={session.role === "REST" ? "plan-session-help" : "plan-session-metric"}>
          {prescriptionLabel(session)}
        </small>
        <SessionExplanationEntry session={session} context={explanationContext} loadEvidence={loadEvidence} />
        {compact ? (
          <details className="plan-day-card__details">
            <summary>{sessionSlotLabel(session.slot)} 훈련 방법과 기록</summary>
            <div>{details}</div>
          </details>
        ) : details}
      </div>
    </section>
  )
}

export function PlanRpeGuide() {
  return (
    <div className="plan-rpe-guide">
      <strong>RPE 기준<TermHelp term="rpe" /></strong>
      <span>
        1~2 회복 움직임 · 3~4 대화 가능한 쉬운 유산소 · 5 꾸준한 노력 · 6 짧은 문장만 가능 · 7 몇 마디만 가능 · 8 매우 힘든 짧은 반복 · 9 거의 최대인 짧은 노력 · 10 최대 노력에 가까운 느낌
      </span>
      <small>몸의 느낌을 설명하는 기준이며 의료 판단이 아닙니다.</small>
    </div>
  )
}

function PlanTrainingFlow({
  days,
  today,
  frameLengthDays,
  activeDayIndex,
}: {
  readonly days: readonly ScheduleDay[]
  readonly today: string
  readonly frameLengthDays: FrameLengthDays
  readonly activeDayIndex: number
}) {
  return (
    <section className="plan-training-flow" aria-label={`${frameLengthDays}일 훈련 흐름`}>
      <header>
        <strong>{frameLengthDays}일 훈련 흐름</strong>
        <span>강약과 회복을 먼저 확인하세요.</span>
      </header>
      <ul className="plan-training-flow__legend" aria-label="훈련 구분">
        <li><PlanFlowCodeHelp primary="MAIN" kind="main" variant="legend" /></li>
        <li><PlanFlowCodeHelp primary="BASE" kind="base" variant="legend" /></li>
        <li><PlanFlowCodeHelp primary="REC" kind="recovery" variant="legend" /></li>
        <li><PlanFlowCodeHelp primary="OFF" kind="off" variant="legend" /></li>
      </ul>
      <ol
        className="plan-training-flow__days"
        style={{ "--flow-day-count": days.length } as React.CSSProperties}
      >
        {days.map((day, index) => {
          const isToday = day.date === today
          const labels = day.sessions.length > 0
            ? day.sessions.map(sessionFlowLabel)
            : [{ primary: "OFF", kind: "off", accessible: "훈련 없음", short: "휴식" } satisfies SessionFlowLabel]
          return (
            <li
              key={day.date}
              data-current-date={isToday ? "true" : undefined}
              data-active-day={activeDayIndex === index ? "true" : undefined}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${calendarDateLabel(day.date)} · ${labels.map((label) => label.accessible).join(" · ")}`}
            >
              <time dateTime={day.date}>
                <span>{shortWeekday(day.date)}</span>
                <strong>{isoToDate(day.date).getDate()}</strong>
              </time>
              <span className="plan-training-flow__markers">
                {labels.map((label, labelIndex) => (
                  <span key={`${day.date}-${labelIndex}`} data-flow-kind={label.kind}>
                    <strong>{label.short}</strong>
                    {label.secondary !== undefined && <small>{timelineSecondaryCode(label.secondary)}</small>}
                  </span>
                ))}
              </span>
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
      sessions: sessions
        .filter((session) => session.day === day)
        .sort((first, second) => sessionSlotOrder(first) - sessionSlotOrder(second)),
    }
  })
}

function sessionSlotOrder(session: PlanSession): number {
  return session.slot === "AM" ? 0 : 1
}

function sessionFlowLabel(session: PlanSession): SessionFlowLabel {
  if (session.role === "REST") {
    return { primary: "OFF", kind: "off", accessible: "훈련 없음", short: "휴식" }
  }
  if (session.role === "QUALITY") {
    const secondary = qualityIntentCode(session)
    return {
      primary: "MAIN",
      secondary,
      kind: "main",
      accessible: `주요 훈련 ${secondary}`,
      short: "주요",
    }
  }
  if (session.plannedEnergyIntent === "RECOVERY_INTENT") {
    return { primary: "REC", kind: "recovery", accessible: "회복 운동", short: "회복" }
  }
  return { primary: "BASE", kind: "base", accessible: "기초 지구력", short: "기초" }
}

function qualityIntentCode(session: PlanSession): NonNullable<SessionFlowLabel["secondary"]> {
  const intent = session.plannedEnergyIntent
  switch (intent) {
    case "LT_INTENT": return "LT"
    case "VO2_INTENT": return "VO2"
    case "GLY_INTENT": return "GLY"
    case "ATP_PC_INTENT": return "ATP"
    case "MIXED_INTENT": return "MIX"
    case "RECOVERY_INTENT":
    case "BASE_INTENT":
      return "MIX"
    default:
      return intent satisfies never
  }
}

function timelineSecondaryCode(code: NonNullable<SessionFlowLabel["secondary"]>): string {
  if (code === "VO2") return "VO₂"
  if (code === "ATP") return "ATP-PC"
  return code
}

function calendarDateLabel(iso: string): string {
  const date = isoToDate(iso)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}`
}

function shortWeekday(iso: string): string {
  return WEEKDAYS[isoToDate(iso).getDay()]!.slice(0, 1)
}

function daySummary(sessions: readonly PlanSession[]): string {
  if (sessions.length === 0) return "비움"
  if (sessions.every((session) => session.role === "REST")) return "휴식"
  return `훈련 ${sessions.length}개`
}
