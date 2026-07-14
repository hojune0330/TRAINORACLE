type TrendTableRow = {
  readonly key: string
  readonly label: string
  readonly value: string
}

type AccessibleTrendTableProps = {
  readonly caption: string
  readonly rows: readonly TrendTableRow[]
}

export function AccessibleTrendTable({ caption, rows }: AccessibleTrendTableProps) {
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{
        fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)",
        cursor: "pointer", letterSpacing: "0.06em",
      }}>표로 보기</summary>
      <table style={{
        width: "100%", marginTop: 6, fontFamily: "var(--mono)", fontSize: 10.5,
        color: "var(--ink-2)", borderCollapse: "collapse",
      }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{caption}</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBottom: "1px dashed var(--hair)" }}>
              <th scope="row" style={{ textAlign: "left", padding: "3px 0", fontWeight: 400 }}>{row.label}</th>
              <td style={{ textAlign: "right", padding: "3px 0" }}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
