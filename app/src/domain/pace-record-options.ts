import type { AthleteRecord } from "./athlete-records"

// Structural bridge until persisted actual records also allow unknown dates.
export type PaceRecordInput = Omit<AthleteRecord, "achievedOn"> & {
  readonly achievedOn: string | null
}

export type PaceRecordSelectionBadge =
  | "RECENT_ACTUAL"
  | "ROLLING_12_BEST"
  | "LIFETIME_BEST"
  | "GOAL"

export type PaceRecordSourceSnapshot = Readonly<PaceRecordInput>

export type PaceRecordOption = {
  readonly recordId: string
  readonly sourceSnapshot: PaceRecordSourceSnapshot
  readonly badges: readonly PaceRecordSelectionBadge[]
  readonly dateStatus: "WITHIN_ROLLING_12" | "OUTSIDE_ROLLING_12" | "UNDATED" | "GOAL"
}

export type PaceRecordExclusion = {
  readonly recordId: string
  readonly reason: "INVALID_DATE" | "FUTURE_DATE" | "INVALID_PERFORMANCE" | "CONFLICTING_ID"
}

export type PaceRecordOptions = {
  readonly status: "READY" | "INVALID_TODAY" | "INVALID_EVENT_DISTANCE"
  readonly eventDistanceM: number
  readonly today: string
  readonly rollingWindowStart: string | null
  readonly options: readonly PaceRecordOption[]
  readonly latestStatus: "NONE" | "UNAMBIGUOUS" | "AMBIGUOUS"
  readonly recommendedRecordId: string | null
  readonly excluded: readonly PaceRecordExclusion[]
}

function canonicalDistance(distance: number): number {
  return distance === 21097 ? 21097.5 : distance
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function calendarParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
    ? { year, month, day }
    : null
}

function snapshot(record: PaceRecordInput): PaceRecordSourceSnapshot {
  return {
    schemaVersion: record.schemaVersion,
    id: record.id,
    purpose: record.purpose,
    eventDistanceM: record.eventDistanceM,
    performanceSeconds: record.performanceSeconds,
    achievedOn: record.achievedOn,
    seasonId: record.seasonId,
    enteredBy: record.enteredBy,
    verificationState: record.verificationState,
    sourceRef: record.sourceRef,
    savedAt: record.savedAt,
  }
}

function best(records: readonly PaceRecordSourceSnapshot[]): readonly PaceRecordSourceSnapshot[] {
  const fastest = records.reduce((time, record) => Math.min(time, record.performanceSeconds), Infinity)
  return records.filter((record) => record.performanceSeconds === fastest)
}

/**
 * Latest actual(s) within the inclusive calendar window, rolling/lifetime best
 * (including ties), and goals. Badges share one option per source identity.
 * Recommendation is advisory, never a freshness assertion or persisted selection.
 */
export function derivePaceRecordOptions(
  records: readonly PaceRecordInput[],
  eventDistanceM: number,
  today: string,
): PaceRecordOptions {
  const event = canonicalDistance(eventDistanceM)
  const empty: PaceRecordOptions = {
    status: "READY",
    eventDistanceM: event,
    today,
    rollingWindowStart: null,
    options: [],
    latestStatus: "NONE",
    recommendedRecordId: null,
    excluded: [],
  }
  const parts = calendarParts(today)
  if (parts === null) return { ...empty, status: "INVALID_TODAY" }
  if (!Number.isFinite(event) || event < 60) return { ...empty, status: "INVALID_EVENT_DISTANCE" }

  // Calendar arithmetic, not elapsed milliseconds or rounded month counts.
  const year = parts.year - 1
  const day = Math.min(parts.day, daysInMonth(year, parts.month))
  const start = `${String(year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const excluded: PaceRecordExclusion[] = []
  const byId = new Map<string, PaceRecordSourceSnapshot>()
  const conflictingIds = new Set<string>()
  for (const record of records) {
    if (canonicalDistance(record.eventDistanceM) !== event) continue
    const source = snapshot(record)
    const previous = byId.get(record.id)
    if (previous && JSON.stringify(previous) !== JSON.stringify(source)) conflictingIds.add(record.id)
    byId.set(record.id, source)
  }

  const actual: PaceRecordSourceSnapshot[] = []
  const goals: PaceRecordSourceSnapshot[] = []
  // Stable identity order resolves equivalent times without using save order as race chronology.
  const sources = [...byId.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  for (const record of sources) {
    let reason: PaceRecordExclusion["reason"] | null = null
    if (conflictingIds.has(record.id)) reason = "CONFLICTING_ID"
    else if (!Number.isFinite(record.performanceSeconds) || record.performanceSeconds <= 0) reason = "INVALID_PERFORMANCE"
    else if (record.purpose === "RACE_GOAL") {
      if (record.achievedOn !== null) reason = "INVALID_DATE"
    } else if (record.achievedOn !== null) {
      if (calendarParts(record.achievedOn) === null) reason = "INVALID_DATE"
      else if (record.achievedOn > today) reason = "FUTURE_DATE"
    }
    if (reason !== null) {
      excluded.push({ recordId: record.id, reason })
      continue
    }
    if (record.purpose === "RACE_GOAL") goals.push(record)
    else actual.push(record)
  }

  const rolling = actual.filter((record) => record.achievedOn !== null && record.achievedOn >= start)
  const latestDate = rolling.reduce((latest, record) => {
    return record.achievedOn !== null && record.achievedOn > latest ? record.achievedOn : latest
  }, "")
  const recent = rolling.filter((record) => record.achievedOn === latestDate)
  const ambiguous = new Set(recent.map((record) => record.performanceSeconds)).size > 1
  const options = new Map<string, PaceRecordOption>()
  function add(candidates: readonly PaceRecordSourceSnapshot[], badge: PaceRecordSelectionBadge): void {
    for (const record of candidates) {
      const previous = options.get(record.id)
      options.set(record.id, {
        recordId: record.id,
        sourceSnapshot: record,
        badges: [...(previous?.badges ?? []), badge],
        dateStatus: record.purpose === "RACE_GOAL" ? "GOAL"
          : record.achievedOn === null ? "UNDATED"
            : record.achievedOn >= start ? "WITHIN_ROLLING_12" : "OUTSIDE_ROLLING_12",
      })
    }
  }
  add(recent, "RECENT_ACTUAL")
  add(best(rolling), "ROLLING_12_BEST")
  add(best(actual), "LIFETIME_BEST")
  add(goals, "GOAL")
  return {
    ...empty,
    rollingWindowStart: start,
    options: [...options.values()],
    latestStatus: recent.length === 0 ? "NONE" : ambiguous ? "AMBIGUOUS" : "UNAMBIGUOUS",
    recommendedRecordId: ambiguous ? null : recent[0]?.id ?? null,
    excluded,
  }
}
