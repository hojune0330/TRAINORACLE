import { z } from "zod"
import { isValidIsoDate } from "./dates"

const STORAGE_KEY = "trainoracle.engagement.v1"
const DAILY_VISIT_POINTS = 1
const JOURNAL_DAY_POINTS = 4
const DAY_MS = 86_400_000

const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine(isValidIsoDate)
const engagementStateSchema = z.object({
  version: z.literal(1),
  visitDates: z.array(isoDateSchema),
})

type EngagementState = z.infer<typeof engagementStateSchema>

export type EngagementJournalRef = {
  readonly date: string
  readonly kind: "post-session" | "evening" | "race"
}

export type EngagementSummary = {
  readonly points: number
  readonly visitDays: number
  readonly journalDays: number
  readonly recordingStreak: number
  readonly pointMeaning: "NON_ECONOMIC_LOCAL_BETA"
}

const EMPTY_STATE: EngagementState = {
  version: 1,
  visitDates: [],
}

export function recordDailyVisit(today: string): EngagementState {
  const parsedToday = isoDateSchema.safeParse(today)
  if (!parsedToday.success) return loadState()

  const state = loadState()
  if (state.visitDates.includes(parsedToday.data)) return state

  const next: EngagementState = {
    version: 1,
    visitDates: [...state.visitDates, parsedToday.data].sort(),
  }
  saveState(next)
  return next
}

export function engagementSummary(
  journalRefs: readonly EngagementJournalRef[],
  today: string,
): EngagementSummary {
  const state = loadState()
  const visitDates = validDistinctDates(state.visitDates, today)
  const journalDates = validDistinctDates(
    journalRefs.map((entry) => entry.date),
    today,
  )
  return {
    points: visitDates.length * DAILY_VISIT_POINTS + journalDates.length * JOURNAL_DAY_POINTS,
    visitDays: visitDates.length,
    journalDays: journalDates.length,
    recordingStreak: calculateRecordingStreak(journalDates, today),
    pointMeaning: "NON_ECONOMIC_LOCAL_BETA",
  }
}

function loadState(): EngagementState {
  if (typeof window === "undefined") return EMPTY_STATE
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return EMPTY_STATE

  try {
    const parsedJson: unknown = JSON.parse(raw)
    const parsed = engagementStateSchema.safeParse(parsedJson)
    return parsed.success
      ? { version: 1, visitDates: [...validDistinctDates(parsed.data.visitDates)] }
      : EMPTY_STATE
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return EMPTY_STATE
  }
}

function saveState(state: EngagementState): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
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
