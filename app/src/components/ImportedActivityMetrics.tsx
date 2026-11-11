import type { FileObservationV1 } from "../domain/import/file-observation"
import { ACTIVITY_DETAIL_METRICS, type ActivityDetailSummary } from "../domain/import/file-activity-detail"

const STATISTIC = { TOTAL: "합계", AVERAGE: "평균", MAXIMUM: "최대", MINIMUM: "최소", SOURCE: "원본 값" } as const
const TIME = { ELAPSED: "전체 경과 시간", TIMER: "타이머 시간", MOVING: "이동 시간", SOURCE_DEFINED: "파일 시간 · 종류 미지정", UNKNOWN: "시간 종류 미확인" } as const

/** Keep the stored precision and unit. Display never recalculates a source average. */
export const originalQuantity = (value: number | null | undefined, unit: string) => value === null || value === undefined ? "미기록" : `${String(value)} ${unit}`
export const importedSourceClock = (timestamp: string) => timestamp.replace("T", " ").replace(/(Z|[+-]\d{2}:\d{2})$/, (_, offset: string) => ` UTC${offset === "Z" ? "+00:00" : offset}`)

export function ImportedActivityMetricRows({ values, caption }: { readonly values: ActivityDetailSummary; readonly caption: string }) {
  return <table className="imported-activity-detail__table imported-activity-detail__metrics">
    <caption>{caption}</caption>
    <thead><tr><th scope="col">원본 항목</th><th scope="col">값 · 단위</th></tr></thead>
    <tbody>{values.map((item, index) => <tr key={`${item.metric}-${item.statistic}-${item.sourceField}-${index}`}>
      <th scope="row">{ACTIVITY_DETAIL_METRICS[item.metric].label} · {STATISTIC[item.statistic]}<small>{item.sourceField}</small></th>
      <td>{originalQuantity(item.value, ACTIVITY_DETAIL_METRICS[item.metric].unit)}</td>
    </tr>)}</tbody>
  </table>
}

export function ImportedActivityMetrics({ observation }: { readonly observation: FileObservationV1 }) {
  const summaries = observation.detail?.summary ?? []
  return <div className="imported-activity-detail__metrics-panel">
    <h4>전체 수치</h4>
    <p>저장된 원본 정밀도와 단위로 표시해요. 평균·최대·합계는 서로 다른 값이에요.</p>
    <dl className="imported-activity-detail__context">
      <div><dt>파일 전체 거리</dt><dd>{originalQuantity(observation.distanceMeters, "m")}</dd></div>
      <div><dt>{TIME[observation.durationMeaning]}</dt><dd>{originalQuantity(observation.durationSeconds, "s")}</dd></div>
    </dl>
    {summaries.length > 0 ? <ImportedActivityMetricRows values={summaries} caption="파일이 제공한 요약 수치" />
      : <p>파일에 별도의 요약 수치가 없어요. 센서 표본이 있으면 차트에서 확인할 수 있어요.</p>}
    {summaries.some(item => item.metric === "runCadence" || item.metric === "cadenceRpm") && <p>케이던스는 파일의 단위를 유지해요. 걸음 수로 바꾸거나 두 배로 환산하지 않아요.</p>}
  </div>
}

/** Presentation conversion only: the original value remains in the source table. */
export function activityDistance(value: number | null | undefined) {
  return value == null ? "미기록" : value >= 1000 ? (value / 1000).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + " km" : value.toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + " m"
}
export function activityDuration(value: number | null | undefined) {
  if (value == null) return "미기록"
  const seconds = Math.round(value), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60)
  return (hours ? hours + "시간 " : "") + minutes + "분 " + seconds % 60 + "초"
}
export function activityPace(minutes: number | null | undefined) {
  if (minutes == null) return "미기록"
  const seconds = Math.round(minutes * 60)
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0") + " /km"
}
