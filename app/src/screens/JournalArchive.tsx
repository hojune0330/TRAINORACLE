import React from "react"
import { ArrowLeft, BookOpen, CalendarDays, HeartPulse, Layers, PencilLine, RefreshCw } from "lucide-react"
import { ViewSwitcher } from "../components/ViewSwitcher"
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
import { validJournalCalendarReturn, type JournalCalendarReturn, type OpenJournalDay } from "../navigation/readerPosition"
import { BodyHistory } from "./BodyHistory"
import { localJournalScopeGeneration } from "../domain/account/local-journal-ownership"
import { filterOwnerBodyEntries } from "../domain/account/body-record-scope"
import { useTaskFlowBack } from "../hooks/useTaskFlowBack"

export type JournalArchiveProps = {
  readonly entries: readonly JournalEntry[]
  readonly selection: ArchiveSelection
  readonly onSelectionChange: (selection: ArchiveSelection) => void
  readonly onOpenDay: OpenJournalDay
  readonly onBack: () => void
  readonly onWriteLog?: (() => void) | undefined
  readonly onWriteDate?: (date: string) => void
  readonly readiness?: CalendarReadiness
  readonly onRetry?: () => void
  readonly mode?: "CALENDAR" | "CYCLE"
  readonly cycleAnchor?: string | null
  readonly cycleIndex?: number
  readonly onModeChange?: (mode: "CALENDAR" | "CYCLE") => void
  readonly onCycleAnchorChange?: (anchor: string) => void
  readonly onCycleIndexChange?: (index: number) => void
  readonly calendarReturn?: JournalCalendarReturn | null
  readonly onCalendarReturnConsumed?: () => void
  readonly section?: "JOURNAL" | "BODY" | undefined
  readonly onSectionChange?: (section: "JOURNAL" | "BODY") => void
  readonly bodyPartId?: string | null | undefined
  readonly onBodyPartChange?: (partId: string | null) => void
  readonly onWriteBody?: (partId?: string) => void
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
  calendarReturn,
  onCalendarReturnConsumed,
  section = "JOURNAL", onSectionChange, bodyPartId, onBodyPartChange, onWriteBody,
  readiness = "READY",
  onRetry,
}: JournalArchiveProps) {
  const [internalMode, setInternalMode] = React.useState<"CALENDAR" | "CYCLE">("CALENDAR")
  const [internalSection, setInternalSection] = React.useState<"JOURNAL" | "BODY">("JOURNAL")
  const [internalBodyPartId, setInternalBodyPartId] = React.useState<string | null>(null)
  const [bodyNavigationPending, setBodyNavigationPending] = React.useState(false)
  const activeBodyPartId = onBodyPartChange ? bodyPartId ?? null : internalBodyPartId
  const changeBodyPart = onBodyPartChange ?? setInternalBodyPartId
  const activeSection = onSectionChange ? section : internalSection
  const bodyScope = localJournalScopeGeneration()
  const bodyEntries = React.useMemo(() => filterOwnerBodyEntries(entries), [entries, bodyScope])
  const changeSection = onSectionChange ?? setInternalSection
  const releaseBodyBack = useTaskFlowBack({ enabled: activeSection === "BODY", onBack: () => {
    if (activeBodyPartId) changeBodyPart(null)
    else changeSection("JOURNAL")
  } })
  const calendarDecorationState = useCalendarDecorationState()
  const journalDecorationSnapshot = useJournalDecorationSnapshot()
  const allowedCalendarDecorationIds = React.useMemo<ReadonlySet<DecorationId>>(
    () => new Set(journalDecorationSnapshot?.ownedItemIds ?? []),
    [journalDecorationSnapshot?.ownedItemIds],
  )
  const activeMode = mode ?? internalMode
  const calendarRoot = useCalendarScroll(`journal-scroll:${activeMode}${activeSection === "BODY" ? ":body" : ""}`)
  const changeMode = onModeChange ?? setInternalMode
  const archive = React.useMemo(() => projectJournalArchive(entries), [entries])
  const today = useLocalToday()
  const dates = React.useMemo(() => calendarRecordDates(entries), [entries])
  const latest = recentCalendarDate(dates, today)
  const nav = useCalendarPosition("journal", selection.selectedMonth ? `${selection.selectedMonth}-01` : latest ?? today, readiness === "READY")
  const displayedMonth = nav.month
  const navigationFocus = React.useRef<string | null>(null)
  React.useLayoutEffect(() => {
    const date = navigationFocus.current
    if (!date || nav.date !== date || displayedMonth !== date.slice(0, 7)) return
    const target = calendarRoot.current?.querySelector<HTMLButtonElement>(`.month-calendar__grid button[data-date="${date}"]`)
    if (target) {
      navigationFocus.current = null
      target.focus({ preventScroll: true })
    }
  }, [nav.date, displayedMonth, calendarRoot])
  const moveToDate = (date: string) => {
    navigationFocus.current = date
    nav.selectDate(date)
  }
  React.useLayoutEffect(() => {
    const returned = validJournalCalendarReturn(calendarReturn, entries)
    if (returned && activeMode === "CALENDAR" && (nav.date !== returned.date || nav.month !== returned.date.slice(0, 7))) nav.selectDate(returned.date)
  }, [calendarReturn, entries, activeMode, nav.date, nav.month, nav.selectDate])
  const [emptyView, setEmptyView] = React.useState<"example" | "calendar">("calendar")
  const [emptyIllustrationFailed, setEmptyIllustrationFailed] = React.useState(false)
  const unconfirmedEmpty = readiness !== "READY" && entries.length === 0
    && !(activeMode === "CALENDAR" && emptyView === "example")
  const exampleVisible = emptyView === "example"
  const recordObject = activeSection === "BODY" ? "기록을" : "일지를"
  const readMessage = readiness === "LOADING"
    ? entries.length > 0 ? `저장된 ${recordObject} 보고 있어요. 최신 기록을 불러오는 중이에요.` : `${recordObject} 불러오고 있어요.`
    : entries.length > 0 ? `저장된 ${recordObject} 보고 있어요. 최신 기록은 아직 확인하지 못했어요.`
      : readiness === "STALE" ? `최신 ${recordObject} 아직 확인하지 못했어요. 기록이 없는 상태로 표시하지 않아요.`
        : `${recordObject} 불러오지 못했어요. 기록이 없는 것은 아니에요.`
  const showLatest = latest !== null && (nav.date !== latest || displayedMonth !== latest.slice(0, 7))
  const nearest = dates.includes(nav.date) ? null : nearestCalendarDate(dates, nav.date)
  const showNearest = nearest !== null && nearest !== latest
  const futureRecordsOnly = dates.length > 0 && latest === null
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
    if (activeSection === "BODY") {
      if (activeBodyPartId) changeBodyPart(null)
      else changeSection("JOURNAL")
    } else if (activeMode === "CYCLE") {
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
  const showWriteEntry = Boolean(onWriteLog && activeSection === "JOURNAL" && activeMode === "CALENDAR" && !exampleVisible)

  return (
    <div ref={calendarRoot} className="journal-archive" data-testid="journal-archive"
      onWheel={activeMode === "CALENDAR" ? nav.markManual : undefined}
      onTouchMove={activeMode === "CALENDAR" ? nav.markManual : undefined}
      onKeyDown={event => { if (activeMode === "CALENDAR" && ["PageUp", "PageDown", "Home", "End", " "].includes(event.key)) nav.markManual() }}>
      <header className={`journal-archive__header${showWriteEntry ? " journal-archive__header--with-write" : ""}`}>
        <button
          type="button"
          onClick={goBack}
          aria-label={activeSection === "BODY" ? activeBodyPartId ? "몸 기록 목록으로" : "일지로" : activeMode === "CYCLE" || selectedWeek !== null || selection.selectedMonth !== null ? "월간 달력으로" : "홈으로"}
          title="뒤로"
          className="journal-archive__back"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div className="journal-archive__heading">
          <AppHeading as="h1" variant="screen" className="journal-archive__title">
            {activeSection === "BODY" ? "몸 기록" : heading}
          </AppHeading>
        </div>
        {showWriteEntry && <button type="button" className="journal-archive__header-write"
          aria-label="새 일지 작성" title="새 일지 작성" onClick={onWriteLog}>
          <PencilLine size={18} aria-hidden="true" />
        </button>}
      </header>

      <div className="journal-archive__content-tabs journal-archive__navigation" role="group" aria-label="일지와 몸 기록">
        <button type="button" className="journal-archive__content-choice" data-category="journal" aria-pressed={activeSection === "JOURNAL"}
          onClick={() => changeSection("JOURNAL")}><BookOpen size={18} aria-hidden="true" /><span>일지</span></button>
        <button type="button" className="journal-archive__content-choice" data-category="body" aria-pressed={activeSection === "BODY"}
          onClick={() => changeSection("BODY")}><HeartPulse size={18} aria-hidden="true" /><span>몸 기록</span></button>
      </div>

      {readiness !== "READY" && <div className="calendar-guidance">
        <p role={readiness === "ERROR" ? "alert" : "status"}>{readMessage}</p>
        {onRetry && readiness !== "LOADING" && <button type="button" className="calendar-range-return" onClick={onRetry}>
          <RefreshCw size={18} aria-hidden="true" /> {activeSection === "BODY" ? "몸 기록" : "일지"} 다시 불러오기
        </button>}
      </div>}

      {activeSection === "BODY" && (readiness === "READY" || entries.length > 0) && <BodyHistory
        entries={bodyEntries} scopeKey={String(bodyScope)} showHeading={false} manageBrowserBack={false}
        selectedPartId={activeBodyPartId} onSelectedPartChange={changeBodyPart}
        onOpenEntry={(id, date) => {
          if (releaseBodyBack()) { setBodyNavigationPending(false); onOpenDay(date, id) }
          else setBodyNavigationPending(true)
        }} onRecord={onWriteBody ?? (() => onWriteLog?.())} />}
      {activeSection === "BODY" && bodyNavigationPending && <p role="status" className="calendar-guidance">
        화면을 닫는 중이에요. 잠시 후 다시 눌러 주세요.
      </p>}
      <div hidden={activeSection !== "JOURNAL"}>
      {!unconfirmedEmpty && <>
      <div className="journal-archive__view-controls">
        <ViewSwitcher label="일지 보기 방식" category="journal" value={activeMode} onValueChange={changeMode}
          className="journal-archive__view-switcher journal-archive__navigation"
          options={[
            { value: "CALENDAR", label: "달력", ariaLabel: "월간 달력", icon: CalendarDays },
            { value: "CYCLE", label: "묶음", ariaLabel: "기록 묶음", icon: Layers },
          ]} />
      </div>

      {activeMode === "CYCLE" ? (
        <CycleArchive
          entries={entries}
          anchor={cycleAnchor}
          index={cycleIndex}
          onAnchorChange={onCycleAnchorChange}
          onIndexChange={onCycleIndexChange}
          onOpenDay={(date, entryId?: string) => onOpenDay(date, entryId)}
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
          {(showLatest || showNearest || futureRecordsOnly) && <div className="calendar-guidance-actions">
            {showLatest && <button type="button" aria-label={`최근 기록 날짜 ${dayLabel(latest)}로 이동`} onClick={() => moveToDate(latest)}>최근 날짜 · {latest.slice(5).replace("-", "/")}</button>}
            {showNearest && <button type="button" aria-label={`가까운 기록 날짜 ${dayLabel(nearest)}로 이동`} onClick={() => moveToDate(nearest)}>가까운 날짜</button>}
            {futureRecordsOnly && <span>미래 날짜의 기록이 있어요.</span>}
          </div>}
          {calendarDecorationState === null ? <JournalMonthCalendar month={calendarMonth} entries={entries} onOpenDay={onOpenDay} onWriteDate={onWriteDate}
            calendarReturn={calendarReturn} onCalendarReturnConsumed={onCalendarReturnConsumed}
            selectedDate={nav.date} onSelectedDateChange={nav.selectDate} onMonthChange={nav.selectMonth} /> :
            <CalendarDecorationFrame state={calendarDecorationState} allowedItemIds={allowedCalendarDecorationIds}>
              <JournalMonthCalendar month={calendarMonth} entries={entries} onOpenDay={onOpenDay} onWriteDate={onWriteDate}
                calendarReturn={calendarReturn} onCalendarReturnConsumed={onCalendarReturnConsumed}
                selectedDate={nav.date} onSelectedDateChange={nav.selectDate} onMonthChange={nav.selectMonth} />
            </CalendarDecorationFrame>}
          {entries.length === 0 && readiness === "READY" && <div className="journal-archive__empty-actions">
            {!emptyIllustrationFailed && <img className="journal-archive__empty-illustration"
              src={`${import.meta.env.BASE_URL}illustrations/journal-empty-v1.png`} alt="" width={64} height={64}
              loading="lazy" onError={() => setEmptyIllustrationFailed(true)} />}
            <button type="button" className="calendar-range-return" aria-label="일지가 쌓인 예시 보기" onClick={() => setEmptyView("example")}>일지 예시</button>
          </div>}
          </>}
          {archive.months.length > 0 && !exampleVisible && (
            <InfoDisclosure title="다른 달 찾기" purpose="actions">
            <SummaryList
              label="월별 기록"
              showLabel={false}
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
      {entries.some(entry => entry.kind === "post-session" && entry.date === today)
        && entries.filter(entry => entry.kind === "post-session" && entry.date <= today).length > 1 && (
        <div className="journal-archive__comparison">
          <InfoDisclosure title="최근 훈련 비교" purpose="actions">
            <JournalThenNow onOpenDay={onOpenDay} />
          </InfoDisclosure>
        </div>
      )}
      </>}
      </div>
    </div>
  )
}
