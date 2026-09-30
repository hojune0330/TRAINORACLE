import { describe, expect, it } from "vitest"
import { copyWorkoutCalculationInputs } from "../src/prescription/all-workout-calculator"
import type { WorkoutCalculationInputs } from "../src/prescription/all-workout-calculator"

describe("portable workout input copy", () => {
  it("preserves decimals and optional values without sharing nested references", () => {
    const input: WorkoutCalculationInputs = {
      eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: 3600,
      confirmedRequirements: ["FLAT_TRACK"],
      fiveK: { recordId: "synthetic", seconds: 1111.23, achievedAt: "2026-09-01", evaluatedAt: "2026-09-30" },
      segmentPaces: [{ segmentId: "main", secondsPerKm: 222.246 }],
      segmentSeconds: [{ segmentId: "main", seconds: 88.8984 }],
      recoverySeconds: [{ segmentId: "rest", seconds: 60 }],
    }
    const copied = copyWorkoutCalculationInputs(input)
    expect(copied).toEqual(input)
    expect(copied).not.toBe(input)
    expect(copied.confirmedRequirements).not.toBe(input.confirmedRequirements)
    expect(copied.fiveK).not.toBe(input.fiveK)
    expect(copied.segmentPaces[0]).not.toBe(input.segmentPaces[0])
    expect(copied.segmentSeconds?.[0]).not.toBe(input.segmentSeconds?.[0])
    expect(copied.recoverySeconds?.[0]).not.toBe(input.recoverySeconds?.[0])
  })

  it("does not invent absent optional fields or missing numeric input", () => {
    const input: WorkoutCalculationInputs = {
      eventDistanceM: 800, experience: "DEVELOPING", availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [],
    }
    const copied = copyWorkoutCalculationInputs(input)
    expect(copied).toEqual(input)
    expect(Object.hasOwn(copied, "segmentSeconds")).toBe(false)
    expect(Object.hasOwn(copied, "recoverySeconds")).toBe(false)
  })
})
