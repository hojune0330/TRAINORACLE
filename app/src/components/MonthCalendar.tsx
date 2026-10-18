import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, CircleHelp } from "lucide-react"
import { isValidIsoDate, isoShift, isoToDate } from "../domain/dates"
import { projectJournalMonthCalendar } from "../domain/journal-calendar"
import "./MonthCalendar.css"
import { useCalendarMotion } from "../hooks/useCalendarMotion"
import { CalendarRoleIcon } from "./CalendarTrainingMark"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const

export function calendarDayLabel(date: string): string {
  const day = isoToDate(date)
  return `${day.getFullYear()}년 ${day.getMonth() + 1}월 ${day.getDate()}일 ${WEEKDAYS[day.getDay()]}요일`
}

export function shiftCalendarMonth(month: string, offset: number): string {
  const date = isoToDate(`${month}-01`)
  date.setMonth(date.getMonth() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

type Props = {
  readonly month: string
  readonly today: string
  readonly selectedDate?: string
  readonly onMonthChange: (month: string) => void
  readonly onSelectDate: (date: string) => void
  readonly onToday?: (date: string) => void
  readonly dayDescription: (date: string) => string
  readonly renderDay: (date: string) => ReactNode
  /** Return null on dates without a read-only cue; never creates a separate hit target. */
  readonly renderDayAdornment?: (date: string) => ReactNode
  /** Short assistive description corresponding to renderDayAdornment. */
  readonly dayAdornmentDescription?: (date: string) => string | undefined
  readonly highlightedRange?: { readonly start: string; readonly end: string }
  readonly trainingColors?: boolean
  readonly category?: "training" | "journal"
  /** Archive reading surface only; training calendars retain their current layout. */
  readonly presentation?: "standard" | "journal-archive"
  readonly summary?: string | undefined
  /** Journal overview only. Detailed training calendars keep their full session labels. */
  readonly compact?: boolean
}

export function MonthCalendar({ month, today, selectedDate, onMonthChange, onSelectDate, onToday, dayDescription, renderDay,
  renderDayAdornment, dayAdornmentDescription, highlightedRange, trainingColors = false, category = "training", presentation = "standard", summary, compact = false }: Props) {
  const headingId = useId()
  const jumpId = useId()
  const monthTrigger = useRef<HTMLButtonElement>(null)
  const motion = useCalendarMotion()
  const [jumpOpen, setJumpOpen] = useState(false)
  const [focusedDate, setFocusedDate] = useState<string | null>(null)
  const grid = useRef<HTMLTableElement>(null)
  const focusAfterMonthChange = useRef<string | null>(null)
  const cells = projectJournalMonthCalendar(month, [])
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
  const monthDate = isoToDate(`${month}-01`)
  const label = `${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월`
  const paperStyle = presentation === "journal-archive" ? {
    "--journal-calendar-paper": `url("${import.meta.env.BASE_URL}illustrations/journal-calendar-paper-v1.webp")`,
  } as CSSProperties : undefined
  const tabDate = focusedDate?.startsWith(month) ? focusedDate
    : selectedDate?.startsWith(month) ? selectedDate : today.startsWith(month) ? today : `${month}-01`

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const weekday = isoToDate(date).getDay()
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday }
    const offset = offsets[event.key]
    if (offset === undefined) return
    event.preventDefault()
    const target = isoShift(date, offset)
    if (!target.startsWith(month)) {
      focusAfterMonthChange.current = target
      onMonthChange(target.slice(0, 7))
    } else {
      grid.current?.querySelector<HTMLButtonElement>(`button[data-date="${target}"]`)?.focus()
    }
  }

  return <section className="month-calendar" style={paperStyle} data-category={category} data-presentation={presentation === "standard" ? undefined : presentation} data-compact={compact || undefined} data-reduced-motion={motion.reduced || undefined} aria-labelledby={headingId}>
    <header className="month-calendar__toolbar">
      <h3 id={headingId} aria-live="polite"><button ref={monthTrigger} type="button" className="month-calendar__month" aria-label={`${label} · 년월과 날짜 이동`} aria-expanded={jumpOpen} aria-controls={jumpId} onClick={() => setJumpOpen(value => !value)}>
        {presentation === "journal-archive" ? <span className="month-calendar__month-label" aria-hidden="true">
          <span className="month-calendar__year">{monthDate.getFullYear()}년</span>
          <span className="month-calendar__month-value">{monthDate.getMonth() + 1}<span className="month-calendar__month-unit">월</span></span>
        </span> : label}
        <ChevronDown size={16} aria-hidden="true" />
      </button></h3>
      <div className="month-calendar__actions">
        <button type="button" className="month-calendar__today" onClick={() => {
          setFocusedDate(today)
          onMonthChange(today.slice(0, 7))
          if (onToday) onToday(today)
          else onSelectDate(today)
        }}>오늘</button>
        <button type="button" className="month-calendar__month-nav" aria-label="이전 달" title="이전 달" onClick={() => onMonthChange(shiftCalendarMonth(month, -1))}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" className="month-calendar__month-nav" aria-label="다음 달" title="다음 달" onClick={() => onMonthChange(shiftCalendarMonth(month, 1))}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
    {summary && <p className="month-calendar__summary">{summary}</p>}
    {jumpOpen && <div id={jumpId} className="month-calendar__jump" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setJumpOpen(false); monthTrigger.current?.focus() }
    }}>
      <label>년월 선택<input type="month" value={month} onChange={event => {
        if (isValidIsoDate(`${event.target.value}-01`)) onMonthChange(event.target.value)
      }} /></label>
      <label>날짜로 이동<input type="date" value={selectedDate ?? ""} onChange={event => {
        const date = event.target.value
        if (!isValidIsoDate(date)) return
        focusAfterMonthChange.current = date
        setFocusedDate(date)
        onMonthChange(date.slice(0, 7)); onSelectDate(date); setJumpOpen(false)
      }} /></label>
    </div>}
    <table ref={grid} role="grid" aria-label={`${label} 달력`} className="month-calendar__grid">
      <thead><tr>{WEEKDAYS.map((day, index) => <th scope="col" key={day} data-weekday={index} aria-label={`${day}요일`}>{day}</th>)}</tr></thead>
      <tbody key={month}>{weeks.map((week) => <tr key={week[0]!.date}>
        {week.map((cell) => {
          const outside = cell.kind === "OUTSIDE_MONTH"
          const current = cell.date === today
          const selected = cell.date === selectedDate
          const inRange = highlightedRange !== undefined && cell.date >= highlightedRange.start && cell.date <= highlightedRange.end
          const description = dayDescription(cell.date)
          const adornmentDescription = dayAdornmentDescription?.(cell.date)
          const adornment = renderDayAdornment?.(cell.date)
          const hasAdornment = adornment !== null && adornment !== undefined && adornment !== false
          const content = renderDay(cell.date)
          const hasContent = content !== null && content !== undefined && content !== false
          const name = [calendarDayLabel(cell.date), description, adornmentDescription].filter(Boolean).join(" · ")
          return <td key={cell.date} role="gridcell" aria-selected={selected} data-outside={outside || undefined} data-in-range={inRange || undefined} data-weekday={isoToDate(cell.date).getDay()}>
            <button
              ref={element => {
                if (element && focusAfterMonthChange.current === cell.date) {
                  focusAfterMonthChange.current = null
                  element.focus()
                }
              }}
              type="button" data-date={cell.date} data-selected={selected || undefined}
              aria-current={current ? "date" : undefined} aria-label={name}
              tabIndex={cell.date === tabDate ? 0 : -1}
              onFocus={() => setFocusedDate(cell.date)}
              onKeyDown={event => moveFocus(event, cell.date)} onClick={() => {
                if (outside) onMonthChange(cell.date.slice(0, 7))
                onSelectDate(cell.date)
              }}>
              <span className={`month-calendar__date-heading${hasAdornment ? " month-calendar__date-heading--with-adornment" : ""}`}>
                <time dateTime={cell.date} className="month-calendar__number">{cell.day}</time>
                {hasAdornment && <span className="month-calendar__day-adornment" aria-hidden="true">{adornment}</span>}
              </span>
              {hasContent && <span className="month-calendar__events" aria-hidden="true">{content}</span>}
            </button>
          </td>
        })}
      </tr>)}</tbody>
    </table>
    {trainingColors && <details className="calendar-color-guide">
      <summary><CircleHelp size={16} aria-hidden="true" />훈련 색·종류 알아보기<ChevronDown size={16} aria-hidden="true" /></summary>
      <ul aria-label="달력 색상 범례">
        {([['main', '주요 훈련', '계획의 메인 운동'], ['base', '기본 운동', '기초 지구력 훈련'],
          ['recovery', '회복 운동', '회복을 위한 가벼운 운동'], ['off', '휴식', '운동 없이 쉬는 시간'],
          ['race', '경기', '경기 전 기록 또는 결과'], ['neural', '플라이오', '점프·반동을 쓰는 운동']] as const).map(([tone, label, description]) =>
          <li key={tone}><span className="calendar-color-guide__swatch" data-tone={tone} aria-hidden="true"><CalendarRoleIcon tone={tone} /></span><span><strong>{label}</strong><small>{description}</small></span></li>)}
      </ul>
      <p>색은 훈련의 역할을 나타내요. 주요 훈련이 모두 고강도인 것은 아니며, 플라이오도 부담이 클 수 있어요.</p>
      <p>기록에 없는 분류는 추측하지 않아요. 빈 칸은 휴식이나 회복을 뜻하지 않아요.</p>
      <label className="calendar-motion-choice"><input type="checkbox" checked={motion.chosen} onChange={event => motion.setReduced(event.target.checked)} />달력 움직임 줄이기</label>
    </details>}
  </section>
}
