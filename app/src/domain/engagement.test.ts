import { beforeEach, describe, expect, it } from "vitest"
import {
  engagementSummary,
  recordDailyVisit,
} from "./engagement"
import type { EngagementJournalRef } from "./engagement"

const journal = (
  date: string,
  kind: EngagementJournalRef["kind"] = "post-session",
): EngagementJournalRef => ({ date, kind })

describe("safe local engagement", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("awards one daily visit only once", () => {
    recordDailyVisit("2026-07-24")
    recordDailyVisit("2026-07-24")

    expect(engagementSummary([], "2026-07-24")).toMatchObject({
      points: 1,
      visitDays: 1,
      journalDays: 0,
    })
  })

  it("counts each journal date once regardless of entry count or kind", () => {
    recordDailyVisit("2026-07-24")
    const entries = [
      journal("2026-07-24"),
      journal("2026-07-24", "evening"),
      journal("2026-07-23", "race"),
    ]

    expect(engagementSummary(entries, "2026-07-24")).toMatchObject({
      points: 9,
      visitDays: 1,
      journalDays: 2,
      recordingStreak: 2,
    })
  })

  it("allows rest or pain check-in days to maintain the recording streak", () => {
    const entries = [
      journal("2026-07-22", "evening"),
      journal("2026-07-23", "evening"),
      journal("2026-07-24", "post-session"),
    ]

    expect(engagementSummary(entries, "2026-07-24").recordingStreak).toBe(3)
  })

  it("does not inspect distance, pain, memo, or plan compliance fields", () => {
    const enrichedJournalRef = {
      ...journal("2026-07-24"),
      distanceKm: 999,
      painParts: { knee: 5 },
      memo: "private text",
      planCompleted: true,
    }
    const first = engagementSummary([enrichedJournalRef], "2026-07-24")
    const second = engagementSummary([journal("2026-07-24", "evening")], "2026-07-24")

    expect(first).toEqual(second)
    expect(JSON.stringify(first)).not.toMatch(/distance|private text|memo|pain|plan/u)
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
      recordingStreak: 1,
    })
  })

  it("fails closed to an empty state when stored data is malformed", () => {
    window.localStorage.setItem("trainoracle.engagement.v1", "{broken")

    expect(engagementSummary([], "2026-07-24")).toMatchObject({
      points: 0,
      visitDays: 0,
    })
  })
})
