import { useEffect, useState } from "react"
import type { InstantPlanDaySummary } from "../../domain/instant-plan-contract"
import { MonthCalendar } from "../MonthCalendar"
import { PlanDayReader } from "../../screens/plan-beta/PlanDayReader"
import { useLocalToday } from "../../hooks/useLocalToday"
import { isoShift } from "../../domain/dates"
import "../CalendarJournalDetails.css"

const labels = { MAIN: "핵심 훈련", BASE: "기초 지구력", REC: "회복", OFF: "휴식", OTHER: "훈련" }

export function RecommendationCalendar({ days }: { readonly days: readonly InstantPlanDaySummary[] }) {
  const today = useLocalToday()
  const first = days[0]?.date ?? today
  const [month, setMonth] = useState(first.slice(0, 7))
  const [selected, setSelected] = useState(first)
  const [open, setOpen] = useState(false)
  useEffect(() => { setMonth(first.slice(0, 7)); setSelected(first); setOpen(false) }, [first])
  const day = days.find(item => item.date === selected)
  const select = (date: string) => { setSelected(date); setMonth(date.slice(0, 7)); setOpen(true) }
  return <>
    <MonthCalendar month={month} today={today} selectedDate={selected} onMonthChange={setMonth} onSelectDate={select}
      onToday={date => { setSelected(date); setMonth(date.slice(0, 7)) }}
      highlightedRange={{ start: first, end: days.at(-1)?.date ?? first }}
      dayDescription={date => days.find(item => item.date === date)?.sessions.map(session => `${session.slotLabel} ${labels[session.role]}`).join(" · ") || "이 후보의 일정 없음"}
      renderDay={date => {
        const item = days.find(day => day.date === date)
        if (!item) return null
        if (!item.sessions.length) return <span className="month-calendar__event">등록된 훈련 없음</span>
        return item.sessions.map(session => <span key={session.id} className="month-calendar__event" data-kind={session.role.toLowerCase()}><span>{session.slotLabel}</span><br /><span>{labels[session.role]}</span></span>)
      }} />
    {open && <PlanDayReader date={selected} sessions={[]} canPrevious canNext onClose={() => setOpen(false)}
      onPrevious={() => select(isoShift(selected, -1))} onNext={() => select(isoShift(selected, 1))}
      notice={<p>아직 선택 전인 계획 후보예요.</p>}>
      {day?.sessions.length ? day.sessions.map(session => <section key={session.id} className="calendar-journal-detail">
        <h3>{session.slotLabel} · {labels[session.role]}</h3><p>{session.title}</p>
      </section>) : <p>이 후보에는 이날 예정된 훈련이 없어요.</p>}
    </PlanDayReader>}
  </>
}
