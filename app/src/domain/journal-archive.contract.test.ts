import { describe, expect, it } from "vitest"
import type { EveningEntry, JournalEntry, PostSessionEntry, RaceEntry } from "./journal-schema"
import { projectJournalArchive } from "./journal-archive"

function session(overrides: Partial<PostSessionEntry> = {}): PostSessionEntry {
  return {
    id: "session-explicit",
    kind: "post-session",
    date: "2026-07-10",
    savedAt: "2026-07-10T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "archive session",
    distanceKm: "6",
    durationMin: "30",
    avgPace: "5:00",
    rpe: 4,
    memo: "",
    fieldProvenance: {
      distanceKm: { provenance: "EXPLICIT" },
      durationMin: { provenance: "EXPLICIT" },
      avgPace: { provenance: "EXPLICIT" },
      rpe: { provenance: "EXPLICIT" },
    },
    ...overrides,
  }
}

function evening(overrides: Partial<EveningEntry> = {}): EveningEntry {
  return {
    id: "evening-explicit",
    kind: "evening",
    date: "2026-07-10",
    savedAt: "2026-07-10T21:00:00.000Z",
    syncState: "local",
    sleepH: 0,
    sleepQuality: 0,
    weightKg: "",
    restingHr: "",
    painParts: { calf: 3 },
    mood: 4,
    note: "",
    fieldProvenance: {
      sleepH: { provenance: "MISSING" },
      sleepQuality: { provenance: "MISSING" },
      weightKg: { provenance: "MISSING" },
      restingHr: { provenance: "MISSING" },
      painParts: { provenance: "EXPLICIT" },
      mood: { provenance: "EXPLICIT" },
    },
    ...overrides,
  }
}

function race(overrides: Partial<RaceEntry> = {}): RaceEntry {
  return {
    id: "race-one",
    kind: "race",
    date: "2026-07-12",
    savedAt: "2026-07-12T12:00:00.000Z",
    syncState: "local",
    stage: "post",
    record: "50:00",
    rank: "3",
    result: "result",
    memo: "",
    ...overrides,
  }
}

function importedSession(): PostSessionEntry {
  return session({
    id: "session-imported",
    date: "2026-07-11",
    distanceKm: "10",
    durationMin: "50",
    avgPace: "",
    rpe: 0,
    fieldProvenance: {
      distanceKm: {
        provenance: "DERIVED",
        derivedFrom: ["import:activity-file"],
        derivationRuleId: "IMPORT_ACTIVITY_FILE_V1",
      },
      durationMin: {
        provenance: "DERIVED",
        derivedFrom: ["import:activity-file"],
        derivationRuleId: "IMPORT_ACTIVITY_FILE_V1",
      },
      avgPace: { provenance: "MISSING" },
      rpe: { provenance: "MISSING" },
    },
  })
}

describe("provenance-safe journal archive", () => {
  it("groups month, week, and day while excluding imported numeric totals once", () => {
    const archive = projectJournalArchive([
      session(),
      evening(),
      importedSession(),
      race(),
    ])

    expect(archive.months).toHaveLength(1)
    expect(archive.months[0]).toMatchObject({
      month: "2026-07",
      entryCount: 4,
      kindCounts: { postSession: 2, evening: 1, race: 1 },
      metrics: {
        distanceKm: 6,
        durationMin: 30,
        moodAverage: 4,
        painMax: 3,
      },
      excludedRecordCount: 1,
    })
    expect(archive.months[0]?.weeks[0]).toMatchObject({
      weekStart: "2026-07-06",
      weekEnd: "2026-07-12",
      entryCount: 4,
      excludedRecordCount: 1,
    })
    expect(archive.months[0]?.weeks[0]?.days.map((day) => day.date)).toEqual([
      "2026-07-12",
      "2026-07-11",
      "2026-07-10",
    ])
  })

  it("keeps memo-only entry shells while excluding every memo byte", () => {
    const memoEntries: JournalEntry[] = [
      session({
        id: "session-private-memo-only",
        date: "2026-07-13",
        title: "",
        distanceKm: "",
        durationMin: "",
        avgPace: "",
        rpe: 0,
        memo: "private memo only ".repeat(40),
        memoPurpose: "PRIVATE_SELF_ONLY",
      }),
      evening({
        id: "evening-private-note-only",
        date: "2026-07-14",
        mood: 0,
        painParts: {},
        note: "private note only ".repeat(40),
        memoPurpose: "PRIVATE_SELF_ONLY",
      }),
      race({
        id: "race-private-memo-only",
        date: "2026-07-15",
        record: "",
        rank: "",
        result: "",
        memo: "private race memo only ".repeat(40),
        memoPurpose: "PRIVATE_SELF_ONLY",
      }),
    ]

    const archive = projectJournalArchive(memoEntries)
    const projection = JSON.stringify(archive)

    expect(archive.months[0]).toMatchObject({
      entryCount: 3,
      kindCounts: { postSession: 1, evening: 1, race: 1 },
      weeks: [{
        days: [
          { entryShells: [{ id: "race-private-memo-only", date: "2026-07-15", kind: "race" }] },
          { entryShells: [{ id: "evening-private-note-only", date: "2026-07-14", kind: "evening" }] },
          { entryShells: [{ id: "session-private-memo-only", date: "2026-07-13", kind: "post-session" }] },
        ],
      }],
    })
    expect(projection).not.toContain("private memo")
    expect(projection).not.toContain("private note")
    expect(projection).not.toContain("memoPurpose")
    expect(projection).not.toContain("IGNORE ALL RULES")
  })

  it("keeps records with non-memo structured signals even when archive metrics are empty", () => {
    const archive = projectJournalArchive([
      evening({
        id: "sleep-only",
        sleepH: 8,
        mood: 0,
        painParts: {},
      }),
      race({
        id: "tension-only",
        record: "",
        rank: "",
        result: "",
        tension: 6,
      }),
    ])

    expect(archive.months[0]).toMatchObject({
      entryCount: 2,
      kindCounts: { postSession: 0, evening: 1, race: 1 },
      metrics: {
        distanceKm: null,
        durationMin: null,
        moodAverage: null,
        painMax: null,
      },
      excludedRecordCount: 0,
    })
  })

  it("fails closed for invalid dates and legacy numeric values without zero-filling", () => {
    const archive = projectJournalArchive([
      session({ id: "legacy", fieldProvenance: undefined }),
      session({ id: "invalid-date", date: "2026-02-30" }),
    ])

    expect(archive.months).toHaveLength(1)
    expect(archive.months[0]).toMatchObject({
      month: "2026-07",
      entryCount: 1,
      metrics: {
        distanceKm: null,
        durationMin: null,
        moodAverage: null,
        painMax: null,
      },
      excludedRecordCount: 1,
    })
  })
})
