import React from "react"
import { ArrowRight, CalendarDays } from "lucide-react"
import type { DistanceWindow } from "../../domain/cumulative-distance"
import {
  buildCumulativeDistanceDashboard,
  type CumulativeDistanceSummary,
  type DistanceBucket,
} from "../../domain/cumulative-distance"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import { AccessibleTrendTable } from "./AccessibleTrendTable"

type CumulativeDistancePanelProps = {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
  readonly planWindow?: DistanceWindow | null
  readonly mode: "compact" | "full"
  readonly onOpenTrends?: () => void
}

function distanceText(summary: CumulativeDistanceSummary): string {
  return summary.totalKm === null ? "—" : `${summary.totalKm}`
}

function distanceAccessibleText(summary: CumulativeDistanceSummary): string {
  return summary.totalKm === null
    ? "집계 가능한 거리 기록 없음"
    : `${summary.totalKm}킬로미터, 기록 ${summary.includedSourceCount}건`
}

function compactMonth(label: string): string {
  return `${Number(label.slice(5, 7))}월`
}

function compactWeek(label: string): string {
  return `${Number(label.slice(5, 7))}.${Number(label.slice(8, 10))}`
}

export function CumulativeDistancePanel({
  observations,
  today,
  planWindow = null,
  mode,
  onOpenTrends,
}: CumulativeDistancePanelProps) {
  const [weekCount, setWeekCount] = React.useState<4 | 12>(4)
  const [monthCount, setMonthCount] = React.useState<6 | 12>(6)
  const dashboard = React.useMemo(() => buildCumulativeDistanceDashboard({
    observations,
    asOfDate: today,
    planWindow,
    weeksBack: mode === "compact" ? 4 : weekCount,
    monthsBack: mode === "compact" ? 6 : monthCount,
  }), [mode, monthCount, observations, planWindow, today, weekCount])

  if (mode === "compact") {
    const items = [
      { label: "이번 주", summary: dashboard.toDate.week },
      { label: "이번 달", summary: dashboard.toDate.month },
      { label: "올해", summary: dashboard.toDate.year },
      ...(dashboard.plan === null ? [] : [{ label: "현재 계획", summary: dashboard.plan }]),
    ]
    return (
      <section className="distance-overview distance-overview--compact" aria-labelledby="home-distance-title">
        <div className="distance-overview__heading">
          <div>
            <span className="distance-overview__eyebrow">쌓인 거리</span>
            <h2 id="home-distance-title">내 달리기가 얼마나 쌓였을까요?</h2>
          </div>
          <button type="button" onClick={onOpenTrends} aria-label="누적 거리 자세히 보기">
            자세히 <ArrowRight aria-hidden="true" size={16} />
          </button>
        </div>
        <div className={`distance-overview__totals distance-overview__totals--${items.length}`}>
          {items.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{distanceText(item.summary)}<small>{item.summary.totalKm === null ? "" : " km"}</small></strong>
            </div>
          ))}
        </div>
        {items.every((item) => item.summary.totalKm === null) && (
          <p className="distance-overview__empty">훈련 후 거리를 직접 적으면 주·월·연간 합계가 여기서 시작돼요.</p>
        )}
      </section>
    )
  }

  return (
    <section className="distance-overview distance-overview--full" aria-labelledby="distance-analysis-title">
      <div className="distance-overview__heading">
        <div>
          <span className="distance-overview__eyebrow">누적 거리</span>
          <h2 id="distance-analysis-title">거리 흐름</h2>
          <p>직접 적어 출처가 확인된 거리만 더해요. 미기록은 0 km로 바꾸지 않아요.</p>
        </div>
      </div>

      <div className="distance-overview__totals distance-overview__totals--full">
        <DistanceTotal label="이번 주" summary={dashboard.toDate.week} />
        <DistanceTotal label="이번 달" summary={dashboard.toDate.month} />
        <DistanceTotal label="올해" summary={dashboard.toDate.year} />
        {dashboard.plan !== null && <DistanceTotal label="현재 계획 기간" summary={dashboard.plan} />}
      </div>

      {dashboard.plan !== null && (
        <p className="distance-overview__plan-note">
          <CalendarDays aria-hidden="true" size={15} />
          계획 시작일부터 화면에 보이는 마지막 계획 날짜까지 더한 값이에요. 정확한 9.5일 시간 경계 값은 아니에요.
        </p>
      )}

      <DistanceSeries
        title="주간 거리"
        buckets={dashboard.weeks}
        labelForBucket={compactWeek}
        control={(
          <PeriodToggle
            label="주간 비교 기간"
            value={weekCount}
            options={[4, 12]}
            suffix="주"
            onChange={(value) => setWeekCount(value as 4 | 12)}
          />
        )}
      />

      <DistanceSeries
        title="월간 거리"
        buckets={dashboard.months}
        labelForBucket={compactMonth}
        control={(
          <PeriodToggle
            label="월간 비교 기간"
            value={monthCount}
            options={[6, 12]}
            suffix="개월"
            onChange={(value) => setMonthCount(value as 6 | 12)}
          />
        )}
      />

      <DailyDistanceHeatmap buckets={dashboard.days} month={today.slice(0, 7)} />

      <details className="distance-overview__details">
        <summary>집계 기준과 제외된 기록 보기</summary>
        <p>가져온 값, 출처가 없는 예전 값, 잘못된 숫자, 같은 ID인데 내용이 충돌한 기록은 합계에서 제외해요.</p>
        <p>비밀 메모 원문과 메모가 있다는 사실은 읽거나 점수로 쓰지 않아요.</p>
      </details>
    </section>
  )
}

function DistanceTotal({ label, summary }: {
  readonly label: string
  readonly summary: CumulativeDistanceSummary
}) {
  return (
    <div aria-label={`${label}, ${distanceAccessibleText(summary)}`}>
      <span>{label}</span>
      <strong>{distanceText(summary)}<small>{summary.totalKm === null ? "" : " km"}</small></strong>
      <em>{summary.totalKm === null ? "기록 없음" : `${summary.includedSourceCount}건 반영`}</em>
    </div>
  )
}

function PeriodToggle({ label, value, options, suffix, onChange }: {
  readonly label: string
  readonly value: number
  readonly options: readonly number[]
  readonly suffix: string
  readonly onChange: (value: number) => void
}) {
  return (
    <div className="distance-overview__toggle" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >{option}{suffix}</button>
      ))}
    </div>
  )
}

function DistanceSeries({ title, buckets, labelForBucket, control }: {
  readonly title: string
  readonly buckets: readonly DistanceBucket[]
  readonly labelForBucket: (label: string) => string
  readonly control: React.ReactNode
}) {
  const values = buckets.flatMap((bucket) => bucket.totalKm === null ? [] : [bucket.totalKm])
  const max = Math.max(...values, 1)
  const excluded = buckets.reduce((sum, bucket) => sum + bucket.excludedSourceCount, 0)

  return (
    <div className="distance-overview__series">
      <div className="distance-overview__series-heading">
        <h3>{title}</h3>
        {control}
      </div>
      <div
        className="distance-overview__bars"
        role="img"
        aria-label={`${title}: ${buckets.map((bucket) => `${labelForBucket(bucket.label)} ${distanceAccessibleText(bucket)}`).join(", ")}`}
        style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(18px, 1fr))` }}
      >
        {buckets.map((bucket) => (
          <div key={bucket.label} className="distance-overview__bar-item">
            <span>{bucket.totalKm === null ? "—" : bucket.totalKm}</span>
            <i
              data-missing={bucket.totalKm === null ? "true" : "false"}
              style={{ height: bucket.totalKm === null ? 8 : `${Math.max(12, (bucket.totalKm / max) * 72)}px` }}
            />
            <small>{labelForBucket(bucket.label)}</small>
          </div>
        ))}
      </div>
      <AccessibleTrendTable
        caption={title}
        rows={buckets.map((bucket) => ({
          key: bucket.label,
          label: labelForBucket(bucket.label),
          value: distanceAccessibleText(bucket),
        }))}
      />
      {excluded > 0 && <p className="distance-overview__excluded">집계 기준에 맞지 않아 제외한 기록 {excluded}건</p>}
    </div>
  )
}

function DailyDistanceHeatmap({ buckets, month }: {
  readonly buckets: readonly DistanceBucket[]
  readonly month: string
}) {
  const values = buckets.flatMap((bucket) => bucket.totalKm === null ? [] : [bucket.totalKm])
  const max = Math.max(...values, 1)
  const firstDay = buckets[0]
  const leadingDays = firstDay === undefined
    ? 0
    : (new Date(`${firstDay.label}T00:00:00`).getDay() + 6) % 7

  return (
    <div className="distance-overview__heatmap">
      <div className="distance-overview__series-heading">
        <h3>이번 달 날짜별 거리</h3>
        <span>{Number(month.slice(5, 7))}월</span>
      </div>
      <div className="distance-overview__weekdays" aria-hidden="true">
        {['월', '화', '수', '목', '금', '토', '일'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="distance-overview__heatmap-grid" role="list" aria-label={`${Number(month.slice(5, 7))}월 날짜별 거리`}>
        {Array.from({ length: leadingDays }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
        {buckets.map((bucket) => {
          const ratio = bucket.totalKm === null ? 0 : bucket.totalKm / max
          return (
            <span
              key={bucket.label}
              role="listitem"
              data-has-distance={bucket.totalKm === null ? "false" : "true"}
              style={{ "--distance-opacity": `${Math.round((0.24 + ratio * 0.76) * 100)}%` } as React.CSSProperties}
              aria-label={`${Number(bucket.label.slice(8, 10))}일, ${distanceAccessibleText(bucket)}`}
              title={`${Number(bucket.label.slice(8, 10))}일 · ${bucket.totalKm === null ? "기록 없음" : `${bucket.totalKm} km`}`}
            >
              <b>{Number(bucket.label.slice(8, 10))}</b>
              <small>{bucket.totalKm === null ? "" : bucket.totalKm}</small>
            </span>
          )
        })}
      </div>
      <p className="distance-overview__heatmap-note">색과 함께 날짜 안의 숫자로 거리 유무를 확인할 수 있어요.</p>
    </div>
  )
}
