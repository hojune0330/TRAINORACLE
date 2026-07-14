import { beforeEach, describe, expect, it } from "vitest"
import {
  exportEntriesJSON,
  loadAnalysisEntries,
  loadEntries,
  saveEntry,
  type JournalEntry,
  type RaceEntry,
} from "./journal-store"

const STORAGE_KEY = "trainoracle.journal.v1"

function validRaceEntry(id: string): RaceEntry {
  return {
    id,
    kind: "race",
    date: "2026-07-14",
    savedAt: "2026-07-14T00:00:00.000Z",
    syncState: "local",
    stage: "pre",
    record: "",
    rank: "",
    result: "",
    memo: "첫 바퀴는 침착하게",
    memoPurpose: "ANALYZABLE_TRAINING_NOTE",
    tension: 7,
    condition: 4,
    mood: 5,
    goalPace: {
      schemaVersion: 1,
      unit: "seconds_per_kilometer",
      secondsPerKm: 225,
    },
  }
}

function raceWithoutPurpose(): RaceEntry {
  const { memoPurpose: _omitted, ...entry } = validRaceEntry("missing-race")
  return entry
}

describe("journal storage boundary", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("round-trips approved optional race self-check fields without inventing defaults", () => {
    // Given
    const complete = validRaceEntry("complete")
    const missingOptionalFields = {
      id: "minimal",
      kind: "race",
      date: "2026-07-14",
      savedAt: "2026-07-14T00:01:00.000Z",
      syncState: "local",
      stage: "post",
      record: "4:08.21",
      rank: "2위",
      result: "결승 진출",
      memo: "",
    } satisfies JournalEntry

    // When
    const firstSave = saveEntry(complete)
    const secondSave = saveEntry(missingOptionalFields)
    const loaded = loadEntries()

    // Then
    expect(firstSave.ok).toBe(true)
    expect(secondSave.ok).toBe(true)
    expect(loaded).toHaveLength(2)
    expect(loaded[0]).toEqual(complete)
    expect(loaded[1]).not.toHaveProperty("tension")
    expect(loaded[1]).not.toHaveProperty("condition")
    expect(loaded[1]).not.toHaveProperty("mood")
    expect(loaded[1]).not.toHaveProperty("goalPace")
  })

  it("includes raw notes only in an explicitly requested full export", () => {
    // Given
    const secret = "OWNER_EXPORT_ONLY_SECRET"
    saveEntry({
      ...validRaceEntry("owner-full-export"),
      memo: secret,
      memoPurpose: "PRIVATE_SELF_ONLY",
    })

    // When
    const defaultExport = exportEntriesJSON()
    const fullExport = exportEntriesJSON({ includeRawMemos: true })

    // Then
    expect(defaultExport).not.toContain(secret)
    expect(fullExport).toContain(secret)
    expect(fullExport).toContain("PRIVATE_SELF_ONLY")
    expect(fullExport).toContain('"exportMode": "OWNER_FULL_BACKUP"')
  })

  it.each([
    ["tension below range", { tension: 0 }],
    ["tension above range", { tension: 11 }],
    ["fractional tension", { tension: 7.5 }],
    ["condition above range", { condition: 6 }],
    ["mood below range", { mood: 0 }],
    ["zero pace", { goalPace: { schemaVersion: 1, unit: "seconds_per_kilometer", secondsPerKm: 0 } }],
    ["fractional pace", { goalPace: { schemaVersion: 1, unit: "seconds_per_kilometer", secondsPerKm: 225.5 } }],
  ])("rejects %s when saving", (_label, invalidField) => {
    // Given
    const invalid = { ...validRaceEntry("invalid"), ...invalidField }

    // When
    const result = saveEntry(invalid)

    // Then
    expect(result.ok).toBe(false)
    expect(loadEntries()).toEqual([])
  })

  it("drops malformed persisted entries while retaining a valid sibling", () => {
    // Given
    const malformed = { ...validRaceEntry("malformed"), mood: 999 }
    const valid = validRaceEntry("valid")
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([malformed, valid]))

    // When
    const loaded = loadEntries()

    // Then
    expect(loaded).toEqual([valid])
  })

  it.each([
    ["race", raceWithoutPurpose()],
    ["post-session", {
      id: "missing-session", kind: "post-session", date: "2026-07-14",
      savedAt: "2026-07-14T00:00:00.000Z", syncState: "local",
      system: "lt", title: "tempo", distanceKm: "8", durationMin: "40",
      avgPace: "5:00", rpe: 6, memo: "목적 없는 새 메모",
    }],
    ["evening", {
      id: "missing-evening", kind: "evening", date: "2026-07-14",
      savedAt: "2026-07-14T00:00:00.000Z", syncState: "local",
      sleepH: 8, sleepQuality: 4, weightKg: "", restingHr: "",
      painParts: {}, mood: 4, note: "목적 없는 새 메모",
    }],
  ] as const)("rejects a new nonempty %s note without an explicit purpose", (_kind, candidate) => {
    // When
    const result = saveEntry(candidate)

    // Then
    expect(result.ok).toBe(false)
    expect(loadEntries()).toEqual([])
  })

  it("rejects new records that claim a synced state before a sync consumer exists", () => {
    // Given
    const synced = { ...validRaceEntry("synced"), syncState: "synced" } satisfies JournalEntry

    // When
    const result = saveEntry(synced)

    // Then
    expect(result.ok).toBe(false)
    expect(loadEntries()).toEqual([])
  })

  it("projects owner-visible records into a raw-text-free analytics boundary", () => {
    // Given
    const secret = "PRIVATE_ANALYTICS_SECRET"
    saveEntry({
      ...validRaceEntry("analytics-private"),
      record: "4:08.21",
      memo: secret,
      memoPurpose: "PRIVATE_SELF_ONLY",
    })

    // When
    const projected = loadAnalysisEntries()
    const serialized = JSON.stringify(projected)

    // Then
    expect(projected).toHaveLength(1)
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toMatch(/"(?:memo|note|memoPurpose)"\s*:/u)
    expect(serialized).toContain('"record":"4:08.21"')
    expect(serialized).not.toMatch(/"(?:tension|condition|mood|goalPace)"\s*:/u)
  })

  it("keeps display-only race self-checks out of analytics while retaining them in safe export", () => {
    // Given
    saveEntry(validRaceEntry("display-only-self-checks"))

    // When
    const projected = loadAnalysisEntries()
    const exported = exportEntriesJSON()

    // Then
    expect(projected).toEqual([])
    expect(exported).toContain("display-only-self-checks")
    expect(exported).toContain('"tension": 7')
    expect(exported).toContain('"secondsPerKm": 225')
    expect(exported).not.toContain("첫 바퀴는 침착하게")
  })

  it("does not turn a private-note-only record into an analysis or progress row", () => {
    // Given
    saveEntry({
      id: "private-only",
      kind: "race",
      date: "2026-07-14",
      savedAt: "2026-07-14T00:00:00.000Z",
      syncState: "local",
      stage: "pre",
      record: "",
      rank: "",
      result: "",
      memo: "나만 보는 일기",
      memoPurpose: "PRIVATE_SELF_ONLY",
    })

    // When
    const projected = loadAnalysisEntries()

    // Then
    expect(loadEntries()).toHaveLength(1)
    expect(projected).toEqual([])
    expect(exportEntriesJSON()).not.toContain("private-only")
    expect(exportEntriesJSON()).not.toContain("나만 보는 일기")
  })
})

describe("safe journal export", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("omits private raw text and purpose metadata while retaining approved structured fields", () => {
    // Given
    const privateSecret = "PRIVATE_SECRET_7f32"
    const privateEntry = {
      ...validRaceEntry("private"),
      memo: privateSecret,
      memoPurpose: "PRIVATE_SELF_ONLY",
    } satisfies JournalEntry
    saveEntry(privateEntry)

    // When
    const exported = exportEntriesJSON()

    // Then
    expect(exported).not.toContain(privateSecret)
    expect(exported).not.toMatch(/"(?:memo|note)"\s*:/u)
    expect(exported).not.toContain("PRIVATE_SELF_ONLY")
    expect(exported).not.toMatch(/"memoPurpose"\s*:/u)
    expect(exported).toContain('"tension": 7')
    expect(exported).toMatch(/"goalPace"\s*:/u)
    expect(exported).toContain('"secondsPerKm": 225')
  })

  it.each([
    ["race", "ANALYZABLE_RACE_SECRET"],
    ["post-session", "ANALYZABLE_SESSION_SECRET"],
    ["evening", "ANALYZABLE_EVENING_SECRET"],
  ] as const)("omits analyzable raw text and purpose metadata from %s exports", (kind, secret) => {
    // Given
    const common = {
      id: kind,
      date: "2026-07-14",
      savedAt: "2026-07-14T00:00:00.000Z",
      syncState: "local" as const,
      memoPurpose: "ANALYZABLE_TRAINING_NOTE" as const,
    }
    const entry: JournalEntry = kind === "race"
      ? { ...validRaceEntry(kind), memo: secret }
      : kind === "post-session"
        ? { ...common, kind, system: "lt", title: "tempo", distanceKm: "8", durationMin: "40", avgPace: "5:00", rpe: 6, memo: secret }
        : { ...common, kind, sleepH: 8, sleepQuality: 4, weightKg: "", restingHr: "", painParts: {}, mood: 4, note: secret }
    saveEntry(entry)

    // When
    const exported = exportEntriesJSON()

    // Then
    expect(exported).not.toContain(secret)
    expect(exported).not.toContain("ANALYZABLE_TRAINING_NOTE")
    expect(exported).not.toMatch(/"(?:memo|note|memoPurpose)"\s*:/u)
  })
})
