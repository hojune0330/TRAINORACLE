import { isoShift, isoToDate, pad2 } from "./dates"
import type { ArchiveDaySummary, ArchiveKindCounts } from "./journal-archive-types"

export type CalendarRecordSummary = {
  readonly entryCount: number
  readonly kindCounts: ArchiveKindCounts
}

type CalendarCellBase = {
  readonly date: string
  readonly day: number
}

export type JournalMonthCalendarCell =
  | (CalendarCellBase & { readonly kind: "OUTSIDE_MONTH" })
  | (CalendarCellBase & { readonly kind: "EMPTY_DAY" })
  | (CalendarCellBase & {
    readonly kind: "RECORDED_DAY"
    readonly entryCount: number
    readonly kindCounts: ArchiveKindCounts
  })

export function projectJournalMonthCalendar(
  month: string,
  days: readonly ArchiveDaySummary[],
): readonly JournalMonthCalendarCell[] {
  const firstDate = `${month}-01`
  const first = isoToDate(firstDate)
  const firstWeekday = first.getDay()
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cellsInGrid = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const summaries = new Map(
    days
      .filter((day) => day.date.slice(0, 7) === month)
      .map((day) => [day.date, toCalendarRecordSummary(day)]),
  )
  const gridStart = isoShift(firstDate, -firstWeekday)
  const cells: JournalMonthCalendarCell[] = []

  for (let index = 0; index < cellsInGrid; index += 1) {
    const date = isoShift(gridStart, index)
    const day = isoToDate(date).getDate()
    if (!date.startsWith(month)) {
      cells.push({ kind: "OUTSIDE_MONTH", date, day })
      continue
    }
    const summary = summaries.get(date)
    if (summary === undefined) {
      cells.push({ kind: "EMPTY_DAY", date, day })
      continue
    }
    cells.push({
      kind: "RECORDED_DAY",
      date,
      day,
      entryCount: summary.entryCount,
      kindCounts: summary.kindCounts,
    })
  }

  return cells
}

function toCalendarRecordSummary(day: ArchiveDaySummary): CalendarRecordSummary {
  return {
    entryCount: day.entryCount,
    kindCounts: { ...day.kindCounts },
  }
}
