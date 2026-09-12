import type { TrendBucket } from "../../domain/trend-analysis"
import { AccessibleTrendTable } from "./AccessibleTrendTable"
import {
  formatTrendValue,
  monthText,
} from "./trend-display"
import type { DisplayTrendMetric } from "./trend-display"

type MonthlyTrendBarsProps = {
  readonly buckets: readonly TrendBucket[]
  readonly metric: DisplayTrendMetric
  readonly metricLabel: string
}

export function MonthlyTrendBars({
  buckets,
  metric,
  metricLabel,
}: MonthlyTrendBarsProps) {
  const barHeight = 54
  const values = buckets.flatMap((bucket) => bucket.kind === "DATA" ? [bucket.median] : [])
  const max = Math.max(...values, 1)
  const ariaValues = buckets.map((bucket) => bucket.kind === "MISSING"
    ? `${monthText(bucket.label)} 기록 없음`
    : `${monthText(bucket.label)} 중앙값 ${formatTrendValue(metric, bucket.median)}`)

  return (
    <>
      <div
        className="monthly-trend-bars"
        role="img"
        aria-label={`${metricLabel} 최근 4개월: ${ariaValues.join(", ")}. 빈 달은 이어서 계산하지 않았어요.`}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 64px), 1fr))",
          gap: "var(--space-2)",
          minHeight: 132,
          alignItems: "end",
          paddingTop: "var(--space-3)",
        }}
      >
        {buckets.map((bucket) => (
          <div
            className="monthly-trend-bars__item"
            key={bucket.label}
            style={{
              minWidth: 0,
              display: "grid",
              gridTemplateRows: `minmax(40px, auto) ${barHeight}px minmax(20px, auto)`,
              alignItems: "end",
              textAlign: "center",
            }}
          >
            <span className="monthly-trend-bars__value" style={{
              minWidth: 0,
              fontFamily: "var(--mono)",
              fontSize: "var(--fs-caption)",
              lineHeight: 1.25,
              color: "var(--ink-2)",
              fontVariantNumeric: "tabular-nums",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }}>
              {bucket.kind === "MISSING" ? "—" : formatTrendValue(metric, bucket.median)}
            </span>
            <div className="monthly-trend-bars__track" style={{
              height: barHeight,
              display: "flex",
              alignItems: "flex-end",
            }}>
              {bucket.kind === "MISSING" ? (
                <span className="monthly-trend-bars__missing" style={{
                  width: "100%",
                  height: barHeight,
                  border: "1px dashed var(--line-2)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--ink-3)",
                  fontFamily: "var(--sans)",
                  fontSize: "var(--fs-caption)",
                }}>없음</span>
              ) : (
                <span className="monthly-trend-bars__bar" style={{
                  width: "100%",
                  height: `${(bucket.median / max) * barHeight}px`,
                  display: "block",
                  background: "var(--ink-2)",
                }} />
              )}
            </div>
            <span className="monthly-trend-bars__label" style={{
              minWidth: 0,
              paddingTop: "var(--space-1)",
              fontFamily: "var(--mono)",
              fontSize: "var(--fs-caption)",
              lineHeight: 1.3,
              color: "var(--ink-3)",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }}>{monthText(bucket.label)}</span>
          </div>
        ))}
      </div>
      <AccessibleTrendTable
        caption={`${metricLabel} 최근 4개월 중앙값`}
        rows={buckets.map((bucket) => ({
          key: bucket.label,
          label: monthText(bucket.label),
          value: bucket.kind === "MISSING"
            ? "집계 가능한 기록 없음"
            : `중앙 ${formatTrendValue(metric, bucket.median)} · 표본 ${bucket.n}건`,
        }))}
      />
    </>
  )
}
