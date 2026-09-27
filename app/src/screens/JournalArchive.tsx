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
import { JournalThenNow } from "./home/JournalThenNow"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { useLocalToday } from "../hooks/useLocalToday"

export type JournalArchiveProps = {
  readonly entries: readonly JournalEntry[]
  readonly selection: ArchiveSelection
  readonly onSelectionChange: (selection: ArchiveSelection) => void
  readonly onOpenDay: (date: string) => void
  readonly onBack: () => void
  readonly onWriteLog?: (() => void) | undefined
  readonly onWriteDate?: (date: string) => void
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
  onWriteDate,
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
  const today = useLocalToday()
  const displayedMonth = selection.selectedMonth ?? today.slice(0, 7)
  const selectedMonth = archive.months.find((month) => month.month === selection.selectedMonth) ?? null
  const calendarMonth = archive.months.find(month => month.month === displayedMonth) ?? {
    month: displayedMonth, entryCount: 0, kindCounts: { postSession: 0, evening: 0, race: 0 },
    metrics: { distanceKm: null, durationMin: null, moodAverage: null, painMax: null },
    excludedRecordCount: 0, weeks: [],
  }
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
    } else if (selection.selectedMonth !== null) {
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
    <div className="journal-archive" data-testid="journal-archive">
      <header className="journal-archive__header">
        <button
          type="button"
          onClick={goBack}
          aria-label={activeMode === "CYCLE" || selectedWeek !== null ? "월간 달력으로" : selection.selectedMonth !== null ? "이번 달로" : "홈으로"}
          title="뒤로"
          className="journal-archive__back"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div className="journal-archive__heading">
          <div className="journal-archive__eyebrow">
            JOURNAL ARCHIVE
          </div>
          <h1>
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

      {entries.some(entry => entry.kind === "post-session" && entry.date === today)
        && entries.filter(entry => entry.kind === "post-session" && entry.date <= today).length > 1 && (
        <div style={{ padding: "0 20px 16px" }}>
          <InfoDisclosure title="최근 훈련 비교">
            <JournalThenNow onOpenDay={onOpenDay} />
          </InfoDisclosure>
        </div>
      )}

      {activeMode === "CYCLE" ? (
        <CycleArchive
          entries={entries}
          anchor={cycleAnchor}
          index={cycleIndex}
          onAnchorChange={onCycleAnchorChange}
          onIndexChange={onCycleIndexChange}
          onOpenDay={onOpenDay}
          onWriteLog={onWriteLog}
          onWriteDate={onWriteDate}
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
      ) : (
        <>
          <JournalMonthCalendar month={calendarMonth} entries={entries} onOpenDay={onOpenDay} onWriteDate={onWriteDate}
            onMonthChange={month => onSelectionChange({ selectedMonth: month, selectedWeekStart: null })} />
          {archive.months.length === 0 ? (
            <GuidedEmptyState
              title="첫 일지를 남겨보세요"
              description="훈련한 날도, 쉰 날도 기록할 수 있어요."
              actionLabel="오늘 기록하기" onAction={onWriteLog} />
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
        </>
      )}
    </div>
  )
}
