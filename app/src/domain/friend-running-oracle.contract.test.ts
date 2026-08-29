import { describe, expect, it } from "vitest"
import type { StructuredJournalObservation } from "./journal-observation"
import type { AthleteRecord } from "./athlete-records"
import {
  buildOracleComparisonSnapshot,
  deriveFriendRunningOracle,
  oracleComparisonSnapshotSchema,
} from "./friend-running-oracle"

const today = "2026-08-29"

function record(id: string, seconds: number): AthleteRecord {
  return {
    schemaVersion: 1,
    id,
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: seconds,
    achievedOn: "2026-08-20",
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "SELF_REPORTED_FORM",
    savedAt: "2026-08-20T09:00:00.000Z",
  }
}

function observation(id: string, key: "BASE" | "LT", distanceKm: number): StructuredJournalObservation {
  return {
    sourceRef: {
      sourceKind: "SESSION_RESULT_RECORD",
      sourceId: id,
      sourceVersion: null,
      observedAt: "2026-08-20T09:00:00.000Z",
      trustState: "ACCEPTED",
      containsPrivateRawText: false,
    },
    loggedOn: "2026-08-20",
    energySystem: key,
    distanceKm,
    durationMin: 40,
    secondsPerKm: null,
    rpe: 4,
    mood: null,
    painMax: null,
    painSourceLevels: [],
    fieldProvenance: {
      system: "EXPLICIT",
      distanceKm: "EXPLICIT",
      durationMin: "EXPLICIT",
      secondsPerKm: "MISSING",
      rpe: "EXPLICIT",
      mood: "MISSING",
      painMax: "MISSING",
    },
    derivationRefs: [],
  }
}

describe("friend running oracle", () => {
  it("publishes only explicitly selected aggregate fields", () => {
    const snapshot = buildOracleComparisonSnapshot({
      observations: [observation("a", "BASE", 8), observation("b", "LT", 6)],
      records: [record("pb", 1110)],
      selection: { recordId: "pb", shareRecord: true, shareDistance: false, shareEnergy: true },
      today,
    })

    expect(snapshot).toMatchObject({
      sharedFields: ["BEST_RECORD", "ENERGY_HISTORY"],
      record: { eventDistanceM: 5000, bestSeconds: 1110 },
      recent8WeekDistanceKm: null,
      structuredSessionCount: 2,
    })
    expect(JSON.stringify(snapshot)).not.toMatch(/memo|pain|sleep|location|contact|symptom/iu)
  })

  it("refuses to create a snapshot when no field is selected", () => {
    expect(buildOracleComparisonSnapshot({
      observations: [],
      records: [record("pb", 1110)],
      selection: { recordId: null, shareRecord: false, shareDistance: false, shareEnergy: false },
      today,
    })).toBeNull()
  })

  it("describes the comparison without ranking ability or prescribing one shared pace", () => {
    const own = oracleComparisonSnapshotSchema.parse({
      schemaVersion: 1,
      sharedFields: ["BEST_RECORD", "RECENT_DISTANCE", "ENERGY_HISTORY"],
      record: { eventDistanceM: 5000, bestSeconds: 1080 },
      recent8WeekDistanceKm: 80,
      structuredSessionCount: 4,
      energySessionCounts: [{ key: "BASE", count: 3 }, { key: "LT", count: 1 }],
    })
    const friend = oracleComparisonSnapshotSchema.parse({
      schemaVersion: 1,
      sharedFields: ["BEST_RECORD", "RECENT_DISTANCE", "ENERGY_HISTORY"],
      record: { eventDistanceM: 5000, bestSeconds: 1140 },
      recent8WeekDistanceKm: 64,
      structuredSessionCount: 3,
      energySessionCounts: [{ key: "LT", count: 2 }],
    })
    const result = deriveFriendRunningOracle(own, friend)

    expect(result.facts.join(" ")).toContain("기록 차이는 5.3%")
    expect(result.togetherPlan.join(" ")).toContain("각자의 기록과 RPE")
    expect(JSON.stringify(result)).not.toMatch(/승자|패자|우수|열등|같은 페이스로/iu)
  })
})
