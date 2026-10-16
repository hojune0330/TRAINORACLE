import React from "react"
import { ChevronRight } from "lucide-react"
import { isoToDate } from "../domain/dates"
import type {
  ArchiveDaySummary,
  ArchiveKindCounts,
  ArchiveMetrics,
  ArchiveMonthSummary,
  ArchiveWeekSummary,
} from "../domain/journal-archive"

type ArchiveSummary = ArchiveDaySummary | ArchiveWeekSummary | ArchiveMonthSummary

const DAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const

export function SummaryList<T>({
  label,
  showLabel = true,
  items,
  itemKey,
  renderItem,
}: {
  readonly label: string
  readonly showLabel?: boolean
  readonly items: readonly T[]
  readonly itemKey: (item: T) => string
  readonly renderItem: (item: T) => React.ReactNode
}) {
  return (
    <section className="journal-archive__summary-list" aria-label={label}>
      {showLabel && <div className="journal-archive__summary-list-title">
        {label}
      </div>}
      <div className="journal-archive__summary-list-items">
        {items.map((item) => (
          <React.Fragment key={itemKey(item)}>{renderItem(item)}</React.Fragment>
        ))}
      </div>
    </section>
  )
}

export function SummaryButton({
  heading,
  summary,
  ariaLabel,
  onClick,
}: {
  readonly heading: string
  readonly summary: ArchiveSummary
  readonly ariaLabel: string
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="journal-archive__summary-button"
    >
      <span className="journal-archive__summary-button-copy">
        <span className="journal-archive__summary-button-heading">
          {heading}
        </span>
        <span className="journal-archive__summary-button-metrics">
          {kindText(summary.kindCounts)}
          {metricParts(summary.metrics).map((part) => ` · ${part}`)}
        </span>
        {summary.excludedRecordCount > 0 && (
          <span className="journal-archive__summary-button-excluded">
            출처를 확인할 수 없어 제외된 기록 {summary.excludedRecordCount}건
          </span>
        )}
      </span>
      <ChevronRight aria-hidden="true" size={18} className="journal-archive__summary-button-chevron" />
    </button>
  )
}

function kindText(counts: ArchiveKindCounts): string {
  const parts = [
    counts.postSession > 0 ? `훈련 후 ${counts.postSession}건` : null,
    counts.evening > 0 ? `컨디션·메모 ${counts.evening}건` : null,
    counts.race > 0 ? `경기 ${counts.race}건` : null,
  ].filter((part): part is string => part !== null)
  return parts.join(" · ")
}

function metricParts(metrics: ArchiveMetrics): readonly string[] {
  return [
    metrics.distanceKm === null ? null : `${metrics.distanceKm} km`,
    metrics.durationMin === null ? null : `${metrics.durationMin}분`,
    metrics.moodAverage === null ? null : `기분 평균 ${metrics.moodAverage}/5`,
    metrics.painMax === null ? null : `통증 최대 ${metrics.painMax}/5`,
  ].filter((part): part is string => part !== null)
}

export function summaryText(summary: ArchiveSummary): string {
  const parts = [
    kindText(summary.kindCounts),
    ...metricParts(summary.metrics),
    summary.excludedRecordCount > 0
      ? `출처를 확인할 수 없어 제외된 기록 ${summary.excludedRecordCount}건`
      : null,
  ].filter((part): part is string => part !== null && part !== "")
  return parts.join(" · ")
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number)
  return `${year}년 ${monthNumber}월`
}

function dateParts(date: string): { readonly year: number; readonly month: number; readonly day: number } {
  const [year, month, day] = date.split("-").map(Number)
  return { year: year ?? 0, month: month ?? 0, day: day ?? 0 }
}

export function dayLabel(date: string): string {
  const { year, month, day } = dateParts(date)
  const dayName = DAY_NAMES[isoToDate(date).getDay()] ?? ""
  return `${year}년 ${month}월 ${day}일 ${dayName}`
}

export function weekButtonLabel(week: ArchiveWeekSummary): string {
  const start = dateParts(week.weekStart)
  const end = dateParts(week.weekEnd)
  return `${start.month}월 ${start.day}일–${end.month}월 ${end.day}일`
}

export function weekHeading(week: ArchiveWeekSummary): string {
  const start = dateParts(week.weekStart)
  const end = dateParts(week.weekEnd)
  return start.month === end.month
    ? `${start.month}월 ${start.day}일–${end.day}일`
    : `${start.month}월 ${start.day}일–${end.month}월 ${end.day}일`
}
