import { useMemo, useState } from "react"
import type { FileObservationV1 } from "../domain/import/file-observation"
import { ACTIVITY_DETAIL_METRICS, type ActivityDetailMetric, type ActivityDetailSample } from "../domain/import/file-activity-detail"
import { AccessibleTrendTable } from "../screens/trends/AccessibleTrendTable"
import { RecordAction, RecordNotice } from "./RecordUI"
import { importedSourceClock, originalQuantity } from "./ImportedActivityMetrics"

export type ActivityChartRange = { readonly sourceIndex: number; readonly startTime: string; readonly endTime: string }
type PlotPoint = { readonly sample: ActivityDetailSample; readonly time: number; readonly value: number }
const PAGE = 20

/** Timestamp spacing is real. Null values/clocks, source segments and reversed clocks break the line. */
function projectChart(samples: readonly ActivityDetailSample[], metric: ActivityDetailMetric) {
  const segments: PlotPoint[][] = []
  let current: PlotPoint[] = []
  let previous: ActivityDetailSample | null = null
  let firstTime = Infinity, lastTime = -Infinity, minimum = Infinity, maximum = -Infinity, count = 0
  for (const sample of samples) {
    const value = sample.metrics[metric]
    const time = sample.timestamp === null ? NaN : Date.parse(sample.timestamp)
    if (value === null || value === undefined || !Number.isFinite(time)) {
      if (current.length) segments.push(current)
      current = []; previous = null; continue
    }
    if (previous && (previous.segmentIndex !== sample.segmentIndex || sample.sourceIndex !== previous.sourceIndex + 1 || time <= Date.parse(previous.timestamp!))) {
      if (current.length) segments.push(current)
      current = []
    }
    current.push({ sample, value, time }); previous = sample
    firstTime = Math.min(firstTime, time); lastTime = Math.max(lastTime, time)
    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); count++
  }
  if (current.length) segments.push(current)
  const x = (time: number) => firstTime === lastTime ? 500 : 10 + (time - firstTime) / (lastTime - firstTime) * 980
  const y = (value: number) => minimum === maximum ? 100 : 190 - (value - minimum) / (maximum - minimum) * 180
  // Reduce only the drawing: each pixel bucket keeps its first/last/min/max in original order.
  // Segment boundaries never share buckets. All source rows remain in the table.
  let plotted = 0
  const path = segments.map(segment => {
    const buckets = new Map<number, PlotPoint[]>()
    for (const point of segment) {
      const bucket = Math.floor(x(point.time))
      const values = buckets.get(bucket)
      if (!values) buckets.set(bucket, [point, point, point, point])
      else { values[1] = point; if (point.value < values[2]!.value) values[2] = point; if (point.value > values[3]!.value) values[3] = point }
    }
    const points = [...buckets.values()].flatMap(values => [...new Set(values)].sort((a, b) => a.sample.sourceIndex - b.sample.sourceIndex))
    plotted += points.length
    return points.map((point, index) => `${index ? "L" : "M"}${x(point.time).toFixed(3)},${y(point.value).toFixed(3)}`).join(" ") + (points.length === 1 ? " l0.01,0" : "")
  }).join(" ")
  return { path, x, y, firstTime, lastTime, minimum, maximum, count, plotted, segments: segments.length }
}

export function ImportedActivitySensorChart(props: {
  readonly range: ActivityChartRange | null; readonly onClearRange: () => void
  readonly timeDescription?: string; readonly sampleClock?: (sample: ActivityDetailSample) => string
  readonly markers?: readonly { readonly timestamp: string; readonly label: string }[]
} & ({ readonly observation: FileObservationV1; readonly samples?: never } | { readonly observation?: never; readonly samples: readonly ActivityDetailSample[] })) {
  const { range, onClearRange } = props
  const allSamples = props.samples ?? props.observation.detail?.samples ?? []
  const sampleClock = props.sampleClock ?? ((sample: ActivityDetailSample) => sample.timestamp ? importedSourceClock(sample.timestamp) : sample.localTimestamp ? `${sample.localTimestamp} · 시간대 미확인` : "시각 미기록")
  const metrics = useMemo(() => (Object.keys(ACTIVITY_DETAIL_METRICS) as ActivityDetailMetric[])
    .filter(metric => allSamples.some(sample => Object.hasOwn(sample.metrics, metric))), [allSamples])
  const [selectedMetric, setSelectedMetric] = useState<ActivityDetailMetric | null>(null)
  const metric = selectedMetric && metrics.includes(selectedMetric) ? selectedMetric : metrics.includes("heartRateBpm") ? "heartRateBpm" : metrics[0] ?? null
  const rangeKey = range ? `${range.sourceIndex}:${range.startTime}:${range.endTime}` : "all"
  const context = `${metric}:${rangeKey}`
  const [selection, setSelection] = useState({ context: "", index: 0 })
  const [tablePage, setTablePage] = useState({ context: "", start: 0 })
  const samples = useMemo(() => range ? allSamples.filter(sample => sample.timestamp !== null
    && Date.parse(sample.timestamp) >= Date.parse(range.startTime) && Date.parse(sample.timestamp) <= Date.parse(range.endTime)) : allSamples, [allSamples, range])
  const graph = useMemo(() => metric ? projectChart(samples, metric) : null, [samples, metric])
  if (!metric || !graph) return <RecordNotice kind="empty" title="센서 표본이 없어요">
    <p>이 기록에는 시간에 따른 측정값이 저장되지 않았어요. 전체 수치와 구간은 그대로 확인할 수 있어요.</p>
  </RecordNotice>
  const definition = ACTIVITY_DETAIL_METRICS[metric]
  const selectedIndex = Math.min(selection.context === context ? selection.index : 0, Math.max(0, samples.length - 1))
  const selected = samples[selectedIndex]
  const selectedValue = selected?.metrics[metric]
  const selectedTime = selected?.timestamp ? Date.parse(selected.timestamp) : NaN
  const start = tablePage.context === context ? tablePage.start : 0
  const visible = samples.slice(start, start + PAGE)
  const choose = (index: number) => setSelection({ context, index })
  return <div className="imported-activity-detail__chart">
    <h4>센서 차트</h4>
    <label className="imported-activity-detail__select">표시할 지표
      <select value={metric} onChange={event => setSelectedMetric(event.target.value as ActivityDetailMetric)}>
        {metrics.map(item => <option key={item} value={item}>{ACTIVITY_DETAIL_METRICS[item].label} · {ACTIVITY_DETAIL_METRICS[item].unit}</option>)}
      </select>
    </label>
    {range && <div className="imported-activity-detail__range"><p>구간 {range.sourceIndex + 1}의 원본 시작·종료 시각 범위</p>
      <p>{importedSourceClock(range.startTime)} → {importedSourceClock(range.endTime)}</p>
      <RecordAction priority="secondary" onClick={onClearRange}>전체 범위 보기</RecordAction></div>}
    <p>{definition.label} · {definition.unit} / 가로축: 실제 표본 시각</p>
    {graph.count > 0 ? <>
      <div className="imported-activity-detail__plot">
        <div className="imported-activity-detail__axis" aria-hidden="true"><span>{String(graph.maximum)}</span><span>{String(graph.minimum)}</span></div>
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" role="img"
          aria-label={`${definition.label} 차트. 시각이 있는 측정값 ${graph.count}개, 최저 ${graph.minimum}, 최고 ${graph.maximum} ${definition.unit}. ${samples.length - graph.count}개는 값 또는 시각 미확인. 원본 수치는 표로 볼 수 있어요.`}>
          <path data-testid="activity-sensor-path" d={graph.path} className="imported-activity-detail__trace" vectorEffect="non-scaling-stroke" />
          {props.markers?.filter(marker => Date.parse(marker.timestamp) >= graph.firstTime && Date.parse(marker.timestamp) <= graph.lastTime).map((marker, index) =>
            <line key={index} data-testid="activity-source-marker" aria-label={marker.label} x1={graph.x(Date.parse(marker.timestamp))} x2={graph.x(Date.parse(marker.timestamp))} y1="0" y2="200" className="imported-activity-detail__source-marker" vectorEffect="non-scaling-stroke" />)}
          {selectedValue !== undefined && selectedValue !== null && Number.isFinite(selectedTime) && <line data-testid="activity-sensor-selection"
            x1={graph.x(selectedTime)} x2={graph.x(selectedTime)} y1="0" y2="200" className="imported-activity-detail__cursor" vectorEffect="non-scaling-stroke" />}
        </svg>
      </div>
      <div className="imported-activity-detail__clock-range"><time dateTime={new Date(graph.firstTime).toISOString()}>{importedSourceClock(new Date(graph.firstTime).toISOString())}</time>
        <time dateTime={new Date(graph.lastTime).toISOString()}>{importedSourceClock(new Date(graph.lastTime).toISOString())}</time></div>
      <p>{props.timeDescription ?? "차트의 시각은 UTC로 맞췄어요. 선택한 표본과 표에는 파일의 원래 시각을 표시해요."}</p>
      {!!props.markers?.length && <p>점선은 원본에 표시된 구간 시작이에요. 종료 시각이나 구간 시간을 새로 계산하지 않아요.</p>}
      {graph.plotted < graph.count && <p>화면에는 표시용 요약 {graph.plotted}점을 그려요. 각 표시 구간의 최저·최고와 단절을 유지하며, 원본 {graph.count}개는 표에서 모두 확인할 수 있어요.</p>}
    </> : <p>값과 정확한 시각이 함께 있는 표본이 없어 차트를 그리지 않았어요. 원본 값은 아래 표에서 확인할 수 있어요.</p>}
    <p>{samples.length}개 표본 중 값·시각 미확인 {samples.length - graph.count}개. 빈 값과 다른 원본 구간 사이에는 선을 잇지 않아요. 원인이 일시정지인지는 단정하지 않아요.</p>
    {selected && <div className="imported-activity-detail__sample">
      <label>표본 선택 · {selectedIndex + 1} / {samples.length}
        <input aria-label="센서 표본 선택" type="range" min="0" max={Math.max(0, samples.length - 1)} step="1" value={selectedIndex}
          disabled={samples.length < 2} onChange={event => choose(Number(event.target.value))} />
      </label>
      <p aria-live="polite">{sampleClock(selected)} · {originalQuantity(selectedValue, definition.unit)}</p>
      <div className="imported-activity-detail__pager">
        <RecordAction priority="secondary" disabled={selectedIndex === 0} onClick={() => choose(selectedIndex - 1)}>이전 표본</RecordAction>
        <RecordAction priority="secondary" disabled={selectedIndex + 1 >= samples.length} onClick={() => choose(selectedIndex + 1)}>다음 표본</RecordAction>
      </div>
    </div>}
    <div className="imported-activity-detail__sample-table">
      <AccessibleTrendTable caption={`${definition.label} 원본 표본`} rows={visible.map(sample => ({ key: String(sample.sourceIndex),
        label: `표본 ${sample.sourceIndex + 1} · ${sampleClock(sample)}`,
        value: `${originalQuantity(sample.metrics[metric], definition.unit)} · 원본 구간 ${sample.segmentIndex + 1}` }))} />
      <p>전체 {samples.length}개 중 {samples.length ? start + 1 : 0}–{Math.min(start + PAGE, samples.length)}개 표시</p>
      {samples.length > PAGE && <div className="imported-activity-detail__pager">
        <RecordAction priority="secondary" disabled={start === 0} onClick={() => setTablePage({ context, start: Math.max(0, start - PAGE) })}>이전 표본 표</RecordAction>
        <RecordAction priority="secondary" disabled={start + PAGE >= samples.length} onClick={() => setTablePage({ context, start: start + PAGE })}>다음 표본 표</RecordAction>
      </div>}
    </div>
  </div>
}
