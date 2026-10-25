import React from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { SectionLb } from "../../components/JournalPrimitives"
import { AppHeading } from "../../components/AppHeading"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import {
  bucketByMonth,
  summarizeMetricCoverage,
} from "../../domain/trend-analysis"
import { isoToDate } from "../../domain/dates"
import { acceptsFileDistance } from "../../domain/analysis-field-eligibility"
import { registerBrowserBackLayer } from "../../navigation/browserNavigation"
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

function validMetric(value: string | undefined): value is DisplayTrendMetric {
  return TREND_METRIC_OPTIONS.some(item => item.metric === value)
}

function initialTrendMetric(
  observations: readonly StructuredJournalObservation[],
  today: string,
  initialMetric: string | undefined,
): DisplayTrendMetric {
  if (validMetric(initialMetric)) return initialMetric
  return TREND_METRIC_OPTIONS.find(item => (
    bucketByMonth(observations, isoToDate(today), 4, item.metric).some(bucket => bucket.kind === "DATA")
  ))?.metric ?? "DISTANCE_KM"
}

function sourceDate(date: string | null | undefined): string {
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})/u)
  return match ? `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일` : "날짜 확인 필요"
}

function MetricSelectorSheet({ metric, onSelect, onClose, returnFocusTo }: {
  readonly metric: DisplayTrendMetric
  readonly onSelect: (metric: DisplayTrendMetric) => void
  readonly onClose: () => void
  readonly returnFocusTo: () => HTMLElement | null
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const titleId = React.useId()
  const closeLayerRef = React.useRef<(() => void) | null>(null)
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  React.useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    const layer = registerBrowserBackLayer({
      id: `monthly-metric-${titleId}`,
      canClose: () => true,
      onClose: () => onCloseRef.current(),
    })
    closeLayerRef.current = layer.close
    document.body.style.overflow = "hidden"
    dialog?.showModal()
    dialog?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true })
    return () => {
      closeLayerRef.current = null
      layer.dispose()
      if (dialog?.open) dialog.close()
      document.body.style.overflow = previousOverflow
      const trigger = returnFocusTo()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [titleId, returnFocusTo])

  return <dialog
    ref={dialogRef}
    className="monthly-metric-sheet"
    aria-labelledby={titleId}
    aria-modal="true"
    onCancel={event => { event.preventDefault(); closeLayerRef.current?.() }}
    onClick={event => { if (event.target === event.currentTarget) closeLayerRef.current?.() }}
    onKeyDown={event => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeLayerRef.current?.()
        return
      }
      if (event.key !== "Tab") return
      const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus()
      }
    }}
  >
    <header className="monthly-metric-sheet__header">
      <AppHeading as="h3" variant="section" id={titleId}>볼 지표 선택</AppHeading>
      <button type="button" aria-label="지표 선택 닫기" onClick={() => closeLayerRef.current?.()}>
        <X size={18} aria-hidden="true" />
      </button>
    </header>
    <fieldset className="monthly-metric-sheet__options">
      <legend>추이 항목</legend>
      {TREND_METRIC_OPTIONS.map((item, index) => <button
        className="monthly-metric-sheet__option" type="button" key={item.metric}
        aria-pressed={item.metric === metric}
        onClick={() => { onSelect(item.metric); closeLayerRef.current?.() }}
        onKeyDown={event => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
          event.preventDefault()
          const options = dialogRef.current?.querySelectorAll<HTMLButtonElement>(".monthly-metric-sheet__option")
          const nextIndex = (index + (event.key === "ArrowDown" ? 1 : -1) + TREND_METRIC_OPTIONS.length) % TREND_METRIC_OPTIONS.length
          options?.[nextIndex]?.focus()
        }}>
        <span>{item.buttonLabel}</span>
        <Check size={18} aria-hidden="true" className="monthly-metric-sheet__check" />
      </button>)}
    </fieldset>
  </dialog>
}

export function MonthlyTrendSection({
  observations,
  today,
  initialMetric,
  onMetricChange,
  onShowExample,
  onOpenImport,
  onWriteLog,
  onWriteRecovery,
}: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
  /** A valid explicit context wins; otherwise start with the first metric containing data. */
  readonly initialMetric?: DisplayTrendMetric | string | undefined
  readonly onMetricChange?: ((metric: DisplayTrendMetric) => void) | undefined
  readonly onShowExample?: (() => void) | undefined
  readonly onOpenImport?: (() => void) | undefined
  readonly onWriteLog?: (() => void) | undefined
  readonly onWriteRecovery?: (() => void) | undefined
}) {
  const [metric, setMetric] = React.useState<DisplayTrendMetric>(() => initialTrendMetric(observations, today, initialMetric))
  const [selectorOpen, setSelectorOpen] = React.useState(false)
  const selectorRef = React.useRef<HTMLButtonElement>(null)
  const previousInitialMetric = React.useRef(initialMetric)
  const onMetricChangeRef = React.useRef(onMetricChange)
  onMetricChangeRef.current = onMetricChange
  const returnFocusTo = React.useCallback(() => selectorRef.current, [])
  React.useEffect(() => { onMetricChangeRef.current?.(metric) }, [metric])
  React.useEffect(() => {
    if (previousInitialMetric.current === initialMetric) return
    previousInitialMetric.current = initialMetric
    if (validMetric(initialMetric)) setMetric(initialMetric)
  }, [initialMetric])
  const option = TREND_METRIC_OPTIONS.find((item) => item.metric === metric)
  if (option === undefined) throw new Error(`Missing trend metric option: ${metric}`)
  const buckets = bucketByMonth(observations, isoToDate(today), 4, metric)
  const hasData = buckets.some(bucket => bucket.kind === "DATA")
  const labels = new Set(buckets.map((bucket) => bucket.label))
  const scoped = observations.filter((observation) => labels.has(observation.loggedOn.slice(0, 7)))
  const coverage = summarizeMetricCoverage(scoped, metric)
  const sourceRefs = buckets.flatMap((bucket) => bucket.sourceRefs)
  const fileDistanceRefs = new Set(scoped.filter(acceptsFileDistance).map(observation => observation.sourceRef))
  const sourceObservations = new Map(scoped.map(observation => [observation.sourceRef, observation]))
  const excludesFilePace = metric === "SECONDS_PER_KM" && scoped.some(observation => (
    observation.sourceRef.sourceKind === "SESSION_RESULT_RECORD"
    && observation.secondsPerKm !== null
    && observation.fieldProvenance.secondsPerKm === "FILE"
  ))
  const isRecoveryMetric = metric === "PAIN_MAX" || metric === "MOOD"
  const onRecord = isRecoveryMetric ? onWriteRecovery : onWriteLog

  return (
    <section className="monthly-trend-section" aria-label="최근 4개월 추이">
      <SectionLb>최근 4개월</SectionLb>
      <div className="monthly-trend-section__heading">
        <div>
          <AppHeading as="h3" variant="section">{metric === "DISTANCE_KM" ? "한 번에 달린 거리" : option.noun}</AppHeading>
          <p>월별 중앙값</p>
        </div>
        <button ref={selectorRef} type="button" className="monthly-trend-section__selector"
          aria-label={`지표 선택: ${option.buttonLabel}`} aria-haspopup="dialog" aria-expanded={selectorOpen}
          onClick={() => setSelectorOpen(true)}>
          <span>{option.buttonLabel}</span><ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {selectorOpen && <MetricSelectorSheet metric={metric} returnFocusTo={returnFocusTo}
        onClose={() => setSelectorOpen(false)} onSelect={next => {
          setMetric(next)
        }} />}

      {excludesFilePace && (
        <div className="monthly-trend-section__scope-note">
          직접 기록 기준 · 파일 페이스 제외
        </div>
      )}

      {hasData ? <MonthlyTrendBars buckets={buckets} metric={metric} metricLabel={option.noun} /> : <div className="monthly-trend-section__start">
        <p>{coverage.excluded > 0
          ? `최근 4개월의 기록은 있지만, 집계에 사용할 ${option.noun} 값을 확인하지 못했어요.`
          : `일지에 남긴 ${option.noun} 값으로 최근 4개월의 변화를 볼 수 있어요.`}</p>
        <div className="monthly-trend-section__start-actions">
          {onRecord && <button type="button" onClick={onRecord}>{isRecoveryMetric ? "몸 상태 기록하기" : "운동 기록하기"}</button>}
          {onShowExample && <button type="button" onClick={onShowExample}>거리 예시 보기</button>}
          {metric === "DISTANCE_KM" && onOpenImport && <button type="button" onClick={onOpenImport}>운동 파일 가져오기</button>}
        </div>
      </div>}

      {(hasData || coverage.excluded > 0) && <div className="monthly-trend-section__status" aria-live="polite">
        집계 사용 {coverage.included}건 · 집계 제외 {coverage.excluded}건
        {buckets.some((bucket) => bucket.kind === "DATA" && bucket.displayStatus === "STALE") && (
          <span> · 오래된 출처가 포함된 달이 있어요.</span>
        )}
        {buckets.some((bucket) => bucket.kind === "DATA" && bucket.displayStatus === "CONFLICTING") && (
          <span> · 출처가 서로 달라 확인이 필요한 달이 있어요.</span>
        )}
        {hasData && buckets.some((bucket) => bucket.kind === "MISSING") && (
          <span> · 기록이 없는 달은 계산하지 않았어요.</span>
        )}
      </div>}

      {hasData && <InfoDisclosure title="월별 수치와 집계 범위 보기" className="monthly-trend-section__details">
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
      </InfoDisclosure>}
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
                <div>{sourceDate(sourceObservations.get(source)?.loggedOn ?? source.observedAt)} · {source.sourceKind === "DAILY_CHECKIN_RECORD" ? "몸 상태 기록" : "운동 기록"} · {metric === "DISTANCE_KM" && fileDistanceRefs.has(source)
                  ? "확인한 파일 거리" : source.trustState === "ACCEPTED" ? "출처 확인" : source.trustState === "STALE" ? "오래된 출처 · 확인 필요" : source.trustState === "CONFLICTING" ? "출처 충돌 · 확인 필요" : "확인 필요"}</div>
                <details className="monthly-trend-section__source-id">
                  <summary>원본 식별 정보</summary>
                  <div>기록 ID: {source.sourceId}</div>
                  {source.sourceVersion && <div>출처 버전: {source.sourceVersion}</div>}
                  {source.observedAt && <div>관측 시각: {source.observedAt}</div>}
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
