import { useState } from "react"
import { ArrowRight, CalendarDays } from "lucide-react"
import { MonthCalendar, calendarDayLabel } from "./MonthCalendar"
import { CalendarTrainingMark } from "./CalendarTrainingMark"
import { isoShift, isoToDate } from "../domain/dates"
import { PlanDayReader } from "../screens/plan-beta/PlanDayReader"

/** Isolated display-only example: never enters any journal or plan data collection. */
export function CalendarEmptyExample({ today, expanded, onExpand, onCalendar, onWrite, hasRealRecords }: {
  today: string; expanded: boolean; onExpand: () => void; onCalendar: () => void; onWrite?: () => void; hasRealRecords: boolean;
}) {
  const start = isoShift(today, -isoToDate(today).getDay())
  const [month, setMonth] = useState(today.slice(0, 7))
  const [date, setDate] = useState<string | null>(null)
  const openDate = (value: string) => { setDate(value); setMonth(value.slice(0, 7)) }
  const examples = [
    { date: start, tone: "base" as const, label: "조깅", detail: "조깅한 날의 일지예요. 실제 기록에는 시간·거리와 직접 남긴 내용이 표시돼요." },
    { date: isoShift(start, 2), tone: "recovery" as const, label: "회복", detail: "가벼운 활동을 기록한 날이에요. 회복 운동과 아무 기록 없는 날은 다르게 보여요." },
    { date: isoShift(start, 4), tone: "off" as const, label: "휴식", detail: "쉬었다고 직접 기록한 날이에요. 훈련하지 않아도 일지를 남길 수 있어요." },
  ]
  return <section className="calendar-empty-example" aria-label="일지 달력 예시">
    <header><CalendarDays size={20} aria-hidden="true" /><h2>{expanded ? "일지가 쌓인 달력" : "첫 일지를 남겨보세요"}</h2></header>
    <p className="calendar-example-label">예시 · 내 기록에 저장되지 않아요</p>
    {expanded ? <MonthCalendar month={month} today={today} selectedDate={date ?? undefined}
      onMonthChange={setMonth} onToday={value => { setMonth(value.slice(0, 7)); setDate(null) }}
      onSelectDate={openDate} trainingColors
      dayDescription={value => `예시 · ${examples.find(item => item.date === value)?.label ?? "기록 없는 날"}`}
      renderDay={value => { const item = examples.find(item => item.date === value); return item ? <CalendarTrainingMark tone={item.tone} label={item.label} /> : null }} />
      : <button type="button" className="calendar-example-preview" onClick={onExpand} aria-label="예시 둘러보기">
        {Array.from({ length: 7 }, (_, index) => { const value = isoShift(start, index); const item = examples.find(example => example.date === value)
          return <span key={value}><small>{["일", "월", "화", "수", "목", "금", "토"][index]}</small><strong>{Number(value.slice(-2))}</strong>{item && <CalendarTrainingMark tone={item.tone} label={item.label} />}</span>
        })}<span className="calendar-example-preview__cta">예시 둘러보기 <ArrowRight size={16} aria-hidden="true" /></span>
      </button>}
    {hasRealRecords && <p role="status">내 기록도 도착했어요.</p>}
    <div className="calendar-guidance-actions">
      {onWrite && <button type="button" onClick={onWrite}>내 첫 기록 남기기 <ArrowRight size={16} aria-hidden="true" /></button>}
      <button type="button" onClick={onCalendar}>내 달력</button>
    </div>
    {date && <PlanDayReader date={date} sessions={[]} canPrevious canNext onPrevious={() => openDate(isoShift(date, -1))}
      onNext={() => openDate(isoShift(date, 1))} onClose={() => setDate(null)} notice={<p>예시 · 내 기록에 저장되지 않아요</p>}>
      <section className="calendar-journal-detail"><h3>{calendarDayLabel(date)}</h3><p>{examples.find(item => item.date === date)?.detail ?? "이날은 예시 기록이 없어요. 실제 달력에서는 날짜를 눌러 기록을 남길 수 있어요."}</p></section>
    </PlanDayReader>}
  </section>
}
