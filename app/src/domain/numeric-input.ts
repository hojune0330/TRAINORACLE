import { z } from "zod"

const decimalStringSchema = z.string()
  .trim()
  .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u)
  .transform(Number)
  .pipe(z.number().finite())

export function parseDecimalString(value: string): number | null {
  const parsed = decimalStringSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function parsePaceText(value: string): number | null {
  const match = /^(\d+):(\d{1,2})$/u.exec(value.trim())
  if (match === null) return null
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (seconds >= 60) return null
  const secondsPerKm = minutes * 60 + seconds
  return Number.isSafeInteger(secondsPerKm) && secondsPerKm > 0 ? secondsPerKm : null
}

/**
 * 평균 페이스 표준 표기로 정규화한다 (WORK_ORDER_UX2 §3-2, D-06).
 *
 * 입력 형식은 셋을 받는다:
 *  - "5:30"   → "5'30\""
 *  - "5'30\"" → "5'30\""
 *  - "5.30"   → "5'30\""
 *  - "530"    → "5'30\""
 *  4자리 숫자("530")는 허용하되 3자리("530"은 분=5, 초=30)로 해석한다.
 *
 * ⚠️ 형식 표준화만 한다 — 값 자체(secondsPerKm)는 바꾸지 않는다.
 * NORTH_STAR §3 "60m 미만 스프린트 페이스 환산 금지"와 무관하며,
 * 기존 저장값은 조회 시 표시만 정규화하고 저장 값을 고치지 않는다(마이그레이션 금지).
 */
export function normalizePace(value: string): string | null {
  const raw = value.trim()
  if (raw === "") return null

  let minutes: number
  let seconds: number
  const colon = /^(\d+):(\d{1,2})$/u.exec(raw)
  const quote = /^(\d+)'(\d{1,2})(?:″|")?$/u.exec(raw)
  const dot = /^(\d+)\.(\d{1,2})$/u.exec(raw)
  const bare = /^(\d{3,4})$/u.exec(raw)
  if (colon !== null) {
    minutes = Number(colon[1])
    seconds = Number(colon[2])
  } else if (quote !== null) {
    minutes = Number(quote[1])
    seconds = Number(quote[2])
  } else if (dot !== null) {
    minutes = Number(dot[1])
    seconds = Number(dot[2])
  } else if (bare !== null) {
    const digits = bare[1] ?? ""
    if (digits.length === 4) {
      minutes = Number(digits.slice(0, 2))
      seconds = Number(digits.slice(2))
    } else {
      minutes = Number(digits.slice(0, 1))
      seconds = Number(digits.slice(1))
    }
  } else {
    return null
  }

  if (Number.isNaN(minutes) || Number.isNaN(seconds) || seconds >= 60 || minutes <= 0) return null
  const secondsPerKm = minutes * 60 + seconds
  if (!Number.isSafeInteger(secondsPerKm) || secondsPerKm <= 0) return null
  return `${minutes}'${String(seconds).padStart(2, "0")}"`
}
