import { z } from "zod"

/**
 * 사람이 한 번의 훈련에서 달릴 수 있는 거리 상한(km).
 *
 * 250km로 잡은 이유: 100마일(약 161km)은 흔한 울트라 종목이고, 그보다 긴
 * 대회도 있다. 실제 기록을 막지 않으려면 넉넉해야 한다. 반대로 상한이
 * 없으면 오타 하나가 주간 합계를 10억 km로 만든다(수정 전 실측).
 *
 * 이 값을 넘는 입력은 **거부**한다 — 잘라내지(clamp) 않는다. 잘라내면
 * 사용자가 적지 않은 숫자를 앱이 만들어낸 셈이 되고, 그건 "꾸며낸 값을
 * 분석에 넣지 않는다"는 원칙을 어긴다.
 */
export const MAX_DISTANCE_KM = 1000

/**
 * 한 번의 훈련 시간 상한(분). 100마일 완주는 24시간(1440분)을 넘기기도
 * 하므로 그보다 넉넉하게 둔다.
 */
export const MAX_DURATION_MIN = 3000

/**
 * 페이스 상한(초/km). 1km에 30분이면 걷기보다 느리다 — 그보다 느린 값은
 * 훈련 기록이 아니라 입력 실수로 본다.
 */
export const MAX_PACE_SECONDS_PER_KM = 30 * 60

const decimalStringSchema = z.string()
  .trim()
  .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u)
  .transform(Number)
  .pipe(z.number().finite())

/**
 * 소수 문자열을 숫자로 바꾼다 — **형식만** 본다.
 *
 * 범위 판단은 하지 않는다. 이 함수는 "이 문자열이 숫자인가"에만 답하고,
 * "그 숫자가 사람이 낼 수 있는 값인가"는 `parseDistanceKm` 같은 전용
 * 함수가 판단한다. 둘을 섞으면 페이스 계산처럼 다른 범위를 쓰는 곳에서
 * 잘못 막힌다.
 */
export function parseDecimalString(value: string): number | null {
  const parsed = decimalStringSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** 0보다 크고 상한 이하인 값만 통과시킨다. 벗어나면 null(거부). */
function inRange(value: number | null, max: number): number | null {
  if (value === null) return null
  if (value <= 0) return null
  if (value > max) return null
  return value
}

/**
 * 거리(km) 입력. 0 이하이거나 `MAX_DISTANCE_KM`를 넘으면 null.
 *
 * 집계·추이에 들어가는 거리는 반드시 이 함수를 통과해야 한다.
 * `parseDecimalString`을 직접 쓰면 음수와 거대값이 합계에 섞인다.
 */
export function parseDistanceKm(value: string): number | null {
  return inRange(parseDecimalString(value), MAX_DISTANCE_KM)
}

/** 시간(분) 입력. 0 이하이거나 `MAX_DURATION_MIN`을 넘으면 null. */
export function parseDurationMin(value: string): number | null {
  return inRange(parseDecimalString(value), MAX_DURATION_MIN)
}

/**
 * "분:초" 페이스를 초/km로 바꾼다.
 * 0 이하이거나 `MAX_PACE_SECONDS_PER_KM`를 넘으면 null.
 */
export function parsePaceText(value: string): number | null {
  const match = /^(\d+):(\d{1,2})$/u.exec(value.trim())
  if (match === null) return null
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (seconds >= 60) return null
  const secondsPerKm = minutes * 60 + seconds
  if (!Number.isSafeInteger(secondsPerKm)) return null
  return inRange(secondsPerKm, MAX_PACE_SECONDS_PER_KM)
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
