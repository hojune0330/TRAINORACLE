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
