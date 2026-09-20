import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import {
  bucketByMonth,
  summarizeMetricCoverage,
} from "../../domain/trend-analysis"
import { isoToDate } from "../../domain/dates"
import { acceptsFileDistance } from "../../domain/analysis-field-eligibility"
import { MonthlyTrendBars } from "./MonthlyTrendBars"
import {
  displayStatusText,
  formatTrendRange,
  formatTrendValue,
  monthText,
  TREND_METRIC_OPTIONS,
} from "./trend-display"
import type { DisplayTrendMetric } from "./trend-display"
import "./monthly-trend-details.css"

export function MonthlyTrendSection({
  observations,
  today,
  initialMetric,
}: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
  /** Optional deep-link context; invalid values keep the existing pace default. */
  readonly initialMetric?: DisplayTrendMetric | string | undefined
}) {
  const [metric, setMetric] = React.useState<DisplayTrendMetric>(() => (
    typeof initialMetric === "string" && TREND_METRIC_OPTIONS.some((item) => item.metric === initialMetric)
      ? initialMetric as DisplayTrendMetric
      : "SECONDS_PER_KM"
  ))
  const option = TREND_METRIC_OPTIONS.find((item) => item.metric === metric)
  if (option === undefined) throw new Error(`Missing trend metric option: ${metric}`)
  const buckets = bucketByMonth(observations, isoToDate(today), 4, metric)
  const labels = new Set(buckets.map((bucket) => bucket.label))
  const scoped = observations.filter((observation) => labels.has(observation.loggedOn.slice(0, 7)))
  const coverage = summarizeMetricCoverage(scoped, metric)
  const sourceRefs = buckets.flatMap((bucket) => bucket.sourceRefs)
  const fileDistanceRefs = new Set(scoped.filter(acceptsFileDistance).map(observation => observation.sourceRef))

  return (
    <section className="monthly-trend-section" aria-label="최근 4개월 추이">
      <SectionLb>최근 4개월</SectionLb>
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

      {metric === "SECONDS_PER_KM" && (
        <div className="monthly-trend-section__scope-note">
          직접 기록 기준 · 파일 페이스 제외
        </div>
      )}

      <MonthlyTrendBars buckets={buckets} metric={metric} metricLabel={option.noun} />

      <div className="monthly-trend-section__status" aria-live="polite">
        집계 사용 {coverage.included}건 · 집계 제외 {coverage.excluded}건
        {buckets.some((bucket) => bucket.kind === "DATA" && bucket.displayStatus === "STALE") && (
          <span> · 오래된 출처가 포함된 달이 있어요.</span>
        )}
        {buckets.some((bucket) => bucket.kind === "DATA" && bucket.displayStatus === "CONFLICTING") && (
          <span> · 출처가 서로 달라 확인이 필요한 달이 있어요.</span>
        )}
        {buckets.some((bucket) => bucket.kind === "MISSING") && (
          <span> · 기록이 없는 달은 계산하지 않았어요.</span>
        )}
      </div>

      <InfoDisclosure title="월별 수치와 집계 범위 보기" className="monthly-trend-section__details">
        <div className="monthly-trend-section__rows">
          {buckets.map((bucket) => (
            <div className="monthly-trend-section__row" key={bucket.label}>
              {bucket.kind === "MISSING" ? (
                <div>{monthText(bucket.label)}은 집계 가능한 기록이 없어요.</div>
              ) : (
                <>
                  <div className="monthly-trend-section__row-title">
                    {monthText(bucket.label)} 중앙 {option.noun} {formatTrendValue(metric, bucket.median)}
                  </div>
                  <div className="monthly-trend-section__row-meta">
                    표본 {bucket.n}건 · 범위 {formatTrendRange(metric, bucket)} · {bucket.nonSensitiveReasonCodes.includes("CONFIRMED_FILE_DISTANCE")
                      ? "확인한 파일 거리 포함" : displayStatusText(bucket)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </InfoDisclosure>
      {sourceRefs.length > 0 && (
        <details className="monthly-trend-section__sources">
          <summary>
            출처 기록 보기
          </summary>
          <ul>
            {sourceRefs.map((source, index) => (
              <li
                key={`${source.sourceId}-${source.observedAt ?? "unknown"}-${index}`}
              >
                {source.sourceId} · {metric === "DISTANCE_KM" && fileDistanceRefs.has(source)
                  ? "확인한 파일 거리" : source.trustState === "ACCEPTED" ? "출처 확인" : "확인 필요"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
