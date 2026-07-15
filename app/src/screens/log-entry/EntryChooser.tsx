import { compactDate, dowOf, nowClock } from "../../domain/dates"
import { entriesForDate, todayISO } from "../../domain/journal-store"
import { TopBar } from "./shared"
import type { JournalEntryType } from "./shared"

interface EntryChooserProps {
  readonly onBack?: () => void
  readonly onPick?: (entryType: JournalEntryType) => void
}

const ENTRY_OPTIONS = [
  { id: "post-session", t: "훈련 후", d: "방금 끝낸 세션 기록", meta: "POST · ~1분", mark: "↻" },
  { id: "evening", t: "회복 · 하루 마무리", d: "쉬는 날도 그대로 · 수면·감정·통증 체크", meta: "EVENING · ~2분", mark: "☾" },
  { id: "race", t: "경기 직전/직후", d: "기록·심박·감정", meta: "RACE · ~30초", mark: "▲" },
] as const

export function EntryChooser({ onBack, onPick }: EntryChooserProps) {
  return (
    <div style={{ paddingBottom: 30 }}>
      <TopBar onBack={onBack}>새 일지</TopBar>
      <div style={{ padding: "20px 20px 4px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {compactDate(todayISO())} {dowOf(todayISO())} · {nowClock()}
        </div>
        <h1 style={{ fontFamily: "var(--sans)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: "6px 0 0" }}>어떤 일지를 쓰세요?</h1>
      </div>

      <div style={{ marginTop: 18 }}>
        {ENTRY_OPTIONS.map((option, index) => (
          <button key={option.id} onClick={() => onPick?.(option.id)} style={{
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

      <div style={{ padding: "24px 20px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.06em", lineHeight: 1.55 }}>
          {entriesForDate(todayISO()).length > 0
            ? "오늘 일지가 이미 있어요. 같은 날에 여러 진입점으로 쓰면 한 페이지에 합쳐집니다."
            : "오늘 첫 일지예요. 짧게 몰아 쓰면 1분이면 끝나요."}
        </div>
      </div>
    </div>
  )
}
