import React from "react"
import type { ArchiveKindCounts, ArchiveMonthSummary } from "../domain/journal-archive"
import { MonthCalendar } from "../components/MonthCalendar"
import { useLocalToday } from "../hooks/useLocalToday"
import type { JournalEntry } from "../domain/journal-schema"
import { isValidIsoDate, isoShift } from "../domain/dates"
import { CalendarJournalDetails } from "../components/CalendarJournalDetails"
import { PlanDayReader } from "./plan-beta/PlanDayReader"
import { CalendarTrainingMark } from "../components/CalendarTrainingMark"
import { calendarMarksDescription, journalCalendarMarks, type CalendarTrainingMarkData } from "../domain/calendar-training-presentation"
import { calendarRecordDates } from "../domain/calendar-context"
import { JournalDecorationPreview, useJournalDecorationPreviews } from "./journal/JournalDecorationPreview"

type JournalMonthCalendarProps = {
  readonly month: ArchiveMonthSummary
  readonly onOpenDay: (date: string) => void
  readonly onMonthChange: (month: string) => void
  readonly entries?: readonly JournalEntry[]
  readonly highlightedRange?: { readonly start: string; readonly end: string }
  readonly onWriteDate?: (date: string) => void
  readonly selectedDate?: string
  readonly onSelectedDateChange?: (date: string) => void
}

export function JournalMonthCalendar({ month, onOpenDay, onMonthChange, entries = [], highlightedRange, onWriteDate, selectedDate: controlledDate, onSelectedDateChange }: JournalMonthCalendarProps) {
  const today = useLocalToday()
  const [internalDate, setInternalDate] = React.useState<string>()
  const selectedDate = controlledDate ?? internalDate
  const setSelectedDate = (date: string) => { setInternalDate(date); onSelectedDateChange?.(date) }
  const [readerDate, setReaderDate] = React.useState<string | null>(null)
  const openDate = (date: string) => { setSelectedDate(date); setReaderDate(date); onMonthChange(date.slice(0, 7)) }
  const summaryId = React.useId()
  const recordDates = React.useMemo(() => calendarRecordDates(entries), [entries])
  const activeDates = React.useMemo(
    () => new Set(entries.map((entry) => entry.date).filter(isValidIsoDate)),
    [entries],
  )
  const decorationPreviews = useJournalDecorationPreviews(activeDates)
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
  const marksByDate = React.useMemo(() => {
    const result = new Map<string, CalendarTrainingMarkData[]>()
    for (const entry of entries) {
      const marks = result.get(entry.date) ?? []
      marks.push(...journalCalendarMarks(entry))
      result.set(entry.date, marks)
    }
    for (const marks of result.values()) marks.sort((a, b) => {
      const order = (mark: CalendarTrainingMarkData) => mark.tone === "race" ? 0 : mark.slot === "오전" ? 1 : mark.slot === "오후" ? 2 : 3
      return order(a) - order(b)
    })
    return result
  }, [entries])

  return (
    <section className="journal-calendar-browse" aria-labelledby={summaryId}>
      <div className="journal-month-calendar__summary" id={summaryId}>
        <strong>날짜별 일지</strong>
        <span>이 달 {activeDays}일 · {month.entryCount}개 기록</span>
      </div>
      <MonthCalendar trainingColors month={month.month} today={today} selectedDate={selectedDate} highlightedRange={highlightedRange}
        onMonthChange={onMonthChange} onToday={setSelectedDate} onSelectDate={date => {
          openDate(date)
        }}
        dayDescription={date => {
          const day = byDate.get(date)
          return day ? [kindText(day.kindCounts), calendarMarksDescription(marksByDate.get(date) ?? []), "일지 열기"].filter(Boolean).join(" · ") : "일지 없음"
        }}
        dayAdornmentDescription={date => decorationPreviews.has(date) ? "일지에 그림 장식 있음" : undefined}
        renderDayAdornment={date => <JournalDecorationPreview item={decorationPreviews.get(date)} />}
        renderDay={date => {
          const day = byDate.get(date)
          if (!day) return null
          const marks = marksByDate.get(date) ?? []
          if (marks.length) return <>
            {marks.slice(0, 3).map((mark, index) => <CalendarTrainingMark key={index} {...mark} />)}
            {marks.length > 3 && <span className="month-calendar__event">+{marks.length - 3}</span>}
          </>
          return <>
            {day.kindCounts.postSession > 0 && <CalendarTrainingMark tone="unknown" label={`훈련 ${day.kindCounts.postSession}`} />}
            {day.kindCounts.evening > 0 && <span className="month-calendar__event">일상 {day.kindCounts.evening}</span>}
            {day.kindCounts.race > 0 && <CalendarTrainingMark tone="race" label={`경기 ${day.kindCounts.race}`} />}
          </>
        }} />
      {selectedDate?.startsWith(month.month) && !byDate.has(selectedDate) && <p className="month-calendar__empty" role="status">이날 작성한 일지가 없어요.</p>}
      {readerDate !== null && <PlanDayReader date={readerDate} sessions={[]} canPrevious canNext
        onPrevious={() => openDate(isoShift(readerDate, -1))} onNext={() => openDate(isoShift(readerDate, 1))}
        onClose={() => setReaderDate(null)}>
        <nav className="calendar-record-jumps" aria-label="기록 있는 날짜 이동">
          <button type="button" disabled={!recordDates.some(date => date < readerDate)} onClick={() => {
            const date = recordDates.filter(date => date < readerDate).at(-1); if (date) openDate(date)
          }}>이전 기록</button>
          <button type="button" disabled={!recordDates.some(date => date > readerDate)} onClick={() => {
            const date = recordDates.find(date => date > readerDate); if (date) openDate(date)
          }}>다음 기록</button>
        </nav>
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
