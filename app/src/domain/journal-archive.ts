import { isValidIsoDate, isoShift, weekStartOf } from "./dates"
import {
  projectStructuredJournalObservation,
  selectStructuredJournalInput,
} from "./journal-observation"
import type { StructuredJournalObservation } from "./journal-observation"
import type { JournalEntry } from "./journal-schema"
import { eligibleMetricValue } from "./trend-analysis"
import type {
  ArchiveDaySummary,
  ArchiveKindCounts,
  ArchiveMonthSummary,
  ArchiveWeekSummary,
  JournalArchiveProjection,
} from "./journal-archive-types"

export type {
  ArchiveDaySummary,
  ArchiveKindCounts,
  ArchiveMetrics,
  ArchiveMonthSummary,
  ArchiveSelection,
  ArchiveWeekSummary,
  JournalArchiveProjection,
} from "./journal-archive-types"

type MutableCounts = {
  postSession: number
  evening: number
  race: number
}

type MutableSummary = {
  entryCount: number
  kindCounts: MutableCounts
  distances: number[]
  durations: number[]
  moods: number[]
  pains: number[]
  excludedRecordCount: number
}

type DayGroup = {
  readonly date: string
  readonly summary: MutableSummary
}

type WeekGroup = {
  readonly weekStart: string
  readonly summary: MutableSummary
  readonly days: Map<string, DayGroup>
}

type MonthGroup = {
  readonly month: string
  readonly summary: MutableSummary
  readonly weeks: Map<string, WeekGroup>
}

type EligibleArchiveValues = {
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly mood: number | null
  readonly painMax: number | null
}

function newSummary(): MutableSummary {
  return {
    entryCount: 0,
    kindCounts: { postSession: 0, evening: 0, race: 0 },
    distances: [],
    durations: [],
    moods: [],
    pains: [],
    excludedRecordCount: 0,
  }
}

function archiveDuration(observation: StructuredJournalObservation): number | null {
  const duration = observation.durationMin
  if (observation.sourceRef.sourceKind !== "SESSION_RESULT_RECORD"
    || duration === null
    || !Number.isFinite(duration)
    || duration <= 0
    || observation.fieldProvenance.durationMin !== "EXPLICIT"
    || observation.sourceRef.trustState === "MISSING"
    || observation.sourceRef.trustState === "SOURCE_NOT_VERIFIED") {
    return null
  }
  return duration
}

function eligibleValues(entry: JournalEntry): EligibleArchiveValues {
  const input = selectStructuredJournalInput(entry)
  if (input === null) {
    return { distanceKm: null, durationMin: null, mood: null, painMax: null }
  }

  const observation = projectStructuredJournalObservation(input)
  return {
    distanceKm: eligibleMetricValue(observation, "DISTANCE_KM"),
    durationMin: archiveDuration(observation),
    mood: eligibleMetricValue(observation, "MOOD"),
    painMax: eligibleMetricValue(observation, "PAIN_MAX"),
  }
}

function hasSummaryCandidate(entry: JournalEntry): boolean {
  if (entry.kind === "post-session") {
    return entry.distanceKm.trim() !== "" || entry.durationMin.trim() !== ""
  }
  if (entry.kind === "evening") {
    return entry.mood > 0 || Object.values(entry.painParts).some((level) => level > 0)
  }
  return false
}

function hasNonPrivateArchiveSignal(entry: JournalEntry): boolean {
  switch (entry.kind) {
    case "post-session":
      return selectStructuredJournalInput(entry) !== null
        || entry.intensityAssessment !== undefined
    case "evening":
      return selectStructuredJournalInput(entry) !== null
        || entry.sleepH > 0
        || entry.sleepQuality > 0
        || entry.weightKg.trim() !== ""
        || entry.restingHr.trim() !== ""
    case "race":
      return entry.record.trim() !== ""
        || entry.rank.trim() !== ""
        || entry.result.trim() !== ""
        || entry.tension !== undefined
        || entry.condition !== undefined
        || entry.mood !== undefined
        || entry.goalPace !== undefined
    default: {
      const exhaustive: never = entry
      return exhaustive
    }
  }
}

function addToSummary(
  summary: MutableSummary,
  entry: JournalEntry,
  values: EligibleArchiveValues,
  excluded: boolean,
): void {
  summary.entryCount += 1
  if (entry.kind === "post-session") summary.kindCounts.postSession += 1
  if (entry.kind === "evening") summary.kindCounts.evening += 1
  if (entry.kind === "race") summary.kindCounts.race += 1
  if (values.distanceKm !== null) summary.distances.push(values.distanceKm)
  if (values.durationMin !== null) summary.durations.push(values.durationMin)
  if (values.mood !== null) summary.moods.push(values.mood)
  if (values.painMax !== null) summary.pains.push(values.painMax)
  if (excluded) summary.excludedRecordCount += 1
}

function rounded(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function sumOrNull(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : rounded(values.reduce((total, value) => total + value, 0), 2)
}

function averageOrNull(values: readonly number[]): number | null {
  const sum = sumOrNull(values)
  return sum === null ? null : rounded(sum / values.length, 1)
}

function maxOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.max(...values)
}

function finishBase(summary: MutableSummary) {
  return {
    entryCount: summary.entryCount,
    kindCounts: { ...summary.kindCounts },
    metrics: {
      distanceKm: sumOrNull(summary.distances),
      durationMin: sumOrNull(summary.durations),
      moodAverage: averageOrNull(summary.moods),
      painMax: maxOrNull(summary.pains),
    },
    excludedRecordCount: summary.excludedRecordCount,
  }
}

function finishDay(group: DayGroup): ArchiveDaySummary {
  return { date: group.date, ...finishBase(group.summary) }
}

function finishWeek(group: WeekGroup): ArchiveWeekSummary {
  return {
    weekStart: group.weekStart,
    weekEnd: isoShift(group.weekStart, 6),
    ...finishBase(group.summary),
    days: [...group.days.values()]
      .sort((left, right) => right.date.localeCompare(left.date))
      .map(finishDay),
  }
}

function finishMonth(group: MonthGroup): ArchiveMonthSummary {
  return {
    month: group.month,
    ...finishBase(group.summary),
    weeks: [...group.weeks.values()]
      .sort((left, right) => right.weekStart.localeCompare(left.weekStart))
      .map(finishWeek),
  }
}

export function projectJournalArchive(
  entries: readonly JournalEntry[],
): JournalArchiveProjection {
  const months = new Map<string, MonthGroup>()

  for (const entry of entries) {
    if (!isValidIsoDate(entry.date) || !hasNonPrivateArchiveSignal(entry)) continue
    const monthKey = entry.date.slice(0, 7)
    const weekKey = weekStartOf(entry.date)
    const month = months.get(monthKey) ?? {
      month: monthKey,
      summary: newSummary(),
      weeks: new Map<string, WeekGroup>(),
    }
    if (!months.has(monthKey)) months.set(monthKey, month)
    const week = month.weeks.get(weekKey) ?? {
      weekStart: weekKey,
      summary: newSummary(),
      days: new Map<string, DayGroup>(),
    }
    if (!month.weeks.has(weekKey)) month.weeks.set(weekKey, week)
    const day = week.days.get(entry.date) ?? {
      date: entry.date,
      summary: newSummary(),
    }
    if (!week.days.has(entry.date)) week.days.set(entry.date, day)

    const values = eligibleValues(entry)
    const hasEligibleValue = Object.values(values).some((value) => value !== null)
    const candidate = hasSummaryCandidate(entry)
    const excluded = candidate && !hasEligibleValue
    addToSummary(month.summary, entry, values, excluded)
    addToSummary(week.summary, entry, values, excluded)
    addToSummary(day.summary, entry, values, excluded)
  }

  return {
    months: [...months.values()]
      .sort((left, right) => right.month.localeCompare(left.month))
      .map(finishMonth),
  }
}
