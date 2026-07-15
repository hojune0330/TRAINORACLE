// 일지 전용 컴포넌트들. JournalPrimitives.
// v3 JSX 포팅 — CONFLICT C4/C5 수정: cycleDay는 bare string 대신
// CycleDayLabel typed object를 받는다 (display-label.ts).
import type { ReactNode, CSSProperties } from "react"
import type { CycleDayLabel } from "../domain/display-label"
import { formatCycleDayLabel } from "../domain/display-label"
import { TermHelp } from "./TermHelp"

// ============== INDEX CARD (날짜 헤더) ==============
export interface IndexCardProps {
  date: string
  dow?: string
  weather?: string
  /** CONFLICT C5 수정: bare "D-5" 문자열 금지 — typed object만 허용 */
  cycleDay?: CycleDayLabel
  /** 사이클 라벨 뒤에 붙는 부가 표기 (예: "★ MAIN") — 네임스페이스 값 아님 */
  cycleSuffix?: string
  season?: string
}

export function IndexCard({ date, dow, weather, cycleDay, cycleSuffix, season }: IndexCardProps) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--ink)",
      padding: "11px 14px",
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 8,
      alignItems: "baseline",
    }}>
      <div>
        <div style={{
          fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
          letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)",
        }}>{date}</div>
        <div style={{
          fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)",
          letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2,
        }}>{dow}{weather ? ` · ${weather}` : ""}</div>
      </div>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)",
        letterSpacing: "0.06em", textAlign: "right", lineHeight: 1.5,
      }}>
        {cycleDay && (
          <div>
            {formatCycleDayLabel(cycleDay)}
            {cycleSuffix ? ` ${cycleSuffix}` : ""}
            <TermHelp term="cycle-day" />
          </div>
        )}
        {season && <div>{season}</div>}
      </div>
    </div>
  )
}

// ============== MOOD STRIP (감정 5단계) ==============
export function MoodStrip({ level = 3, showLabel = false }: { level?: number; showLabel?: boolean }) {
  const labels = ["흐림", "무덤덤", "보통", "좋음", "최고"]
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span className={`mood-strip m${level}`}>
        <span className="b"></span>
        <span className="b"></span>
        <span className="b"></span>
        <span className="b"></span>
        <span className="b"></span>
      </span>
      {showLabel && (
        <span style={{
          fontFamily: "var(--mono)", fontSize: 10.5,
          color: `var(--mood-${level})`,
          letterSpacing: "0.04em",
        }}>{labels[level - 1]}</span>
      )}
    </span>
  )
}

// ============== INTENSITY DOT GROUP ==============
export type EnergyDist = Partial<Record<"base" | "lt" | "vo2" | "gly" | "atp" | "rest", number>>

const ENERGY_ORDER = ["base", "lt", "vo2", "gly", "atp", "rest"] as const
const ENERGY_COLORS: Record<(typeof ENERGY_ORDER)[number], string> = {
  base: "#4A8FC7", lt: "#B8A024", vo2: "#C7761C",
  gly: "#B8332E", atp: "#7A3FB5", rest: "#7A7A70",
}

export function IntensityDots({ dist = {} }: { dist?: EnergyDist }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {ENERGY_ORDER.map((k) => {
        const v = dist[k]
        if (!v) return null
        return (
          <span key={k} style={{
            width: 6, height: 6, borderRadius: "50%",
            background: ENERGY_COLORS[k],
          }} title={`${k.toUpperCase()} ${v}`}></span>
        )
      })}
    </span>
  )
}

// ============== INTENSITY STACK BAR (주/월 누적) ==============
export function IntensityStack({ data = {}, height = 14 }: { data?: EnergyDist; height?: number }) {
  const sum = Object.values(data).reduce((a, b) => a + (b ?? 0), 0) || 1
  return (
    <div style={{
      display: "flex", height,
      border: "1px solid var(--ink)",
    }}>
      {ENERGY_ORDER.map((k) => {
        const v = data[k] ?? 0
        if (!v) return null
        return (
          <div key={k} style={{
            flex: v / sum,
            background: ENERGY_COLORS[k],
          }}></div>
        )
      })}
    </div>
  )
}

// ============== STAMP (PB / SB / DONE) ==============
export function Stamp({ kind = "pb", children }: { kind?: "pb" | "sb" | "brand" | "done"; children: ReactNode }) {
  const className = `stamp ${kind === "pb" ? "red" : kind === "sb" || kind === "brand" ? "brand" : ""}`
  return <span className={className}>{children}</span>
}

// ============== PAIN DOT (부상 강도) ==============
export function PainDot({ level = 1, size = 8 }: { level?: number; size?: number }) {
  return (
    <span style={{
      display: "inline-block",
      width: size, height: size,
      background: `var(--pain-${level})`,
      borderRadius: "50%",
      verticalAlign: "middle",
    }}></span>
  )
}

// ============== SPARKLINE (mini line graph) ==============
export function Sparkline({ data = [], width = 100, height = 24, color = "var(--ink)", showLast = false }: {
  data?: number[]; width?: number; height?: number; color?: string; showLast?: boolean
}) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = height - pad - ((d - min) / range) * (height - pad * 2)
    return `${x},${y}`
  })
  const last = data[data.length - 1] ?? min
  const lx = pad + (width - pad * 2)
  const ly = height - pad - ((last - min) / range) * (height - pad * 2)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.2" />
      {showLast && <circle cx={lx} cy={ly} r="2" fill={color} />}
    </svg>
  )
}

// ============== DELTA (변화량 표시) ==============
export function Delta({ value, suffix = "", invert = false }: {
  value: number | string; suffix?: string; invert?: boolean
}) {
  const n = typeof value === "number" ? value : parseFloat(value)
  const positive = n > 0
  const negative = n < 0
  const goodIsUp = !invert
  const color = (positive && goodIsUp) || (negative && !goodIsUp)
    ? "var(--delta-up)"
    : (negative && goodIsUp) || (positive && !goodIsUp)
    ? "var(--delta-down)"
    : "var(--delta-flat)"
  const sign = positive ? "+" : ""
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 10,
      color, fontWeight: 500,
      letterSpacing: "0.02em",
      fontVariantNumeric: "tabular-nums",
    }}>{sign}{value}{suffix}</span>
  )
}

// ============== SECTION LABEL (작은) ==============
export function SectionLb({ children, action, onAction }: {
  children: ReactNode; action?: string; onAction?: () => void
}) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      marginBottom: 10, padding: "0 20px",
    }}>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)",
        letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
      }}>{children}</div>
      {action && onAction ? (
        <button onClick={onAction} style={{
          fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)",
          background: "transparent", border: 0, cursor: "pointer",
          textDecoration: "underline", textUnderlineOffset: "3px",
          letterSpacing: "0.04em", padding: 0, minWidth: 44, minHeight: 44,
        }}>{action}</button>
      ) : action ? (
        <span style={{
          fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)",
          letterSpacing: "0.04em",
        }}>{action}</span>
      ) : null}
    </div>
  )
}

export type { CSSProperties }
