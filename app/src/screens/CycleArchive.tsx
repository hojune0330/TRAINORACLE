import React from "react"
import { projectJournalArchive } from "../domain/journal-archive"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { JournalEntry } from "../domain/journal-schema"
import { todayISO } from "../domain/journal-store"
import { trainingCycleWindow } from "../domain/training-cycle-window"
import { isValidIsoDate } from "../domain/dates"
import { JournalMonthCalendar } from "./JournalMonthCalendar"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { GuidedEmptyState } from "../components/GuidedEmptyState"
import "../components/CalendarJournalDetails.css"

export function CycleArchive({ entries, anchor, index, onAnchorChange, onIndexChange, onOpenDay, onWriteLog, onWriteDate }: {
  readonly entries: readonly JournalEntry[]
  readonly anchor?: string | null
  readonly index?: number
  readonly onAnchorChange?: (anchor: string) => void
  readonly onIndexChange?: (index: number) => void
  readonly onOpenDay: (date: string) => void
  readonly onWriteLog?: (() => void) | undefined
  readonly onWriteDate?: (date: string) => void
}) {
  const [internalAnchor, setInternalAnchor] = React.useState(todayISO)
  const [internalIndex, setInternalIndex] = React.useState(0)
  const effectiveAnchor = anchor ?? internalAnchor
  const effectiveIndex = index ?? internalIndex
  const changeAnchor = onAnchorChange ?? setInternalAnchor
  const changeIndex = onIndexChange ?? setInternalIndex
  const window = isValidIsoDate(effectiveAnchor) ? trainingCycleWindow(effectiveAnchor, effectiveIndex) : null
  const [month, setMonth] = React.useState((window?.start ?? todayISO()).slice(0, 7))
  React.useEffect(() => { if (window) setMonth(window.start.slice(0, 7)) }, [window?.start])
  const archive = React.useMemo(() => projectJournalArchive(entries), [entries])
  const calendarMonth = archive.months.find(item => item.month === month) ?? {
    month, entryCount: 0, kindCounts: { postSession: 0, evening: 0, race: 0 },
    metrics: { distanceKm: null, durationMin: null, moodAverage: null, painMax: null }, excludedRecordCount: 0, weeks: [],
  }

  return (
    <section className="cycle-calendar" aria-label="9.5일 주기 일지">
      <div className="cycle-calendar__controls">
        <button type="button" aria-label="이전 주기" disabled={window === null} onClick={() => changeIndex(effectiveIndex - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <strong>{window === null ? "시작일을 다시 골라 주세요" : `${window.start} ~ ${window.end} · ${window.lengthDays}일 구간`}</strong>
        <button type="button" aria-label="다음 주기" disabled={window === null} onClick={() => changeIndex(effectiveIndex + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      {window && (month < window.start.slice(0, 7) || month > window.end.slice(0, 7)) && (
        <button type="button" className="calendar-range-return" onClick={() => setMonth(window.start.slice(0, 7))}>선택한 주기로 이동</button>
      )}
      <JournalMonthCalendar month={calendarMonth} entries={entries} onOpenDay={onOpenDay} onWriteDate={onWriteDate} onMonthChange={setMonth} highlightedRange={window ?? undefined} />
      {window && !entries.some(entry => entry.date >= window.start && entry.date <= window.end) && <GuidedEmptyState
        title="이 주기에 기록이 없어요" description="날짜를 둘러보거나 오늘 기록을 남겨보세요."
        actionLabel="오늘 기록하기" onAction={onWriteLog} />}
      <InfoDisclosure title="주기 시작일과 표시 기준">
      <p style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)" }}>
        9일과 10일을 번갈아 묶어 보는 TrainOracle 일지 방식이에요. 시작일은 직접 정하고,
        처방이나 정답 주기가 아니에요. 이 화면은 기록을 묶어 볼 뿐 계획을 자동으로 바꾸지 않아요.
      </p>
      <label htmlFor="cycle-anchor" style={{ display: "block", marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
        주기 시작일
      </label>
      <input
        id="cycle-anchor"
        type="date"
        value={effectiveAnchor}
        onChange={(event) => { if (isValidIsoDate(event.target.value)) { changeAnchor(event.target.value); changeIndex(0) } }}
        style={{ width: "100%", minHeight: 44, marginTop: 6, boxSizing: "border-box", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)" }}
      />
      <p>달력 밑줄은 선택한 주기 범위예요. 앞뒤 달로 이동해도 주기는 바뀌지 않아요.</p>
      </InfoDisclosure>
    </section>
  )
}
