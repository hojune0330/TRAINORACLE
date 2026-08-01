import React from "react"

export function WeekCell({ label, value, unit, right, border }: {
  readonly label: React.ReactNode
  readonly value: string
  readonly unit: string
  readonly right?: boolean
  readonly border?: boolean
}) {
  return (
    <div style={{
      padding: right === true ? "12px 12px 12px 0" : "12px 0 12px 12px",
      borderRight: right === true ? "1px solid var(--hair)" : 0,
      borderBottom: border === true ? "1px solid var(--hair)" : 0,
    }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500, color: "var(--ink)", marginTop: 4 }}>
        {value}<span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  )
}
