import React from "react"

export function StickyBar({
  onSave,
  error,
  label = "저장",
}: {
  readonly onSave?: () => void
  readonly error?: boolean
  readonly label?: string
}) {
  return (
    <div className="entry-sticky-bar" style={{
      position: "absolute", bottom: "var(--entry-sticky-bottom, 0px)", left: 0, right: 0,
      borderTop: "1px solid var(--ink)", background: "var(--bg)",
      padding: "12px 16px",
    }}>
      {error && (
        <div data-testid="save-error" role="alert" style={{
          marginBottom: 10, padding: "10px 12px",
          border: "1px solid var(--pain-5)", background: "var(--surface)",
          fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.55,
          color: "var(--ink)", letterSpacing: "0.03em",
        }}>
          저장을 완료하지 못했어요. 현재 안내만으로는 원인을 확인할 수 없어요.<br />
          입력 내용은 이 화면에 그대로 남아 있어요. 새로고침하거나 앱 데이터를 지우지 말고 다시 저장해 주세요.
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onSave} style={{
          flex: 2, padding: "14px", background: "var(--ink)", color: "var(--bg)",
          border: 0, fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500,
          cursor: "pointer", borderRadius: 0,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>{label}<span style={{ fontFamily: "var(--mono)", fontSize: 10, opacity: 0.65, letterSpacing: "0.14em" }}>→</span></button>
      </div>
    </div>
  )
}
