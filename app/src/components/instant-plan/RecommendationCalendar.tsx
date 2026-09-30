import { useEffect, useState } from "react"
import type { InstantPlanDaySummary } from "../../domain/instant-plan-contract"
import { MonthCalendar } from "../MonthCalendar"
import { PlanDayReader } from "../../screens/plan-beta/PlanDayReader"
import { useLocalToday } from "../../hooks/useLocalToday"
import { isoShift } from "../../domain/dates"
import { CalendarTrainingMark } from "../CalendarTrainingMark"
import { CALENDAR_TRAINING_LABELS, plannedCalendarTone } from "../../domain/calendar-training-presentation"
import "../CalendarJournalDetails.css"
import { useCalendarPosition } from "../../hooks/useCalendarPosition"

const labels = { MAIN: "핵심 훈련", BASE: "기초 지구력", REC: "회복", OFF: "휴식", OTHER: "훈련" }

export function RecommendationCalendar({ days, identity = "preview" }: { readonly days: readonly InstantPlanDaySummary[]; readonly identity?: string }) {
  const today = useLocalToday()
  const first = days[0]?.date ?? today
  const nav = useCalendarPosition(`candidate:${identity}:${first}`, first)
  const { month, date: selected, selectMonth: setMonth, selectDate: setSelected } = nav
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [identity, first])
  const day = days.find(item => item.date === selected)
  const select = (date: string) => { setSelected(date); setMonth(date.slice(0, 7)); setOpen(true) }
  return <>
    <MonthCalendar trainingColors month={month} today={today} selectedDate={selected} onMonthChange={setMonth} onSelectDate={select}
      onToday={date => { setSelected(date); setMonth(date.slice(0, 7)) }}
      highlightedRange={{ start: first, end: days.at(-1)?.date ?? first }}
      dayDescription={date => days.find(item => item.date === date)?.sessions.map(session => `${session.slotLabel} ${labels[session.role]}`).join(" · ") || "이 후보의 일정 없음"}
      renderDay={date => {
        const item = days.find(day => day.date === date)
        if (!item) return null
        if (!item.sessions.length) return <span className="month-calendar__event">등록된 훈련 없음</span>
        return item.sessions.map(session => <CalendarTrainingMark key={session.id} tone={plannedCalendarTone(session)} slot={session.slotLabel} label={CALENDAR_TRAINING_LABELS[plannedCalendarTone(session)]} />)
      }} />
    {open && <PlanDayReader date={selected} sessions={[]} canPrevious canNext onClose={() => setOpen(false)}
      onPrevious={() => select(isoShift(selected, -1))} onNext={() => select(isoShift(selected, 1))}
      notice={<p>아직 선택 전인 계획 후보예요.</p>}>
      {day?.sessions.length ? day.sessions.map(session => <section key={session.id} className="calendar-journal-detail">
        <h3>{session.slotLabel} · {labels[session.role]}</h3><p>{session.title}</p>
        {session.notation && <p>{session.notation}</p>}
      </section>) : <p>이 후보에는 이날 예정된 훈련이 없어요.</p>}
    </PlanDayReader>}
  </>
}
