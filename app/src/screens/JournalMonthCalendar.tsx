import React from "react"
import type { ArchiveKindCounts, ArchiveMonthSummary } from "../domain/journal-archive"
import { MonthCalendar } from "../components/MonthCalendar"
import { useLocalToday } from "../hooks/useLocalToday"
import type { JournalEntry } from "../domain/journal-schema"
import { isoShift } from "../domain/dates"
import { CalendarJournalDetails } from "../components/CalendarJournalDetails"
import { PlanDayReader } from "./plan-beta/PlanDayReader"

type JournalMonthCalendarProps = {
  readonly month: ArchiveMonthSummary
  readonly onOpenDay: (date: string) => void
  readonly onMonthChange: (month: string) => void
  readonly entries?: readonly JournalEntry[]
  readonly highlightedRange?: { readonly start: string; readonly end: string }
  readonly onWriteDate?: (date: string) => void
}

export function JournalMonthCalendar({ month, onOpenDay, onMonthChange, entries = [], highlightedRange, onWriteDate }: JournalMonthCalendarProps) {
  const today = useLocalToday()
  const [selectedDate, setSelectedDate] = React.useState<string>()
  const [readerDate, setReaderDate] = React.useState<string | null>(null)
  const openDate = (date: string) => { setSelectedDate(date); setReaderDate(date); onMonthChange(date.slice(0, 7)) }
  const summaryId = React.useId()
  const days = React.useMemo(
    () => month.weeks.flatMap((week) => week.days),
    [month.weeks],
  )
  const byDate = new Map<string, { kindCounts: ArchiveKindCounts }>(days.map(day => [day.date, day]))
  // Adjacent-month cells use their own real records, not the visible month's totals.
  for (const entry of entries) {
    if (entry.date.startsWith(month.month)) continue
    const counts = byDate.get(entry.date)?.kindCounts ?? { postSession: 0, evening: 0, race: 0 }
    const key = entry.kind === "post-session" ? "postSession" : entry.kind
    byDate.set(entry.date, { kindCounts: { ...counts, [key]: counts[key] + 1 } })
  }
  const activeDays = days.length

  return (
    <section className="journal-calendar-browse" aria-labelledby={summaryId}>
      <div className="journal-month-calendar__summary" id={summaryId}>
        <strong>날짜별 일지</strong>
        <span>이 달 {activeDays}일 · {month.entryCount}개 기록</span>
      </div>
      <MonthCalendar month={month.month} today={today} selectedDate={selectedDate} highlightedRange={highlightedRange}
        onMonthChange={onMonthChange} onToday={setSelectedDate} onSelectDate={date => {
          openDate(date)
        }}
        dayDescription={date => {
          const day = byDate.get(date)
          return day ? `${kindText(day.kindCounts)} 일지 열기` : "일지 없음"
        }}
        renderDay={date => {
          const day = byDate.get(date)
          if (!day) return null
          return <>
            {day.kindCounts.postSession > 0 && <span className="month-calendar__event" data-kind="base">훈련 {day.kindCounts.postSession}</span>}
            {day.kindCounts.evening > 0 && <span className="month-calendar__event">일상 {day.kindCounts.evening}</span>}
            {day.kindCounts.race > 0 && <span className="month-calendar__event" data-kind="main">경기 {day.kindCounts.race}</span>}
          </>
        }} />
      {selectedDate?.startsWith(month.month) && !byDate.has(selectedDate) && <p className="month-calendar__empty" role="status">이날 작성한 일지가 없어요.</p>}
      {readerDate !== null && <PlanDayReader date={readerDate} sessions={[]} canPrevious canNext
        onPrevious={() => openDate(isoShift(readerDate, -1))} onNext={() => openDate(isoShift(readerDate, 1))}
        onClose={() => setReaderDate(null)}>
        <CalendarJournalDetails date={readerDate} entries={entries} onOpenDay={onOpenDay} onWriteDate={onWriteDate} />
      </PlanDayReader>}
    </section>
  )
}

function kindText(counts: ArchiveKindCounts): string {
  const parts = [
    counts.postSession > 0 ? `훈련 후 ${counts.postSession}건` : null,
    counts.evening > 0 ? `하루 마무리 ${counts.evening}건` : null,
    counts.race > 0 ? `경기 ${counts.race}건` : null,
  ].filter((part): part is string => part !== null)
  return parts.join(" · ")
}
