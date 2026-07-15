/**
 * TermHelp — 용어 옆 "?" 도움말
 *
 * 원칙 (총책임자 결정):
 * - 용어를 쉬운 말로 치환하지 않는다. 원래 용어를 유지하고 옆에서 설명한다.
 *   (치환 시 훈련 기록의 정확성·전달력이 흐려질 위험)
 * - 안전 용어(safety: true)의 설명 카드는 경고 색으로 구분하고,
 *   "진단이 아님" 등의 경계 문구를 glossary 원문 그대로 표시한다.
 * - 설명은 표시 전용이며 어떤 데이터·안전 상태도 변경하지 않는다.
 * - 위치 보정(오버플로우/플립)·Escape 닫기는 공용 Popover가 담당.
 * - 터치 타깃: 시각 14px 유지하되 히트 영역은 44px.
 */
import { GLOSSARY, type TermId } from "../domain/glossary"
import { usePopover, PopCard } from "./Popover"

export function TermHelp({ term }: { term: TermId }) {
  const { open, toggle, wrapRef } = usePopover()
  const entry = GLOSSARY[term]
  const accent = entry.safety ? "var(--warn)" : "var(--ink-3)"

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        aria-label={`${entry.label} 설명 ${open ? "닫기" : "보기"}`}
        aria-expanded={open}
        onClick={toggle}
        style={{
          width: 44, height: 44, margin: "-9px -8px -9px 1px", padding: 0,
          border: 0, background: "transparent", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          verticalAlign: "middle",
        }}
      >
        <span aria-hidden="true" style={{
          width: 14, height: 14,
          border: `1px solid ${accent}`, borderRadius: "50%",
          boxSizing: "border-box",
          background: open ? accent : "transparent",
          color: open ? "var(--bg)" : accent,
          fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700,
          lineHeight: 1,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>?</span>
      </button>

      <PopCard
        open={open}
        align="left"
        width={232}
        label={`term:${term}`}
        accentBorder={{
          border: entry.safety ? "var(--warn)" : "var(--line)",
          bar: entry.safety ? "var(--warn)" : "var(--ink-3)",
        }}
      >
        <div style={{
          fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700,
          color: entry.safety ? "var(--warn)" : "var(--ink-3)",
          letterSpacing: "0.1em", marginBottom: 5,
        }}>
          {entry.label}{entry.safety ? " · 안전 표시" : ""}
        </div>
        <div style={{
          fontFamily: "var(--serif, inherit)", fontSize: 11.5, lineHeight: 1.55,
          color: "var(--ink)", fontWeight: 400, whiteSpace: "normal",
        }}>
          {entry.short}
        </div>
        {entry.detail && (
          <div style={{
            marginTop: 6, fontSize: 10.5, lineHeight: 1.5,
            color: "var(--ink-2)", fontWeight: 400, whiteSpace: "normal",
          }}>
            {entry.detail}
          </div>
        )}
      </PopCard>
    </span>
  )
}
