// dates — 표시용 날짜 헬퍼 (실데이터 표면 공용, F0-d).
// 저장 포맷은 journal-store의 YYYY-MM-DD 단일 소스. 여기는 표시 변환만 담당.

const DOW_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const

export function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** ISO 날짜에 일수 더하기/빼기 */
export function isoShift(iso: string, days: number): string {
  const d = isoToDate(iso)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  if (year === undefined || month === undefined || day === undefined) return false

  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
}

/** "2026 · 07 · 10" — IndexCard 헤더용 */
export function cardDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${y} · ${m} · ${d}`
}

/** "2026·07·10" — 컴팩트 표기 */
export function compactDate(iso: string): string {
  return iso.replaceAll("-", "·")
}

/** "FRI" 등 영문 요일 */
export function dowOf(iso: string): string {
  return DOW_EN[isoToDate(iso).getDay()] ?? ""
}

/** "2026 summer" — 시즌 라벨 (월 기준 단순 계산) */
export function seasonOf(iso: string): string {
  const m = isoToDate(iso).getMonth() + 1
  const s = m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "autumn" : "winter"
  return `${iso.slice(0, 4)} ${s}`
}

/** "18:42" — 현재 시각 */
export function nowClock(): string {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 해당 날짜가 속한 주의 월요일 ISO */
export function weekStartOf(iso: string): string {
  const shift = (isoToDate(iso).getDay() + 6) % 7 // Mon=0
  return isoShift(iso, -shift)
}
