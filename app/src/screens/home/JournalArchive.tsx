import React from "react"
import type { JournalEntry, JournalKind } from "../../domain/journal-store"
import {
  daysForMonth,
  mondayOffset,
  monthIdOf,
  shiftMonthId,
  summarizeJournalDays,
  weekDates,
} from "../../domain/journal-archive"
import type { JournalArchiveDay } from "../../domain/journal-archive"
import { isoShift, isoToDate, weekStartOf } from "../../domain/dates"

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const
const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const
const KIND_MARK: Record<JournalKind, string> = {
  "post-session": "●",
  evening: "☾",
  race: "▲",
}

export type JournalArchiveMode = "month" | "week"

export type JournalArchiveView = {
  readonly mode: JournalArchiveMode
  readonly monthId: string
  readonly weekStart: string
}

type JournalArchiveProps = {
  readonly entries: readonly JournalEntry[]
  readonly initialDate: string
  readonly view?: JournalArchiveView
  readonly onViewChange?: (view: JournalArchiveView) => void
  readonly onOpenDay?: (date: string) => void
}

export function journalArchiveViewForDate(date: string): JournalArchiveView {
  return { mode: "month", monthId: monthIdOf(date), weekStart: weekStartOf(date) }
}

function viewForMonth(view: JournalArchiveView, monthId: string): JournalArchiveView {
  const firstDay = daysForMonth(monthId)[0] ?? view.weekStart
  return { ...view, monthId, weekStart: weekStartOf(firstDay) }
}

function dayTitle(date: string): string {
  const value = isoToDate(date)
  return `${value.getMonth() + 1}월 ${value.getDate()}일`
}

function dateLabel(date: string, compact: boolean): string {
  const value = isoToDate(date)
  if (compact) return String(value.getDate())
  return `${value.getMonth() + 1}/${value.getDate()} ${WEEKDAY_NAMES[value.getDay()]}`
}

function monthTitle(monthId: string): string {
  const [year, month] = monthId.split("-")
  return `${year}년 ${Number(month)}월 일지`
}

function measureLine(summary: JournalArchiveDay): string | null {
  const values = [
    summary.totalDurationMin === null ? null : `${summary.totalDurationMin}분`,
    summary.totalDistanceKm === null ? null : `${summary.totalDistanceKm}km`,
  ].filter((value): value is string => value !== null)
  return values.length > 0 ? values.join(" · ") : null
}

function summaryLabel(summary: JournalArchiveDay | undefined): string {
  if (summary === undefined) return "기록 없음"
  const marks = summary.kinds.map((kind) => KIND_MARK[kind]).join(" ")
  return `${summary.entryCount}건 기록${marks === "" ? "" : ` ${marks}`}`
}

function reflectionLabel(summary: JournalArchiveDay, compact: boolean): string | null {
  if (compact) return null
  if (summary.highestPain !== null) return `통증 ${summary.highestPain}/5`
  return summary.mood === null ? null : `기분 ${summary.mood}/5`
}

function weekSummary(dates: readonly string[], byDate: ReadonlyMap<string, JournalArchiveDay>): string {
  const summaries = dates.flatMap((date) => {
    const summary = byDate.get(date)
    return summary === undefined ? [] : [summary]
  })
  const count = summaries.reduce((total, summary) => total + summary.entryCount, 0)
  const duration = summaries.reduce((total, summary) => total + (summary.totalDurationMin ?? 0), 0)
  const distance = summaries.reduce((total, summary) => total + (summary.totalDistanceKm ?? 0), 0)
  const values = [`${summaries.length}일`, `${count}건`]
  if (duration > 0) values.push(`${duration}분`)
  if (distance > 0) values.push(`${distance}km`)
  return values.join(" · ")
}

function DateButton({ date, summary, compact, onOpenDay }: {
  readonly date: string
  readonly summary: JournalArchiveDay | undefined
  readonly compact: boolean
  readonly onOpenDay?: (date: string) => void
}) {
  const line = summary === undefined ? null : measureLine(summary)
  const reflection = summary === undefined ? null : reflectionLabel(summary, compact)
  return (
    <button
      type="button"
      onClick={() => onOpenDay?.(date)}
      aria-label={`${dayTitle(date)} ${summaryLabel(summary)} 일지 열기`}
      style={{
        minHeight: compact ? 64 : 72, border: "1px solid var(--hair)", background: summary === undefined ? "var(--paper-2)" : "var(--surface)",
        color: "var(--ink)", cursor: "pointer", padding: "7px 6px", textAlign: "left", overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 4, alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)" }}>{dateLabel(date, compact)}</span>
        {summary !== undefined && (
          <span style={{ display: "flex", gap: 5, alignItems: "baseline", whiteSpace: "nowrap" }}>
            <span aria-hidden="true" style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--brand)", letterSpacing: "0.06em" }}>{summary.kinds.map((kind) => KIND_MARK[kind]).join(" ")}</span>
            {reflection !== null && <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)" }}>{reflection}</span>}
          </span>
        )}
      </div>
      {summary !== undefined && (
        <>
          {compact ? (
            <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", lineHeight: 1.2 }}>{summary.entryCount}건</div>
          ) : (
            <>
              <div style={{ marginTop: 5, fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)", lineHeight: 1.3 }}>{summary.entryCount}건 기록</div>
              {line !== null && <div style={{ marginTop: 3, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink)", whiteSpace: "nowrap" }}>{line}</div>}
            </>
          )}
        </>
      )}
    </button>
  )
}

export function JournalArchive({ entries, initialDate, view: controlledView, onViewChange, onOpenDay }: JournalArchiveProps) {
  const [localView, setLocalView] = React.useState(() => journalArchiveViewForDate(initialDate))
  const view = controlledView ?? localView
  const updateView = (next: JournalArchiveView) => {
    if (controlledView === undefined) setLocalView(next)
    onViewChange?.(next)
  }
  const summaries = React.useMemo(() => summarizeJournalDays(entries), [entries])
  const byDate = React.useMemo(() => new Map(summaries.map((summary) => [summary.date, summary])), [summaries])
  const monthDays = React.useMemo(() => daysForMonth(view.monthId), [view.monthId])
  const firstMonthDay = monthDays[0] ?? initialDate
  const offset = mondayOffset(firstMonthDay)
  const currentWeek = React.useMemo(() => weekDates(view.weekStart), [view.weekStart])
  const currentWeekSummary = React.useMemo(() => weekSummary(currentWeek, byDate), [currentWeek, byDate])

  return (
    <section style={{ padding: "24px 20px 0" }} aria-label="일지 아카이브">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em" }}>— JOURNAL ARCHIVE</div>
          <h2 style={{ margin: "5px 0 0", fontFamily: "var(--sans)", fontSize: 21, fontWeight: 500, color: "var(--ink)" }}>{view.mode === "month" ? monthTitle(view.monthId) : `${dayTitle(view.weekStart)} - ${dayTitle(currentWeek[6] ?? view.weekStart)}`}</h2>
        </div>
        <div role="group" aria-label="일지 보기" style={{ display: "flex", border: "1px solid var(--ink)" }}>
          <button type="button" onClick={() => updateView({ ...view, mode: "month", monthId: monthIdOf(view.weekStart) })} aria-pressed={view.mode === "month"} style={viewButtonStyle(view.mode === "month")}>달력</button>
          <button type="button" onClick={() => updateView({ ...view, mode: "week" })} aria-pressed={view.mode === "week"} style={viewButtonStyle(view.mode === "week")}>주간 보기</button>
        </div>
      </div>

      {view.mode === "month" ? (
        <>
          <ArchiveControls
            previousLabel="이전 달"
            nextLabel="다음 달"
            onPrevious={() => updateView(viewForMonth(view, shiftMonthId(view.monthId, -1)))}
            onNext={() => updateView(viewForMonth(view, shiftMonthId(view.monthId, 1)))}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3, marginTop: 10 }}>
            {WEEKDAY_LABELS.map((label) => <span key={label} style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-4)", textAlign: "center" }}>{label}</span>)}
            {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
            {monthDays.map((date) => <DateButton key={date} date={date} summary={byDate.get(date)} compact onOpenDay={onOpenDay} />)}
          </div>
        </>
      ) : (
        <>
          <ArchiveControls
            previousLabel="이전 주"
            nextLabel="다음 주"
            onPrevious={() => updateView({ ...view, weekStart: isoShift(view.weekStart, -7) })}
            onNext={() => updateView({ ...view, weekStart: isoShift(view.weekStart, 7) })}
          />
          <p style={{ margin: "10px 0 0", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.04em" }}>{currentWeekSummary}</p>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            {currentWeek.map((date) => <DateButton key={date} date={date} summary={byDate.get(date)} compact={false} onOpenDay={onOpenDay} />)}
          </div>
        </>
      )}
      <p style={{ margin: "10px 0 0", fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", lineHeight: 1.55 }}>
        이 기기에 저장된 구조화된 기록만 표시해요. 메모 원문과 날씨·웨어러블 데이터는 이 화면에 넣지 않아요.
      </p>
    </section>
  )
}

function viewButtonStyle(selected: boolean): React.CSSProperties {
  return {
    minHeight: 30, border: 0, borderLeft: selected ? 0 : "1px solid var(--ink)", background: selected ? "var(--ink)" : "transparent",
    color: selected ? "var(--bg)" : "var(--ink-2)", cursor: "pointer", padding: "0 8px", fontFamily: "var(--mono)", fontSize: 9,
  }
}

function ArchiveControls({ previousLabel, nextLabel, onPrevious, onNext }: {
  readonly previousLabel: string
  readonly nextLabel: string
  readonly onPrevious: () => void
  readonly onNext: () => void
}) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 12 }}>
      <button type="button" onClick={onPrevious} aria-label={previousLabel} style={arrowButtonStyle}>←</button>
      <button type="button" onClick={onNext} aria-label={nextLabel} style={arrowButtonStyle}>→</button>
    </div>
  )
}

const arrowButtonStyle: React.CSSProperties = {
  width: 32, height: 30, border: "1px solid var(--ink)", background: "transparent", color: "var(--ink)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 13,
}
