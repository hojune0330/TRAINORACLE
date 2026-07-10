/**
 * TermHelp — 용어 옆 "?" 도움말
 *
 * 원칙 (총책임자 결정):
 * - 용어를 쉬운 말로 치환하지 않는다. 원래 용어를 유지하고 옆에서 설명한다.
 *   (치환 시 훈련 기록의 정확성·전달력이 흐려질 위험)
 * - 안전 용어(safety: true)의 설명 카드는 경고 색으로 구분하고,
 *   "진단이 아님" 등의 경계 문구를 glossary 원문 그대로 표시한다.
 * - 설명은 표시 전용이며 어떤 데이터·안전 상태도 변경하지 않는다.
 */
import { useEffect, useRef, useState } from "react"
import { GLOSSARY, type TermId } from "../domain/glossary"

export function TermHelp({ term }: { term: TermId }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const entry = GLOSSARY[term]

  // 바깥 탭/클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
    }
  }, [open])

  const accent = entry.safety ? "var(--warn)" : "var(--ink-3)"

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        aria-label={`${entry.label} 설명 ${open ? "닫기" : "보기"}`}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        style={{
          width: 14, height: 14, marginLeft: 5, padding: 0,
          border: `1px solid ${accent}`, borderRadius: "50%",
          background: open ? accent : "transparent",
          color: open ? "var(--bg)" : accent,
          fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700,
          lineHeight: 1, cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          verticalAlign: "middle",
        }}
      >?</button>

      {open && (
        <div
          role="note"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: -8,
            width: 232, zIndex: 40,
            background: "var(--surface)",
            border: `1px solid ${entry.safety ? "var(--warn)" : "var(--line)"}`,
            borderLeft: `3px solid ${entry.safety ? "var(--warn)" : "var(--ink-3)"}`,
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            padding: "10px 12px",
            textTransform: "none", letterSpacing: 0,
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
        </div>
      )}
    </span>
  )
}
