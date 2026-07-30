import type { AthleteRecord, RecordPurpose } from "./athlete-records"

export const SEASON_WINDOW_MONTHS = 18

export function elapsedSinceAchieved(
  record: AthleteRecord,
  today: Date,
): { readonly months: number; readonly label: string } | null {
  if (record.achievedOn === null) return null
  const achieved = calendarParts(record.achievedOn)
  if (achieved === null) return null
  let months = (
    (today.getFullYear() - achieved.year) * 12
    + today.getMonth()
    - (achieved.month - 1)
  )
  if (today.getDate() < achieved.day) months -= 1
  const safeMonths = Math.max(0, months)
  return { months: safeMonths, label: elapsedLabel(safeMonths) }
}

export function seasonWindowLabel(
  record: Extract<AthleteRecord, { readonly purpose: "SEASON_BEST" }>,
  today: Date,
): { readonly withinWindow: boolean; readonly label: string } {
  const elapsed = elapsedSinceAchieved(record, today)
  const withinWindow = elapsed !== null && elapsed.months <= SEASON_WINDOW_MONTHS
  const prefix = withinWindow ? "시즌 범위 안" : "시즌 범위 밖"
  return { withinWindow, label: `${prefix} (${elapsed?.label ?? "날짜 확인 필요"})` }
}

export function formatRecordTime(performanceSeconds: number): string {
  const minutes = Math.floor(performanceSeconds / 60)
  const seconds = Number((performanceSeconds - minutes * 60).toFixed(2))
  return `${minutes}분 ${seconds}초`
}

export function recordPurposeLabel(purpose: RecordPurpose): string {
  if (purpose === "PERSONAL_BEST") return "개인 최고"
  if (purpose === "SEASON_BEST") return "시즌 최고"
  if (purpose === "RECENT_RESULT") return "최근 경기"
  return "경기 목표"
}

export function athleteRecordAuthorityCopy(record: AthleteRecord): string {
  if (record.purpose === "RACE_GOAL") {
    return "직접 입력한 목표 · 현재 경기력 기록이 아님"
  }
  if (record.enteredBy === "ATHLETE" && record.verificationState === "SELF_REPORTED") {
    return "직접 입력한 기록"
  }
  if (record.enteredBy === "COACH") return "코치가 입력한 기록"
  if (record.enteredBy === "VERIFIED_IMPORT") return "확인된 가져오기 기록"
  return "검증 상태를 확인할 기록"
}

function elapsedLabel(months: number): string {
  if (months === 0) return "이번 달"
  if (months < 12) return `${months}개월 전`
  const years = Math.floor(months / 12)
  const remainder = months % 12
  return remainder === 0 ? `${years}년 전` : `${years}년 ${remainder}개월 전`
}

function calendarParts(
  value: string,
): { readonly year: number; readonly month: number; readonly day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (match === null) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}
