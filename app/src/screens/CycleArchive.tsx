import React from "react"
import { projectJournalArchive } from "../domain/journal-archive"
import type { ArchiveDaySummary } from "../domain/journal-archive"
import type { JournalEntry } from "../domain/journal-schema"
import { todayISO } from "../domain/journal-store"
import { trainingCycleWindow } from "../domain/training-cycle-window"
import { dayLabel, SummaryButton, SummaryList, summaryText } from "./JournalArchiveSummary"

export function CycleArchive({ entries, onOpenDay }: {
  readonly entries: readonly JournalEntry[]
  readonly onOpenDay: (date: string) => void
}) {
  const [anchor, setAnchor] = React.useState(todayISO)
  const [index, setIndex] = React.useState(0)
  const window = trainingCycleWindow(anchor, index)
  const days = React.useMemo(() => cycleDays(entries, window.start, window.end), [entries, window.start, window.end])

  return (
    <section style={{ padding: "18px 20px 0" }} aria-label="9.5일 주기 일지">
      <p style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)" }}>
        9일과 10일을 번갈아 보는 TrainOracle의 9.5일 틀이에요. 시작일은 직접 정하고,
        이 화면은 기록을 묶어 볼 뿐 계획을 자동으로 바꾸지 않아요.
      </p>
      <label htmlFor="cycle-anchor" style={{ display: "block", marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
        주기 시작일
      </label>
      <input
        id="cycle-anchor"
        type="date"
        value={anchor}
        onChange={(event) => { setAnchor(event.target.value); setIndex(0) }}
        style={{ width: "100%", minHeight: 44, marginTop: 6, boxSizing: "border-box", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)" }}
      />
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) 44px", gap: 8, alignItems: "center" }}>
        <button type="button" aria-label="이전 주기" onClick={() => setIndex((value) => value - 1)} style={cycleButtonStyle}>←</button>
        <strong style={{ minWidth: 0, textAlign: "center", fontFamily: "var(--sans)", fontSize: 14 }}>
          {window.start}–{window.end} · {window.lengthDays}일 구간
        </strong>
        <button type="button" aria-label="다음 주기" onClick={() => setIndex((value) => value + 1)} style={cycleButtonStyle}>→</button>
      </div>
      {days.length === 0 ? (
        <p style={{ margin: "28px 0 0", textAlign: "center", fontFamily: "var(--sans)", color: "var(--ink-3)" }}>이 구간에는 기록이 없어요.</p>
      ) : (
        <SummaryList
          label={`${window.lengthDays}일 구간의 일별 기록`}
          items={days}
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
      )}
    </section>
  )
}

const cycleButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  border: "1px solid var(--line)",
  background: "transparent",
  color: "var(--ink)",
  cursor: "pointer",
}

function cycleDays(entries: readonly JournalEntry[], start: string, end: string): readonly ArchiveDaySummary[] {
  const archive = projectJournalArchive(entries)
  return archive.months
    .flatMap((month) => month.weeks)
    .flatMap((week) => week.days)
    .filter((day) => day.date >= start && day.date <= end)
    .sort((left, right) => right.date.localeCompare(left.date))
}
