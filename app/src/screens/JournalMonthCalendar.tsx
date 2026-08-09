import React from "react"
import { assertNever } from "@impl/shared/assert-never"
import {
  projectJournalMonthCalendar,
  type JournalMonthCalendarCell,
} from "../domain/journal-calendar"
import type { ArchiveKindCounts, ArchiveMonthSummary } from "../domain/journal-archive"
import { dayLabel, monthLabel } from "./JournalArchiveSummary"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const

type JournalMonthCalendarProps = {
  readonly month: ArchiveMonthSummary
  readonly onOpenDay: (date: string) => void
}

export function JournalMonthCalendar({ month, onOpenDay }: JournalMonthCalendarProps) {
  const days = React.useMemo(
    () => month.weeks.flatMap((week) => week.days),
    [month.weeks],
  )
  const cells = React.useMemo(
    () => projectJournalMonthCalendar(month.month, days),
    [days, month.month],
  )
  const activeDays = days.length

  return (
    <section className="journal-month-calendar" aria-labelledby="journal-calendar-summary">
      <div className="journal-month-calendar__summary" id="journal-calendar-summary">
        <strong>기록이 있는 날짜를 눌러 일지를 열어요</strong>
        <span>{activeDays}일 · {month.entryCount}개 기록</span>
      </div>
      <div className="journal-month-calendar__weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="journal-month-calendar__grid" role="grid" aria-label={`${monthLabel(month.month)} 달력`}>
        {cells.map((cell) => (
          <CalendarCell key={cell.date} cell={cell} onOpenDay={onOpenDay} />
        ))}
      </div>
    </section>
  )
}

function CalendarCell({
  cell,
  onOpenDay,
}: {
  readonly cell: JournalMonthCalendarCell
  readonly onOpenDay: (date: string) => void
}) {
  switch (cell.kind) {
    case "OUTSIDE_MONTH":
      return <div className="journal-month-calendar__cell journal-month-calendar__cell--outside" role="gridcell" aria-hidden="true" />
    case "EMPTY_DAY":
      return (
        <div className="journal-month-calendar__cell journal-month-calendar__cell--empty" role="gridcell" aria-label={`${dayLabel(cell.date)} 기록 없음`}>
          <span>{cell.day}</span>
        </div>
      )
    case "RECORDED_DAY":
      return (
        <div className="journal-month-calendar__cell journal-month-calendar__cell--recorded" role="gridcell">
          <button type="button" onClick={() => onOpenDay(cell.date)} aria-label={`${dayLabel(cell.date)} ${kindText(cell.kindCounts)} 일지 열기`}>
            <span className="journal-month-calendar__date">{cell.day}</span>
            <span className="journal-month-calendar__marks" aria-hidden="true">
              {cell.kindCounts.postSession > 0 && <i data-kind="training" />}
              {cell.kindCounts.evening > 0 && <i data-kind="daily" />}
              {cell.kindCounts.race > 0 && <i data-kind="race" />}
            </span>
            <span className="journal-month-calendar__count" aria-hidden="true">{cell.entryCount}</span>
          </button>
        </div>
      )
    default:
      return assertNever(cell)
  }
}

function kindText(counts: ArchiveKindCounts): string {
  const parts = [
    counts.postSession > 0 ? `훈련 후 ${counts.postSession}건` : null,
    counts.evening > 0 ? `하루 마무리 ${counts.evening}건` : null,
    counts.race > 0 ? `경기 ${counts.race}건` : null,
  ].filter((part): part is string => part !== null)
  return parts.join(" · ")
}
