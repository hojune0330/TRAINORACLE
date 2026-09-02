import { beforeEach, describe, expect, it } from "vitest"
import {
  ENGAGEMENT_STORAGE_KEY,
  awardJournalEntry,
  engagementSummary,
  loadEngagementSummary,
  reconcileJournalAwards,
  recordDailyVisit,
  toEngagementJournalRef,
} from "./engagement"
import type { EngagementJournalRef } from "./engagement"
import type { EveningEntry, PostSessionEntry, RaceEntry } from "./journal-schema"

const journal = (
  date: string,
  kind: EngagementJournalRef["kind"] = "post-session",
): EngagementJournalRef => ({ date, kind })

describe("safe local engagement", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("does not award attendance or points for opening the app", () => {
    expect(loadEngagementSummary("2026-07-24")).toMatchObject({
      points: 0,
      journalDays: 0,
      visitDays: 0,
    })
  })

  it("awards one explicit visit point per calendar date", () => {
    expect(recordDailyVisit("2026-07-24")).toMatchObject({
      kind: "AWARDED", awardedPoints: 1,
      summary: { points: 1, visitDays: 1, visitedToday: true },
    })
    expect(recordDailyVisit("2026-07-24")).toMatchObject({
      kind: "ALREADY_AWARDED", awardedPoints: 0,
      summary: { points: 1, visitDays: 1, visitedToday: true },
    })
  })

  it("counts each journal date once regardless of entry count or kind", () => {
    const entries = [
      journal("2026-07-24"),
      journal("2026-07-24", "evening"),
      journal("2026-07-23", "race"),
    ]

    expect(engagementSummary(entries, "2026-07-24")).toMatchObject({
      points: 8,
      journalDays: 2,
    })
  })

  it("does not count a memo-only entry as attendance", () => {
    const memoOnly: PostSessionEntry = {
      id: "memo-only",
      kind: "post-session",
      date: "2026-07-24",
      savedAt: "2026-07-24T12:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      memo: "private text",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }

    expect(toEngagementJournalRef(memoOnly)).toBeNull()
    expect(engagementSummary([], "2026-07-24")).toMatchObject({ points: 0, journalDays: 0 })
  })

  it("counts an explicit recovery check without reading its note", () => {
    const recovery: EveningEntry = {
      id: "recovery-check",
      kind: "evening",
      date: "2026-07-24",
      savedAt: "2026-07-24T21:00:00.000Z",
      syncState: "local",
      sleepH: 0,
      sleepQuality: 0,
      weightKg: "",
      restingHr: "",
      painParts: { calf: 2 },
      mood: 0,
      note: "private text",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }
    const ref = toEngagementJournalRef(recovery)

    expect(ref).toEqual({ date: "2026-07-24", kind: "evening" })
    expect(engagementSummary(ref === null ? [] : [ref], "2026-07-24")).toMatchObject({
      points: 4,
      journalDays: 1,
    })
  })

  it("does not award race results while allowing an explicit body self-check", () => {
    const race: RaceEntry = {
      id: "race-result",
      kind: "race",
      date: "2026-07-24",
      savedAt: "2026-07-24T12:00:00.000Z",
      syncState: "local",
      stage: "post",
      record: "4:10",
      rank: "2위",
      result: "SB",
      memo: "",
      goalPace: {
        schemaVersion: 1,
        unit: "seconds_per_kilometer",
        secondsPerKm: 180,
      },
    }

    expect(toEngagementJournalRef(race)).toBeNull()
    expect(awardJournalEntry(race, "2026-07-24")).toMatchObject({
      kind: "INELIGIBLE",
      awardedPoints: 0,
      summary: { points: 0, journalDays: 0 },
    })
    expect(toEngagementJournalRef({ ...race, tension: 4 })).toEqual({
      date: "2026-07-24",
      kind: "race",
    })
  })

  it("awards an explicitly saved rest day without requiring distance or intensity", () => {
    const rest: PostSessionEntry = {
      id: "rest-day",
      kind: "post-session",
      date: "2026-07-24",
      savedAt: "2026-07-24T12:00:00.000Z",
      syncState: "local",
      system: "rest",
      title: "",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      memo: "",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }

    expect(awardJournalEntry(rest, "2026-07-24")).toMatchObject({
      kind: "AWARDED",
      awardedPoints: 4,
      summary: { points: 4, journalDays: 1, journalRecordedToday: true },
    })
  })

  it("keeps earned journal-day points after the source entry is deleted", () => {
    const recovery: EveningEntry = {
      id: "pain-check",
      kind: "evening",
      date: "2026-07-24",
      savedAt: "2026-07-24T21:00:00.000Z",
      syncState: "local",
      sleepH: 0,
      sleepQuality: 0,
      weightKg: "",
      restingHr: "",
      painParts: { calf: 2 },
      mood: 0,
      note: "",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }

    expect(awardJournalEntry(recovery, "2026-07-24").kind).toBe("AWARDED")
    expect(reconcileJournalAwards([], "2026-07-24")).toMatchObject({
      points: 4,
      journalDays: 1,
    })
  })

  it("awards a journal date only once and combines it with the visit point", () => {
    const recovery: EveningEntry = {
      id: "same-day-recovery",
      kind: "evening",
      date: "2026-07-24",
      savedAt: "2026-07-24T21:00:00.000Z",
      syncState: "local",
      sleepH: 0,
      sleepQuality: 0,
      weightKg: "",
      restingHr: "",
      painParts: { calf: 1 },
      mood: 0,
      note: "",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }

    recordDailyVisit("2026-07-24")
    expect(awardJournalEntry(recovery, "2026-07-24")).toMatchObject({
      kind: "AWARDED",
      summary: { points: 5 },
    })
    expect(awardJournalEntry({ ...recovery, id: "second" }, "2026-07-24")).toMatchObject({
      kind: "ALREADY_AWARDED",
      summary: { points: 5 },
    })
  })

  it("does not award points for future or calendar-invalid dates", () => {
    const entries = [
      journal("2026-07-24"),
      journal("2026-07-25"),
      journal("2026-02-31"),
      journal("2026-99-99"),
    ]

    expect(engagementSummary(entries, "2026-07-24")).toMatchObject({
      points: 4,
      journalDays: 1,
    })
  })

  it("keeps a backfilled journal visible without granting spendable points", () => {
    const oldRest: PostSessionEntry = {
      id: "old-rest",
      kind: "post-session",
      date: "2026-07-20",
      savedAt: "2026-07-24T12:00:00.000Z",
      syncState: "local",
      activityOutcome: "RESTED",
      system: "rest",
      title: "휴식",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      memo: "",
    }

    expect(toEngagementJournalRef(oldRest)).toEqual({ date: "2026-07-20", kind: "post-session" })
    expect(awardJournalEntry(oldRest, "2026-07-24")).toMatchObject({
      kind: "INELIGIBLE",
      awardedPoints: 0,
      summary: { points: 0 },
    })
    expect(reconcileJournalAwards([{ date: "2026-07-20", kind: "post-session" }], "2026-07-24"))
      .toMatchObject({ points: 0, journalDays: 0 })
  })

  it("fails closed to an empty state when stored data is malformed", () => {
    window.localStorage.setItem(ENGAGEMENT_STORAGE_KEY, "{broken")

    expect(loadEngagementSummary("2026-07-24")).toMatchObject({
      points: 0,
    })
  })
})
