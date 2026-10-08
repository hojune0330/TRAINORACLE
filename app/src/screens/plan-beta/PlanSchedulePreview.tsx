import React, { type ReactNode } from "react"
import { Check, ChevronLeft, ChevronRight, CircleMinus, HeartPulse, Maximize2, SkipForward } from "lucide-react"
import type { PlanProgressState } from "@impl/plan-generator/types"
import type { PlanSession } from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { isValidIsoDate, isoShift, isoToDate } from "../../domain/dates"
import { calendarEntriesByDate, planCalendarDate } from "../../domain/calendar-context"
import { useCalendarPosition } from "../../hooks/useCalendarPosition"
import { useLocalToday } from "../../hooks/useLocalToday"
import { calendarReducedMotion } from "../../hooks/useCalendarMotion"
import { MonthCalendar } from "../../components/MonthCalendar"
import { CalendarTrainingMark } from "../../components/CalendarTrainingMark"
import { CALENDAR_TRAINING_LABELS, plannedCalendarTone } from "../../domain/calendar-training-presentation"
import {
  prescriptionLabel,
  sessionExecution,
  sessionExecutionSteps,
  sessionLabel,
  sessionSlotLabel,
  PROGRESS_LABELS,
} from "./labels"
import { DetailedPrescriptionView } from "./DetailedPrescriptionView"
import { PlanFlowCodeHelp } from "./PlanFlowCodeHelp"
import { SessionExplanationEntry } from "./SessionExplanation"
import { WorkoutMemoTool } from "../../components/WorkoutMemoTool"
import type { SessionExplanationContext } from "../../domain/session-explanation"
import type { SessionExplanationEvidence } from "../../domain/session-explanation-evidence"
import { PlanDayReader } from "./PlanDayReader"
import type { JournalEntry } from "../../domain/journal-schema"
import { CalendarJournalBadge, CalendarJournalDetails, calendarJournalDescription } from "../../components/CalendarJournalDetails"

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const
type FrameLengthDays = 7 | 9 | 9.5 | 10
type ScheduleDisplayMode = "stack" | "swipe"
type SessionFlowKind = "main" | "base" | "recovery" | "off"

export type PlanReaderRequest = Pick<PlanSession, "day" | "slot"> & {
  readonly sequence: number
  readonly section?: "records"
  readonly returnFocusToCalendar?: boolean
}
const PROGRESS_ICONS = { COMPLETED: Check, RESTED: CircleMinus, SKIPPED: SkipForward, PAIN_CHECKIN: HeartPulse } as const

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
  renderSessionAction,
  renderAfterSchedule,
  showRpeGuide = true,
  timelineHeading,
  displayMode = "stack",
  explanationContext,
  loadEvidence,
  focusSession,
  detailsExpanded = true,
  detailsId,
  readerNotice,
  journalEntries = [],
  journalEntriesComplete = true,
  readerRequest,
  sessionProgress,
  allowMemoExport = true,
}: {
  readonly startDate: string
  readonly frameLengthDays?: FrameLengthDays
  readonly sessions: readonly PlanSession[]
  readonly renderSessionFooter?: (session: PlanSession) => ReactNode
  readonly renderSessionAction?: (session: PlanSession, leave?: (action: () => void) => void) => ReactNode
  readonly renderAfterSchedule?: ReactNode
  readonly showRpeGuide?: boolean
  readonly timelineHeading?: string
  readonly displayMode?: ScheduleDisplayMode
  readonly explanationContext?: SessionExplanationContext
  readonly loadEvidence?: (session: PlanSession) => SessionExplanationEvidence | null
  readonly focusSession?: Pick<PlanSession, "day" | "slot">
  readonly detailsExpanded?: boolean
  readonly detailsId?: string
  readonly readerNotice?: ReactNode
  readonly journalEntries?: readonly JournalEntry[]
  readonly journalEntriesComplete?: boolean
  readonly readerRequest?: PlanReaderRequest
  readonly sessionProgress?: (session: PlanSession) => PlanProgressState | undefined
  readonly allowMemoExport?: boolean
}) {
  const validStartDate = isValidIsoDate(startDate)
  const dayCount = Math.ceil(frameLengthDays)
  const days = React.useMemo(() => validStartDate ? buildScheduleDays(startDate, sessions, dayCount) : [],
    [validStartDate, startDate, sessions, dayCount])
  const today = useLocalToday()
  const focusedDayIndex = focusSession === undefined
    ? -1
    : days.findIndex((day) => day.day === focusSession.day && day.sessions.some((session) => session.slot === focusSession.slot))
  const localCalendarId = React.useId()
  const calendarIdentity = `plan:${explanationContext?.kind ?? "SAVED"}:${explanationContext?.plan.candidateId ?? detailsId ?? localCalendarId}:${startDate}:${dayCount}`
  const nav = useCalendarPosition(calendarIdentity, days[focusedDayIndex]?.date ?? planCalendarDate(startDate, dayCount, today, explanationContext?.kind === "CANDIDATE"))
  const initialDayIndex = Math.max(0, days.findIndex(day => day.date === nav.date))
  const [activeDayIndex, setActiveDayIndex] = React.useState(initialDayIndex)
  const selectedDate = nav.date
  const setSelectedDate = nav.selectDate
  const [calendarDetailsOpen, setCalendarDetailsOpen] = React.useState(false)
  const [reader, setReader] = React.useState<{ date: string; slot?: PlanSession["slot"]; section?: "records" } | null>(null)
  // Keep the original reader mounted after its last journal is deleted so its undo
  // action and nested Back entry survive until the athlete leaves this date.
  const [readerJournalDate, setReaderJournalDate] = React.useState<string | null>(null)
  const readerIndex = days.findIndex(day => day.date === reader?.date)
  const readerDay = days[readerIndex]
  const selectedInPlan = days.some(day => day.date === selectedDate)
  const showDetails = (detailsExpanded || calendarDetailsOpen) && selectedInPlan
  const scheduleId = React.useId()
  const scheduleRef = React.useRef<HTMLOListElement>(null)
  const calendarRef = React.useRef<HTMLElement>(null)
  const handledReaderRequest = React.useRef<number>()
  const readerRequestOrigin = React.useRef<HTMLElement | null>(null)
  const readerOpenedFromCalendar = React.useRef(false)
  const previousCalendarIdentity = React.useRef(calendarIdentity)

  React.useEffect(() => {
    if (previousCalendarIdentity.current === calendarIdentity) return
    previousCalendarIdentity.current = calendarIdentity
    const nextIndex = Math.max(0, days.findIndex((day) => day.date === nav.date))
    setActiveDayIndex(nextIndex)
    setCalendarDetailsOpen(false)
    setReader(null)
    setReaderJournalDate(null)
    readerRequestOrigin.current = null
    readerOpenedFromCalendar.current = false
  }, [calendarIdentity])

  React.useEffect(() => {
    if (!readerRequest || handledReaderRequest.current === readerRequest.sequence) return
    const index = days.findIndex(day => day.day === readerRequest.day && day.sessions.some(session => session.slot === readerRequest.slot))
    const day = days[index]
    if (!day) return
    handledReaderRequest.current = readerRequest.sequence
    readerRequestOrigin.current = readerRequest.returnFocusToCalendar
      ? null : document.activeElement instanceof HTMLElement ? document.activeElement : null
    readerOpenedFromCalendar.current = readerRequest.returnFocusToCalendar === true
    setSelectedDate(day.date)
    setActiveDayIndex(index)
    setReader({ date: day.date, slot: readerRequest.slot, section: readerRequest.section })
    setReaderJournalDate(journalEntries.some(entry => entry.date === day.date) ? day.date : null)
  }, [readerRequest, days, journalEntries])

  React.useEffect(() => {
    if (reader !== null && journalEntries.some(entry => entry.date === reader.date)) setReaderJournalDate(reader.date)
  }, [reader?.date, journalEntries])

  const moveToDay = React.useCallback((nextIndex: number) => {
    const boundedIndex = Math.min(Math.max(nextIndex, 0), days.length - 1)
    setActiveDayIndex(boundedIndex)
    const date = days[boundedIndex]?.date
    if (date !== undefined) setSelectedDate(date)
    const list = scheduleRef.current
    const target = list?.children.item(boundedIndex) as HTMLElement | null
    if (list === null || target === null) return

    if (displayMode === "swipe" && typeof list.scrollTo === "function") {
      const reduceMotion = calendarReducedMotion()
      const first = list.children.item(0) as HTMLElement | null
      list.scrollTo({ left: target.offsetLeft - (first?.offsetLeft ?? 0), behavior: reduceMotion ? "auto" : "smooth" })
      return
    }
    const reduceMotion = calendarReducedMotion()
    target.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
  }, [days, displayMode, setSelectedDate])

  React.useLayoutEffect(() => {
    const list = scheduleRef.current
    if (!showDetails || displayMode !== "swipe" || list === null) return
    const target = list.children.item(activeDayIndex) as HTMLElement | null
    const first = list.children.item(0) as HTMLElement | null
    if (target && first) list.scrollLeft = target.offsetLeft - first.offsetLeft
    if (focusedDayIndex >= 0) scheduleRef.current?.querySelector<HTMLElement>("[data-returned-session='true']")
      ?.scrollIntoView?.({ behavior: "auto", block: "center", inline: "nearest" })
  }, [showDetails, startDate, displayMode, focusedDayIndex, focusSession?.slot])

  const appliedFocus = React.useRef<string>()
  React.useEffect(() => {
    if (focusedDayIndex < 0) return
    const key = `${calendarIdentity}:${focusedDayIndex}:${focusSession?.slot}`
    if (appliedFocus.current === key) return
    appliedFocus.current = key
    setCalendarDetailsOpen(true)
    moveToDay(focusedDayIndex)
  }, [calendarIdentity, focusedDayIndex, focusSession?.slot, moveToDay])

  const syncActiveDay = React.useCallback(() => {
    if (displayMode !== "swipe") return
    const list = scheduleRef.current
    if (list === null) return
    const cards = Array.from(list.children) as HTMLElement[]
    const nearest = cards.reduce((bestIndex, card, index) => (
      Math.abs(card.offsetLeft - (cards[0]?.offsetLeft ?? 0) - list.scrollLeft)
        < Math.abs(cards[bestIndex]!.offsetLeft - (cards[0]?.offsetLeft ?? 0) - list.scrollLeft)
        ? index
        : bestIndex
    ), 0)
    const nearestCard = cards[nearest]
    if (nearestCard === undefined || Math.abs(nearestCard.offsetLeft - (cards[0]?.offsetLeft ?? 0) - list.scrollLeft) > 2) return
    setActiveDayIndex(nearest)
    const date = days[nearest]?.date
    if (date !== undefined) setSelectedDate(date)
  }, [days, displayMode])

  const openDayReader = (index: number, slot?: PlanSession["slot"], origin: "calendar" | "other" | "preserve" = "other") => {
    const day = days[index]
    if (!day) return
    if (origin !== "preserve") {
      readerRequestOrigin.current = null
      readerOpenedFromCalendar.current = origin === "calendar"
    }
    setSelectedDate(day.date)
    setActiveDayIndex(index)
    setReader({ date: day.date, slot })
    setReaderJournalDate(journalEntries.some(entry => entry.date === day.date) ? day.date : null)
  }

  const closeDayReader = () => {
    setReader(null)
    setReaderJournalDate(null)
    const list = scheduleRef.current
    const first = list?.children.item(0) as HTMLElement | null
    const target = list?.children.item(activeDayIndex) as HTMLElement | null
    if (displayMode === "swipe" && list && first && target) list.scrollLeft = target.offsetLeft - first.offsetLeft
  }

  const moveReader = (date: string) => {
    const index = days.findIndex(day => day.date === date)
    if (index >= 0) openDayReader(index, undefined, "preserve")
    else { setReader({ date }); setReaderJournalDate(journalEntries.some(entry => entry.date === date) ? date : null); setSelectedDate(date) }
  }

  if (!validStartDate) return null

  return (
    <>
      {showRpeGuide && showDetails && <PlanRpeGuide />}
      <PlanTrainingFlow
        calendarRef={calendarRef}
        month={nav.month} onMonthChange={nav.selectMonth}
        days={days}
        journalEntries={journalEntries}
        sessionProgress={sessionProgress}
        today={today}
        frameLengthDays={frameLengthDays}
        selectedDate={selectedDate}
        onToday={date => {
          setSelectedDate(date)
          const index = days.findIndex(day => day.date === date)
          if (index >= 0) moveToDay(index)
        }}
        onSelectDate={date => {
          setSelectedDate(date)
          const index = days.findIndex(day => day.date === date)
          if (index < 0) {
            readerRequestOrigin.current = null
            readerOpenedFromCalendar.current = true
            setReader({ date }); setReaderJournalDate(journalEntries.some(entry => entry.date === date) ? date : null); return
          }
          openDayReader(index, undefined, "calendar")
        }}
      />
      {!selectedInPlan && <p className="month-calendar__empty" role="status">{calendarDateLabel(selectedDate)}에는 이 계획의 일정이 없어요.</p>}
      {!detailsExpanded && selectedInPlan && <button type="button" className="calendar-range-return"
        aria-expanded={calendarDetailsOpen} aria-controls={detailsId ?? `${scheduleId}-cards`}
        onClick={() => setCalendarDetailsOpen(open => !open)}>
        {calendarDetailsOpen ? "날짜별 카드 접기" : "날짜별 카드 보기"}
      </button>}
      <section
        id={detailsId ?? `${scheduleId}-cards`}
        className="plan-day-deck"
        hidden={!showDetails}
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
                      action={renderSessionAction?.(session)}
                      returnedFromJournal={focusSession?.day === session.day && focusSession.slot === session.slot}
                      onExpand={() => openDayReader(index, session.slot)}
                      allowMemoExport={allowMemoExport}
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
      {reader !== null && <PlanDayReader date={reader.date} sessions={readerDay?.sessions ?? []}
        initialSlot={reader.slot} initialSection={reader.section} canPrevious canNext
        returnFocusTo={readerRequestOrigin.current !== null || readerOpenedFromCalendar.current || reader.section === "records"
          ? date => (readerRequestOrigin.current?.isConnected ? readerRequestOrigin.current : null)
            ?? calendarRef.current?.querySelector<HTMLElement>(`button[data-date="${date}"]`)
            ?? calendarRef.current?.querySelector<HTMLElement>(".month-calendar__month") ?? null
          : undefined}
        onPrevious={() => moveReader(isoShift(reader.date, -1))}
        onNext={() => moveReader(isoShift(reader.date, 1))}
        onClose={closeDayReader} notice={readerNotice}>
        {leave => <>
        {readerDay?.sessions.map(session => <PlanSessionPreview key={`${reader.date}-${session.slot}`}
          date={reader.date} session={session} compact={false} expanded
          explanationContext={explanationContext} loadEvidence={loadEvidence}
          footer={renderSessionFooter?.(session)}
          action={renderSessionAction?.(session, leave)}
          returnedFromJournal={focusSession?.day === session.day && focusSession.slot === session.slot}
          allowMemoExport={allowMemoExport} />)}
        {!readerDay?.sessions.length && <p>이 계획에는 이날 예정된 훈련이 없어요.</p>}
        {journalEntries.some(entry => entry.date === reader.date) || (journalEntriesComplete && readerJournalDate === reader.date)
          ? <CalendarJournalDetails date={reader.date} entries={journalEntries} />
          : <p className="plan-caption" role={journalEntriesComplete ? undefined : "status"}>{journalEntriesComplete ? "이 날짜에 남긴 일지가 없어요." : "일지를 모두 읽지 못해 기록 여부를 확인할 수 없어요."}</p>}
        </>}
      </PlanDayReader>}
      {renderAfterSchedule}
    </>
  )
}

function PlanSessionPreview({
  date,
  session,
  compact,
  footer,
  action,
  explanationContext,
  loadEvidence,
  returnedFromJournal = false,
  expanded = false,
  onExpand,
  allowMemoExport = true,
}: {
  readonly date: string
  readonly session: PlanSession
  readonly compact: boolean
  readonly footer?: ReactNode
  readonly action?: ReactNode
  readonly explanationContext?: SessionExplanationContext
  readonly loadEvidence?: (session: PlanSession) => SessionExplanationEvidence | null
  readonly returnedFromJournal?: boolean
  readonly expanded?: boolean
  readonly onExpand?: () => void
  readonly allowMemoExport?: boolean
}) {
  const flow = sessionFlowLabel(session)
  const executionSteps = sessionExecutionSteps(session)
  const details = (
    <>
      {executionSteps.length === 0 && session.prescription.kind !== "PACE_TARGET" && (
        <p className="plan-session-execution">{sessionExecution(session)}</p>
      )}
      {session.prescription.kind === "PACE_TARGET" && (
        <DetailedPrescriptionView prescription={session.prescription} />
      )}
      {executionSteps.length > 0 && (
        <ol className="plan-session-steps" aria-label="훈련 실행 순서">
          {executionSteps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </li>
          ))}
        </ol>
      )}
      {!expanded && footer}
    </>
  )

  return (
    <section
      className="plan-day-card__session"
      data-flow-kind={flow.kind}
      data-session-slot={session.slot}
      role="group"
      aria-label={`${calendarDateLabel(date)} ${sessionSlotLabel(session.slot)} 세션${returnedFromJournal ? " · 일지에서 돌아온 세션" : ""}`}
      data-returned-session={returnedFromJournal ? "true" : undefined}
      tabIndex={expanded ? -1 : undefined}
    >
      <header>
        <span className="plan-schedule-preview__slot">{sessionSlotLabel(session.slot)}</span>
        <PlanFlowCodeHelp
          primary={flow.primary}
          secondary={flow.secondary}
          kind={flow.kind}
        />
        {onExpand && <button className="plan-session-expand" type="button" onClick={onExpand}
          aria-label={`${calendarDateLabel(date)} ${sessionSlotLabel(session.slot)} 훈련과 일지 크게 보기`} title="훈련과 일지 크게 보기"
          aria-haspopup="dialog"><Maximize2 size={17} aria-hidden="true" /></button>}
      </header>
      <div className="plan-session-content">
        <strong>{sessionLabel(session)}</strong>
        <small className={session.role === "REST" ? "plan-session-help" : "plan-session-metric"}>
          {prescriptionLabel(session, expanded)}
        </small>
        {action}
        {expanded && footer && <details className="plan-session-records" data-session-records>
          <summary>일지·진행 기록</summary>{footer}
        </details>}
        {expanded && allowMemoExport && <WorkoutMemoTool session={session} date={date} state={explanationContext?.kind === "CANDIDATE" ? "PREVIEW" : "PLAN"} />}
        {compact ? (
          <details className="plan-day-card__details" open={returnedFromJournal}>
            <summary>{sessionSlotLabel(session.slot)} 훈련 방법과 기록</summary>
            <div>{details}</div>
          </details>
        ) : details}
        <SessionExplanationEntry session={session} date={date} context={explanationContext} loadEvidence={loadEvidence} showPurpose={false} />
      </div>
    </section>
  )
}

export function PlanRpeGuide() {
  return (
    <div className="plan-rpe-guide">
      <strong>힘든 정도 · 1~10<TermHelp term="rpe" /></strong>
      <ul className="plan-rpe-guide__scale" aria-label="힘든 정도 쉽게 보기">
        <li><b>1~2</b><span>산책처럼 편해요</span></li>
        <li><b>3~4</b><span>대화하며 달릴 수 있어요</span></li>
        <li><b>5~6</b><span>짧게만 말할 수 있어요</span></li>
        <li><b>7~8</b><span>말하기 어려워요</span></li>
        <li><b>9~10</b><span>거의 전력이에요</span></li>
      </ul>
      <details className="plan-rpe-guide__more">
        <summary>RPE 단계 설명</summary>
        <span>
          1~2 회복 움직임 · 3~4 대화 가능한 쉬운 유산소 · 5 꾸준한 노력 · 6 짧은 문장만 가능 · 7 몇 마디만 가능 · 8 매우 힘든 짧은 반복 · 9 거의 최대인 짧은 노력 · 10 최대 노력에 가까운 느낌
        </span>
        <small>몸의 느낌을 설명하는 기준이며 의료 판단이 아닙니다.</small>
      </details>
    </div>
  )
}

function PlanTrainingFlow({
  calendarRef,
  month, onMonthChange,
  days,
  today,
  frameLengthDays,
  selectedDate,
  onSelectDate,
  onToday,
  journalEntries,
  sessionProgress,
}: {
  readonly calendarRef: React.RefObject<HTMLElement>
  readonly month: string
  readonly onMonthChange: (month: string) => void
  readonly days: readonly ScheduleDay[]
  readonly today: string
  readonly frameLengthDays: FrameLengthDays
  readonly selectedDate: string
  readonly onSelectDate: (date: string) => void
  readonly onToday: (date: string) => void
  readonly journalEntries: readonly JournalEntry[]
  readonly sessionProgress?: (session: PlanSession) => PlanProgressState | undefined
}) {
  const setMonth = onMonthChange
  const byDate = new Map(days.map(day => [day.date, day]))
  const journalByDate = React.useMemo(() => calendarEntriesByDate(journalEntries), [journalEntries])
  const outsidePlanMonth = days.length > 0 && (month < days[0]!.date.slice(0, 7) || month > days.at(-1)!.date.slice(0, 7))
  return (
    <section ref={calendarRef} className="plan-training-flow" aria-label={`${frameLengthDays}일 훈련 일정`}>
      <header>
        <strong>{frameLengthDays}일 훈련 일정</strong>
        <span>{days[0]?.date.slice(5).replace("-", "/")} ~ {days.at(-1)?.date.slice(5).replace("-", "/")}</span>
      </header>
      {outsidePlanMonth && <button className="calendar-range-return" type="button" onClick={() => {
        setMonth(days[0]!.date.slice(0, 7))
        onToday?.(days[0]!.date)
      }}>계획 시작일로</button>}
      <MonthCalendar trainingColors month={month} today={today} selectedDate={selectedDate}
        highlightedRange={days.length ? { start: days[0]!.date, end: days.at(-1)!.date } : undefined}
        onMonthChange={setMonth} onSelectDate={onSelectDate} onToday={onToday}
        dayDescription={date => {
          const day = byDate.get(date)
          const planned = day === undefined ? "이 계획의 일정 없음" : day.sessions.length === 0 ? "예정 훈련 없음" : day.sessions.map(session =>
            `${sessionSlotLabel(session.slot)} ${sessionFlowLabel(session).accessible}${sessionProgress?.(session) ? ` · ${PROGRESS_LABELS[sessionProgress(session)!]}` : ""}`).join(" · ")
          return [planned, calendarJournalDescription(journalByDate.get(date) ?? [], date)].filter(Boolean).join(" · ")
        }}
        renderDay={date => <>{byDate.get(date)?.sessions.map(session => {
          const progress = sessionProgress?.(session)
          const StatusIcon = progress === undefined ? null : PROGRESS_ICONS[progress]
          return <CalendarTrainingMark tone={plannedCalendarTone(session)} key={session.slot}
            slot={sessionSlotLabel(session.slot)} label={CALENDAR_TRAINING_LABELS[plannedCalendarTone(session)]}>
            {StatusIcon && <StatusIcon size={12} aria-hidden="true" />}
          </CalendarTrainingMark>
        })}<CalendarJournalBadge entries={journalByDate.get(date) ?? []} date={date} /></>} />
      <details className="plan-session-guidance">
        <summary>훈련 구분·약어</summary>
        <p>AM 오전 · PM 오후. 주요 훈련의 종류와 방법은 날짜를 눌러 확인해요.</p>
        <ul className="plan-training-flow__legend" aria-label="훈련 구분">
          <li><PlanFlowCodeHelp primary="MAIN" kind="main" variant="legend" /></li>
          <li><PlanFlowCodeHelp primary="BASE" kind="base" variant="legend" /></li>
          <li><PlanFlowCodeHelp primary="REC" kind="recovery" variant="legend" /></li>
          <li><PlanFlowCodeHelp primary="OFF" kind="off" variant="legend" /></li>
        </ul>
        {sessionProgress && <ul className="plan-training-flow__legend" aria-label="진행 기록 표시">
          {(Object.keys(PROGRESS_ICONS) as PlanProgressState[]).map(state => {
            const Icon = PROGRESS_ICONS[state]
            return <li key={state}><Icon size={14} aria-hidden="true" />{PROGRESS_LABELS[state]}</li>
          })}
        </ul>}
      </details>
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

function calendarDateLabel(iso: string): string {
  const date = isoToDate(iso)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}`
}

function daySummary(sessions: readonly PlanSession[]): string {
  if (sessions.length === 0) return "비움"
  if (sessions.every((session) => session.role === "REST")) return "휴식"
  return `훈련 ${sessions.length}개`
}
