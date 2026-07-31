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
  const values = buckets.flatMap((bucket) => bucket.kind === "DATA" ? [bucket.median] : [])
  const max = Math.max(...values, 1)
  const ariaValues = buckets.map((bucket) => bucket.kind === "MISSING"
    ? `${monthText(bucket.label)} 기록 없음`
    : `${monthText(bucket.label)} 중앙값 ${formatTrendValue(metric, bucket.median)}`)

  return (
    <>
      <div
        role="img"
        aria-label={`${metricLabel} 최근 4개월: ${ariaValues.join(", ")}. 빈 달은 이어서 계산하지 않았어요.`}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 8,
          height: 112,
          alignItems: "end",
          paddingTop: 12,
        }}
      >
        {buckets.map((bucket) => (
          <div key={bucket.label} style={{ minWidth: 0, textAlign: "center" }}>
            {bucket.kind === "MISSING" ? (
              <div style={{
                height: 54,
                border: "1px dashed var(--line-2)",
                display: "grid",
                placeItems: "center",
                color: "var(--ink-4)",
                fontFamily: "var(--mono)",
                fontSize: 9,
              }}>없음</div>
            ) : (
              <div style={{
                height: `${Math.max(18, (bucket.median / max) * 54)}px`,
                background: "var(--ink-2)",
              }} />
            )}
            <div style={{
              marginTop: 6,
              overflowWrap: "anywhere",
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
            }}>{monthText(bucket.label)}</div>
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
