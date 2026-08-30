import React from "react"
import { ArrowLeft } from "lucide-react"
import { GuidedEmptyState } from "../components/GuidedEmptyState"
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
import { CycleArchive } from "./CycleArchive"
import { JournalMonthCalendar } from "./JournalMonthCalendar"

export type JournalArchiveProps = {
  readonly entries: readonly JournalEntry[]
  readonly selection: ArchiveSelection
  readonly onSelectionChange: (selection: ArchiveSelection) => void
  readonly onOpenDay: (date: string) => void
  readonly onBack: () => void
  readonly onWriteLog?: (() => void) | undefined
  readonly mode?: "CALENDAR" | "CYCLE"
  readonly cycleAnchor?: string | null
  readonly cycleIndex?: number
  readonly onModeChange?: (mode: "CALENDAR" | "CYCLE") => void
  readonly onCycleAnchorChange?: (anchor: string) => void
  readonly onCycleIndexChange?: (index: number) => void
}

export function JournalArchive({
  entries,
  selection,
  onSelectionChange,
  onOpenDay,
  onBack,
  onWriteLog,
  mode,
  cycleAnchor,
  cycleIndex,
  onModeChange,
  onCycleAnchorChange,
  onCycleIndexChange,
}: JournalArchiveProps) {
  const [internalMode, setInternalMode] = React.useState<"CALENDAR" | "CYCLE">("CALENDAR")
  const activeMode = mode ?? internalMode
  const changeMode = onModeChange ?? setInternalMode
  const archive = React.useMemo(() => projectJournalArchive(entries), [entries])
  const selectedMonth = archive.months.find((month) => month.month === selection.selectedMonth) ?? null
  const selectedWeek = selectedMonth?.weeks.find(
    (week) => week.weekStart === selection.selectedWeekStart,
  ) ?? null

  const goBack = () => {
    if (activeMode === "CYCLE") {
      changeMode("CALENDAR")
    } else if (selectedWeek !== null) {
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

  const heading = activeMode === "CYCLE"
    ? "9.5일 주기 일지"
    : selectedWeek !== null
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

      <div className="journal-archive__mode-tabs app-compact-tabs">
        <button className="app-compact-tab" type="button" aria-pressed={activeMode === "CALENDAR"} onClick={() => changeMode("CALENDAR")}>
          <span>월간 달력</span>
        </button>
        <button className="app-compact-tab" type="button" aria-pressed={activeMode === "CYCLE"} onClick={() => changeMode("CYCLE")}>
          <span>9.5일 주기</span>
        </button>
      </div>

      {activeMode === "CYCLE" ? (
        <CycleArchive
          entries={entries}
          anchor={cycleAnchor}
          index={cycleIndex}
          onAnchorChange={onCycleAnchorChange}
          onIndexChange={onCycleIndexChange}
          onOpenDay={onOpenDay}
          onWriteLog={onWriteLog}
        />
      ) : archive.months.length === 0 ? (
        <GuidedEmptyState
          title="첫 일지를 남겨보세요"
          description="훈련한 날도, 쉰 날도 기록할 수 있어요. 한 번 남기면 날짜별 일지가 여기에 모입니다."
          actionLabel="오늘 기록하기"
          onAction={onWriteLog}
        />
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
        <JournalMonthCalendar month={selectedMonth} onOpenDay={onOpenDay} />
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
