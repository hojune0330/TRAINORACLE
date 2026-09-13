import React from "react"
import { CheckCircle2, ChevronRight, Flag, Moon, PencilLine } from "lucide-react"
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
  { id: "quick-session", t: "빠르게 기록", d: "운동 결과와 몸 상태만", Icon: CheckCircle2 },
  { id: "post-session", t: "훈련 후", d: "거리·시간·훈련 내용을 자세히", Icon: PencilLine },
  { id: "evening", t: "회복 · 하루 마무리", d: "수면·기분·몸 상태", Icon: Moon },
  { id: "race", t: "경기 직전/직후", d: "경기 기록과 컨디션", Icon: Flag },
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
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: 0 }}>
          {compactDate(entryDate)} {dowOf(entryDate)} · {nowClock()}
        </div>
        <h1 ref={headingRef} tabIndex={-1} style={{ fontFamily: "var(--sans)", fontSize: 22, fontWeight: 500, letterSpacing: 0, margin: "6px 0 0" }}>어떤 일지를 쓰세요?</h1>
      </div>

      <div style={{ marginTop: 18 }}>
        {ENTRY_OPTIONS.map((option, index) => (
          <button type="button" key={option.id} data-testid={`entry-choice-${option.id}`} onClick={() => onPick?.(option.id)} style={{
            width: "100%", textAlign: "left",
            padding: "12px 20px", minHeight: 64,
            background: "var(--surface)",
            border: 0, borderTop: "1px solid var(--ink)",
            borderBottom: index === ENTRY_OPTIONS.length - 1 ? "1px solid var(--ink)" : 0,
            cursor: "pointer",
            display: "grid", gridTemplateColumns: "20px minmax(0, 1fr) 18px", gap: 12, alignItems: "center",
          }}>
            <option.Icon size={19} aria-hidden="true" style={{ color: "var(--brand)" }} />
            <div style={{ minWidth: 0, wordBreak: "keep-all", overflowWrap: "anywhere" }}>
              <div style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, color: "var(--ink)", letterSpacing: 0 }}>{option.t}</div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-3)", letterSpacing: 0, marginTop: 3 }}>{option.d}</div>
            </div>
            <ChevronRight size={18} aria-hidden="true" />
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
              워치 앱에서 내보낸 파일을 골라요
            </span>
          </button>
        </div>
      )}

      <div style={{ padding: "24px 20px" }}>
        <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-3)", letterSpacing: 0, lineHeight: 1.55 }}>
          {entriesForDate(entryDate).length > 0
            ? `${isToday ? "오늘" : "이 날짜에"} 남긴 일지가 있어요. 기록을 더 쓰면 같은 날짜에 모아 보여드려요.`
            : `${isToday ? "오늘" : "이 날짜의"} 첫 일지예요. 원하는 항목만 남겨도 괜찮아요.`}
        </div>
      </div>
    </div>
  )
}
