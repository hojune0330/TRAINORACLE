import React from "react"
import { CheckCircle2, ChevronRight, Flag, HeartPulse, PencilLine } from "lucide-react"
import "../../styles/category-cards.css"
import { compactDate, dowOf } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import { useCalendarSnapshot } from "../../hooks/useCalendarEntries"
import { ContextualIllustration } from "../../components/ContextualIllustration"
import { AppHeading } from "../../components/AppHeading"
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
  { id: "quick-session", t: "빠르게 기록", d: "거리·시간·힘든 정도", Icon: CheckCircle2 },
  { id: "post-session", t: "자세히 기록", d: "운동별로 자세히", Icon: PencilLine },
  { id: "evening", t: "컨디션·메모", d: "수면·몸 상태·기분·메모", Icon: HeartPulse },
  { id: "race", t: "경기 기록", d: "경기 전후 기록·컨디션", Icon: Flag },
] as const

export function EntryChooser({ onBack, onPick, onOpenImport, targetDate }: EntryChooserProps) {
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const today = todayISO()
  const entryDate = targetDate ?? today
  const journalSnapshot = useCalendarSnapshot()
  const entryCount = journalSnapshot.entries.filter(entry => entry.date === entryDate).length
  const hasEntries = entryCount > 0
  const confirmedEmpty = journalSnapshot.status === "READY" && !hasEntries
  const readMessage = journalSnapshot.status === "LOADING" ? "기록을 불러오는 중이에요."
    : journalSnapshot.status === "STALE" ? "기록의 최신 상태를 확인하지 못했어요. 보관된 기록은 계속 볼 수 있어요."
    : journalSnapshot.status === "ERROR" ? "기록을 불러오지 못했어요."
    : null
  React.useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div style={{ paddingBottom: 30 }}>
      <TopBar onBack={onBack}>새 일지</TopBar>
      <div style={{ padding: "20px 20px 4px" }}>
        <div style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-3)", letterSpacing: 0 }}>
          {entryDate.slice(0, 4) !== today.slice(0, 4) ? `${entryDate.slice(0, 4)}년 ` : ""}{compactDate(entryDate)} {dowOf(entryDate)}
          {hasEntries && <span> · {journalSnapshot.status === "READY" ? "일지" : "보관된 일지"} {entryCount}개</span>}
        </div>
        <div className="contextual-entry-intro">
          <div className="contextual-entry-intro__copy">
            <AppHeading ref={headingRef} tabIndex={-1} as="h1" variant="screen" accent className="entry-chooser__title">무엇을 기록할까요?</AppHeading>
            {readMessage !== null && <p role={journalSnapshot.status === "ERROR" ? "alert" : "status"}>
              {readMessage}
            </p>}
          </div>
          {confirmedEmpty && <ContextualIllustration image="journal-guide" size="small" />}
        </div>
      </div>

      <div className="app-choice-group" style={{ marginTop: 18, padding: "0 20px", display: "grid" }}>
        {ENTRY_OPTIONS.map((option) => (
          <button className="category-card" data-category={option.id === "evening" ? "body" : "record"} type="button" key={option.id} data-testid={`entry-choice-${option.id}`} onClick={() => onPick?.(option.id)} style={{
            width: "100%", textAlign: "left",
            minHeight: 64,
            display: "grid", gridTemplateColumns: "40px minmax(0, 1fr) 18px", gap: 12, alignItems: "center",
          }}>
            <span className="category-icon" aria-hidden="true"><option.Icon size={20} /></span>
            <div style={{ minWidth: 0, wordBreak: "keep-all", overflowWrap: "anywhere" }}>
              <div style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, color: "var(--ink)", letterSpacing: 0 }}>{option.t}</div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-3)", letterSpacing: 0, marginTop: 3 }}>{option.d}</div>
            </div>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ))}
      </div>

      {onOpenImport && (
        <div className="app-choice-group" style={{ padding: "20px 20px 0" }}>
          <button
            className="app-choice-control"
            type="button"
            onClick={onOpenImport}
            data-testid="open-import"
            style={{
              width: "100%", minHeight: 48, textAlign: "left", lineHeight: 1.5,
            }}
          >
            <span style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
              운동 파일 불러오기
            </span>
          </button>
        </div>
      )}

    </div>
  )
}
