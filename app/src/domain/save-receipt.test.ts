import { describe, expect, it } from "vitest"
import { explicitOrMissing } from "./field-provenance"
import type { JournalEntry } from "./journal-store"
import { createSavedFactReceipt } from "./save-receipt"

const BASE = {
  id: "receipt-entry",
  date: "2026-07-23",
  savedAt: "2026-07-23T12:00:00.000Z",
  syncState: "local",
} as const

describe("saved fact receipt precedence", () => {
  it("keeps pain first and confirms an explicitly saved mood", () => {
    // Given
    const entry = {
      ...BASE,
      kind: "evening",
      sleepH: 0,
      sleepQuality: 0,
      weightKg: "",
      restingHr: "",
      painParts: { kneeRight: 2 },
      mood: 4,
      note: "",
      fieldProvenance: {
        sleepH: explicitOrMissing(false),
        sleepQuality: explicitOrMissing(false),
        weightKg: explicitOrMissing(false),
        restingHr: explicitOrMissing(false),
        painParts: explicitOrMissing(true),
        mood: explicitOrMissing(true),
      },
    } satisfies JournalEntry

    // When
    const receipt = createSavedFactReceipt(entry)

    // Then
    expect(receipt).toEqual({ kind: "pain", moodAlsoSaved: true })
  })

  it("uses distance only when the saved value is explicit and positive", () => {
    // Given
    const entry = {
      ...BASE,
      kind: "post-session",
      system: "base",
      title: "",
      distanceKm: "8",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      memo: "",
      fieldProvenance: {
        distanceKm: explicitOrMissing(true),
        durationMin: explicitOrMissing(false),
        avgPace: explicitOrMissing(false),
        rpe: explicitOrMissing(false),
        plannedRpe: explicitOrMissing(false),
        objectiveComponents: explicitOrMissing(false),
      },
    } satisfies JournalEntry

    // When
    const receipt = createSavedFactReceipt(entry)

    // Then
    expect(receipt).toEqual({ kind: "distance", distanceKm: 8 })
  })

  it("falls back to local-save confirmation when no structured fact was entered", () => {
    // Given
    const entry = {
      ...BASE,
      kind: "race",
      stage: "pre",
      record: "",
      rank: "",
      result: "",
      memo: "",
      fieldProvenance: {
        tension: explicitOrMissing(false),
        condition: explicitOrMissing(false),
        mood: explicitOrMissing(false),
        goalPace: explicitOrMissing(false),
      },
    } satisfies JournalEntry

    // When
    const receipt = createSavedFactReceipt(entry)

    // Then
    expect(receipt).toEqual({ kind: "generic" })
  })
})
