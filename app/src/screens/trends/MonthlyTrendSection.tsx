import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import {
  bucketByMonth,
  summarizeMetricCoverage,
} from "../../domain/trend-analysis"
import { isoToDate } from "../../domain/dates"
import { MonthlyTrendBars } from "./MonthlyTrendBars"
import {
  displayStatusText,
  formatTrendRange,
  formatTrendValue,
  monthText,
  TREND_METRIC_OPTIONS,
} from "./trend-display"
import type { DisplayTrendMetric } from "./trend-display"

export function MonthlyTrendSection({
  observations,
  today,
}: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
}) {
  const [metric, setMetric] = React.useState<DisplayTrendMetric>("SECONDS_PER_KM")
  const option = TREND_METRIC_OPTIONS.find((item) => item.metric === metric)
  if (option === undefined) throw new Error(`Missing trend metric option: ${metric}`)
  const buckets = bucketByMonth(observations, isoToDate(today), 4, metric)
  const labels = new Set(buckets.map((bucket) => bucket.label))
  const scoped = observations.filter((observation) => labels.has(observation.loggedOn.slice(0, 7)))
  const coverage = summarizeMetricCoverage(scoped, metric)
  const sourceRefs = buckets.flatMap((bucket) => bucket.sourceRefs)

  return (
    <section aria-label="최근 4개월 추이" style={{ padding: "26px 20px 0" }}>
      <SectionLb>— 4 MONTHS · 설명 통계</SectionLb>
      <div className="monthly-trend__tabs app-compact-tabs" role="group" aria-label="추이 항목">
        {TREND_METRIC_OPTIONS.map((item) => (
          <button
            className="app-compact-tab"
            key={item.metric}
            type="button"
            aria-pressed={item.metric === metric}
            onClick={() => setMetric(item.metric)}
          ><span>{item.buttonLabel}</span></button>
        ))}
      </div>

      <MonthlyTrendBars buckets={buckets} metric={metric} metricLabel={option.noun} />

      <div style={{ marginTop: 12, borderTop: "1px solid var(--line)" }}>
        {buckets.map((bucket) => (
          <div key={bucket.label} style={{
            padding: "10px 0",
            borderBottom: "1px dashed var(--hair)",
            fontFamily: "var(--mono)",
            color: "var(--ink-2)",
          }}>
            {bucket.kind === "MISSING" ? (
              <div style={{ fontSize: 10.5 }}>{monthText(bucket.label)}은 집계 가능한 기록이 없어요.</div>
            ) : (
              <>
                <div style={{ fontSize: 11.5, color: "var(--ink)" }}>
                  {monthText(bucket.label)} 중앙 {option.noun} {formatTrendValue(metric, bucket.median)}
                </div>
                <div style={{ marginTop: 3, fontSize: 9.5, color: "var(--ink-3)" }}>
                  표본 {bucket.n}건 · 범위 {formatTrendRange(metric, bucket)} · {displayStatusText(bucket)}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)" }}>
        집계 사용 {coverage.included}건 · 집계 제외 {coverage.excluded}건
      </div>
      {sourceRefs.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)" }}>
            출처 기록 보기
          </summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)" }}>
            {sourceRefs.map((source) => (
              <li
                key={`${source.sourceId}-${source.observedAt ?? "unknown"}`}
                style={{ overflowWrap: "anywhere" }}
              >
                {source.sourceId} · {source.trustState === "ACCEPTED" ? "출처 확인" : "확인 필요"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
