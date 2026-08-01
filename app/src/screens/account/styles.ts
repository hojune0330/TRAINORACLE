import type React from "react"

export const mono: React.CSSProperties = { fontFamily: "var(--mono)" }

export const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
  padding: "10px 12px",
  fontSize: 16,
  fontFamily: "var(--mono)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--paper, #fff)",
  color: "var(--ink)",
}

export const primaryBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  fontSize: 15,
  fontWeight: 600,
  fontFamily: "var(--sans)",
  border: "1px solid var(--ink)",
  borderRadius: 8,
  background: "var(--ink)",
  color: "var(--bg, #fff)",
  cursor: "pointer",
}

export const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "transparent",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  fontWeight: 500,
}
