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
import { CycleArchive } from "./CycleArchive"
import { JournalMonthCalendar } from "./JournalMonthCalendar"
import { JournalThenNow } from "./home/JournalThenNow"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { useLocalToday } from "../hooks/useLocalToday"
import { useCalendarPosition, useCalendarScroll } from "../hooks/useCalendarPosition"
import { calendarRecordDates, nearestCalendarDate, recentCalendarDate, type CalendarReadiness } from "../domain/calendar-context"
import { CalendarEmptyExample } from "../components/CalendarEmptyExample"
import { AppHeading } from "../components/AppHeading"
import { CalendarDecorationFrame } from "../components/CalendarDecorationFrame"
import { useCalendarDecorationState } from "../components/calendar/useCalendarDecorationState"
import type { DecorationId } from "../domain/decoration-catalog"
import { useJournalDecorationSnapshot } from "./journal/JournalDecorationPreview"

export type JournalArchiveProps = {
  readonly entries: readonly JournalEntry[]
  readonly selection: ArchiveSelection
  readonly onSelectionChange: (selection: ArchiveSelection) => void
  readonly onOpenDay: (date: string) => void
  readonly onBack: () => void
  readonly onWriteLog?: (() => void) | undefined
  readonly onWriteDate?: (date: string) => void
  readonly readiness?: CalendarReadiness
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
  readiness = "READY",
}: JournalArchiveProps) {
  const [internalMode, setInternalMode] = React.useState<"CALENDAR" | "CYCLE">("CALENDAR")
  const calendarDecorationState = useCalendarDecorationState()
  const journalDecorationSnapshot = useJournalDecorationSnapshot()
  const allowedCalendarDecorationIds = React.useMemo<ReadonlySet<DecorationId>>(
    () => new Set(journalDecorationSnapshot?.ownedItemIds ?? []),
    [journalDecorationSnapshot?.ownedItemIds],
  )
  const activeMode = mode ?? internalMode
  const calendarRoot = useCalendarScroll(`journal-scroll:${activeMode}`)
  const changeMode = onModeChange ?? setInternalMode
  const archive = React.useMemo(() => projectJournalArchive(entries), [entries])
  const today = useLocalToday()
  const dates = React.useMemo(() => calendarRecordDates(entries), [entries])
  const latest = recentCalendarDate(dates, today)
  const nav = useCalendarPosition("journal", selection.selectedMonth ? `${selection.selectedMonth}-01` : latest ?? today, readiness === "READY")
  const displayedMonth = nav.month
  const [emptyView, setEmptyView] = React.useState<"teaser" | "example" | "calendar">("teaser")
  const exampleVisible = emptyView === "example" || (emptyView === "teaser" && readiness === "READY" && entries.length === 0)
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
    ? "기록 묶음"
    : selectedWeek !== null
    ? weekHeading(selectedWeek)
    : selectedMonth !== null
      ? monthLabel(displayedMonth)
      : "지난 일지"

  return (
    <div ref={calendarRoot} className="journal-archive" data-testid="journal-archive"
      onWheel={activeMode === "CALENDAR" ? nav.markManual : undefined}
      onTouchMove={activeMode === "CALENDAR" ? nav.markManual : undefined}
      onKeyDown={event => { if (activeMode === "CALENDAR" && ["PageUp", "PageDown", "Home", "End", " "].includes(event.key)) nav.markManual() }}>
      <header className="journal-archive__header">
        <button
          type="button"
          onClick={goBack}
          aria-label={activeMode === "CYCLE" || selectedWeek !== null || selection.selectedMonth !== null ? "월간 달력으로" : "홈으로"}
          title="뒤로"
          className="journal-archive__back"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div className="journal-archive__heading">
          <div className="journal-archive__eyebrow">
            JOURNAL ARCHIVE
          </div>
          <AppHeading as="h1" variant="screen" accent className="journal-archive__title">
            {heading}
          </AppHeading>
        </div>
      </header>

      <div className="journal-archive__mode-tabs app-compact-tabs">
        <button className="app-compact-tab" type="button" aria-pressed={activeMode === "CALENDAR"} onClick={() => changeMode("CALENDAR")}>
          <span>월간 달력</span>
        </button>
        <button className="app-compact-tab" type="button" aria-pressed={activeMode === "CYCLE"} onClick={() => changeMode("CYCLE")}>
          <span>기록 묶음</span>
        </button>
      </div>
      {readiness !== "READY" && <p className="calendar-guidance" role="status">{readiness === "LOADING" ? "일지를 불러오고 있어요." : readiness === "STALE" ? "저장된 일지를 보고 있어요. 최신 기록은 아직 확인하지 못했어요." : "일지를 불러오지 못했어요. 기록이 없는 것은 아니에요."}</p>}

      {entries.some(entry => entry.kind === "post-session" && entry.date === today)
        && entries.filter(entry => entry.kind === "post-session" && entry.date <= today).length > 1 && (
        <div style={{ padding: "0 20px 16px" }}>
          <InfoDisclosure title="최근 훈련 비교" purpose="actions" preview="지난 훈련과 오늘 기록 나란히 보기">
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
          readiness={readiness}
          calendarDecorationState={calendarDecorationState}
          allowedCalendarDecorationIds={allowedCalendarDecorationIds}
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
          {exampleVisible ? <CalendarEmptyExample today={today} expanded={emptyView === "example"} onExpand={() => setEmptyView("example")}
            onCalendar={() => setEmptyView("calendar")} onWrite={onWriteLog} hasRealRecords={entries.length > 0} illustrationAllowed={readiness === "READY"} /> : <>
          <div className="calendar-guidance-actions">
            {latest && <button type="button" onClick={() => nav.selectDate(latest)}>최근 일지 · {latest.slice(5).replace("-", "/")}</button>}
            {!dates.includes(nav.date) && dates.length > 0 && nearestCalendarDate(dates, nav.date) !== latest && <button type="button" onClick={() => { const date = nearestCalendarDate(dates, nav.date); if (date) nav.selectDate(date) }}>가까운 기록</button>}
            {dates.length > 0 && !latest && <span>미래 날짜의 기록이 있어요.</span>}
          </div>
          {calendarDecorationState === null ? <JournalMonthCalendar month={calendarMonth} entries={entries} onOpenDay={onOpenDay} onWriteDate={onWriteDate}
            selectedDate={nav.date} onSelectedDateChange={nav.selectDate} onMonthChange={nav.selectMonth} /> :
            <CalendarDecorationFrame state={calendarDecorationState} allowedItemIds={allowedCalendarDecorationIds}>
              <JournalMonthCalendar month={calendarMonth} entries={entries} onOpenDay={onOpenDay} onWriteDate={onWriteDate}
                selectedDate={nav.date} onSelectedDateChange={nav.selectDate} onMonthChange={nav.selectMonth} />
            </CalendarDecorationFrame>}
          {entries.length === 0 && readiness === "READY" && <button type="button" className="calendar-range-return" onClick={() => setEmptyView("example")}>일지가 쌓인 예시 보기</button>}
          </>}
          {archive.months.length > 0 && !exampleVisible && (
            <InfoDisclosure title="월별 기록 모아보기" purpose="actions" preview="다른 달의 일지 찾기">
            <SummaryList
              label="월별 기록"
              items={archive.months}
              itemKey={(month) => month.month}
              renderItem={(month) => (
                <SummaryButton
                  heading={monthLabel(month.month)}
                  summary={month}
                  ariaLabel={`${monthLabel(month.month)} ${summaryText(month)}`}
                  onClick={() => { nav.selectDate(dates.filter(date => date.startsWith(month.month)).at(-1) ?? `${month.month}-01`); onSelectionChange({
                    selectedMonth: month.month,
                    selectedWeekStart: null,
                  }) }}
                />
              )}
            />
            </InfoDisclosure>
          )}
        </>
      )}
    </div>
  )
}
