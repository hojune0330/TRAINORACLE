import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as journalStore from "./journal-store"
import { loadEntries, saveEntry } from "./journal-store"

const DATE = "2026-07-20"

type JournalUpdate = (
  entry: unknown,
  expectedSavedAt: string,
) => { readonly ok: boolean; readonly total: number }

function isUpdateResult(value: unknown): value is { readonly ok: unknown; readonly total: unknown } {
  return typeof value === "object" && value !== null && "ok" in value && "total" in value
}

function findJournalUpdate(): JournalUpdate | null {
  const candidate: unknown = Reflect.get(journalStore, "updateEntry")
  if (typeof candidate !== "function") return null
  return (entry: unknown, expectedSavedAt: string) => {
    const result: unknown = candidate(entry, expectedSavedAt)
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
    const result = updateEntry?.(
      { ...original, distanceKm: "6", savedAt: "2026-07-20T10:00:00.000Z" },
      original.savedAt,
    )

    // Then
    expect(updateEntry).not.toBeNull()
    expect(result).toEqual({ ok: true, total: 1 })
    expect(loadEntries()).toEqual([{
      ...original,
      distanceKm: "6",
      savedAt: "2026-07-20T10:00:00.000Z",
    }])
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
      savedAt: "2026-07-20T10:00:00.000Z",
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
      },
    }, original.savedAt)

    // Then
    expect(updateEntry).not.toBeNull()
    expect(result).toEqual({ ok: true, total: 1 })
    expect(loadEntries()).toEqual([{
      ...original,
      distanceKm: "6",
      savedAt: "2026-07-20T10:00:00.000Z",
    }])
  })

  it("drops performed-only provenance when a quick activity is corrected to rest", () => {
    const original = {
      id: "quick-correct-to-rest",
      kind: "post-session" as const,
      date: DATE,
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local" as const,
      captureDepth: "QUICK" as const,
      activityOutcome: "COMPLETED" as const,
      activitySlot: "PM" as const,
      objectiveDataState: "WAITING" as const,
      planExecutionRelation: "NOT_APPLICABLE" as const,
      painCheckStatus: "NO_SIGNAL_REPORTED" as const,
      system: "lt",
      title: "운동 완료",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 6,
      memo: "",
      fieldProvenance: {
        activityOutcome: { provenance: "EXPLICIT" as const },
        activitySlot: { provenance: "EXPLICIT" as const },
        plannedSessionLink: { provenance: "MISSING" as const },
        planExecutionRelation: {
          provenance: "DERIVED" as const,
          derivedFrom: ["activityOutcome", "plannedSessionLink"],
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
        },
        painCheckStatus: { provenance: "EXPLICIT" as const },
        painParts: { provenance: "MISSING" as const },
        system: { provenance: "EXPLICIT" as const },
        distanceKm: { provenance: "MISSING" as const },
        durationMin: { provenance: "MISSING" as const },
        avgPace: { provenance: "MISSING" as const },
        rpe: { provenance: "EXPLICIT" as const },
      },
    }
    expect(saveEntry(original).ok).toBe(true)
    const updateEntry = findJournalUpdate()

    const result = updateEntry?.({
      ...original,
      savedAt: "2026-07-20T10:00:00.000Z",
      activityOutcome: "RESTED",
      objectiveDataState: "NONE",
      title: "휴식",
      system: "",
      rpe: 0,
      activitySlot: undefined,
      painCheckStatus: undefined,
      fieldProvenance: {
        activityOutcome: { provenance: "EXPLICIT" },
        plannedSessionLink: { provenance: "MISSING" },
        planExecutionRelation: {
          provenance: "DERIVED",
          derivedFrom: ["activityOutcome", "plannedSessionLink"],
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
        },
        system: { provenance: "MISSING" },
        distanceKm: { provenance: "MISSING" },
        durationMin: { provenance: "MISSING" },
        avgPace: { provenance: "MISSING" },
        rpe: { provenance: "MISSING" },
      },
    }, original.savedAt)

    expect(updateEntry).not.toBeNull()
    expect(result).toEqual({ ok: true, total: 1 })
    const [stored] = loadEntries()
    expect(stored).toMatchObject({
      id: original.id,
      activityOutcome: "RESTED",
      objectiveDataState: "NONE",
      rpe: 0,
    })
    if (stored?.kind !== "post-session") throw new Error("Expected post-session entry")
    expect(stored.activitySlot).toBeUndefined()
    expect(stored.painCheckStatus).toBeUndefined()
    expect(stored.painParts).toBeUndefined()
    expect(stored.system).toBe("")
    expect(stored.fieldProvenance?.activitySlot).toBeUndefined()
    expect(stored.fieldProvenance?.painCheckStatus).toBeUndefined()
    expect(stored.fieldProvenance?.painParts).toBeUndefined()
    expect(stored.fieldProvenance?.system).toEqual({ provenance: "MISSING" })
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
    const result = updateEntry?.(
      { ...imported, distanceKm: "6", savedAt: "2026-07-20T10:00:00.000Z" },
      imported.savedAt,
    )

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
    const result = updateEntry?.(
      { ...original, date: "2026-07-21", savedAt: "2026-07-20T10:00:00.000Z" },
      original.savedAt,
    )

    // Then
    expect(updateEntry).not.toBeNull()
    expect(result).toEqual({ ok: false, total: 1 })
    expect(loadEntries()).toEqual([original])
  })
})
