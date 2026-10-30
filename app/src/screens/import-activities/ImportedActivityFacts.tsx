import type { ImportedActivity } from "../../domain/import/activity-file"
import { toFileObservationSummary } from "../../domain/import/file-observation"

export function importedActivityFactLabels(activity: ImportedActivity) {
  const file = activity.observation
  const summary = file ? toFileObservationSummary(file) : activity
  const meaning = file?.confirmation?.durationMeaning ?? file?.durationMeaning
  const timeLabel = meaning === "TIMER" ? "타이머 시간" : meaning === "MOVING" ? "이동 시간"
    : meaning === "ELAPSED" ? "전체 경과 시간" : "파일의 시간 · 종류 미확인"
  const number = (value: string, unit: string, digits: number) => value === "" || !Number.isFinite(Number(value))
    ? "파일에 없음" : `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: digits })}${unit}`
  return { file, summary, meaning, timeLabel, distance: number(summary.distanceKm, "km", 3), duration: number(summary.durationMin, "분", 2) }
}

/** Display facts and their meaning without promoting them to analysis evidence. */
export function ImportedActivityFacts({ activity }: { readonly activity: ImportedActivity }) {
  const { file, summary, meaning, timeLabel, distance, duration } = importedActivityFactLabels(activity)
  return <div className="import-record-facts">
    <dl>
      <div><dt>거리</dt><dd>{distance}</dd></div>
      <div><dt>{timeLabel}</dt><dd>{duration}</dd></div>
      {file && summary.avgPace !== "" && <div><dt>{timeLabel} 기준 페이스</dt><dd>{summary.avgPace}/km</dd></div>}
    </dl>
    <p className="import-record-facts__source">파일에서 가져옴{file ? ` · ${file.format.toUpperCase()}` : ""}</p>
    {file && <p className="import-record-facts__source">날짜 기준 · {file.timeZone ?? "지역 시간대 미확인"}</p>}
    {file && (meaning === "UNKNOWN" || meaning === "SOURCE_DEFINED") && <p>시간 종류를 몰라도 저장할 수 있어요. 시간 비교와 페이스 계산은 보류해요.</p>}
  </div>
}
