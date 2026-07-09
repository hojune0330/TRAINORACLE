// 직각 스타일 mobile preview frame (단순한 직사각형 베젤)
// 트레인오라클 미감 — radius 0, hairline border, no glow
import type { ReactNode } from "react"

export function MobileFrame({ children, label, width = 380, height = 800 }: {
  children: ReactNode; label?: string; width?: number; height?: number
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {label && (
        <div style={{
          fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)",
          letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ width: 5, height: 5, background: "var(--brand)", borderRadius: "50%" }}></span>
          {label}
        </div>
      )}
      <div style={{
        width: width + 20,
        background: "#0E1412",
        padding: 10,
        boxShadow: "0 40px 100px -30px rgba(0,0,0,0.28), 0 10px 30px -10px rgba(0,0,0,0.18)",
      }}>
        <div data-mobile-frame style={{
          width: width,
          height: height,
          background: "var(--bg)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          position: "relative",
        }}>
          {/* Status bar */}
          <div data-mobile-statusbar style={{
            height: 32, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 22px 0",
            fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600,
            color: "var(--ink)",
            background: "var(--bg)",
          }}>
            <span>9:41</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {/* Signal bars */}
              <svg width="16" height="10" viewBox="0 0 16 10" style={{ display: "block" }}>
                <rect x="0" y="6" width="2" height="4" fill="currentColor"/>
                <rect x="4" y="4" width="2" height="6" fill="currentColor"/>
                <rect x="8" y="2" width="2" height="8" fill="currentColor"/>
                <rect x="12" y="0" width="2" height="10" fill="currentColor"/>
              </svg>
              {/* Battery */}
              <svg width="24" height="11" viewBox="0 0 24 11" style={{ display: "block" }}>
                <rect x="0.5" y="0.5" width="20" height="10" stroke="currentColor" strokeWidth="1" fill="none"/>
                <rect x="2" y="2" width="17" height="7" fill="currentColor"/>
                <rect x="21" y="3.5" width="2" height="4" fill="currentColor"/>
              </svg>
            </div>
          </div>
          {/* Page content */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
