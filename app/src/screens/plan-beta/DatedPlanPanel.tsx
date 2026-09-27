import React, { type ReactNode } from "react"
import { Maximize2 } from "lucide-react"
import { MonthCalendar, calendarDayLabel } from "../../components/MonthCalendar"
import { CalendarJournalBadge, CalendarJournalDetails, calendarJournalDescription } from "../../components/CalendarJournalDetails"
import { isoShift } from "../../domain/dates"
import { useLocalToday } from "../../hooks/useLocalToday"
import { useCalendarEntries } from "../../hooks/useCalendarEntries"
import { PlanDayReader } from "./PlanDayReader"
import { ENERGY_INTENT_LABELS } from "./labels"

type CalendarSession = {
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly role: string
  readonly plannedEnergyIntent: keyof typeof ENERGY_INTENT_LABELS
}

/** Calendar-only adapter: adjusted prescription objects and write callbacks remain untouched. */
export function DatedPlanPanel({ start, sessions, day, onDayChange, children, notice }: {
  readonly start: string
  readonly sessions: readonly CalendarSession[]
  readonly day: number
  readonly onDayChange: (day: number) => void
  readonly children: ReactNode
  readonly notice?: ReactNode
}) {
  const today = useLocalToday()
  const entries = useCalendarEntries()
  const currentDate = isoShift(start, day - 1)
  const [selected, setSelected] = React.useState(currentDate)
  const [month, setMonth] = React.useState(currentDate.slice(0, 7))
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => { setSelected(currentDate); setMonth(currentDate.slice(0, 7)) }, [currentDate])
  const sessionsAt = (date: string) => sessions.filter(session => isoShift(start, session.day - 1) === date)
  const selectedSessions = sessionsAt(selected)
  const select = (date: string, enlarge = true) => {
    setSelected(date); setMonth(date.slice(0, 7))
    const session = sessionsAt(date)[0]
    if (session) onDayChange(session.day)
    if (enlarge) setOpen(true)
  }
  const label = (session: CalendarSession) => `${session.slot === "AM" ? "오전" : "오후"} ${session.role === "REST" ? "휴식" : ENERGY_INTENT_LABELS[session.plannedEnergyIntent].title}`
  return <section className="dated-plan-panel" aria-label="훈련 달력">
    <MonthCalendar month={month} today={today} selectedDate={selected} onMonthChange={setMonth}
      onToday={date => select(date, false)} onSelectDate={date => select(date)}
      highlightedRange={{ start, end: isoShift(start, Math.max(1, ...sessions.map(session => session.day)) - 1) }}
      dayDescription={date => [sessionsAt(date).map(label).join(" · ") || "이 계획의 일정 없음", calendarJournalDescription(entries, date)].filter(Boolean).join(" · ")}
      renderDay={date => <>{sessionsAt(date).map(session => <span key={session.slot} className="month-calendar__event" data-kind={session.role === "QUALITY" ? "main" : session.role === "REST" ? "off" : "base"}>
        {session.slot === "AM" ? "오전" : "오후"}<br />{session.role === "REST" ? "휴식" : ENERGY_INTENT_LABELS[session.plannedEnergyIntent].title.split(" · ").at(-1)}
      </span>)}<CalendarJournalBadge entries={entries} date={date} /></>} />
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
