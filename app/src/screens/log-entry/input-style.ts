import type { CSSProperties } from "react"

export function inputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "11px 12px",
    minHeight: 44,
    border: "1px solid var(--line)",
    background: "var(--surface)",
    fontFamily: "var(--sans)",
    fontSize: "var(--fs-body)",
    color: "var(--ink)",
    boxSizing: "border-box",
    borderRadius: "var(--r-action)",
  }
}
