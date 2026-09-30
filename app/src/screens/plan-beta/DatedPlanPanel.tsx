import React, { type ReactNode } from "react"
import { Maximize2 } from "lucide-react"
import { MonthCalendar, calendarDayLabel } from "../../components/MonthCalendar"
import { CalendarJournalBadge, CalendarJournalDetails, calendarJournalDescription } from "../../components/CalendarJournalDetails"
import { isoShift } from "../../domain/dates"
import { useLocalToday } from "../../hooks/useLocalToday"
import { useCalendarEntries } from "../../hooks/useCalendarEntries"
import { PlanDayReader } from "./PlanDayReader"
import { ENERGY_INTENT_LABELS } from "./labels"
import { CalendarTrainingMark } from "../../components/CalendarTrainingMark"
import { CALENDAR_TRAINING_LABELS, plannedCalendarTone } from "../../domain/calendar-training-presentation"
import { useCalendarPosition } from "../../hooks/useCalendarPosition"
import { calendarEntriesByDate } from "../../domain/calendar-context"

type CalendarSession = {
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly role: string
  readonly plannedEnergyIntent: keyof typeof ENERGY_INTENT_LABELS
}

/** Calendar-only adapter: adjusted prescription objects and write callbacks remain untouched. */
export function DatedPlanPanel({ start, sessions, day, onDayChange, children, notice, identity }: {
  readonly identity?: string
  readonly start: string
  readonly sessions: readonly CalendarSession[]
  readonly day: number
  readonly onDayChange: (day: number) => void
  readonly children: ReactNode
  readonly notice?: ReactNode
}) {
  const today = useLocalToday()
  const entries = useCalendarEntries()
  const journalByDate = React.useMemo(() => calendarEntriesByDate(entries), [entries])
  const currentDate = isoShift(start, day - 1)
  const instance = React.useId()
  const nav = useCalendarPosition(`adjusted:${identity ?? instance}:${start}`, currentDate)
  const selected = nav.date, setSelected = nav.selectDate, month = nav.month, setMonth = nav.selectMonth
  const [open, setOpen] = React.useState(false)
  const previousDay = React.useRef(currentDate)
  React.useEffect(() => {
    if (previousDay.current !== currentDate) setSelected(currentDate)
    previousDay.current = currentDate
  }, [currentDate, setSelected])
  const restored = React.useRef(false)
  React.useEffect(() => {
    if (restored.current) return
    restored.current = true
    const session = sessions.find(item => isoShift(start, item.day - 1) === selected)
    if (session && session.day !== day) onDayChange(session.day)
  }, [sessions, start, selected, day, onDayChange])
  const sessionsAt = (date: string) => sessions.filter(session => isoShift(start, session.day - 1) === date)
  const selectedSessions = sessionsAt(selected)
  const select = (date: string, enlarge = true) => {
    setSelected(date); setMonth(date.slice(0, 7))
    const session = sessionsAt(date)[0]
    if (session) onDayChange(session.day)
    if (enlarge) setOpen(true)
  }
  const label = (session: CalendarSession) => `${session.slot === "AM" ? "오전" : "오후"} ${CALENDAR_TRAINING_LABELS[plannedCalendarTone(session)]}${session.role === "REST" ? "" : ` · ${ENERGY_INTENT_LABELS[session.plannedEnergyIntent].title}`}`
  return <section className="dated-plan-panel" aria-label="훈련 달력">
    <MonthCalendar trainingColors month={month} today={today} selectedDate={selected} onMonthChange={setMonth}
      onToday={date => select(date, false)} onSelectDate={date => select(date)}
      highlightedRange={{ start, end: isoShift(start, Math.max(1, ...sessions.map(session => session.day)) - 1) }}
      dayDescription={date => [sessionsAt(date).map(label).join(" · ") || "이 계획의 일정 없음", calendarJournalDescription(journalByDate.get(date) ?? [], date)].filter(Boolean).join(" · ")}
      renderDay={date => <>{sessionsAt(date).map(session => <CalendarTrainingMark key={session.slot}
        tone={plannedCalendarTone(session)} slot={session.slot === "AM" ? "오전" : "오후"}
        label={CALENDAR_TRAINING_LABELS[plannedCalendarTone(session)]} />)}<CalendarJournalBadge entries={journalByDate.get(date) ?? []} date={date} /></>} />
    <button className="plan-session-expand" type="button" onClick={() => setOpen(true)}>
      <Maximize2 size={18} aria-hidden="true" />{calendarDayLabel(selected)} · 크게 보기
    </button>
    {open && <PlanDayReader date={selected} sessions={selectedSessions} canPrevious canNext
      onPrevious={() => select(isoShift(selected, -1))} onNext={() => select(isoShift(selected, 1))}
      onClose={() => setOpen(false)} notice={notice}>
      <div className="adjusted-plan-schedule">{selectedSessions.length ? children : <p>이 계획에는 이날 예정된 훈련이 없어요.</p>}</div>
      <CalendarJournalDetails date={selected} entries={entries} />
    </PlanDayReader>}
  </section>
}
