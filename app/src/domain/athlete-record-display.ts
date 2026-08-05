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

// 형식뿐 아니라 실재하는 날짜인지까지 확인한다.
//
// 이전에는 정규식만 통과하면 그대로 계산에 넘겼다. 그래서 `2025-13-99`(13월
// 99일)가 "5개월 전"이라는 확신에 찬 라벨을 만들어 냈다. 읽을 수 없는 날짜에
// 숫자를 지어내는 것은 North Star §3 폴백 원칙("실패하면 덜 보여준다")에
// 정면으로 어긋난다.
//
// 도달 가능성 — 과장하지 않고 적는다:
//   현재 저장 경로(`athlete-records.ts`의 `isCalendarDate`)가 이미 달력
//   왕복 검사를 하므로, localStorage를 거쳐 이런 값이 들어오지는 **않는다.**
//   즉 지금 사용자에게 보이는 버그는 아니고, 방어 계층의 구멍이다.
//
// 그럼에도 고치는 이유:
//   `seasonWindowLabel`은 이미 `?? "날짜 확인 필요"` 폴백을 갖고 있다. 즉 이
//   모듈은 "못 읽는 날짜는 확인을 요구한다"고 스스로 선언해 놓고, 월·일이
//   범위를 벗어난 경우에는 그 폴백에 도달하지 못했다. 선언과 구현이 어긋난
//   상태였고, 그 폴백은 사실상 죽은 코드였다. 이 수정으로 살아난다.
//
// 형제 모듈과 검증 강도를 맞춘다(`athlete-records.ts` `isCalendarDate`와 동일한
// UTC 왕복 방식). 두 모듈이 서로 다른 엄격도로 날짜를 받는 상태가 위험하다.
function calendarParts(
  value: string,
): { readonly year: number; readonly month: number; readonly day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const probe = new Date(Date.UTC(year, month - 1, day))
  const exists = (
    probe.getUTCFullYear() === year
    && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day
  )
  return exists ? { year, month, day } : null
}
