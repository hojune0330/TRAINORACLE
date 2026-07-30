import { beforeEach, describe, expect, it } from "vitest"
import type { PostSessionEntry } from "./journal-store"
import {
  deleteEntry,
  loadEntries,
  nextJournalSavedAt,
  replaceAllEntries,
  updateEntry,
} from "./journal-store"
import { loadTombstones } from "./account/tombstone"
import { mergeEntries } from "./account/sync"
import { loadTrash } from "./journal-trash"

const ORIGINAL_SAVED_AT = "2026-07-20T09:00:00.000Z"

function session(
  id: string,
  overrides: Partial<PostSessionEntry> = {},
): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-07-20",
    savedAt: ORIGINAL_SAVED_AT,
    syncState: "local",
    system: "base",
    title: "Easy run",
    distanceKm: "5",
    durationMin: "25",
    avgPace: "5:00",
    rpe: 6,
    memo: "",
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe("journal update integrity", () => {
  it("creates a strictly newer timestamp even when the prior timestamp is in the future", () => {
    // Given
    const future = "2999-01-01T00:00:00.000Z"

    // When
    const next = nextJournalSavedAt(future)

    // Then
    expect(Date.parse(next)).toBe(Date.parse(future) + 1)
  })

  it("refuses an ambiguous update when stored entries share an id", () => {
    // Given
    const first = session("duplicate", { title: "First" })
    const second = session("duplicate", { title: "Second" })
    expect(replaceAllEntries([first, second]).ok).toBe(true)

    // When
    const result = updateEntry(
      { ...first, title: "Edited", savedAt: "2026-07-20T10:00:00.000Z" },
      ORIGINAL_SAVED_AT,
    )

    // Then
    expect(result).toEqual({ ok: false, total: 2 })
    expect(loadEntries()).toEqual([first, second])
  })

  it("refuses an ambiguous delete without creating trash or a tombstone", () => {
    // Given
    const first = session("duplicate", { title: "First" })
    const second = session("duplicate", { title: "Second" })
    expect(replaceAllEntries([first, second]).ok).toBe(true)

    // When
    const result = deleteEntry("duplicate")

    // Then
    expect(result).toEqual({ ok: false, total: 2, trashed: false })
    expect(loadEntries()).toEqual([first, second])
    expect(loadTrash()).toEqual([])
    expect(loadTombstones()).toEqual([])
  })

  it("rejects a stale edit after another tab saved a newer version", () => {
    // Given
    const original = session("same-entry")
    expect(replaceAllEntries([original]).ok).toBe(true)

    // When
    const firstResult = updateEntry(
      { ...original, title: "Saved in tab A", savedAt: "2026-07-20T10:00:00.000Z" },
      ORIGINAL_SAVED_AT,
    )
    const staleResult = updateEntry(
      { ...original, distanceKm: "6", savedAt: "2026-07-20T11:00:00.000Z" },
      ORIGINAL_SAVED_AT,
    )

    // Then
    expect(firstResult).toEqual({ ok: true, total: 1 })
    expect(staleResult).toEqual({ ok: false, total: 1 })
    expect(loadEntries()).toEqual([
      expect.objectContaining({
        id: "same-entry",
        title: "Saved in tab A",
        distanceKm: "5",
        savedAt: "2026-07-20T10:00:00.000Z",
      }),
    ])
  })

  it("keeps the edited local version over an older remote copy", () => {
    // Given
    const original = session("sync-entry")
    const staleRemote = session("sync-entry", {
      title: "Older remote copy",
      savedAt: "2026-07-20T09:30:00.000Z",
    })
    expect(replaceAllEntries([original]).ok).toBe(true)

    // When
    const result = updateEntry(
      {
        ...original,
        title: "Edited on this device",
        savedAt: "2026-07-20T10:00:00.000Z",
      },
      ORIGINAL_SAVED_AT,
    )
    const merged = mergeEntries(loadEntries(), [staleRemote], new Set())

    // Then
    expect(result).toEqual({ ok: true, total: 1 })
    expect(merged).toEqual([
      expect.objectContaining({
        id: "sync-entry",
        title: "Edited on this device",
        savedAt: "2026-07-20T10:00:00.000Z",
      }),
    ])
  })

  it("preserves untouched derived and unknown provenance during an edit", () => {
    // Given
    const original = session("provenance", {
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
        durationMin: { provenance: "EXPLICIT" },
        avgPace: {
          provenance: "DERIVED",
          derivedFrom: ["distanceKm", "durationMin"],
          derivationRuleId: "pace-from-distance-duration-v1",
        },
      },
    })
    expect(replaceAllEntries([original]).ok).toBe(true)

    // When
    const result = updateEntry(
      {
        ...original,
        title: "Renamed only",
        savedAt: "2026-07-20T10:00:00.000Z",
        fieldProvenance: {
          distanceKm: { provenance: "EXPLICIT" },
          durationMin: { provenance: "EXPLICIT" },
          avgPace: { provenance: "EXPLICIT" },
          rpe: { provenance: "EXPLICIT" },
          plannedRpe: { provenance: "MISSING" },
          objectiveComponents: { provenance: "MISSING" },
        },
      },
      ORIGINAL_SAVED_AT,
    )

    // Then
    expect(result).toEqual({ ok: true, total: 1 })
    expect(loadEntries()[0]?.fieldProvenance).toEqual(original.fieldProvenance)
  })

  it("marks a changed structured field explicit without promoting untouched fields", () => {
    // Given
    const original = session("changed-field", {
      fieldProvenance: {
        distanceKm: {
          provenance: "DERIVED",
          derivedFrom: ["durationMin"],
          derivationRuleId: "distance-from-duration-v1",
        },
        durationMin: { provenance: "EXPLICIT" },
      },
    })
    expect(replaceAllEntries([original]).ok).toBe(true)

    // When
    const result = updateEntry(
      {
        ...original,
        distanceKm: "6",
        savedAt: "2026-07-20T10:00:00.000Z",
        fieldProvenance: {
          distanceKm: { provenance: "EXPLICIT" },
          durationMin: { provenance: "EXPLICIT" },
          avgPace: { provenance: "EXPLICIT" },
          rpe: { provenance: "EXPLICIT" },
          plannedRpe: { provenance: "MISSING" },
          objectiveComponents: { provenance: "MISSING" },
        },
      },
      ORIGINAL_SAVED_AT,
    )

    // Then
    expect(result).toEqual({ ok: true, total: 1 })
    expect(loadEntries()[0]?.fieldProvenance).toEqual({
      distanceKm: { provenance: "EXPLICIT" },
      durationMin: { provenance: "EXPLICIT" },
    })
  })
})
