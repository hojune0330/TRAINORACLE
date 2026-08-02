import { z } from "zod"
import { isValidIsoDate } from "./dates"
import type { JournalEntry } from "./journal-schema"

const JOURNAL_DAY_POINTS = 4
const DAY_MS = 86_400_000

const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine(isValidIsoDate)
export type EngagementJournalRef = {
  readonly date: string
  readonly kind: "post-session" | "evening" | "race"
}

export type EngagementSummary = {
  readonly points: number
  readonly journalDays: number
  readonly recordingStreak: number
  readonly pointMeaning: "NON_ECONOMIC_LOCAL_BETA"
}

export function engagementSummary(
  journalRefs: readonly EngagementJournalRef[],
  today: string,
): EngagementSummary {
  const journalDates = validDistinctDates(
    journalRefs.map((entry) => entry.date),
    today,
  )
  return {
    points: journalDates.length * JOURNAL_DAY_POINTS,
    journalDays: journalDates.length,
    recordingStreak: calculateRecordingStreak(journalDates, today),
    pointMeaning: "NON_ECONOMIC_LOCAL_BETA",
  }
}

export function toEngagementJournalRef(entry: JournalEntry): EngagementJournalRef | null {
  const qualifies = entry.kind === "post-session"
    ? entry.title.trim() !== ""
      || entry.distanceKm.trim() !== ""
      || entry.durationMin.trim() !== ""
      || entry.avgPace.trim() !== ""
      || entry.rpe > 0
      || entry.intensityAssessment !== undefined
    : entry.kind === "evening"
      ? entry.sleepH > 0
        || entry.sleepQuality > 0
        || entry.weightKg.trim() !== ""
        || entry.restingHr.trim() !== ""
        || Object.values(entry.painParts).some((level) => level > 0)
        || entry.mood > 0
      : entry.record.trim() !== ""
        || entry.rank.trim() !== ""
        || entry.result.trim() !== ""
        || entry.tension !== undefined
        || entry.condition !== undefined
        || entry.mood !== undefined
        || entry.goalPace !== undefined
  return qualifies ? { date: entry.date, kind: entry.kind } : null
}

function validDistinctDates(
  dates: readonly string[],
  latestDate?: string,
): readonly string[] {
  const valid = dates.filter((date) => isoDateSchema.safeParse(date).success
    && (latestDate === undefined || date <= latestDate))
  return [...new Set(valid)].sort()
}

function calculateRecordingStreak(
  journalDates: readonly string[],
  today: string,
): number {
  if (!isoDateSchema.safeParse(today).success || journalDates.length === 0) return 0
  const dateSet = new Set(journalDates)
  const start = dateSet.has(today) ? today : shiftIsoDate(today, -1)
  if (!dateSet.has(start)) return 0

  let count = 0
  let cursor = start
  while (dateSet.has(cursor)) {
    count += 1
    cursor = shiftIsoDate(cursor, -1)
  }
  return count
}

function shiftIsoDate(date: string, days: number): string {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS
  return new Date(timestamp).toISOString().slice(0, 10)
}
