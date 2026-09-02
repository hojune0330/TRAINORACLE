import React from "react"
import { compactDate, dowOf, nowClock } from "../../domain/dates"
import { entriesForDate, todayISO } from "../../domain/journal-store"
import { TopBar } from "./shared"
import type { LogEntryType } from "./shared"

interface EntryChooserProps {
  readonly onBack?: () => void
  readonly onPick?: (entryType: LogEntryType) => void
  readonly targetDate?: string
  /** 워치 내보내기 파일 가져오기 — 직접 쓰기의 대안 진입점 */
  readonly onOpenImport?: () => void
}

const ENTRY_OPTIONS = [
  { id: "quick-session", t: "빠르게 기록", d: "운동 결과·RPE·몸 상태만", meta: "QUICK · 2~5번", mark: "✓" },
  { id: "post-session", t: "훈련 후", d: "방금 끝낸 세션 기록", meta: "POST · ~1분", mark: "↻" },
  { id: "evening", t: "회복 · 하루 마무리", d: "쉬는 날도 그대로 · 수면·감정·통증 체크", meta: "EVENING · ~2분", mark: "☾" },
  { id: "race", t: "경기 직전/직후", d: "기록·심박·감정", meta: "RACE · ~30초", mark: "▲" },
] as const

export function EntryChooser({ onBack, onPick, onOpenImport, targetDate }: EntryChooserProps) {
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const today = todayISO()
  const entryDate = targetDate ?? today
  const isToday = entryDate === today
  React.useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div style={{ paddingBottom: 30 }}>
      <TopBar onBack={onBack}>새 일지</TopBar>
      <div style={{ padding: "20px 20px 4px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {compactDate(entryDate)} {dowOf(entryDate)} · {nowClock()}
        </div>
        <h1 ref={headingRef} tabIndex={-1} style={{ fontFamily: "var(--sans)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: "6px 0 0" }}>어떤 일지를 쓰세요?</h1>
      </div>

      <div style={{ marginTop: 18 }}>
        {ENTRY_OPTIONS.map((option, index) => (
          <button key={option.id} data-testid={`entry-choice-${option.id}`} onClick={() => onPick?.(option.id)} style={{
            width: "100%", textAlign: "left",
            padding: "18px 20px",
            background: "var(--surface)",
            border: 0, borderTop: "1px solid var(--ink)",
            borderBottom: index === ENTRY_OPTIONS.length - 1 ? "1px solid var(--ink)" : 0,
            cursor: "pointer",
            display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 14, alignItems: "center",
          }}>
            <span style={{
              fontFamily: "var(--mono)", fontSize: 22, color: "var(--brand)",
              fontWeight: 500, lineHeight: 1,
            }}>{option.mark}</span>
            <div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.005em" }}>{option.t}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.04em", marginTop: 3 }}>{option.d}</div>
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.1em" }}>{option.meta}</span>
          </button>
        ))}
      </div>

      {onOpenImport && (
        <div style={{ padding: "20px 20px 0" }}>
          <button
            type="button"
            onClick={onOpenImport}
            data-testid="open-import"
            style={{
              width: "100%", minHeight: 48, padding: "13px 16px", textAlign: "left",
              background: "transparent", color: "var(--ink-2)",
              border: "1px dashed var(--line-2, var(--line))", borderRadius: 0,
              cursor: "pointer", lineHeight: 1.5,
            }}
          >
            <span style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
              워치 기록 불러오기
            </span>
            <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 3 }}>
              가민 커넥트 등에서 내보낸 TCX·GPX 파일 · 거리·시간 자동 입력
            </span>
          </button>
        </div>
      )}

      <div style={{ padding: "24px 20px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.06em", lineHeight: 1.55 }}>
          {entriesForDate(entryDate).length > 0
            ? `${isToday ? "오늘" : "이 날짜에"} 일지가 이미 있어요. 같은 날에 여러 진입점으로 쓰면 한 페이지에 합쳐집니다.`
            : `${isToday ? "오늘" : "이 날짜의"} 첫 일지예요. 짧게 몰아 쓰면 1분이면 끝나요.`}
        </div>
      </div>
    </div>
  )
}
