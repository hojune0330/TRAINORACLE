import { MEMO_PURPOSE, memoPurposeOf } from "../../domain/journal-schema"
import type { RaceEntry } from "../../domain/journal-store"

export function SavedMemo({
  entry,
  text,
  fontSize,
}: {
  readonly entry: { readonly memoPurpose?: unknown }
  readonly text: string
  readonly fontSize: number
}) {
  if (text === "") return null
  const purpose = memoPurposeOf(entry)
  const purposeLabel = purpose === MEMO_PURPOSE.privateSelfOnly
    ? "나만의 메모 · 분석하지 않아요"
    : "훈련 메모 · 분석용으로 구분됨"

  return (
    <div style={{ marginTop: 12, borderTop: "1px dashed var(--paper-edge)", paddingTop: 10 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", marginBottom: 5 }}>
        {purposeLabel}
      </div>
      <div className="hand" style={{ fontSize, lineHeight: 1.45, color: "var(--ink-blue)" }}>
        {text}
      </div>
    </div>
  )
}

export function RaceSelfCheckSummary({ entry }: { readonly entry: RaceEntry }) {
  const pace = entry.goalPace === undefined ? null : formatPace(entry.goalPace.secondsPerKm)
  const items: Array<readonly [string, string]> = []
  if (entry.tension !== undefined) items.push(["긴장도", `${entry.tension}/10`])
  if (entry.condition !== undefined) items.push(["컨디션", `${entry.condition}/5`])
  if (pace !== null) items.push(["목표 페이스", pace])
  if (entry.mood !== undefined) items.push(["감정", `${entry.mood}/5`])
  if (items.length === 0) return null

  return (
    <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 0, margin: "12px 0 0", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ padding: "9px 8px", minWidth: 0 }}>
          <dt style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)" }}>{label}</dt>
          <dd style={{ margin: "3px 0 0", fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", overflowWrap: "anywhere" }}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = String(secondsPerKm % 60).padStart(2, "0")
  return `${minutes}분 ${seconds}초/km`
}
