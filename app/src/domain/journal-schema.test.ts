import { describe, expect, it } from "vitest"
import { memoPurposeOf, parseJournalEntry, parseTargetPaceInput } from "./journal-schema"

describe("parseTargetPaceInput", () => {
  it("returns a seconds-per-kilometer value when minutes and seconds are valid", () => {
    // Given
    const minutes = "3"
    const seconds = "45"

    // When
    const pace = parseTargetPaceInput(minutes, seconds)

    // Then
    expect(pace).toEqual({
      schemaVersion: 1,
      unit: "seconds_per_kilometer",
      secondsPerKm: 225,
    })
  })

  it("accepts a colon-delimited pace in the minutes field", () => {
    // Given
    const paceInput = "3:45"

    // When
    const pace = parseTargetPaceInput(paceInput, "")

    // Then
    expect(pace?.secondsPerKm).toBe(225)
  })

  it.each([
    ["", "", "blank"],
    ["-1", "30", "negative minutes"],
    ["3", "60", "seconds at sixty"],
    ["3", "1.5", "fractional seconds"],
    ["0", "0", "zero total"],
  ])("rejects %s:%s as %s", (minutes, seconds) => {
    // Given / When
    const pace = parseTargetPaceInput(minutes, seconds)

    // Then
    expect(pace).toBeNull()
  })
})

describe("memoPurposeOf", () => {
  it("treats legacy unlabeled text as private self-only", () => {
    // Given
    const legacyEntry = {}

    // When
    const purpose = memoPurposeOf(legacyEntry)

    // Then
    expect(purpose).toBe("PRIVATE_SELF_ONLY")
  })

  it("preserves an explicitly analyzable training-note purpose", () => {
    // Given
    const trainingNote = { memoPurpose: "ANALYZABLE_TRAINING_NOTE" }

    // When
    const purpose = memoPurposeOf(trainingNote)

    // Then
    expect(purpose).toBe("ANALYZABLE_TRAINING_NOTE")
  })
})

describe("post-session intensity assessment persistence", () => {
  it("preserves planned RPE and an interval component when the payload is valid", () => {
    // Given
    const entry = {
      id: "session-intensity-1",
      kind: "post-session",
      date: "2026-07-18",
      savedAt: "2026-07-18T01:00:00.000Z",
      syncState: "local",
      system: "vo2",
      title: "6 x 400m",
      distanceKm: "6",
      durationMin: "45",
      avgPace: "3:40",
      rpe: 8,
      memo: "",
      intensityAssessment: {
        schemaVersion: 1,
        plannedRpe: 7,
        objectiveComponents: [{
          componentId: "component-1",
          kind: "INTERVALS",
          repetitions: 6,
          workSeconds: 72,
          recoverySeconds: 90,
          actualPaceSecondsPerKm: 180,
          referencePaceSecondsPerKm: 190,
        }],
      },
    }

    // When
    const parsed = parseJournalEntry(entry)

    // Then
    expect(parsed?.kind).toBe("post-session")
    if (parsed?.kind !== "post-session") throw new TypeError("Expected a post-session entry")
    expect(parsed.intensityAssessment).toEqual(entry.intensityAssessment)
  })
})
