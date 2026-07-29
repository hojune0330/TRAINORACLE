import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as journalStore from "./journal-store"
import { loadEntries, saveEntry } from "./journal-store"

const DATE = "2026-07-20"

type JournalUpdate = (entry: unknown) => { readonly ok: boolean; readonly total: number }

function isUpdateResult(value: unknown): value is { readonly ok: unknown; readonly total: unknown } {
  return typeof value === "object" && value !== null && "ok" in value && "total" in value
}

function findJournalUpdate(): JournalUpdate | null {
  const candidate: unknown = Reflect.get(journalStore, "updateEntry")
  if (typeof candidate !== "function") return null
  return (entry: unknown) => {
    const result: unknown = candidate(entry)
    if (!isUpdateResult(result)) return { ok: false, total: 0 }
    return {
      ok: result.ok === true,
      total: typeof result.total === "number" ? result.total : 0,
    }
  }
}

describe("past local journal updates", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => vi.restoreAllMocks())

  it("replaces one existing local entry without duplicating its id", () => {
    // Given
    const original = {
      id: "past-session",
      kind: "post-session" as const,
      date: DATE,
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local" as const,
      system: "base",
      title: "Past session",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    }
    expect(saveEntry(original).ok).toBe(true)
    const updateEntry = findJournalUpdate()

    // When
    const result = updateEntry?.({ ...original, distanceKm: "6" })

    // Then
    expect(updateEntry).not.toBeNull()
    expect(result).toEqual({ ok: true, total: 1 })
    expect(loadEntries()).toEqual([{ ...original, distanceKm: "6" }])
  })

  it("does not promote a legacy record to explicit provenance during an edit", () => {
    // Given
    const original = {
      id: "legacy-session",
      kind: "post-session" as const,
      date: DATE,
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local" as const,
      system: "base",
      title: "Legacy session",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    }
    expect(saveEntry(original).ok).toBe(true)
    const updateEntry = findJournalUpdate()

    // When
    const result = updateEntry?.({
      ...original,
      distanceKm: "6",
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
      },
    })

    // Then
    expect(updateEntry).not.toBeNull()
    expect(result).toEqual({ ok: true, total: 1 })
    expect(loadEntries()).toEqual([{ ...original, distanceKm: "6" }])
  })

  it("refuses to rewrite an imported entry into a local value", () => {
    // Given
    const imported = {
      id: "imported-session",
      kind: "post-session" as const,
      date: DATE,
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local" as const,
      system: "base",
      title: "Imported session",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
      fieldProvenance: {
        distanceKm: {
          provenance: "DERIVED" as const,
          derivedFrom: ["import:activity-file"],
          derivationRuleId: "imported-activity-v1",
        },
      },
    }
    expect(saveEntry(imported).ok).toBe(true)
    const updateEntry = findJournalUpdate()

    // When
    const result = updateEntry?.({ ...imported, distanceKm: "6" })

    // Then
    expect(updateEntry).not.toBeNull()
    expect(result).toEqual({ ok: false, total: 1 })
    expect(loadEntries()).toEqual([imported])
  })

  it("refuses an edit that changes journal identity or date", () => {
    // Given
    const original = {
      id: "identity-session",
      kind: "post-session" as const,
      date: DATE,
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local" as const,
      system: "base",
      title: "Immutable identity",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    }
    expect(saveEntry(original).ok).toBe(true)
    const updateEntry = findJournalUpdate()

    // When
    const result = updateEntry?.({ ...original, date: "2026-07-21" })

    // Then
    expect(updateEntry).not.toBeNull()
    expect(result).toEqual({ ok: false, total: 1 })
    expect(loadEntries()).toEqual([original])
  })
})
