import type React from "react"

export const mono: React.CSSProperties = { fontFamily: "var(--mono)" }

export const primaryBtn: React.CSSProperties = {
  width: "100%", minHeight: 48, fontSize: 15, fontWeight: 600,
  fontFamily: "var(--sans)", border: "1px solid var(--ink)",
  background: "var(--ink)", color: "var(--bg)", cursor: "pointer",
}

export const secondaryBtn: React.CSSProperties = {
  ...primaryBtn, background: "transparent", color: "var(--ink)",
  border: "1px solid var(--line)", fontWeight: 500,
}
