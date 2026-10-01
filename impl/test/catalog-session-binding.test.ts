import { describe, expect, it } from "vitest"
import { bindDefaultCatalogSessions, initialCatalogMainOptions, resolveCatalogBinding } from "../src/prescription/catalog-session-binding"
import { rangesFor, rpeForIntent } from "../src/plan-generator/session-builder"
import type { ExperienceBand, PlanSession, QualityEnergyIntent } from "../src/plan-generator/types"

function session(experience: ExperienceBand, intent: QualityEnergyIntent): PlanSession {
  return { day: 3, slot: "PM", role: "QUALITY", plannedEnergyIntent: intent,
    prescription: { kind: "RPE_TIME_RANGE", rpe: rpeForIntent(intent), durationMinutes: rangesFor(experience).quality } }
}
const space = "ACCELERATION_AND_DECELERATION_SPACE"

describe("initial MAIN exact catalog supply", () => {
  it.each(["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const)("%s ATP-PC requires a real space answer and uses no invented target", experience => {
    const original = session(experience, "ATP_PC_INTENT"), before = JSON.stringify(original)
    expect(initialCatalogMainOptions(original, 5000, experience)).toEqual([])
    const options = initialCatalogMainOptions(original, 5000, experience, [space])
    expect(options.length).toBeGreaterThan(0)
    for (const option of options) {
      if (option.prescription.kind !== "RPE_TIME_RANGE") throw Error("fixture")
      const workout = resolveCatalogBinding(option.prescription.catalogWorkout!)!
      expect(workout).not.toBeNull()
      expect(workout.inputs).toMatchObject({ experience, fiveK: null, segmentPaces: [], confirmedRequirements: [space] })
      expect(workout.inputs.segmentSeconds).toBeUndefined()
      expect(workout.inputs.recoverySeconds).toBeUndefined()
      expect(workout.steps.filter(step => step.phase === "main" && step.kind === "WORK")
        .every(step => step.referenceRecordId === null && step.paceSecondsPerKm === null && step.targetModel === "FIXED_DURATION")).toBe(true)
      expect(option).toMatchObject({ day: 3, slot: "PM", role: "QUALITY", plannedEnergyIntent: "ATP_PC_INTENT" })
    }
    expect(JSON.stringify(original)).toBe(before)
  })
  it("experienced GLY already has exact record-free MAIN", () => {
    const options = initialCatalogMainOptions(session("EXPERIENCED", "GLY_INTENT"), 800, "EXPERIENCED")
    expect(options.length).toBeGreaterThan(0)
    for (const option of options) {
      if (option.prescription.kind !== "RPE_TIME_RANGE") throw Error("fixture")
      expect(resolveCatalogBinding(option.prescription.catalogWorkout!)!.unavailable).toEqual([])
      expect(option.prescription.rpe).toEqual({ minimum: 8, maximum: 9 })
    }
  })
  it("developing GLY cannot invent missing duration for its eligible distance-only configurations", () => {
    expect(initialCatalogMainOptions(session("DEVELOPING", "GLY_INTENT"), 800, "DEVELOPING")).toEqual([])
  })
  it("beginner GLY is not enabled by environment or claimed repetition experience", () => {
    expect(initialCatalogMainOptions(session("NEW_TO_RUNNING", "GLY_INTENT"), 800, "NEW_TO_RUNNING",
      [space, "HIGH_INTENSITY_REPETITION_EXPERIENCE"])).toEqual([])
  })
  it("preserves previously bound content and does not copy answers into unbound days", () => {
    const original = session("EXPERIENCED", "ATP_PC_INTENT")
    const bound = initialCatalogMainOptions(original, 5000, "EXPERIENCED", [space])[0]!
    const unbound = { ...original, day: 9 }
    const result = bindDefaultCatalogSessions([bound, unbound], 5000, "EXPERIENCED", 1)
    expect(result[0]).toBe(bound)
    expect(result[1]).toBe(unbound)
    expect(initialCatalogMainOptions(bound, 5000, "EXPERIENCED", [space])).toEqual([])
  })
})
