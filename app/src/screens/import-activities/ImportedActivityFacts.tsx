import type { ImportedActivity } from "../../domain/import/activity-file"
import { toFileObservationSummary } from "../../domain/import/file-observation"
import { RecordMetrics, RecordSource } from "../../components/RecordUI"

const durationLabel = (meaning: string | undefined) => meaning === "TIMER" ? "타이머 시간" : meaning === "MOVING" ? "이동 시간"
  : meaning === "ELAPSED" ? "전체 경과 시간" : "파일의 시간 · 종류 미확인"

export function importedActivityFactLabels(activity: ImportedActivity) {
  const file = activity.observation
  const summary = file ? toFileObservationSummary(file) : activity
  const meaning = file?.confirmation?.durationMeaning ?? file?.durationMeaning
  const timeLabel = durationLabel(meaning)
  const number = (value: string, unit: string, digits: number) => value === "" || !Number.isFinite(Number(value))
    ? "파일에 없음" : `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: digits })}${unit}`
  return { file, summary, meaning, timeLabel, distance: number(summary.distanceKm, "km", 3), duration: number(summary.durationMin, "분", 2) }
}

/** Display facts and their meaning without promoting them to analysis evidence. */
export function ImportedActivityFacts({ activity, showTimeNotice = true, compact = false }: { readonly activity: ImportedActivity; readonly showTimeNotice?: boolean; readonly compact?: boolean }) {
  const { file, summary, meaning, timeLabel, distance, duration } = importedActivityFactLabels(activity)
  const unknownTime = meaning !== "TIMER" && meaning !== "MOVING" && meaning !== "ELAPSED"
  return <div className="import-record-facts">
    <RecordMetrics category="record" items={[
      { id: "distance", label: "거리", value: distance },
      { id: "duration", label: compact && unknownTime ? "파일 시간" : timeLabel, value: duration,
        ...(compact && unknownTime ? { detail: "종류 미확인" } : {}) },
      ...(file && summary.avgPace !== "" ? [{ id: "pace", label: `${timeLabel} 기준 페이스`, value: `${summary.avgPace}/km` }] : []),
    ]} />
    <RecordSource source="파일에서 가져옴" {...(file ? { format: file.format.toUpperCase(), dateBasis: file.timeZone ?? "지역 시간대 미확인" } : {})}
      {...(file?.confirmation?.durationMeaning ? { originalTimeMeaning: durationLabel(file.durationMeaning), confirmedTimeMeaning: timeLabel } : {})} />
    {showTimeNotice && file && (meaning === "UNKNOWN" || meaning === "SOURCE_DEFINED") && <p>시간 종류를 몰라도 저장할 수 있어요. 시간 비교와 페이스 계산은 보류해요.</p>}
  </div>
}
