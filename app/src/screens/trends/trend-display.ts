import type { TrendBucket, TrendMetric } from "../../domain/trend-analysis"

export type DisplayTrendMetric = Exclude<TrendMetric, "RPE">

export type TrendMetricOption = {
  readonly metric: DisplayTrendMetric
  readonly buttonLabel: string
  readonly noun: string
}

export const TREND_METRIC_OPTIONS: readonly TrendMetricOption[] = [
  { metric: "DISTANCE_KM", buttonLabel: "거리", noun: "거리" },
  { metric: "SECONDS_PER_KM", buttonLabel: "페이스", noun: "페이스" },
  { metric: "MOOD", buttonLabel: "기분", noun: "기분" },
  { metric: "PAIN_MAX", buttonLabel: "통증", noun: "통증" },
]

function trimDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function pace(value: number): string {
  const rounded = Math.round(value)
  const minutes = Math.floor(rounded / 60)
  const seconds = String(rounded % 60).padStart(2, "0")
  return `${minutes}:${seconds}`
}

export function formatTrendValue(metric: DisplayTrendMetric, value: number): string {
  switch (metric) {
    case "DISTANCE_KM": return `${trimDecimal(value)} km`
    case "SECONDS_PER_KM": return `${pace(value)}/km`
    case "MOOD": return `${trimDecimal(value)}/5`
    case "PAIN_MAX": return `${trimDecimal(value)}/5`
  }
}

export function formatTrendRange(
  metric: DisplayTrendMetric,
  bucket: Extract<TrendBucket, { readonly kind: "DATA" }>,
): string {
  if (metric === "SECONDS_PER_KM") return `${pace(bucket.min)}~${pace(bucket.max)}`
  return `${formatTrendValue(metric, bucket.min)}~${formatTrendValue(metric, bucket.max)}`
}

export function displayStatusText(
  bucket: Extract<TrendBucket, { readonly kind: "DATA" }>,
): string {
  switch (bucket.displayStatus) {
    case "OBSERVED": return "직접 기록"
    case "DERIVED": return "직접 기록에서 계산"
    case "STALE": return "오래된 출처 · 확인 필요"
    case "CONFLICTING": return "출처 충돌 · 확인 필요"
  }
}

export function monthText(label: string): string {
  const month = Number(label.slice(5, 7))
  return Number.isInteger(month) ? `${month}월` : label
}
