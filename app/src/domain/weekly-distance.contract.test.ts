import { describe, expect, it } from "vitest"
import type { StructuredJournalObservation } from "./journal-observation"
import { bucketDistanceByWeek } from "./weekly-distance"

function distanceObservation(
  sourceId: string,
  loggedOn: string,
  distanceKm: number,
  provenance: StructuredJournalObservation["fieldProvenance"]["distanceKm"] = "EXPLICIT",
): StructuredJournalObservation {
  return {
    sourceRef: {
      sourceKind: "SESSION_RESULT_RECORD",
      sourceId,
      sourceVersion: null,
      observedAt: null,
      trustState: "ACCEPTED",
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

describe("weekly provenance-safe distance", () => {
  it("counts an identical source once and excludes every conflicting revision", () => {
    const duplicate = distanceObservation("duplicate", "2026-07-21", 5.04949)
    const conflict = distanceObservation("conflict", "2026-07-22", 8)
    const buckets = bucketDistanceByWeek([
      duplicate, { ...duplicate }, conflict,
      { ...conflict, distanceKm: 10, sourceRef: { ...conflict.sourceRef, observedAt: "2026-07-23T08:00:00Z" } },
    ], "2026-07-27", 2)

    expect(buckets[0]).toEqual({
      kind: "DATA", start: "2026-07-20", end: "2026-07-26",
      totalKm: 5, n: 1, sourceRefs: [duplicate.sourceRef],
    })
  })

  it("scopes conflicting source detection to each week before aggregation", () => {
    const buckets = bucketDistanceByWeek([
      distanceObservation("same-source", "2026-07-21", 5),
      distanceObservation("same-source", "2026-07-28", 8),
    ], "2026-07-27", 2)

    expect(buckets.map(bucket => bucket.kind === "DATA" ? bucket.totalKm : null)).toEqual([5, 8])
  })

  it("sums eligible distance and leaves an empty week missing", () => {
    const buckets = bucketDistanceByWeek(
      [
        distanceObservation("current-a", "2026-07-20", 5),
        distanceObservation("current-b", "2026-07-22", 3),
        distanceObservation("legacy", "2026-07-21", 20, "LEGACY_MISSING_PROVENANCE"),
      ],
      "2026-07-27",
      2,
    )

    expect(buckets).toEqual([
      expect.objectContaining({
        kind: "DATA",
        start: "2026-07-20",
        totalKm: 8,
        n: 2,
      }),
      {
        kind: "MISSING",
        start: "2026-07-27",
        end: "2026-08-02",
        sourceRefs: [],
      },
    ])
  })
})
