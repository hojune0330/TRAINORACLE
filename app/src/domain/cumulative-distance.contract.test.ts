import { describe, expect, it } from "vitest"
import type { StructuredJournalObservation } from "./journal-observation"
import {
  activePlanDateWindow,
  bucketCurrentMonthDistanceByDay,
  bucketDistanceByRecentMonths,
  bucketDistanceByRecentWeeks,
  cumulativeDistance,
  summarizeToDateDistances,
} from "./cumulative-distance"

function distanceObservation({
  sourceId,
  loggedOn,
  distanceKm,
  provenance = "EXPLICIT",
  trustState = "ACCEPTED",
}: {
  readonly sourceId: string
  readonly loggedOn: string
  readonly distanceKm: number | null
  readonly provenance?: StructuredJournalObservation["fieldProvenance"]["distanceKm"]
  readonly trustState?: StructuredJournalObservation["sourceRef"]["trustState"]
}): StructuredJournalObservation {
  return {
    sourceRef: {
      sourceKind: "SESSION_RESULT_RECORD",
      sourceId,
      sourceVersion: null,
      observedAt: `${loggedOn}T12:00:00.000Z`,
      trustState,
      containsPrivateRawText: false,
    },
    loggedOn,
    distanceKm,
    durationMin: null,
    secondsPerKm: null,
    rpe: null,
    mood: null,
    painMax: null,
    painSourceLevels: [],
    fieldProvenance: {
      distanceKm: provenance,
      durationMin: "MISSING",
      secondsPerKm: "MISSING",
      rpe: "MISSING",
      mood: "MISSING",
      painMax: "MISSING",
    },
    derivationRefs: [],
  }
}

describe("cumulative distance v1", () => {
  it("uses one strict source set for week, month, and year to date", () => {
    const observations = [
      distanceObservation({ sourceId: "jan", loggedOn: "2026-01-10", distanceKm: 10 }),
      distanceObservation({ sourceId: "month", loggedOn: "2026-08-02", distanceKm: 7.5 }),
      distanceObservation({ sourceId: "week", loggedOn: "2026-08-27", distanceKm: 5.2 }),
      distanceObservation({ sourceId: "future", loggedOn: "2026-08-29", distanceKm: 99 }),
    ]

    const summary = summarizeToDateDistances(observations, "2026-08-28")
    expect(summary.week.totalKm).toBe(5.2)
    expect(summary.month.totalKm).toBe(12.7)
    expect(summary.year.totalKm).toBe(22.7)
  })

  it("keeps missing as null and excludes untrusted or missing-provenance values", () => {
    const summary = cumulativeDistance([
      distanceObservation({ sourceId: "imported", loggedOn: "2026-08-20", distanceKm: 20, trustState: "SOURCE_NOT_VERIFIED" }),
      distanceObservation({ sourceId: "stale", loggedOn: "2026-08-20", distanceKm: 40, trustState: "STALE" }),
      distanceObservation({ sourceId: "legacy", loggedOn: "2026-08-21", distanceKm: 30, provenance: "LEGACY_MISSING_PROVENANCE" }),
    ], {
      kind: "MONTH_TO_DATE",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      precision: "LOCAL_DATE",
    })

    expect(summary.totalKm).toBeNull()
    expect(summary.includedSourceCount).toBe(0)
    expect(summary.excludedSourceCount).toBe(3)
    expect(summary.coverage).toBe("MISSING")
  })

  it("does not expose a source that never contained distance through the exclusion count", () => {
    const summary = cumulativeDistance([
      distanceObservation({ sourceId: "memo-only", loggedOn: "2026-08-20", distanceKm: null, provenance: "MISSING" }),
    ], {
      kind: "MONTH_TO_DATE",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      precision: "LOCAL_DATE",
    })

    expect(summary.totalKm).toBeNull()
    expect(summary.excludedSourceCount).toBe(0)
    expect(summary.sourceRefs).toEqual([])
  })

  it("keeps conflicting memo-only sources outside distance conflict signals", () => {
    const summary = cumulativeDistance([
      distanceObservation({ sourceId: "memo-only", loggedOn: "2026-08-20", distanceKm: null, provenance: "MISSING" }),
      distanceObservation({ sourceId: "memo-only", loggedOn: "2026-08-21", distanceKm: null, provenance: "MISSING" }),
    ], {
      kind: "MONTH_TO_DATE",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      precision: "LOCAL_DATE",
    })

    expect(summary.totalKm).toBeNull()
    expect(summary.excludedSourceCount).toBe(0)
    expect(summary.duplicateSourceCount).toBe(0)
    expect(summary.reasonCodes).not.toContain("CONFLICTING_SOURCE_ID")
  })

  it("counts an identical source once and rejects a conflicting source entirely", () => {
    const identical = distanceObservation({ sourceId: "same", loggedOn: "2026-08-20", distanceKm: 8 })
    const conflictA = distanceObservation({ sourceId: "conflict", loggedOn: "2026-08-21", distanceKm: 3 })
    const conflictB = distanceObservation({ sourceId: "conflict", loggedOn: "2026-08-21", distanceKm: 4 })
    const summary = cumulativeDistance([identical, identical, conflictA, conflictB], {
      kind: "MONTH_TO_DATE",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      precision: "LOCAL_DATE",
    })

    expect(summary.totalKm).toBe(8)
    expect(summary.includedSourceCount).toBe(1)
    expect(summary.excludedSourceCount).toBe(1)
    expect(summary.duplicateSourceCount).toBe(2)
    expect(summary.reasonCodes).toContain("CONFLICTING_SOURCE_ID")
    expect(summary.reasonCodes).toContain("IDENTICAL_DUPLICATE_SOURCE")
  })

  it("does not describe a conflict-only duplicate as an identical duplicate", () => {
    const summary = cumulativeDistance([
      distanceObservation({ sourceId: "conflict", loggedOn: "2026-08-21", distanceKm: 3 }),
      distanceObservation({ sourceId: "conflict", loggedOn: "2026-08-21", distanceKm: 4 }),
    ], {
      kind: "MONTH_TO_DATE",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      precision: "LOCAL_DATE",
    })

    expect(summary.reasonCodes).toContain("CONFLICTING_SOURCE_ID")
    expect(summary.reasonCodes).not.toContain("IDENTICAL_DUPLICATE_SOURCE")
  })

  it("builds week, month, and day buckets without converting missing to zero", () => {
    const observations = [
      distanceObservation({ sourceId: "a", loggedOn: "2026-07-31", distanceKm: 6 }),
      distanceObservation({ sourceId: "b", loggedOn: "2026-08-27", distanceKm: 4 }),
    ]

    const weeks = bucketDistanceByRecentWeeks(observations, "2026-08-28", 4)
    const months = bucketDistanceByRecentMonths(observations, "2026-08-28", 6)
    const days = bucketCurrentMonthDistanceByDay(observations, "2026-08-28")

    expect(weeks).toHaveLength(4)
    expect(weeks.at(-1)?.totalKm).toBe(4)
    expect(months).toHaveLength(6)
    expect(months.at(-2)?.totalKm).toBe(6)
    expect(months.at(-1)?.totalKm).toBe(4)
    expect(days[0]?.totalKm).toBeNull()
    expect(days[26]?.totalKm).toBe(4)
  })

  it("uses a date-precision plan projection instead of claiming exact 9.5-day attribution", () => {
    expect(activePlanDateWindow("2026-08-27", 9.5)).toEqual({
      kind: "ACTIVE_PLAN_DATE_WINDOW",
      startDate: "2026-08-27",
      endDate: "2026-09-05",
      precision: "LOCAL_DATE",
    })
    expect(activePlanDateWindow(undefined, 9.5)).toBeNull()
    expect(activePlanDateWindow("2026-08-27", undefined)).toBeNull()
  })
})
