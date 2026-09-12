import { ChevronDown, TableProperties } from "lucide-react"

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
    <details className="accessible-trend-table" style={{ marginTop: "var(--space-2)" }}>
      <summary style={{
        minHeight: "var(--app-touch-min)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontFamily: "var(--sans)",
        fontSize: "var(--fs-caption)",
        fontWeight: 650,
        lineHeight: 1.4,
        color: "var(--ink-2)",
        cursor: "pointer",
        letterSpacing: 0,
      }}>
        <TableProperties aria-hidden="true" size={16} />
        <span>표로 보기</span>
        <ChevronDown className="accessible-trend-table__toggle" aria-hidden="true" size={16} />
      </summary>
      <table style={{
        width: "100%",
        marginTop: 0,
        tableLayout: "fixed",
        fontFamily: "var(--sans)",
        fontSize: "var(--fs-caption)",
        lineHeight: 1.5,
        color: "var(--ink-2)",
        borderCollapse: "collapse",
      }}>
        <caption style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        }}>{caption}</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBottom: "var(--bw-line) solid var(--line)" }}>
              <th scope="row" style={{
                width: "34%",
                padding: "var(--space-2) var(--space-2) var(--space-2) 0",
                verticalAlign: "top",
                textAlign: "left",
                fontWeight: 600,
                wordBreak: "keep-all",
                overflowWrap: "anywhere",
              }}>{row.label}</th>
              <td style={{
                padding: "var(--space-2) 0 var(--space-2) var(--space-2)",
                verticalAlign: "top",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                overflowWrap: "anywhere",
              }}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
