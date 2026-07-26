import { describe, expect, it } from "vitest"
import type { JournalEntry } from "./journal-store"
import { summarizeJournalDays } from "./journal-archive"

const entries: readonly JournalEntry[] = [
  {
    id: "session",
    kind: "post-session",
    date: "2026-07-24",
    savedAt: "2026-07-24T07:30:00.000Z",
    syncState: "local",
    system: "lt",
    title: "시드 템포런",
    distanceKm: "8",
    durationMin: "40",
    avgPace: "5:00",
    rpe: 6,
    memo: "OWNER_SECRET_TEXT",
    memoPurpose: "PRIVATE_SELF_ONLY",
  },
  {
    id: "evening",
    kind: "evening",
    date: "2026-07-24",
    savedAt: "2026-07-24T20:30:00.000Z",
    syncState: "local",
    sleepH: 7,
    sleepQuality: 4,
    weightKg: "",
    restingHr: "",
    painParts: { calf: 2 },
    mood: 4,
    note: "OWNER_SECRET_TEXT",
    memoPurpose: "PRIVATE_SELF_ONLY",
  },
]

describe("journal archive summaries", () => {
  it("Given a training and private evening record on one day, when summarized, then it exposes only structured reflection facts", () => {
    const [summary] = summarizeJournalDays(entries)

    expect(summary).toMatchObject({
      date: "2026-07-24",
      entryCount: 2,
      kinds: ["post-session", "evening"],
      systems: ["lt"],
      totalDurationMin: 40,
      totalDistanceKm: 8,
      mood: 4,
      highestPain: 2,
      hasBodyCheckin: true,
    })
    expect(summary).not.toHaveProperty("memo")
    expect(summary).not.toHaveProperty("note")
    expect(JSON.stringify(summary)).not.toContain("OWNER_SECRET_TEXT")
  })
})
