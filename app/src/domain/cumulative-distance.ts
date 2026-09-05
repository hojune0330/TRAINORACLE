import { isValidIsoDate, isoShift, pad2, weekStartOf } from "./dates"
import type { StructuredJournalObservation } from "./journal-observation"
import { eligibleMetricValue } from "./trend-analysis"
import { acceptsExplicitField } from "./analysis-field-eligibility"

export const CUMULATIVE_DISTANCE_FORMULA_VERSION = "CUMULATIVE_DISTANCE_SUM_V1" as const

export type DistanceWindowKind =
  | "WEEK_TO_DATE"
  | "MONTH_TO_DATE"
  | "YEAR_TO_DATE"
  | "RECENT_WEEK"
  | "RECENT_MONTH"
  | "CURRENT_MONTH_DAY"
  | "ACTIVE_PLAN_DATE_WINDOW"

export type DistanceWindow = {
  readonly kind: DistanceWindowKind
  readonly startDate: string
  readonly endDate: string
  readonly precision: "LOCAL_DATE"
}

export type CumulativeDistanceReasonCode =
  | "STRUCTURED_EXPLICIT_DISTANCE"
  | "NO_ELIGIBLE_SOURCE"
  | "EXCLUDED_SOURCE_PRESENT"
  | "IDENTICAL_DUPLICATE_SOURCE"
  | "CONFLICTING_SOURCE_ID"

export type CumulativeDistanceSummary = {
  readonly formulaVersion: typeof CUMULATIVE_DISTANCE_FORMULA_VERSION
  readonly window: DistanceWindow
  readonly totalKm: number | null
  readonly includedSourceCount: number
  readonly excludedSourceCount: number
  readonly duplicateSourceCount: number
  readonly conflictingSourceCount: number
  readonly coverage: "DATA" | "PARTIAL" | "MISSING"
  readonly sourceRefs: readonly StructuredJournalObservation["sourceRef"][]
  readonly reasonCodes: readonly CumulativeDistanceReasonCode[]
}

export type DistanceBucket = CumulativeDistanceSummary & {
  readonly label: string
}

export type CumulativeDistanceDashboard = {
  readonly toDate: Readonly<Record<"week" | "month" | "year", CumulativeDistanceSummary>>
  readonly plan: CumulativeDistanceSummary | null
  readonly weeks: readonly DistanceBucket[]
  readonly months: readonly DistanceBucket[]
  readonly days: readonly DistanceBucket[]
}

function sourceKey(observation: StructuredJournalObservation): string {
  return `${observation.sourceRef.sourceKind}:${observation.sourceRef.sourceId}`
}

function sourceSignature(observation: StructuredJournalObservation): string {
  return JSON.stringify({
    loggedOn: observation.loggedOn,
    distanceKm: observation.distanceKm,
    provenance: observation.fieldProvenance.distanceKm,
    trustState: observation.sourceRef.trustState,
    explicitDistanceAccepted: acceptsExplicitField(observation, "distanceKm"),
  })
}

function roundKm(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

function checkedWindow(window: DistanceWindow): DistanceWindow {
  if (!isValidIsoDate(window.startDate)
    || !isValidIsoDate(window.endDate)
    || window.startDate > window.endDate) {
    throw new RangeError("Distance window must use ordered real local dates")
  }
  return window
}

export function cumulativeDistance(
  observations: readonly StructuredJournalObservation[],
  requestedWindow: DistanceWindow,
): CumulativeDistanceSummary {
  const window = checkedWindow(requestedWindow)
  const scoped = observations.filter((observation) =>
    isValidIsoDate(observation.loggedOn)
      && observation.loggedOn >= window.startDate
      && observation.loggedOn <= window.endDate
      && !(observation.distanceKm === null
        && observation.fieldProvenance.distanceKm === "MISSING"))
  const grouped = new Map<string, StructuredJournalObservation[]>()

  for (const observation of scoped) {
    const key = sourceKey(observation)
    const current = grouped.get(key)
    if (current === undefined) grouped.set(key, [observation])
    else current.push(observation)
  }

  const included: { readonly observation: StructuredJournalObservation; readonly value: number }[] = []
  let excludedSourceCount = 0
  let duplicateSourceCount = 0
  let conflictingSourceCount = 0
  let hasIdenticalDuplicate = false
  let hasConflict = false

  for (const group of grouped.values()) {
    const first = group[0]
    if (first === undefined) continue
    if (first.sourceRef.sourceId.trim() === "") {
      excludedSourceCount += 1
      continue
    }
    const signatures = new Set(group.map(sourceSignature))
    if (signatures.size > 1) {
      excludedSourceCount += 1
      conflictingSourceCount += 1
      hasConflict = true
      continue
    }

    duplicateSourceCount += group.length - 1
    if (group.length > 1) hasIdenticalDuplicate = true
    if (first.distanceKm === null && first.fieldProvenance.distanceKm === "MISSING") {
      continue
    }
    const value = acceptsExplicitField(first, "distanceKm") ? first.distanceKm : eligibleMetricValue(first, "DISTANCE_KM")
    if (!acceptsExplicitField(first, "distanceKm")
      || value === null
      || !Number.isFinite(value)
      || value <= 0) {
      excludedSourceCount += 1
      continue
    }
    included.push({ observation: first, value })
  }

  const reasonCodes: CumulativeDistanceReasonCode[] = []
  if (included.length > 0) reasonCodes.push("STRUCTURED_EXPLICIT_DISTANCE")
  else reasonCodes.push("NO_ELIGIBLE_SOURCE")
  if (excludedSourceCount > 0) reasonCodes.push("EXCLUDED_SOURCE_PRESENT")
  if (hasIdenticalDuplicate) reasonCodes.push("IDENTICAL_DUPLICATE_SOURCE")
  if (hasConflict) reasonCodes.push("CONFLICTING_SOURCE_ID")

  return {
    formulaVersion: CUMULATIVE_DISTANCE_FORMULA_VERSION,
    window,
    totalKm: included.length === 0
      ? null
      : roundKm(included.reduce((sum, item) => sum + item.value, 0)),
    includedSourceCount: included.length,
    excludedSourceCount,
    duplicateSourceCount,
    conflictingSourceCount,
    coverage: included.length === 0
      ? "MISSING"
      : excludedSourceCount > 0 || duplicateSourceCount > 0
        ? "PARTIAL"
        : "DATA",
    sourceRefs: included.map((item) => item.observation.sourceRef),
    reasonCodes,
  }
}

export function toDateDistanceWindows(asOfDate: string): readonly DistanceWindow[] {
  if (!isValidIsoDate(asOfDate)) throw new RangeError("asOfDate must be a real local date")
  return [
    {
      kind: "WEEK_TO_DATE",
      startDate: weekStartOf(asOfDate),
      endDate: asOfDate,
      precision: "LOCAL_DATE",
    },
    {
      kind: "MONTH_TO_DATE",
      startDate: `${asOfDate.slice(0, 7)}-01`,
      endDate: asOfDate,
      precision: "LOCAL_DATE",
    },
    {
      kind: "YEAR_TO_DATE",
      startDate: `${asOfDate.slice(0, 4)}-01-01`,
      endDate: asOfDate,
      precision: "LOCAL_DATE",
    },
  ]
}

export function summarizeToDateDistances(
  observations: readonly StructuredJournalObservation[],
  asOfDate: string,
): Readonly<Record<"week" | "month" | "year", CumulativeDistanceSummary>> {
  const [week, month, year] = toDateDistanceWindows(asOfDate)
  if (week === undefined || month === undefined || year === undefined) {
    throw new RangeError("Required distance windows are missing")
  }
  return {
    week: cumulativeDistance(observations, week),
    month: cumulativeDistance(observations, month),
    year: cumulativeDistance(observations, year),
  }
}

export function bucketDistanceByRecentWeeks(
  observations: readonly StructuredJournalObservation[],
  asOfDate: string,
  weeksBack: number,
): readonly DistanceBucket[] {
  if (!Number.isInteger(weeksBack) || weeksBack <= 0) {
    throw new RangeError("weeksBack must be a positive integer")
  }
  const thisMonday = weekStartOf(asOfDate)
  return Array.from({ length: weeksBack }, (_, index) => {
    const startDate = isoShift(thisMonday, -7 * (weeksBack - index - 1))
    const endDate = index === weeksBack - 1 ? asOfDate : isoShift(startDate, 6)
    return {
      label: startDate,
      ...cumulativeDistance(observations, {
        kind: "RECENT_WEEK",
        startDate,
        endDate,
        precision: "LOCAL_DATE",
      }),
    }
  })
}

function shiftedMonth(asOfDate: string, delta: number): string {
  const year = Number(asOfDate.slice(0, 4))
  const month = Number(asOfDate.slice(5, 7))
  const shifted = new Date(year, month - 1 + delta, 1)
  return `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}`
}

function monthEnd(month: string): string {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const last = new Date(year, monthNumber, 0)
  return `${month}-${pad2(last.getDate())}`
}

export function bucketDistanceByRecentMonths(
  observations: readonly StructuredJournalObservation[],
  asOfDate: string,
  monthsBack: number,
): readonly DistanceBucket[] {
  if (!isValidIsoDate(asOfDate) || !Number.isInteger(monthsBack) || monthsBack <= 0) {
    throw new RangeError("monthsBack and asOfDate must be valid")
  }
  return Array.from({ length: monthsBack }, (_, index) => {
    const label = shiftedMonth(asOfDate, index - monthsBack + 1)
    const startDate = `${label}-01`
    const endDate = index === monthsBack - 1 ? asOfDate : monthEnd(label)
    return {
      label,
      ...cumulativeDistance(observations, {
        kind: "RECENT_MONTH",
        startDate,
        endDate,
        precision: "LOCAL_DATE",
      }),
    }
  })
}

export function bucketCurrentMonthDistanceByDay(
  observations: readonly StructuredJournalObservation[],
  asOfDate: string,
): readonly DistanceBucket[] {
  if (!isValidIsoDate(asOfDate)) throw new RangeError("asOfDate must be a real local date")
  const dayCount = Number(asOfDate.slice(8, 10))
  return Array.from({ length: dayCount }, (_, index) => {
    const date = `${asOfDate.slice(0, 8)}${pad2(index + 1)}`
    return {
      label: date,
      ...cumulativeDistance(observations, {
        kind: "CURRENT_MONTH_DAY",
        startDate: date,
        endDate: date,
        precision: "LOCAL_DATE",
      }),
    }
  })
}

export function activePlanDateWindow(
  startDate: string | undefined,
  visibleLengthDays: number | undefined,
): DistanceWindow | null {
  if (startDate === undefined
    || !isValidIsoDate(startDate)
    || visibleLengthDays === undefined
    || !Number.isFinite(visibleLengthDays)
    || visibleLengthDays <= 0) return null
  const wholeVisibleDates = Math.max(1, Math.ceil(visibleLengthDays))
  return {
    kind: "ACTIVE_PLAN_DATE_WINDOW",
    startDate,
    endDate: isoShift(startDate, wholeVisibleDates - 1),
    precision: "LOCAL_DATE",
  }
}

export function buildCumulativeDistanceDashboard({
  observations,
  asOfDate,
  planWindow = null,
  weeksBack = 4,
  monthsBack = 6,
}: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly asOfDate: string
  readonly planWindow?: DistanceWindow | null
  readonly weeksBack?: number
  readonly monthsBack?: number
}): CumulativeDistanceDashboard {
  const toDatePlanWindow = planWindow === null || planWindow.startDate > asOfDate
    ? null
    : {
        ...planWindow,
        endDate: planWindow.endDate < asOfDate ? planWindow.endDate : asOfDate,
      }
  return {
    toDate: summarizeToDateDistances(observations, asOfDate),
    plan: toDatePlanWindow === null ? null : cumulativeDistance(observations, toDatePlanWindow),
    weeks: bucketDistanceByRecentWeeks(observations, asOfDate, weeksBack),
    months: bucketDistanceByRecentMonths(observations, asOfDate, monthsBack),
    days: bucketCurrentMonthDistanceByDay(observations, asOfDate),
  }
}
