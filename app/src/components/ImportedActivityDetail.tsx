import { useEffect, useId, useState, type KeyboardEvent } from "react"
import type { FileObservationV1 } from "../domain/import/file-observation"
import { fileDuration, fileNumber } from "../screens/trends/file-analysis-display"
import { RecordAction, RecordNotice, RecordSource } from "./RecordUI"
import { ImportedActivitySensorChart, type ActivityChartRange } from "./ImportedActivitySensorChart"
import { ImportedActivityRoute } from "./ImportedActivityRoute"
import { ImportedActivityMetrics, ImportedActivityMetricRows, importedSourceClock, activityDistance, activityDuration } from "./ImportedActivityMetrics"
import "./imported-activity-detail.css"

const SPORT: Record<FileObservationV1["sport"], string> = {
  RUNNING: "달리기", WALKING: "걷기", CYCLING: "자전거", OTHER: "그 밖의 운동", UNKNOWN: "종류 미확인",
}
const TIME: Record<FileObservationV1["durationMeaning"], string> = {
  TIMER: "타이머 시간 · 일시정지 제외", MOVING: "이동 시간", ELAPSED: "전체 경과 시간 · 멈춘 시간 포함",
  SOURCE_DEFINED: "파일 시간 · 종류 미지정", UNKNOWN: "시간 종류 미확인",
}
const LAP_TIME: Record<FileObservationV1["durationMeaning"], string> = {
  TIMER: "타이머 시간", MOVING: "이동 시간", ELAPSED: "전체 경과 시간",
  SOURCE_DEFINED: "종류 미지정", UNKNOWN: "종류 미확인",
}
const LAP_KIND = { WORK: "운동", RECOVERY: "회복", UNKNOWN: "종류 미지정" } as const
const ORIGIN: Record<NonNullable<FileObservationV1["dataLineage"]>["sources"][number]["originProvider"], string> = {
  GARMIN: "Garmin", COROS: "COROS", APPLE: "Apple", SAMSUNG: "Samsung", WHOOP: "WHOOP",
  USER: "사용자", OTHER: "기타 원천", UNKNOWN: "원천 미확인",
}
const PAGE_SIZE = 20

function OriginalLaps({ observation, onRange }: { readonly observation: FileObservationV1; readonly onRange: (range: ActivityChartRange) => void }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const tableId = useId()
  const { laps, completeness } = observation
  if (laps.length === 0) return <RecordNotice kind="empty" title="구간 기록이 없어요">
    <p>구간별 거리와 시간을 표시할 자료가 없어요.</p>
  </RecordNotice>
  const shown = Math.min(limit, laps.length)
  const remaining = laps.length - shown
  const confirmedMeaning = observation.confirmation?.durationMeaning
  return <div className="imported-activity-detail__laps">
    <h4>구간 {laps.length}개</h4>
    <p>파일에 담긴 순서와 구간 종류예요.</p>
    {confirmedMeaning && laps.some(lap => lap.durationMeaning !== confirmedMeaning)
      && <p>전체 시간에 고른 기준과 구간 원본의 시간 종류는 따로 표시해요.</p>}
    {(completeness.missingDistanceLaps > 0 || completeness.missingDurationLaps > 0) && <p className="imported-activity-detail__missing">
      {[completeness.missingDistanceLaps > 0 ? `거리 미기록 ${completeness.missingDistanceLaps}개` : null,
        completeness.missingDurationLaps > 0 ? `시간 미기록 ${completeness.missingDurationLaps}개` : null].filter(Boolean).join(" · ")}
      <br />미기록 항목은 0이나 일부 구간의 합계로 채우지 않아요.
    </p>}
    <table id={tableId} className="imported-activity-detail__table">
      <caption>파일의 구간 기록 · 원본 순서</caption>
      <colgroup><col className="imported-activity-detail__lap-column" /><col className="imported-activity-detail__distance-column" /><col /></colgroup>
      <thead><tr><th scope="col">구간 · 종류</th><th scope="col">거리</th><th scope="col">원본 시간</th></tr></thead>
      <tbody>{laps.slice(0, shown).map(lap => {
        const interval = observation.detail?.laps.find(value => value.sourceIndex === lap.sourceIndex)
        const range = interval?.startTime && interval.endTime && Date.parse(interval.endTime) >= Date.parse(interval.startTime)
          ? { sourceIndex: lap.sourceIndex, startTime: interval.startTime, endTime: interval.endTime } : null
        const canExplore = range && observation.detail?.samples.some(sample => sample.timestamp !== null
          && Date.parse(sample.timestamp) >= Date.parse(range.startTime) && Date.parse(sample.timestamp) <= Date.parse(range.endTime)
          && Object.values(sample.metrics).some(value => value !== null))
        return <tr key={lap.sourceIndex}>
        <th scope="row"><span>{lap.sourceIndex + 1}</span><small>{LAP_KIND[lap.kind]}</small>
          {canExplore && <button type="button" className="imported-activity-detail__lap-link"
            onClick={() => onRange(range)} aria-label={`구간 ${lap.sourceIndex + 1} 차트 보기`}>차트 보기</button>}
        </th>
        <td><span className="imported-activity-detail__value">{lap.distanceMeters === null ? "미기록" : `${fileNumber(lap.distanceMeters)}m`}</span></td>
        <td><span className="imported-activity-detail__value">{fileDuration(lap.durationSeconds)}</span><small>{LAP_TIME[lap.durationMeaning]}</small>
          {interval?.startTime && <small>시작 <time dateTime={interval.startTime}>{importedSourceClock(interval.startTime)}</time></small>}
          {interval?.endTime && <small>종료 <time dateTime={interval.endTime}>{importedSourceClock(interval.endTime)}</time></small>}
          {interval?.trigger && <small>원본 구간 표시: {interval.trigger}</small>}
        </td>
      </tr>})}</tbody>
    </table>
    {observation.detail?.laps.slice(0, shown).some(lap => lap.summary.length > 0) && <details className="imported-activity-detail__lap-metrics">
      <summary>표시 중인 구간의 추가 수치</summary>
      {observation.detail.laps.slice(0, shown).filter(lap => lap.summary.length > 0).map(lap =>
        <ImportedActivityMetricRows key={lap.sourceIndex} values={lap.summary} caption={`구간 ${lap.sourceIndex + 1} 원본 수치`} />)}
    </details>}
    <p className="imported-activity-detail__page" aria-live="polite">전체 {laps.length}개 중 {shown}개 표시</p>
    {remaining > 0 && <RecordAction priority="secondary" aria-controls={tableId}
      onClick={() => setLimit(previous => Math.min(previous + PAGE_SIZE, laps.length))}>
      구간 {Math.min(PAGE_SIZE, remaining)}개 더 보기
    </RecordAction>}
  </div>
}

/** Stored file facts only. Reading never saves, confirms, or grants analysis permission. */
export function ImportedActivityDetail({ observation }: { readonly observation: FileObservationV1 }) {
  return <ActivityDetail key={`${observation.sourceObservationKey}:${observation.contentRevisionFingerprint}`} observation={observation} />
}

const VIEWS = [{ id: "summary", label: "요약" }, { id: "metrics", label: "전체 수치" },
  { id: "laps", label: "구간" }, { id: "chart", label: "차트" }] as const
type DetailView = typeof VIEWS[number]["id"]

function ActivityDetail({ observation }: { readonly observation: FileObservationV1 }) {
  const titleId = useId()
  const [view, setView] = useState<DetailView>("summary")
  const [range, setRange] = useState<ActivityChartRange | null>(null)
  useEffect(() => { if (range) document.getElementById(`${titleId}-chart`)?.focus() }, [range, titleId])
  const confirmedMeaning = observation.confirmation?.durationMeaning
  const effectiveMeaning = confirmedMeaning ?? observation.durationMeaning
  const confirmedSport = observation.confirmation?.sport
  const origins = observation.dataLineage
    ? [...new Set(observation.dataLineage.sources.map(source => ORIGIN[source.originProvider]))].join(" · ")
    : observation.detail ? ORIGIN[observation.detail.source.originProvider] : "원천 미확인"
  const source = observation.detail?.source
  const tabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "ArrowRight" ? (index + 1) % VIEWS.length
      : event.key === "ArrowLeft" ? (index + VIEWS.length - 1) % VIEWS.length
        : event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : null
    if (next === null) return
    event.preventDefault()
    const destination = VIEWS[next]!
    setView(destination.id)
    document.getElementById(`${titleId}-${destination.id}`)?.focus()
  }
  return <section className="imported-activity-detail record-ui" aria-labelledby={titleId}>
    <h3 id={titleId}>파일 기록 상세</h3>
    <div className="imported-activity-detail__tabs" role="tablist" aria-label="운동 상세 보기">
      {VIEWS.map((item, index) => <button key={item.id} type="button" className="app-choice-control"
        role="tab" id={`${titleId}-${item.id}`} aria-selected={view === item.id}
        aria-controls={`${titleId}-panel-${item.id}`} tabIndex={view === item.id ? 0 : -1}
        onKeyDown={event => tabKey(event, index)} onClick={() => setView(item.id)}>{item.label}</button>)}
    </div>
    <div id={`${titleId}-panel-summary`} role="tabpanel" aria-labelledby={`${titleId}-summary`} hidden={view !== "summary"}>
    <dl className="imported-activity-detail__context">
      <div><dt>거리</dt><dd>{activityDistance(observation.distanceMeters)}</dd></div>
      <div><dt>{TIME[effectiveMeaning]}</dt><dd>{activityDuration(observation.durationSeconds)}</dd></div>
    </dl>
    <RecordSource source="파일에서 가져옴" format={observation.format.toUpperCase()}
      dateBasis={observation.timeZone ?? "지역 시간대 미확인 · 파일 날짜 유지"}
      originalTimeMeaning={TIME[observation.durationMeaning]}
      {...(confirmedMeaning ? { confirmedTimeMeaning: TIME[confirmedMeaning] } : {})} />
    <dl className="imported-activity-detail__context">
      <div><dt>표기된 원천</dt><dd>{origins}</dd></div>
      <div><dt>일지 날짜</dt><dd><time dateTime={observation.date}>{observation.date}</time></dd></div>
      <div><dt>파일의 운동 시작</dt><dd>{observation.startedAt
        ? <time dateTime={observation.startedAt}>{importedSourceClock(observation.startedAt)}</time>
        : "정확한 시작 시각 미기록"}</dd></div>
      <div><dt>파일의 운동 종류</dt><dd>{SPORT[observation.sport]}</dd></div>
      {confirmedSport && <div><dt>내가 확인한 운동</dt><dd>{SPORT[confirmedSport]}</dd></div>}
      {source && <><div><dt>파일의 제조사 표기</dt><dd>{source.manufacturer ?? "미기록"}</dd></div>
        <div><dt>파일의 기기 표기</dt><dd>{source.product ?? "미기록"}</dd></div></>}
      <div><dt>저장된 자료</dt><dd>원본 구간 {observation.laps.length}개 · 센서 표본 {observation.detail?.samples.length ?? 0}개</dd></div>
    </dl>
    {(observation.dataLineage || observation.detail) && <p>원천은 기록에 저장된 표기이며, 제공자 인증 여부를 뜻하지 않아요.</p>}
    {(effectiveMeaning === "SOURCE_DEFINED" || effectiveMeaning === "UNKNOWN") && <p>
      시간 종류가 미확정이라 시간 비교와 페이스 계산은 보류해요.
    </p>}
    {!observation.detail && <p>이 기록에는 센서 표본이 저장되지 않았어요. 원본 파일에 자료가 있다면 다시 가져올 수 있어요.</p>}
    </div>
    <div id={`${titleId}-panel-metrics`} role="tabpanel" aria-labelledby={`${titleId}-metrics`} hidden={view !== "metrics"}>
      {view === "metrics" && <ImportedActivityMetrics observation={observation} />}
    </div>
    <div id={`${titleId}-panel-laps`} role="tabpanel" aria-labelledby={`${titleId}-laps`} hidden={view !== "laps"}>
      <OriginalLaps observation={observation} onRange={next => { setRange(next); setView("chart") }} />
    </div>
    <div id={`${titleId}-panel-chart`} role="tabpanel" aria-labelledby={`${titleId}-chart`} hidden={view !== "chart"}>
      <ImportedActivitySensorChart observation={observation} range={range} onClearRange={() => setRange(null)} />
      <ImportedActivityRoute samples={observation.detail?.samples ?? []} />
    </div>
  </section>
}
