import { describe, expect, it } from "vitest"
import {
  formatPrescriptionNotation,
  parsePrescriptionNotation,
} from "../src/prescription/notation"
import { derivePrescriptionTotals } from "../src/prescription/totals"

const ownerNotation = "2×(10×400m) @5000m RP · r60″ · R3′"

function parsedOwnerNotation() {
  const result = parsePrescriptionNotation(ownerNotation)
  if (result.kind !== "parsed") {
    throw new Error(`Expected parsed notation, received ${result.code}`)
  }
  return result.notation
}

describe("prescription notation", () => {
  it("parses the owner fixture into its exact structured work and recovery fields", () => {
    // Given
    const notation = ownerNotation

    // When
    const result = parsePrescriptionNotation(notation)

    // Then
    expect(result).toEqual({
      kind: "parsed",
      notation: {
        kind: "UNBOUND_PRESCRIPTION_NOTATION",
        setCount: 2,
        repetitionsPerSet: 10,
        repetitionDistanceM: 400,
        repetitionDurationSeconds: null,
        paceTargetKind: "RACE_PACE",
        paceTargetEventDistanceM: 5000,
        repetitionRecoverySeconds: 60,
        repetitionRecoveryMode: "STAND",
        setRecoverySeconds: 180,
        setRecoveryMode: "STAND",
      },
    })
  })

  it("formats parsed notation canonically without changing its meaning", () => {
    // Given
    const notation = parsedOwnerNotation()

    // When
    const formatted = formatPrescriptionNotation(notation)
    const reparsed = parsePrescriptionNotation(formatted)

    // Then
    expect(reparsed).toEqual({ kind: "parsed", notation })
  })

  it("counts repetitions, work distance, and both recovery layers without double counting", () => {
    // Given
    const notation = parsedOwnerNotation()

    // When
    const totals = derivePrescriptionTotals(notation)

    // Then
    expect(totals).toEqual({
      totalRepetitions: 20,
      qualityDistanceM: 8000,
      qualityDurationSeconds: null,
      repetitionRecoveryOccurrences: 18,
      repetitionRecoveryTotalSeconds: 1080,
      setRecoveryOccurrences: 1,
      setRecoveryTotalSeconds: 180,
      plannedRecoverySeconds: 1260,
      mainSessionTotalExcludingWarmupCooldown: null,
      uncomputableReasonCodes: ["WORK_DURATION_UNAVAILABLE"],
    })
  })

  it.each([
    "0×(10×400m) @5000m RP · r60″ · R3′",
    "2×(10×0m) @5000m RP · r60″ · R3′",
    "2×(10×400m) @5000m RP · r60 · R3′",
    "2×(10×400m) @5000m RP · R60″ · r3′",
    "2×(10×400m @5000m RP · r60″ · R3′",
    "2×(10×400m) @5000m RP · r60″",
  ])("rejects malformed or structurally inconsistent notation: %s", (notation) => {
    // Given
    const input = notation

    // When
    const result = parsePrescriptionNotation(input)

    // Then
    expect(result.kind).toBe("rejected")
  })
})
