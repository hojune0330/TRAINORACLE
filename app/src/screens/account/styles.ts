import type React from "react"

export const mono: React.CSSProperties = { fontFamily: "var(--mono)" }

export const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "var(--app-touch-min)",
  padding: "10px 12px",
  fontSize: "var(--fs-body-lg)",
  fontFamily: "var(--sans)",
  lineHeight: 1.5,
  border: "1px solid var(--line-2)",
  borderRadius: "var(--r-md)",
  background: "var(--surface)",
  color: "var(--ink)",
}

export const primaryBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  padding: "10px 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-2)",
  fontSize: "var(--fs-body)",
  fontWeight: 650,
  fontFamily: "var(--sans)",
  lineHeight: 1.4,
  border: "1px solid var(--ink)",
  borderRadius: "var(--r-md)",
  background: "var(--ink)",
  color: "var(--bg)",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  cursor: "pointer",
}

export const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "transparent",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  fontWeight: 500,
}
