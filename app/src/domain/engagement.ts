import { z } from "zod"
import { isValidIsoDate } from "./dates"
import type { JournalEntry } from "./journal-schema"

const JOURNAL_DAY_POINTS = 4
const DAILY_VISIT_POINTS = 1
const POINT_MEANING = "NON_ECONOMIC_NON_TRANSFERABLE_BETA" as const
export const ENGAGEMENT_STORAGE_KEY = "trainoracle.engagement.v2"

const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine(isValidIsoDate)
type EngagementState = {
  readonly version: 2
  readonly visitDates: readonly string[]
  readonly journalDates: readonly string[]
  readonly pointMeaning: typeof POINT_MEANING
}
const engagementStateSchema: z.ZodType<EngagementState> = z.object({
  version: z.literal(2),
  visitDates: z.array(isoDateSchema),
  journalDates: z.array(isoDateSchema),
  pointMeaning: z.literal(POINT_MEANING),
}).strict()
const EMPTY_STATE: EngagementState = {
  version: 2,
  visitDates: [],
  journalDates: [],
  pointMeaning: POINT_MEANING,
}
export type EngagementJournalRef = {
  readonly date: string
  readonly kind: "post-session" | "evening" | "race"
}

export type EngagementSummary = {
  readonly points: number
  readonly journalDays: number
  readonly visitDays: number
  readonly visitedToday: boolean
  readonly journalRecordedToday: boolean
  readonly pointMeaning: typeof POINT_MEANING
}

export type EngagementAwardResult =
  | { readonly kind: "AWARDED"; readonly awardedPoints: 1 | 4; readonly summary: EngagementSummary }
  | { readonly kind: "ALREADY_AWARDED"; readonly awardedPoints: 0; readonly summary: EngagementSummary }
  | { readonly kind: "INELIGIBLE"; readonly awardedPoints: 0; readonly summary: EngagementSummary }
  | { readonly kind: "SAVE_FAILED"; readonly awardedPoints: 0; readonly summary: EngagementSummary }

export function engagementSummary(
  journalRefs: readonly EngagementJournalRef[],
  today: string,
): EngagementSummary {
  return summaryFor({
    ...EMPTY_STATE,
    journalDates: journalRefs.map((entry) => entry.date),
  }, today)
}

export function loadEngagementSummary(today: string): EngagementSummary {
  return summaryFor(readState(), today)
}

export function recordDailyVisit(today: string): EngagementAwardResult {
  if (!validAwardDate(today, today)) {
    return { kind: "INELIGIBLE", awardedPoints: 0, summary: loadEngagementSummary(today) }
  }
  return awardDate("VISIT", today, today)
}

export function awardJournalEntry(entry: JournalEntry, today: string): EngagementAwardResult {
  const ref = toEngagementJournalRef(entry)
  if (ref === null || !validAwardDate(ref.date, today)) {
    return { kind: "INELIGIBLE", awardedPoints: 0, summary: loadEngagementSummary(today) }
  }
  return awardDate("JOURNAL", ref.date, today)
}

export function reconcileJournalAwards(
  journalRefs: readonly EngagementJournalRef[],
  today: string,
): EngagementSummary {
  const current = readState()
  const journalDates = validDistinctDates([
    ...current.journalDates,
    ...journalRefs.map((entry) => entry.date),
  ], today)
  if (journalDates.length === validDistinctDates(current.journalDates, today).length) {
    return summaryFor(current, today)
  }
  const next: EngagementState = { ...current, journalDates }
  return saveState(next) ? summaryFor(next, today) : summaryFor(current, today)
}

function awardDate(
  source: "VISIT" | "JOURNAL",
  date: string,
  today: string,
): EngagementAwardResult {
  const current = readState()
  const dates = source === "VISIT" ? current.visitDates : current.journalDates
  if (dates.includes(date)) {
    return { kind: "ALREADY_AWARDED", awardedPoints: 0, summary: summaryFor(current, today) }
  }

  const next: EngagementState = source === "VISIT"
    ? { ...current, visitDates: validDistinctDates([...current.visitDates, date]) }
    : { ...current, journalDates: validDistinctDates([...current.journalDates, date]) }
  if (!saveState(next)) {
    return { kind: "SAVE_FAILED", awardedPoints: 0, summary: summaryFor(current, today) }
  }
  const awardedPoints = source === "VISIT" ? DAILY_VISIT_POINTS : JOURNAL_DAY_POINTS
  return { kind: "AWARDED", awardedPoints, summary: summaryFor(next, today) }
}

function validAwardDate(date: string, today: string): boolean {
  return isoDateSchema.safeParse(date).success
    && isoDateSchema.safeParse(today).success
    && date <= today
}

function summaryFor(state: EngagementState, today: string): EngagementSummary {
  const visitDates = validDistinctDates(state.visitDates, today)
  const journalDates = validDistinctDates(state.journalDates, today)
  return {
    points: visitDates.length * DAILY_VISIT_POINTS + journalDates.length * JOURNAL_DAY_POINTS,
    journalDays: journalDates.length,
    visitDays: visitDates.length,
    visitedToday: visitDates.includes(today),
    journalRecordedToday: journalDates.includes(today),
    pointMeaning: POINT_MEANING,
  }
}

function readState(): EngagementState {
  const target = browserStorage()
  if (target === null) return EMPTY_STATE
  try {
    const serialized = target.getItem(ENGAGEMENT_STORAGE_KEY)
    if (serialized === null) return EMPTY_STATE
    const parsed = engagementStateSchema.safeParse(JSON.parse(serialized))
    if (!parsed.success) return EMPTY_STATE
    return {
      ...parsed.data,
      visitDates: validDistinctDates(parsed.data.visitDates),
      journalDates: validDistinctDates(parsed.data.journalDates),
    }
  } catch (error) {
    if (error instanceof Error) return EMPTY_STATE
    throw error
  }
}

function saveState(state: EngagementState): boolean {
  const target = browserStorage()
  if (target === null) return false
  const serialized = JSON.stringify(state)
  try {
    target.setItem(ENGAGEMENT_STORAGE_KEY, serialized)
    return target.getItem(ENGAGEMENT_STORAGE_KEY) === serialized
  } catch (error) {
    if (error instanceof Error) return false
    throw error
  }
}

function browserStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch (error) {
    if (error instanceof Error) return null
    throw error
  }
}

export function toEngagementJournalRef(entry: JournalEntry): EngagementJournalRef | null {
  const qualifies = entry.kind === "post-session"
    ? entry.system === "rest"
      || entry.title.trim() !== ""
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
      : entry.tension !== undefined
        || entry.condition !== undefined
        || entry.mood !== undefined
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
