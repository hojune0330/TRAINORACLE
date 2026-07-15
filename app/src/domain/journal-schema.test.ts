import { describe, expect, it } from "vitest"
import { memoPurposeOf, parseTargetPaceInput } from "./journal-schema"

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
