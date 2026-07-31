import React from "react"
import { ArrowLeft } from "lucide-react"
import {
  projectJournalArchive,
} from "../domain/journal-archive"
import type {
  ArchiveSelection,
} from "../domain/journal-archive"
import type { JournalEntry } from "../domain/journal-schema"
import {
  dayLabel,
  monthLabel,
  SummaryButton,
  SummaryList,
  summaryText,
  weekButtonLabel,
  weekHeading,
} from "./JournalArchiveSummary"

export type JournalArchiveProps = {
  readonly entries: readonly JournalEntry[]
  readonly selection: ArchiveSelection
  readonly onSelectionChange: (selection: ArchiveSelection) => void
  readonly onOpenDay: (date: string) => void
  readonly onBack: () => void
}

export function JournalArchive({
  entries,
  selection,
  onSelectionChange,
  onOpenDay,
  onBack,
}: JournalArchiveProps) {
  const archive = React.useMemo(() => projectJournalArchive(entries), [entries])
  const selectedMonth = archive.months.find((month) => month.month === selection.selectedMonth) ?? null
  const selectedWeek = selectedMonth?.weeks.find(
    (week) => week.weekStart === selection.selectedWeekStart,
  ) ?? null

  const goBack = () => {
    if (selectedWeek !== null) {
      onSelectionChange({
        selectedMonth: selectedMonth?.month ?? null,
        selectedWeekStart: null,
      })
    } else if (selectedMonth !== null) {
      onSelectionChange({ selectedMonth: null, selectedWeekStart: null })
    } else {
      onBack()
    }
  }

  const heading = selectedWeek !== null
    ? weekHeading(selectedWeek)
    : selectedMonth !== null
      ? monthLabel(selectedMonth.month)
      : "지난 일지"

  return (
    <div data-testid="journal-archive" style={{ minHeight: "100%", paddingBottom: 96 }}>
      <header style={{
        padding: "16px 20px 14px",
        borderBottom: "1px solid var(--ink)",
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr)",
        gap: 10,
        alignItems: "center",
      }}>
        <button
          type="button"
          onClick={goBack}
          aria-label={selectedWeek !== null ? "월간 목록으로" : selectedMonth !== null ? "월 목록으로" : "홈으로"}
          title="뒤로"
          style={{
            width: 44,
            height: 44,
            border: "1px solid var(--line)",
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            background: "transparent",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <ArrowLeft aria-hidden="true" size={19} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            color: "var(--ink-3)",
            letterSpacing: "0.14em",
          }}>
            JOURNAL ARCHIVE
          </div>
          <h1 style={{
            margin: "3px 0 0",
            fontFamily: "var(--sans)",
            fontSize: 21,
            lineHeight: 1.25,
            fontWeight: 600,
            overflowWrap: "anywhere",
          }}>
            {heading}
          </h1>
        </div>
      </header>

      {archive.months.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 16, color: "var(--ink)" }}>
            아직 지난 일지가 없어요.
          </div>
        </div>
      ) : selectedWeek !== null ? (
        <SummaryList
          label={`${weekHeading(selectedWeek)} 일별 기록`}
          items={selectedWeek.days}
          itemKey={(day) => day.date}
          renderItem={(day) => (
            <SummaryButton
              heading={dayLabel(day.date)}
              summary={day}
              ariaLabel={`${dayLabel(day.date)} ${summaryText(day)}`}
              onClick={() => onOpenDay(day.date)}
            />
          )}
        />
      ) : selectedMonth !== null ? (
        <SummaryList
          label={`${monthLabel(selectedMonth.month)} 주별 기록`}
          items={selectedMonth.weeks}
          itemKey={(week) => week.weekStart}
          renderItem={(week) => (
            <SummaryButton
              heading={weekButtonLabel(week)}
              summary={week}
              ariaLabel={`${weekButtonLabel(week)} ${summaryText(week)}`}
              onClick={() => onSelectionChange({
                selectedMonth: selectedMonth.month,
                selectedWeekStart: week.weekStart,
              })}
            />
          )}
        />
      ) : (
        <SummaryList
          label="월별 기록"
          items={archive.months}
          itemKey={(month) => month.month}
          renderItem={(month) => (
            <SummaryButton
              heading={monthLabel(month.month)}
              summary={month}
              ariaLabel={`${monthLabel(month.month)} ${summaryText(month)}`}
              onClick={() => onSelectionChange({
                selectedMonth: month.month,
                selectedWeekStart: null,
              })}
            />
          )}
        />
      )}
    </div>
  )
}
