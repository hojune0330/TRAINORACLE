import { afterEach, describe, expect, it } from "vitest"
import { createElement } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { StructuredJournalObservation } from "./journal-observation"
import { projectStructuredJournalObservations } from "./journal-observation"
import type { PostSessionEntry } from "./journal-schema"
import { buildFileObservation } from "./import/file-observation"
import { cumulativeDistance } from "./cumulative-distance"
import { acceptsExplicitField } from "./analysis-field-eligibility"
import { bucketDistanceByWeek } from "./weekly-distance"
import { MonthlyTrendSection } from "../screens/trends/MonthlyTrendSection"
import { TREND_METRIC_OPTIONS } from "../screens/trends/trend-display"
import {
  markCurrentConfirmedAccountJournalProjection,
  putAccountJournalProjection,
  resetAccountJournalProjection,
  setAccountJournalProjectionStatus,
} from "./account/account-journal-projection"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import {
  bucketByMonth,
  eligibleMetricValue,
  summarizeMetricCoverage,
} from "./trend-analysis"

afterEach(() => {
  cleanup()
  setActiveLocalAccount(null)
  resetAccountJournalProjection(null)
})

function paceObservation(
  sourceId: string,
  loggedOn: string,
  secondsPerKm: number,
  trustState: StructuredJournalObservation["sourceRef"]["trustState"] = "ACCEPTED",
): StructuredJournalObservation {
  return {
    sourceRef: {
      sourceKind: "SESSION_RESULT_RECORD",
      sourceId,
      sourceVersion: null,
      observedAt: `${loggedOn}T08:00:00.000Z`,
      trustState,
      containsPrivateRawText: false,
    },
    loggedOn,
    distanceKm: 5,
    durationMin: secondsPerKm / 12,
    secondsPerKm,
    rpe: 5,
    mood: null,
    painMax: null,
    painSourceLevels: [],
    fieldProvenance: {
      distanceKm: "EXPLICIT",
      durationMin: "EXPLICIT",
      secondsPerKm: "EXPLICIT",
      rpe: "EXPLICIT",
      mood: "MISSING",
      painMax: "MISSING",
    },
    derivationRefs: [],
  }
}

describe("monthly trend aggregation", () => {
  it("matches the four-month hand calculation and leaves May numeric-free", () => {
    const observations = [
      paceObservation("r1", "2026-07-05", 1160),
      paceObservation("r2", "2026-06-11", 1142),
      paceObservation("r3", "2026-06-25", 1124),
      paceObservation("r4", "2026-04-02", 1170),
    ]

    const buckets = bucketByMonth(
      observations,
      new Date(2026, 6, 27, 12),
      4,
      "SECONDS_PER_KM",
    )

    expect(buckets).toEqual([
      expect.objectContaining({
        kind: "DATA",
        label: "2026-04",
        n: 1,
        median: 1170,
        min: 1170,
        max: 1170,
      }),
      {
        kind: "MISSING",
        label: "2026-05",
        sourceRefs: [],
        confidence: null,
        uncertaintyState: "INSUFFICIENT_SOURCE",
        displayStatus: "MISSING",
        nonSensitiveReasonCodes: ["NO_ELIGIBLE_SOURCE"],
      },
      expect.objectContaining({
        kind: "DATA",
        label: "2026-06",
        n: 2,
        median: 1133,
        min: 1124,
        max: 1142,
      }),
      expect.objectContaining({
        kind: "DATA",
        label: "2026-07",
        n: 1,
        median: 1160,
        min: 1160,
        max: 1160,
      }),
    ])
    const may = buckets[1]
    expect(may).toBeDefined()
    expect(may === undefined ? true : "median" in may).toBe(false)
    expect(may === undefined ? true : "unit" in may).toBe(false)
    expect(buckets[3]).toMatchObject({
      unit: "SECONDS_PER_KM",
      confidence: null,
      sourceRefs: [expect.objectContaining({ sourceId: "r1" })],
      nonSensitiveReasonCodes: ["STRUCTURED_OBSERVATION"],
    })
  })

  it("propagates stale and conflicting source states in text-safe fields", () => {
    const stale = bucketByMonth(
      [paceObservation("stale", "2026-07-05", 300, "STALE")],
      new Date(2026, 6, 27, 12),
      1,
      "SECONDS_PER_KM",
    )
    const conflicting = bucketByMonth(
      [paceObservation("conflict", "2026-07-05", 300, "CONFLICTING")],
      new Date(2026, 6, 27, 12),
      1,
      "SECONDS_PER_KM",
    )

    expect(stale[0]).toMatchObject({
      kind: "DATA",
      uncertaintyState: "STALE_SOURCE",
      displayStatus: "STALE",
      confidence: null,
    })
    expect(conflicting[0]).toMatchObject({
      kind: "DATA",
      uncertaintyState: "CONFLICTING_SOURCE",
      displayStatus: "CONFLICTING",
      confidence: null,
    })
  })

  it("excludes unverified and incomplete derived values instead of converting them to zero", () => {
    const unverified = paceObservation(
      "unverified",
      "2026-07-05",
      300,
      "SOURCE_NOT_VERIFIED",
    )
    const incomplete: StructuredJournalObservation = {
      ...paceObservation("incomplete", "2026-07-06", 310),
      fieldProvenance: {
        ...paceObservation("incomplete", "2026-07-06", 310).fieldProvenance,
        secondsPerKm: "DERIVED",
      },
      derivationRefs: [],
    }
    const observations = [unverified, incomplete]

    expect(bucketByMonth(
      observations,
      new Date(2026, 6, 27, 12),
      1,
      "SECONDS_PER_KM",
    )).toEqual([{
      kind: "MISSING",
      label: "2026-07",
      sourceRefs: [],
      confidence: null,
      uncertaintyState: "INSUFFICIENT_SOURCE",
      displayStatus: "MISSING",
      nonSensitiveReasonCodes: ["NO_ELIGIBLE_SOURCE"],
    }])
    expect(summarizeMetricCoverage(observations, "SECONDS_PER_KM")).toEqual({
      included: 0,
      excluded: 2,
    })
  })

  it("rejects invalid ranges instead of silently changing them", () => {
    expect(() => bucketByMonth([], new Date(2026, 6, 27), 0, "RPE")).toThrow(RangeError)
    expect(() => bucketByMonth([], new Date(2026, 6, 27), 1.5, "RPE")).toThrow(RangeError)
  })

  it("supports a different month range and groups by loggedOn rather than UTC time", () => {
    const localJuly = {
      ...paceObservation("local-july", "2026-07-01", 300),
      sourceRef: {
        ...paceObservation("local-july", "2026-07-01", 300).sourceRef,
        observedAt: "2026-06-30T15:30:00.000Z",
      },
    }
    const buckets = bucketByMonth(
      [localJuly],
      new Date(2026, 6, 27, 12),
      2,
      "SECONDS_PER_KM",
    )

    expect(buckets.map((bucket) => bucket.label)).toEqual(["2026-06", "2026-07"])
    expect(buckets[0]).toMatchObject({ kind: "MISSING" })
    expect(buckets[1]).toMatchObject({ kind: "DATA", n: 1, median: 300 })
  })

  it("accepts only the registered complete pace derivation", () => {
    const derived: StructuredJournalObservation = {
      ...paceObservation("derived", "2026-07-06", 300),
      fieldProvenance: {
        ...paceObservation("derived", "2026-07-06", 300).fieldProvenance,
        secondsPerKm: "DERIVED",
      },
      derivationRefs: [{
        field: "secondsPerKm",
        derivedFrom: ["distanceKm", "durationMin"],
        derivationRuleId: "JOURNAL_DISTANCE_DURATION_TO_SECONDS_PER_KM_V1",
      }],
    }

    expect(bucketByMonth(
      [derived],
      new Date(2026, 6, 27, 12),
      1,
      "SECONDS_PER_KM",
    )[0]).toMatchObject({
      kind: "DATA",
      displayStatus: "DERIVED",
      nonSensitiveReasonCodes: ["REGISTERED_DERIVATION"],
    })
  })

  it("rejects a spoofed pace derivation whose inputs are missing or disagree with the value", () => {
    const base = paceObservation("spoofed", "2026-07-06", 399)
    const ref = [{
      field: "secondsPerKm" as const,
      derivedFrom: ["distanceKm", "durationMin"] as const,
      derivationRuleId: "JOURNAL_DISTANCE_DURATION_TO_SECONDS_PER_KM_V1",
    }]
    const missingInputs: StructuredJournalObservation = {
      ...base,
      distanceKm: null,
      durationMin: null,
      fieldProvenance: {
        ...base.fieldProvenance,
        secondsPerKm: "DERIVED",
      },
      derivationRefs: ref,
    }
    const mismatchedValue: StructuredJournalObservation = {
      ...base,
      distanceKm: 5,
      durationMin: 25,
      secondsPerKm: 399,
      fieldProvenance: {
        ...base.fieldProvenance,
        secondsPerKm: "DERIVED",
      },
      derivationRefs: ref,
    }

    expect(bucketByMonth(
      [missingInputs, mismatchedValue],
      new Date(2026, 6, 27, 12),
      1,
      "SECONDS_PER_KM",
    )[0]).toMatchObject({ kind: "MISSING" })
    expect(summarizeMetricCoverage(
      [missingInputs, mismatchedValue],
      "SECONDS_PER_KM",
    )).toEqual({ included: 0, excluded: 2 })
  })
})

function fileSession(id: string, meters = 5049.49, overrides: Partial<PostSessionEntry> = {}): PostSessionEntry {
  const imported = { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "IMPORT_ACTIVITY_FILE_V1" } as const
  return {
    id, kind: "post-session", date: "2026-09-19", savedAt: "2026-09-19T10:00:00Z", syncState: "synced",
    system: "base", title: "", memo: "", distanceKm: "99.99", durationMin: "99.99", avgPace: "1:00", rpe: 6,
    fieldProvenance: {
      system: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" },
      distanceKm: imported, durationMin: imported, avgPace: imported,
    },
    fileObservation: buildFileObservation({
      format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1", sourceActivityId: id,
      date: "2026-09-19", startedAt: null, timeZone: null, sport: "RUNNING",
      distanceMeters: meters, durationSeconds: 1515.75, durationMeaning: "TIMER",
      confirmation: { sport: null, durationMeaning: null },
      laps: [{ sourceIndex: 0, distanceMeters: meters, durationSeconds: 1515.75, durationMeaning: "TIMER", kind: "UNKNOWN" }],
    }),
    ...overrides,
  }
}

function projectFiles(entries: readonly PostSessionEntry[]) {
  return projectStructuredJournalObservations(entries, {
    formats: ["tcx"], confirmedFileEntries: entries.filter(entry => entry.syncState === "synced"),
  })
}

const september = new Date(2026, 8, 19, 12)
const septemberWindow = { startDate: "2026-09-01", endDate: "2026-09-30", kind: "RECENT_MONTH", precision: "LOCAL_DATE" } as const

describe("adopted file distance across distance charts", () => {
  it("uses current-session acknowledgement, never retained ACK cache after hydration failure or owner switch", () => {
    const owner = "synthetic-distance-owner-a"
    const entry = fileSession("cached-file")
    setActiveLocalAccount(owner)
    resetAccountJournalProjection(owner)
    putAccountJournalProjection(owner, entry, true)
    const projectCurrent = () => projectStructuredJournalObservations([entry], { formats: ["tcx"] })
    const expectMissing = () => {
      const observations = projectCurrent()
      expect(eligibleMetricValue(observations[0]!, "DISTANCE_KM")).toBeNull()
      expect(bucketDistanceByWeek(observations, "2026-09-19", 1)[0]).toMatchObject({ kind: "MISSING" })
      expect(bucketByMonth(observations, september, 1, "DISTANCE_KM")[0]).toMatchObject({ kind: "MISSING" })
      expect(eligibleMetricValue(observations[0]!, "RPE")).toBe(6)
    }
    setAccountJournalProjectionStatus(owner, "FAILED")
    expectMissing()
    expect(markCurrentConfirmedAccountJournalProjection(owner, entry, 1)).toBe(true)
    setAccountJournalProjectionStatus(owner, "READY")
    expect(bucketByMonth(projectCurrent(), september, 1, "DISTANCE_KM")[0]).toMatchObject({ kind: "DATA", n: 1 })
    setAccountJournalProjectionStatus(owner, "FAILED")
    expectMissing()
    markCurrentConfirmedAccountJournalProjection(owner, entry, 1)
    setActiveLocalAccount("synthetic-distance-owner-b")
    expectMissing()
  })

  it("uses precise confirmed FILE distances, including zero, without promoting other metrics", () => {
    const observations = projectFiles([fileSession("file-a"), fileSession("file-b", 6051.51), fileSession("zero", 0)])
    const before = JSON.stringify(observations)
    expect(observations.map(value => eligibleMetricValue(value, "DISTANCE_KM"))).toEqual([5.04949, 6.05151, 0])
    expect(bucketDistanceByWeek(observations, "2026-09-19", 1)[0]).toMatchObject({ kind: "DATA", totalKm: 11.1, n: 3 })
    expect(bucketByMonth(observations, september, 1, "DISTANCE_KM")[0]).toMatchObject({
      kind: "DATA", n: 3, median: 5.04949, min: 0, max: 6.05151,
      nonSensitiveReasonCodes: expect.arrayContaining(["CONFIRMED_FILE_DISTANCE"]),
    })
    expect(summarizeMetricCoverage(observations, "DISTANCE_KM")).toEqual({ included: 3, excluded: 0 })
    for (const value of observations) {
      expect(eligibleMetricValue(value, "SECONDS_PER_KM")).toBeNull()
      expect(eligibleMetricValue(value, "RPE")).toBe(6)
      expect(acceptsExplicitField(value, "distanceKm")).toBe(false)
      expect(value.sourceRef.trustState).toBe("SOURCE_NOT_VERIFIED")
    }
    expect(bucketByMonth(observations, september, 1, "SECONDS_PER_KM")[0]).toMatchObject({ kind: "MISSING" })
    expect(JSON.stringify(observations)).toBe(before)
  })

  it("reuses cumulative source selection for duplicates and rejects later revisions before eligibility", () => {
    const original = fileSession("duplicate")
    const changed = fileSession("conflict")
    const observations = projectFiles([
      original, { ...original, id: "duplicate-copy" }, changed,
      fileSession("conflict", 8000, { id: "conflict-revision", savedAt: "2026-09-20T10:00:00Z" }),
      fileSession("independent", 7000),
    ])
    const cumulative = cumulativeDistance(observations, septemberWindow)
    expect(cumulative).toMatchObject({ includedSourceCount: 2, excludedSourceCount: 1, duplicateSourceCount: 1, conflictingSourceCount: 1 })
    expect(bucketDistanceByWeek(observations, "2026-09-19", 1)[0]).toMatchObject({
      kind: "DATA", totalKm: cumulative.totalKm, n: 2, sourceRefs: cumulative.sourceRefs,
    })
    expect(bucketByMonth(observations, september, 1, "DISTANCE_KM")[0]).toMatchObject({
      kind: "DATA", n: 2, median: (5.04949 + 7) / 2, min: 5.04949, max: 7, sourceRefs: cumulative.sourceRefs,
    })
    expect(summarizeMetricCoverage(observations, "DISTANCE_KM")).toEqual({ included: 2, excluded: 1 })

    const blockedRevision = { ...observations[0]!, acceptedFileFields: [] as const }
    const conflicted = [observations[0]!, blockedRevision]
    expect(bucketDistanceByWeek(conflicted, "2026-09-19", 1)[0]).toMatchObject({ kind: "MISSING" })
    expect(bucketByMonth(conflicted, september, 1, "DISTANCE_KM")[0]).toMatchObject({ kind: "MISSING" })
    expect(summarizeMetricCoverage(conflicted, "DISTANCE_KM")).toEqual({ included: 0, excluded: 1 })
  })

  it("keeps pending, disabled, forged and changed FILE evidence out of every distance path", () => {
    const entry = fileSession("file")
    const valid = projectFiles([entry])[0]!
    const rejected = [
      projectFiles([{ ...entry, syncState: "local" }])[0]!,
      projectStructuredJournalObservations([entry], { formats: [], confirmedFileEntries: [entry] })[0]!,
      projectStructuredJournalObservations([entry], { formats: ["tcx"], confirmedFileEntries: [] })[0]!,
      JSON.parse(JSON.stringify(valid)) as StructuredJournalObservation,
      { ...valid, distanceKm: 900 },
      { ...valid, sourceRef: { ...valid.sourceRef, sourceVersion: "other-revision" } },
      { ...valid, loggedOn: "2026-09-18" },
      { ...valid, sourceRef: { ...valid.sourceRef, trustState: "STALE" as const } },
    ]
    for (const value of rejected) {
      expect(eligibleMetricValue(value, "DISTANCE_KM")).toBeNull()
      expect(bucketDistanceByWeek([value], "2026-09-19", 1)[0]).toMatchObject({ kind: "MISSING" })
      expect(bucketByMonth([value], september, 1, "DISTANCE_KM")[0]).toMatchObject({ kind: "MISSING" })
    }
  })

  it("does not turn file admission into RPE, system or pace authority", () => {
    const entry = fileSession("imported-authority")
    const imported = entry.fieldProvenance!.distanceKm!
    const observation = projectFiles([{ ...entry, fieldProvenance: { ...entry.fieldProvenance, rpe: imported, system: imported } }])[0]!
    expect(eligibleMetricValue(observation, "DISTANCE_KM")).toBe(5.04949)
    expect(eligibleMetricValue(observation, "RPE")).toBeNull()
    expect(eligibleMetricValue(observation, "SECONDS_PER_KM")).toBeNull()
    expect(acceptsExplicitField(observation, "system")).toBe(false)
  })

  it("preserves direct-field admission and month-local conflict and coverage boundaries", () => {
    const direct = paceObservation("direct", "2026-09-19", 300, "SOURCE_NOT_VERIFIED")
    const accepted = { ...direct, acceptedExplicitFields: ["distanceKm"] as const }
    const previous = { ...accepted, loggedOn: "2026-08-31", distanceKm: 8 }
    const absent = { ...paceObservation("absent", "2026-09-19", 300), distanceKm: null, fieldProvenance: { ...direct.fieldProvenance, distanceKm: "MISSING" as const } }
    const invalidDate = { ...accepted, loggedOn: "2026-09-31" }
    const observations = [accepted, { ...accepted }, previous, absent, invalidDate]
    expect(eligibleMetricValue(direct, "DISTANCE_KM")).toBeNull()
    expect(eligibleMetricValue(invalidDate, "DISTANCE_KM")).toBeNull()
    expect(bucketByMonth(observations, september, 2, "DISTANCE_KM").map(bucket =>
      bucket.kind === "DATA" ? [bucket.n, bucket.median] : null)).toEqual([[1, 8], [1, 5]])
    expect(summarizeMetricCoverage(observations, "DISTANCE_KM")).toEqual({ included: 2, excluded: 0 })
  })

  it("labels admitted file distance without calling it direct input and keeps file pace explicitly excluded", () => {
    const observations = projectFiles([fileSession("file-source")])
    render(createElement(MonthlyTrendSection, { observations, today: "2026-09-19" }))
    expect(screen.getByText(/\uD30C\uC77C \uD398\uC774\uC2A4 \uC81C\uC678/u)).toBeVisible()
    const distance = TREND_METRIC_OPTIONS.find(option => option.metric === "DISTANCE_KM")!
    fireEvent.click(screen.getByRole("button", { name: distance.buttonLabel }))
    expect(screen.getByText(/\uD655\uC778\uD55C \uD30C\uC77C \uAC70\uB9AC \uD3EC\uD568/u)).toBeVisible()
    expect(screen.queryByText(/\uC9C1\uC811 \uAE30\uB85D/u)).not.toBeInTheDocument()
    expect(screen.getByText(/file-source.*\uD655\uC778\uD55C \uD30C\uC77C \uAC70\uB9AC/u)).toBeInTheDocument()
  })
})
