import { beforeEach, describe, expect, it } from "vitest"
import {
  engagementSummary,
  toEngagementJournalRef,
} from "./engagement"
import type { EngagementJournalRef } from "./engagement"
import type { EveningEntry, PostSessionEntry } from "./journal-schema"

const journal = (
  date: string,
  kind: EngagementJournalRef["kind"] = "post-session",
): EngagementJournalRef => ({ date, kind })

describe("safe local engagement", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("does not award attendance or points for opening the app", () => {
    expect(engagementSummary([], "2026-07-24")).toMatchObject({
      points: 0,
      journalDays: 0,
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
    })
  })
})
