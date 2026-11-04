import { useMemo, useState } from "react"
import type { ActivityDetailSample } from "../domain/import/file-activity-detail"
import { AccessibleTrendTable } from "../screens/trends/AccessibleTrendTable"
import { importedSourceClock, originalQuantity } from "./ImportedActivityMetrics"
import { RecordAction } from "./RecordUI"

type Point = { sample: ActivityDetailSample; longitude: number; latitude: number }
function routeProjection(samples: readonly ActivityDetailSample[]) {
  const segments: Point[][] = [], points: Point[] = []
  let segment: Point[] = [], previous: ActivityDetailSample | null = null
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const sample of samples) {
    const position = sample.position
    if (!position || !Number.isFinite(position.latitudeDegrees) || !Number.isFinite(position.longitudeDegrees)) {
      if (segment.length) segments.push(segment)
      segment = []; previous = null; continue
    }
    const point = { sample, longitude: position.longitudeDegrees, latitude: position.latitudeDegrees }
    minLon = Math.min(minLon, point.longitude); maxLon = Math.max(maxLon, point.longitude)
    minLat = Math.min(minLat, point.latitude); maxLat = Math.max(maxLat, point.latitude); points.push(point)
    const clock = sample.timestamp ? Date.parse(sample.timestamp) : NaN
    const previousClock = previous?.timestamp ? Date.parse(previous.timestamp) : NaN
    const continuous = previous && previous.sourceIndex + 1 === sample.sourceIndex && previous.segmentIndex === sample.segmentIndex
      && Number.isFinite(clock) && Number.isFinite(previousClock) && clock > previousClock
      && Math.abs(previous.position!.longitudeDegrees - point.longitude) <= 180
    if (!continuous && segment.length) { segments.push(segment); segment = [] }
    segment.push(point); previous = sample
  }
  if (segment.length) segments.push(segment)
  const span = Math.max(maxLon - minLon, maxLat - minLat)
  const x = (longitude: number) => span === 0 ? 180 : 180 + (longitude - (minLon + maxLon) / 2) / span * 320
  const y = (latitude: number) => span === 0 ? 180 : 180 - (latitude - (minLat + maxLat) / 2) / span * 320
  let displayed = 0
  const path = segments.map(values => {
    // Adjacent subpixel positions may be represented by their first and last point.
    // This never crosses source/time gaps; the table retains every original point.
    const output: Point[] = []
    let bucket = "", last: Point | null = null
    for (const point of values) {
      const key = `${Math.floor(x(point.longitude))}:${Math.floor(y(point.latitude))}`
      if (key !== bucket) { if (last && output.at(-1) !== last) output.push(last); output.push(point); bucket = key }
      last = point
    }
    if (last && output.at(-1) !== last) output.push(last)
    displayed += output.length
    return output.map((point, index) => `${index ? "L" : "M"}${x(point.longitude).toFixed(3)},${y(point.latitude).toFixed(3)}`).join(" ")
      + (output.length === 1 || output.every(point => point.longitude === output[0]!.longitude && point.latitude === output[0]!.latitude) ? " l0.01,0" : "")
  }).join(" ")
  return { points, path, displayed, segmentCount: segments.length, x, y, stationary: span === 0 }
}

/** Local coordinate diagram only: no tile service, coordinate transmission or route inference. */
export function ImportedActivityRoute({ samples, sampleClock }: { readonly samples: readonly ActivityDetailSample[]; readonly sampleClock?: (sample: ActivityDetailSample) => string }) {
  const route = useMemo(() => routeProjection(samples), [samples]), [selectedIndex, setSelectedIndex] = useState(0), [start, setStart] = useState(0)
  if (!route.points.length) return null
  const selected = route.points[Math.min(selectedIndex, route.points.length - 1)]!
  const clock = sampleClock ?? ((sample: ActivityDetailSample) => sample.timestamp ? importedSourceClock(sample.timestamp) : sample.localTimestamp ? `${sample.localTimestamp} · 시간대 미확인` : "시각 미기록")
  return <section className="imported-activity-detail__route" aria-label="원본 위치 경로 개요">
    <h4>위치 경로 개요</h4>
    <p>외부 지도를 부르지 않고 원본 경도·위도를 그려요. 거리·방향을 계산하는 지도는 아니에요. 시각·좌표가 없거나 원본 구간이 바뀌면 선을 끊어요.</p>
    <svg viewBox="0 0 360 360" role="img" aria-label={`위치 표본 ${route.points.length}개, 분리된 경로 ${route.segmentCount}개. ${route.stationary ? "모든 좌표가 같은 위치예요." : "원본 좌표는 아래 표에서 확인할 수 있어요."}`}>
      <path data-testid="activity-route-path" d={route.path} className="imported-activity-detail__trace" vectorEffect="non-scaling-stroke" />
      <circle cx={route.x(selected.longitude)} cy={route.y(selected.latitude)} r="4" className="imported-activity-detail__route-selected" />
    </svg>
    <p>위쪽: 위도 증가 · 오른쪽: 경도 증가{route.stationary ? " · 같은 위치만 기록됨" : ""}</p>
    {route.displayed < route.points.length && <p>화면용으로 겹친 점을 줄였어요. 원본 {route.points.length}개는 좌표 표에 그대로 있어요.</p>}
    <div className="imported-activity-detail__sample"><label>위치 표본 선택 · {selectedIndex + 1} / {route.points.length}<input type="range" aria-label="위치 표본 선택" min="0" max={route.points.length - 1} step="1" disabled={route.points.length === 1} value={selectedIndex} onChange={event => setSelectedIndex(Number(event.target.value))} /></label>
      <p aria-live="polite">{clock(selected.sample)} · 위도 {originalQuantity(selected.latitude, "°")} · 경도 {originalQuantity(selected.longitude, "°")}</p></div>
    <div className="imported-activity-detail__sample-table"><AccessibleTrendTable caption="원본 좌표 표" rows={route.points.slice(start, start + 20).map(point => ({ key: String(point.sample.sourceIndex), label: `표본 ${point.sample.sourceIndex + 1} · ${clock(point.sample)}`, value: `위도 ${originalQuantity(point.latitude, "°")} · 경도 ${originalQuantity(point.longitude, "°")}` }))} />
      <p>전체 {route.points.length}개 중 {start + 1}–{Math.min(start + 20, route.points.length)}개 표시</p>
      {route.points.length > 20 && <div className="imported-activity-detail__pager"><RecordAction priority="secondary" disabled={start === 0} onClick={() => setStart(value => Math.max(0, value - 20))}>이전 좌표 표</RecordAction><RecordAction priority="secondary" disabled={start + 20 >= route.points.length} onClick={() => setStart(value => value + 20)}>다음 좌표 표</RecordAction></div>}
    </div>
  </section>
}
