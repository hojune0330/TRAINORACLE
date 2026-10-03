import {
  athleteRecordAuthorityCopy,
  elapsedSinceAchieved,
  formatRecordTime,
  recordPurposeLabel,
  seasonWindowLabel,
} from "../../domain/athlete-records"
import type { AthleteRecord } from "../../domain/athlete-records"

export function AthleteRecordRow({ record, onUsePace }: { readonly record: AthleteRecord; readonly onUsePace?: () => void }) {
  const today = new Date()
  const elapsed = elapsedSinceAchieved(record, today)
  const season = record.purpose === "SEASON_BEST"
    ? seasonWindowLabel(record, today)
    : null
  return (
    <li className="athlete-record-row">
      <strong>
        {record.eventDistanceM}m · {formatRecordTime(record.performanceSeconds)}
        {" · "}{recordPurposeLabel(record.purpose)}
      </strong>
      <span>
        {record.achievedOn !== null && `${record.achievedOn} · ${elapsed?.label} · `}
        {athleteRecordAuthorityCopy(record)}
      </span>
      {record.purpose === "SEASON_BEST" && (
        <small>{record.seasonId} · {season?.label}</small>
      )}
      {onUsePace && <button type="button" className="plan-text-action" onClick={onUsePace}>이 기록으로 페이스 변경 보기</button>}
    </li>
  )
}
