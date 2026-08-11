import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ATHLETE_RECORDS_STORAGE_KEY,
  SEASON_WINDOW_MONTHS,
  createSelfReportedAthleteRecord,
  elapsedSinceAchieved,
  loadAthleteRecords,
  saveAthleteRecord,
  seasonWindowLabel,
} from "./athlete-records"
import type { AthleteRecord } from "./athlete-records"

const TODAY = new Date(2026, 6, 27, 12)

function personalBest(overrides: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion: 1,
    id: "pb-5000",
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1110,
    achievedOn: "2024-03-10",
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:pb-5000",
    savedAt: "2026-07-27T03:00:00.000Z",
    ...overrides,
  }
}

function seasonBest(overrides: Record<string, unknown> = {}): unknown {
  return personalBest({
    id: "sb-5000",
    purpose: "SEASON_BEST",
    seasonId: "2026 outdoor",
    sourceRef: "athlete-record:sb-5000",
    ...overrides,
  })
}

function raceGoal(overrides: Record<string, unknown> = {}): unknown {
  return personalBest({
    id: "goal-5000",
    purpose: "RACE_GOAL",
    performanceSeconds: 1050,
    achievedOn: null,
    sourceRef: "athlete-record:goal-5000",
    ...overrides,
  })
}

beforeEach(() => window.localStorage.clear())

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe("athlete record schema and storage", () => {
  it("round-trips PB, SB, recent result, and an undated race goal", () => {
    const records = [
      personalBest(),
      seasonBest(),
      personalBest({
        id: "recent-5000",
        purpose: "RECENT_RESULT",
        sourceRef: "athlete-record:recent-5000",
      }),
      raceGoal(),
    ]

    for (const record of records) {
      expect(saveAthleteRecord(record, TODAY).ok).toBe(true)
    }

    expect(loadAthleteRecords(TODAY).map((record) => record.purpose)).toEqual([
      "PERSONAL_BEST",
      "SEASON_BEST",
      "RECENT_RESULT",
      "RACE_GOAL",
    ])
  })

  it.each([
    ["PB without achieved date", personalBest({ achievedOn: null })],
    ["goal with achieved date", raceGoal({ achievedOn: "2026-07-01" })],
    ["SB without season", seasonBest({ seasonId: "" })],
    ["PB with season", personalBest({ seasonId: "2026 outdoor" })],
    ["future achievement", personalBest({ achievedOn: "2026-07-28" })],
  ])("rejects invalid purpose/date pairing: %s", (_label, candidate) => {
    expect(saveAthleteRecord(candidate, TODAY).ok).toBe(false)
    expect(loadAthleteRecords(TODAY)).toEqual([])
  })

  it.each([59, 0, -1, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects invalid event distance %s",
    (eventDistanceM) => {
      expect(saveAthleteRecord(personalBest({ eventDistanceM }), TODAY).ok).toBe(false)
    },
  )

  it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects invalid performance seconds %s",
    (performanceSeconds) => {
      expect(saveAthleteRecord(personalBest({ performanceSeconds }), TODAY).ok).toBe(false)
    },
  )

  it.each(["enteredBy", "verificationState", "sourceRef"])(
    "rejects a missing provenance field: %s",
    (field) => {
      const candidate = personalBest() as Record<string, unknown>
      delete candidate[field]
      expect(saveAthleteRecord(candidate, TODAY).ok).toBe(false)
    },
  )

  it.each([
    [
      "athlete cannot self-mark a record verified",
      { enteredBy: "ATHLETE", verificationState: "VERIFIED" },
    ],
    [
      "verified import cannot claim self-reporting",
      { enteredBy: "VERIFIED_IMPORT", verificationState: "SELF_REPORTED" },
    ],
  ])("rejects contradictory provenance: %s", (_label, overrides) => {
    expect(saveAthleteRecord(personalBest(overrides), TODAY).ok).toBe(false)
  })

  it.each(["", "race felt easy", "무릎이 아팠다"])(
    "rejects an empty or prose sourceRef: %s",
    (sourceRef) => {
      expect(saveAthleteRecord(personalBest({ sourceRef }), TODAY).ok).toBe(false)
    },
  )

  it("creates only ATHLETE and SELF_REPORTED records for self-service input", () => {
    const record = createSelfReportedAthleteRecord({
      id: "self-goal",
      purpose: "RACE_GOAL",
      eventDistanceM: 5000,
      performanceSeconds: 1050,
      achievedOn: null,
      seasonId: null,
    }, new Date("2026-07-27T03:00:00.000Z"))

    expect(record).toMatchObject({
      enteredBy: "ATHLETE",
      verificationState: "SELF_REPORTED",
      sourceRef: "athlete-record:self-goal",
      achievedOn: null,
    })
    expect(JSON.stringify(record)).not.toMatch(/COACH|VERIFIED_IMPORT|"VERIFIED"/u)
  })

  it("returns an empty list for malformed or tampered persisted data", () => {
    window.localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, "{broken")
    expect(loadAthleteRecords(TODAY)).toEqual([])

    window.localStorage.setItem(
      ATHLETE_RECORDS_STORAGE_KEY,
      JSON.stringify([personalBest(), personalBest({ eventDistanceM: 59 })]),
    )
    expect(loadAthleteRecords(TODAY)).toEqual([])
  })

  it("rejects duplicate IDs and does not overwrite corrupt storage", () => {
    window.localStorage.setItem(
      ATHLETE_RECORDS_STORAGE_KEY,
      JSON.stringify([personalBest(), personalBest()]),
    )
    expect(loadAthleteRecords(TODAY)).toEqual([])

    const corrupt = "{broken"
    window.localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, corrupt)
    expect(saveAthleteRecord(personalBest(), TODAY)).toEqual({ ok: false, total: 0 })
    expect(window.localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY)).toBe(corrupt)
  })

  it("rejects an impossible calendar date", () => {
    expect(saveAthleteRecord(
      personalBest({ achievedOn: "2026-02-30" }),
      TODAY,
    ).ok).toBe(false)
  })

  it("returns failure without crashing when localStorage write throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })

    expect(saveAthleteRecord(personalBest(), TODAY)).toEqual({ ok: false, total: 0 })
  })

  it("returns failure when localStorage accepts a write but does not persist it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined)

    expect(saveAthleteRecord(personalBest(), TODAY)).toEqual({ ok: false, total: 0 })
    expect(loadAthleteRecords(TODAY)).toEqual([])
  })

  it("reads a valid schema-v1 stored record without migration", () => {
    window.localStorage.setItem(
      ATHLETE_RECORDS_STORAGE_KEY,
      JSON.stringify([personalBest()]),
    )
    expect(loadAthleteRecords(TODAY)).toHaveLength(1)
  })
})

describe("athlete record elapsed labels", () => {
  function achieved(achievedOn: string): AthleteRecord {
    return personalBest({ achievedOn }) as AthleteRecord
  }

  it.each([
    ["2026-07-03", "이번 달"],
    ["2026-03-27", "4개월 전"],
    ["2023-05-10", "3년 2개월 전"],
  ])("labels %s as %s", (achievedOn, label) => {
    expect(elapsedSinceAchieved(achieved(achievedOn), TODAY)?.label).toBe(label)
  })

  it("keeps exactly 18 months inside the display-only season window", () => {
    expect(SEASON_WINDOW_MONTHS).toBe(18)
    expect(seasonWindowLabel(
      seasonBest({ achievedOn: "2025-01-27" }) as Extract<
        AthleteRecord,
        { readonly purpose: "SEASON_BEST" }
      >,
      TODAY,
    )).toMatchObject({ withinWindow: true })
    expect(seasonWindowLabel(
      seasonBest({ achievedOn: "2024-12-27" }) as Extract<
        AthleteRecord,
        { readonly purpose: "SEASON_BEST" }
      >,
      TODAY,
    )).toMatchObject({ withinWindow: false })
  })

  it("does not create an elapsed label for a race goal", () => {
    expect(elapsedSinceAchieved(raceGoal() as AthleteRecord, TODAY)).toBeNull()
  })
})
