import { beforeEach, describe, expect, it } from "vitest"
import {
  createEmptyDecorationState,
  decorationStateSchema,
  loadDecorationState,
  saveDecorationState,
} from "./decorations"
import type { JournalEntry } from "./journal-schema"
import { deleteEntry, entriesForDate, restoreDeletedEntry, saveEntry } from "./journal-store"
import { dropFromTrash, loadTrash, purgeExpiredTrash } from "./journal-trash"

const DATE = "2026-08-01"

function session(id: string): JournalEntry {
  return {
    id,
    kind: "post-session",
    date: DATE,
    savedAt: "2026-08-01T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "가벼운 조깅",
    distanceKm: "5",
    durationMin: "28",
    avgPace: "5:36",
    rpe: 4,
    memo: "",
  }
}

function seedJournal(id: string): void {
  if (!saveEntry(session(id)).ok) throw new Error("journal fixture save failed")
}

function seedPlacement(): void {
  const base = createEmptyDecorationState()
  const state = decorationStateSchema.parse({
    ...base,
    pagePlacements: [{ date: DATE, slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" }],
  })
  if (!saveDecorationState(state).ok) throw new Error("decoration fixture save failed")
}

beforeEach(() => {
  window.localStorage.clear()
})

describe("journal decoration placement lifecycle", () => {
  it("keeps the date decoration while the last journal entry is recoverable in trash", () => {
    // Given
    seedJournal("one")
    seedPlacement()

    // When
    expect(deleteEntry("one").ok).toBe(true)

    // Then
    expect(entriesForDate(DATE)).toEqual([])
    expect(loadTrash()).toHaveLength(1)
    expect(loadDecorationState().pagePlacements).toHaveLength(1)
  })

  it("keeps the date decoration when a trashed journal entry is restored", () => {
    // Given
    seedJournal("one")
    seedPlacement()
    expect(deleteEntry("one").ok).toBe(true)

    // When
    expect(restoreDeletedEntry("one").ok).toBe(true)

    // Then
    expect(entriesForDate(DATE)).toHaveLength(1)
    expect(loadDecorationState().pagePlacements).toHaveLength(1)
  })

  it("removes the date decoration after the last recoverable entry is permanently deleted", () => {
    // Given
    seedJournal("one")
    seedPlacement()
    expect(deleteEntry("one").ok).toBe(true)

    // When
    expect(dropFromTrash("one")).toBe(true)

    // Then
    expect(loadTrash()).toEqual([])
    expect(loadDecorationState().pagePlacements).toEqual([])
  })

  it("retains the date decoration when another active entry remains on that date", () => {
    // Given
    seedJournal("one")
    seedJournal("two")
    seedPlacement()
    expect(deleteEntry("one").ok).toBe(true)

    // When
    expect(dropFromTrash("one")).toBe(true)

    // Then
    expect(entriesForDate(DATE)).toHaveLength(1)
    expect(loadDecorationState().pagePlacements).toHaveLength(1)
  })

  it("removes the date decoration when the last trash entry expires after 30 days", () => {
    // Given
    seedJournal("one")
    seedPlacement()
    expect(deleteEntry("one").ok).toBe(true)

    // When
    const afterRetention = Date.now() + 31 * 24 * 60 * 60 * 1000
    expect(purgeExpiredTrash(afterRetention)).toBe(1)

    // Then
    expect(loadDecorationState().pagePlacements).toEqual([])
  })
})
