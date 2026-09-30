import { isValidIsoDate, isoShift } from "./dates"
import { trainingCycleWindow } from "./training-cycle-window"

export type CalendarReadiness = "READY" | "LOADING" | "STALE" | "ERROR"
export type CalendarPosition = { readonly month: string; readonly date: string }

export function calendarEntriesByDate<T extends { readonly date: string }>(entries: readonly T[]): ReadonlyMap<string, readonly T[]> {
  const result = new Map<string, T[]>()
  for (const entry of entries) {
    const date = entry.date
    if (!isValidIsoDate(date)) continue
    const day = result.get(date)
    if (day) day.push(entry)
    else result.set(date, [entry])
  }
  return result
}

export function calendarRecordDates(entries: readonly { readonly date: string }[]): readonly string[] {
  return [...new Set(entries.map(entry => entry.date).filter(isValidIsoDate))].sort()
}

export function recentCalendarDate(dates: readonly string[], today: string): string | null {
  return dates.filter(date => date <= today).at(-1) ?? null
}

export function nearestCalendarDate(dates: readonly string[], selected: string): string | null {
  if (!dates.length) return null
  const civil = (date: string) => Date.UTC(...date.split("-").map(Number).map((value, index) => index === 1 ? value - 1 : value) as [number, number, number])
  return [...dates].sort((a, b) => Math.abs(civil(a) - civil(selected)) - Math.abs(civil(b) - civil(selected)) || a.localeCompare(b))[0]!
}

export function planCalendarDate(start: string, lengthDays: number, today: string, candidate = false): string {
  if (!isValidIsoDate(start)) return today
  const end = isoShift(start, Math.max(0, Math.ceil(lengthDays) - 1))
  return candidate || today < start ? start : today > end ? end : today
}

/** Inverse of the existing 10/9-day archive grouping, not a prescription rule. */
export function calendarCycleIndex(anchor: string, date: string): number {
  if (!isValidIsoDate(anchor) || !isValidIsoDate(date)) return 0
  const civil = (value: string) => { const [y, m, d] = value.split("-").map(Number); return Date.UTC(y!, m! - 1, d!) }
  const estimate = Math.floor((civil(date) - civil(anchor)) / 86_400_000 / 9.5)
  for (const index of [estimate, estimate - 1, estimate + 1]) {
    const window = trainingCycleWindow(anchor, index)
    if (date >= window.start && date <= window.end) return index
  }
  return 0
}

export function calendarReadiness(input: { localComplete: boolean; accountEnabled: boolean; owner: string | null;
  auth: string; online: string; entryCount: number }): CalendarReadiness {
  if (!input.localComplete) return input.entryCount ? "STALE" : "ERROR"
  if (!input.accountEnabled) return "READY"
  if (!input.owner) return input.auth === "GUEST" ? "READY" : input.entryCount ? "STALE" : input.auth === "FAILED" ? "ERROR" : "LOADING"
  if (input.online === "READY") return "READY"
  if (input.entryCount) return "STALE"
  return ["FAILED", "REJECTED", "CONFLICT"].includes(input.online) ? "ERROR" : "LOADING"
}
