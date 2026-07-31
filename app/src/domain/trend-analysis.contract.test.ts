import { describe, expect, it } from "vitest"
import type { StructuredJournalObservation } from "./journal-observation"
import {
  bucketByMonth,
  summarizeMetricCoverage,
} from "./trend-analysis"

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
