import type { CSSProperties, ReactNode } from "react"
import { TermHelp } from "../../components/TermHelp"
import type { TermId } from "../../domain/glossary"

export type JournalEntryType = "post-session" | "evening" | "race"

export interface EntryFormProps {
  readonly onBack?: () => void
  readonly onDone?: (entryType: JournalEntryType, reviewMessage?: string) => void
}

export function FormSec({ lb, help, children }: {
  readonly lb: string
  readonly help?: TermId
  readonly children: ReactNode
}) {
  return (
    <div style={{ padding: "18px 20px 0" }}>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)",
        letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
        marginBottom: 8,
      }}>{lb}{help && <TermHelp term={help} />}</div>
      {children}
    </div>
  )
}

export function inputStyle(): CSSProperties {
  return {
    width: "100%", padding: "11px 12px",
    border: "1px solid var(--line)", background: "var(--surface)",
    fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink)",
    boxSizing: "border-box", borderRadius: 0,
  }
}

export function TopBar({ onBack, children }: {
  readonly onBack?: () => void
  readonly children: ReactNode
}) {
  return (
    <div style={{
      padding: "12px 16px", borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
    }}>
      <button onClick={onBack} style={{
        background: "transparent", border: 0, cursor: "pointer",
        padding: 4, marginLeft: -4,
        fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)",
        letterSpacing: "0.06em",
      }}>← 뒤로</button>
      <div style={{
        flex: 1, fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
        color: "var(--ink)", letterSpacing: "0.14em", textTransform: "uppercase",
        textAlign: "center",
      }}>{children}</div>
      <div style={{ width: 48 }}></div>
    </div>
  )
}

export function StickyBar({ onSave, error }: {
  readonly onSave?: () => void
  readonly error?: boolean
}) {
  return (
    <div className="entry-sticky-bar" style={{
      position: "absolute", bottom: "var(--entry-sticky-bottom, 0px)", left: 0, right: 0,
      borderTop: "1px solid var(--ink)", background: "var(--bg)",
      padding: "12px 16px",
    }}>
      {error && (
        <div data-testid="save-error" style={{
          marginBottom: 10, padding: "10px 12px",
          border: "1px solid var(--pain-5)", background: "var(--surface)",
          fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.55,
          color: "var(--ink)", letterSpacing: "0.03em",
        }}>
          저장이 안 됐어요 — 기기 저장 공간이 가득 찼거나 브라우저가 저장을 막고 있어요.<br />
          적은 내용은 화면에 그대로 있어요. 공간을 비운 뒤 다시 저장을 눌러 주세요.
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} style={{
          flex: 2, padding: "14px", background: "var(--ink)", color: "var(--bg)",
          border: 0, fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500,
          cursor: "pointer", borderRadius: 0,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>저장 <span style={{ fontFamily: "var(--mono)", fontSize: 10, opacity: 0.65, letterSpacing: "0.14em" }}>↵</span></button>
      </div>
    </div>
  )
}
