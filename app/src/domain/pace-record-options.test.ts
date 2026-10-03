import { describe, expect, it } from "vitest"
import type { AthleteRecord } from "./athlete-records"
import { derivePaceRecordOptions } from "./pace-record-options"
import type { PaceRecordInput, PaceRecordSelectionBadge } from "./pace-record-options"

const TODAY = "2026-10-02"

function record(id: string, overrides: Partial<PaceRecordInput> = {}): PaceRecordInput {
  return {
    schemaVersion: 1,
    id,
    purpose: "RECENT_RESULT",
    eventDistanceM: 5000,
    performanceSeconds: 1100,
    achievedOn: "2026-10-01",
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: `athlete-record:${id}`,
    savedAt: "2026-10-02T00:00:00.000Z",
    ...overrides,
  }
}

function idsFor(records: readonly PaceRecordInput[], badge: PaceRecordSelectionBadge, today = TODAY): string[] {
  return derivePaceRecordOptions(records, 5000, today).options
    .filter((option) => option.badges.includes(badge)).map((option) => option.recordId)
}

describe("derivePaceRecordOptions", () => {
  it("accepts the existing readonly AthleteRecord array", () => {
    const records: readonly AthleteRecord[] = [{ ...record("existing"), purpose: "RECENT_RESULT", achievedOn: TODAY, seasonId: null }]
    expect(derivePaceRecordOptions(records, 5000, TODAY).recommendedRecordId).toBe("existing")
  })

  it("recommends the most recent actual, not the fastest or most recently saved", () => {
    const records = [
      record("lifetime", { performanceSeconds: 900, achievedOn: "2020-01-01" }),
      record("rolling", { performanceSeconds: 1000, achievedOn: "2026-03-01", savedAt: "2026-10-02T01:00:00.000Z" }),
      record("latest", { purpose: "PERSONAL_BEST", performanceSeconds: 1200 }),
      record("goal", { purpose: "RACE_GOAL", performanceSeconds: 800, achievedOn: null }),
      record("ordinary", { performanceSeconds: 1300, achievedOn: "2026-02-01" }),
    ]
    const result = derivePaceRecordOptions(records, 5000, TODAY)
    expect(result.options.map((option) => [option.recordId, option.badges])).toEqual([
      ["latest", ["RECENT_ACTUAL"]], ["rolling", ["ROLLING_12_BEST"]],
      ["lifetime", ["LIFETIME_BEST"]], ["goal", ["GOAL"]],
    ])
    expect(result.recommendedRecordId).toBe("latest")
    expect(result.latestStatus).toBe("UNAMBIGUOUS")
    expect(result.options.find((option) => option.recordId === "lifetime")?.dateStatus).toBe("OUTSIDE_ROLLING_12")
  })

  it("deduplicates one source across badges and repeated input without mutating inputs", () => {
    const source = Object.freeze(record("only"))
    const records = Object.freeze([source, source])
    const result = derivePaceRecordOptions(records, 5000, TODAY)
    expect(result.options).toHaveLength(1)
    expect(result.options[0]?.badges).toEqual(["RECENT_ACTUAL", "ROLLING_12_BEST", "LIFETIME_BEST"])
    expect(result.options[0]?.sourceSnapshot).toEqual(source)
    expect(result.options[0]?.sourceSnapshot).not.toBe(source)
    expect(result.options[0]?.sourceSnapshot.savedAt).toBe(source.savedAt)
    expect(records).toEqual([source, source])
  })

  it("copies only structured source fields and detaches snapshots from later edits", () => {
    const source = { ...record("copy"), memo: "must not propagate" }
    const result = derivePaceRecordOptions([source], 5000, TODAY)
    source.performanceSeconds = 1
    expect(result.options[0]?.sourceSnapshot.performanceSeconds).toBe(1100)
    expect(result.options[0]?.sourceSnapshot).not.toHaveProperty("memo")
  })

  it("marks equal-date differing times ambiguous and never automatically recommends the fastest", () => {
    const records = [record("slow", { performanceSeconds: 1200 }), record("fast", { performanceSeconds: 1000 })]
    for (const input of [records, [...records].reverse()]) {
      const result = derivePaceRecordOptions(input, 5000, TODAY)
      expect(result.latestStatus).toBe("AMBIGUOUS")
      expect(result.recommendedRecordId).toBeNull()
      expect(idsFor(input, "RECENT_ACTUAL")).toEqual(["fast", "slow"])
    }
  })

  it("keeps same-date equal-time sources distinct but uses stable identity for an equivalent recommendation", () => {
    const records = [record("b"), record("a")]
    expect(derivePaceRecordOptions(records, 5000, TODAY)).toEqual(derivePaceRecordOptions([...records].reverse(), 5000, TODAY))
    expect(derivePaceRecordOptions(records, 5000, TODAY).recommendedRecordId).toBe("a")
    expect(idsFor(records, "LIFETIME_BEST")).toEqual(["a", "b"])
  })

  it("does not let older ties make a unique latest record ambiguous", () => {
    const result = derivePaceRecordOptions([
      record("a", { achievedOn: "2026-01-01", performanceSeconds: 1000 }),
      record("b", { achievedOn: "2026-01-01", performanceSeconds: 1001 }), record("latest"),
    ], 5000, TODAY)
    expect(result.latestStatus).toBe("UNAMBIGUOUS")
    expect(result.recommendedRecordId).toBe("latest")
  })

  it.each([
    ["2026-10-02", "2025-10-02", "2025-10-01"],
    ["2024-02-29", "2023-02-28", "2023-02-27"],
    ["2025-02-28", "2024-02-28", "2024-02-27"],
    ["2025-03-01", "2024-03-01", "2024-02-29"],
    ["2024-03-31", "2023-03-31", "2023-03-30"],
    ["2026-04-30", "2025-04-30", "2025-04-29"],
    ["2026-01-01", "2025-01-01", "2024-12-31"],
    ["2000-02-29", "1999-02-28", "1999-02-27"],
  ])("uses exact inclusive calendar boundaries for %s", (today, start, outside) => {
    const records = [record("boundary", { achievedOn: start }), record("old", { achievedOn: outside, performanceSeconds: 900 })]
    const result = derivePaceRecordOptions(records, 5000, today)
    expect(result.rollingWindowStart).toBe(start)
    expect(idsFor(records, "RECENT_ACTUAL", today)).toEqual(["boundary"])
    expect(idsFor(records, "ROLLING_12_BEST", today)).toEqual(["boundary"])
    expect(idsFor(records, "LIFETIME_BEST", today)).toEqual(["old"])
    expect(result.recommendedRecordId).toBe("boundary")
  })

  it("includes today and excludes tomorrow even from lifetime best", () => {
    const result = derivePaceRecordOptions([
      record("today", { achievedOn: TODAY }),
      record("future", { achievedOn: "2026-10-03", performanceSeconds: 900 }),
    ], 5000, TODAY)
    expect(result.recommendedRecordId).toBe("today")
    expect(result.options.map((option) => option.recordId)).toEqual(["today"])
    expect(result.excluded).toEqual([{ recordId: "future", reason: "FUTURE_DATE" }])
  })

  it("allows undated actual lifetime best without rolling badges or recommendation", () => {
    const undated = record("undated", { achievedOn: null, performanceSeconds: 900 })
    const records = [undated, record("dated")]
    expect(idsFor(records, "LIFETIME_BEST")).toEqual(["undated"])
    expect(idsFor(records, "ROLLING_12_BEST")).toEqual(["dated"])
    const result = derivePaceRecordOptions([undated], 5000, TODAY)
    expect(result.options[0]?.dateStatus).toBe("UNDATED")
    expect(result.options[0]?.sourceSnapshot.achievedOn).toBeNull()
    expect(result.latestStatus).toBe("NONE")
    expect(result.recommendedRecordId).toBeNull()
  })

  it("keeps all goals separate, never best, including when goals are the only records", () => {
    const records = [record("goal-a", { purpose: "RACE_GOAL", achievedOn: null }), record("goal-b", { purpose: "RACE_GOAL", achievedOn: null, performanceSeconds: 800 })]
    const result = derivePaceRecordOptions(records, 5000, TODAY)
    expect(result.options.map((option) => option.badges)).toEqual([["GOAL"], ["GOAL"]])
    expect(result.recommendedRecordId).toBeNull()
    expect(result.latestStatus).toBe("NONE")
  })

  it.each([21097, 21097.5])("canonicalizes half-marathon request %s while preserving original source distances", (distance) => {
    const records = [record("legacy", { eventDistanceM: 21097 }), record("canonical", { eventDistanceM: 21097.5 }), record("other", { eventDistanceM: 21098 })]
    const result = derivePaceRecordOptions(records, distance, TODAY)
    expect(result.eventDistanceM).toBe(21097.5)
    expect(result.options.map((option) => option.recordId)).toEqual(["canonical", "legacy"])
    expect(result.options[1]?.sourceSnapshot.eventDistanceM).toBe(21097)
    expect(derivePaceRecordOptions(records, 5000, TODAY).options).toEqual([])
  })

  it.each(["", "2026-2-01", "2026-02-29", "2026-04-31", "2026-00-01", "2026-13-01", "2026-01-00", "2026-10-02T00:00:00Z", "0000-01-01", "1900-02-29"])("rejects invalid today and achievement dates: %s", (invalid) => {
    const result = derivePaceRecordOptions([record("valid")], 5000, invalid)
    expect(result.status).toBe("INVALID_TODAY")
    expect(result.options).toEqual([])
    expect(result.recommendedRecordId).toBeNull()
    expect(result.rollingWindowStart).toBeNull()
    const badRecord = derivePaceRecordOptions([record("bad", { achievedOn: invalid })], 5000, TODAY)
    expect(badRecord.options).toEqual([])
    expect(badRecord.excluded).toEqual([{ recordId: "bad", reason: "INVALID_DATE" }])
  })

  it("rejects goals that pretend to have an achievement date", () => {
    expect(derivePaceRecordOptions([record("bad-goal", { purpose: "RACE_GOAL" })], 5000, TODAY).excluded)
      .toEqual([{ recordId: "bad-goal", reason: "INVALID_DATE" }])
  })

  it.each([0, -1, NaN, Infinity])("excludes invalid performance %s", (performanceSeconds) => {
    const result = derivePaceRecordOptions([record("bad", { performanceSeconds }), record("valid")], 5000, TODAY)
    expect(result.recommendedRecordId).toBe("valid")
    expect(result.excluded).toEqual([{ recordId: "bad", reason: "INVALID_PERFORMANCE" }])
  })

  it.each([0, 59, -1, NaN, Infinity])("rejects invalid event distance %s", (distance) => {
    expect(derivePaceRecordOptions([record("bad", { eventDistanceM: distance })], distance, TODAY).status).toBe("INVALID_EVENT_DISTANCE")
  })

  it("excludes conflicting duplicate identities instead of choosing by input order", () => {
    const records = [record("duplicate"), record("duplicate", { performanceSeconds: 900 })]
    for (const input of [records, [...records].reverse()]) {
      const result = derivePaceRecordOptions(input, 5000, TODAY)
      expect(result.options).toEqual([])
      expect(result.recommendedRecordId).toBeNull()
      expect(result.excluded).toEqual([{ recordId: "duplicate", reason: "CONFLICTING_ID" }])
    }
  })

  it("returns no recommendation for old-only or empty inputs", () => {
    for (const records of [[], [record("old", { achievedOn: "2020-01-01" })]]) {
      const result = derivePaceRecordOptions(records, 5000, TODAY)
      expect(result.latestStatus).toBe("NONE")
      expect(result.recommendedRecordId).toBeNull()
    }
  })
})
