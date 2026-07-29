import type { ReactNode } from "react"

export function EntryDeleteRow({ entryId, onDelete }: { entryId: string; onDelete: () => void }) {
  return (
    <div style={{ marginTop: 12, borderTop: "1px dashed var(--hair)", paddingTop: 8, textAlign: "right" }}>
      <button id={`journal-delete-${entryId}`} onClick={onDelete} style={{
        background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)",
        letterSpacing: "0.1em", padding: "4px 2px", minHeight: 44,
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}>이 일지 지우기</button>
    </div>
  )
}

export function SyncChip() {
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.1em",
      color: "var(--ink-4)",
      border: "1px solid var(--hair)", padding: "2px 5px", whiteSpace: "nowrap",
    }}>이 기기</span>
  )
}

/**
 * 가져온 기록 출처 배지 — 실측/자동/수기를 섞어 보여주지 않기 위한 표시.
 * 가져온 값은 주간 통계·추이·훈련계획에서 제외되므로, 왜 숫자가 합계에
 * 안 잡히는지 사용자가 알 수 있어야 한다.
 */
export function ImportedChip() {
  return (
    <span
      data-testid="imported-chip"
      title="워치 파일에서 가져온 기록이에요 · 직접 확인한 값만 통계에 들어가요"
      style={{
        fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.1em",
        color: "var(--ink-2)",
        border: "1px solid var(--line)", padding: "2px 5px", whiteSpace: "nowrap",
      }}
    >가져옴</span>
  )
}

export function CheckinRow({ lb, v, right, last }: { lb: string; v: string; right?: ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "90px 1fr auto",
      gap: 12, padding: "11px 14px", alignItems: "center",
      borderBottom: last ? 0 : "1px dashed var(--hair)",
      fontFamily: "var(--mono)",
    }}>
      <span style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{lb}</span>
      <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>{v}</span>
      <span>{right}</span>
    </div>
  )
}

export function TopBar2({ onBack, children }: { onBack?: (() => void) | undefined; children: ReactNode }) {
  return (
    <div style={{
      padding: "12px 16px", borderBottom: "1px solid var(--line)",
      display: "grid", gridTemplateColumns: "64px minmax(0, 1fr) 64px",
      alignItems: "center",
      background: "var(--bg)",
    }}>
      <button onClick={onBack} style={{
        background: "transparent", border: 0, cursor: "pointer",
        padding: 4, minWidth: 64, minHeight: 44,
        fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)",
        letterSpacing: "0.06em",
      }}>← 뒤로</button>
      <div style={{
        minWidth: 0, fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
        color: "var(--ink)", letterSpacing: "0.14em", textTransform: "uppercase",
        textAlign: "center",
      }}>{children}</div>
      <div aria-hidden="true"></div>
    </div>
  )
}
