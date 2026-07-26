import type { JournalEntry, JournalKind } from "./journal-schema"
import { isoToDate, isoShift, pad2 } from "./dates"

const KIND_ORDER = ["post-session", "evening", "race"] as const satisfies readonly JournalKind[]

export type JournalArchiveDay = {
  readonly date: string
  readonly entryCount: number
  readonly kinds: readonly JournalKind[]
  readonly systems: readonly string[]
  readonly totalDurationMin: number | null
  readonly totalDistanceKm: number | null
  readonly mood: number | null
  readonly highestPain: number | null
  readonly hasBodyCheckin: boolean
}

function decimalInput(value: string): number | null {
  const text = value.trim()
  if (!/^\d+(?:\.\d+)?$/u.test(text)) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function uniqueInOrder(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

function summaryForDate(date: string, entries: readonly JournalEntry[]): JournalArchiveDay {
  const kinds = new Set<JournalKind>()
  const systems: string[] = []
  let durationTotal = 0
  let distanceTotal = 0
  let hasDuration = false
  let hasDistance = false
  let latestMood: { readonly savedAt: string; readonly value: number } | null = null
  let highestPain = 0
  let hasBodyCheckin = false

  for (const entry of entries) {
    kinds.add(entry.kind)
    if (entry.kind === "post-session") {
      if (entry.system.trim() !== "") systems.push(entry.system)
      const duration = decimalInput(entry.durationMin)
      const distance = decimalInput(entry.distanceKm)
      if (duration !== null) {
        durationTotal += duration
        hasDuration = true
      }
      if (distance !== null) {
        distanceTotal += distance
        hasDistance = true
      }
      continue
    }

    if (entry.kind === "evening") {
      hasBodyCheckin = true
      for (const level of Object.values(entry.painParts)) highestPain = Math.max(highestPain, level)
      if (entry.mood > 0 && (latestMood === null || latestMood.savedAt < entry.savedAt)) {
        latestMood = { savedAt: entry.savedAt, value: entry.mood }
      }
    }
  }

  return {
    date,
    entryCount: entries.length,
    kinds: KIND_ORDER.filter((kind) => kinds.has(kind)),
    systems: uniqueInOrder(systems),
    totalDurationMin: hasDuration ? durationTotal : null,
    totalDistanceKm: hasDistance ? Math.round(distanceTotal * 10) / 10 : null,
    mood: latestMood?.value ?? null,
    highestPain: highestPain > 0 ? highestPain : null,
    hasBodyCheckin,
  }
}

export function summarizeJournalDays(entries: readonly JournalEntry[]): readonly JournalArchiveDay[] {
  const entriesByDate = new Map<string, JournalEntry[]>()
  for (const entry of entries) {
    const sameDay = entriesByDate.get(entry.date)
    if (sameDay === undefined) entriesByDate.set(entry.date, [entry])
    else sameDay.push(entry)
  }

  return [...entriesByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, sameDay]) => summaryForDate(date, sameDay))
}

export function monthIdOf(iso: string): string {
  return iso.slice(0, 7)
}

export function shiftMonthId(monthId: string, amount: number): string {
  const [yearText, monthText] = monthId.split("-")
  const date = new Date(Number(yearText), Number(monthText) - 1 + amount, 1)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function daysForMonth(monthId: string): readonly string[] {
  const [yearText, monthText] = monthId.split("-")
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return Array.from({ length: lastDay }, (_, index) => `${year}-${pad2(monthIndex + 1)}-${pad2(index + 1)}`)
}

export function mondayOffset(iso: string): number {
  return (isoToDate(iso).getDay() + 6) % 7
}

export function weekDates(weekStart: string): readonly string[] {
  return Array.from({ length: 7 }, (_, index) => isoShift(weekStart, index))
}
