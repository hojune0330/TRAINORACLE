import { describe, expect, it } from "vitest"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout, type WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { buildSameEventRacePaceCatalog } from "../../../reports/research/same-event-race-pace-catalog"
import { createSegmentRecordReference } from "./catalog-pace-reference"
import type { AthleteRecord } from "./athlete-records"

const events = [[10000, "10000", 2400], [21097.5, "HALF", 5400], [42195, "42195", 10800]] as const
function source(eventDistanceM: number, performanceSeconds: number, goal = false): AthleteRecord {
  const base = { schemaVersion: 1 as const, id: "race-source", eventDistanceM, performanceSeconds,
    seasonId: null, enteredBy: "ATHLETE" as const, verificationState: "SELF_REPORTED" as const,
    sourceRef: "athlete-record:race-source", savedAt: "2026-10-02T00:00:00.000Z" }
  return goal ? { ...base, purpose: "RACE_GOAL", achievedOn: null }
    : { ...base, purpose: "RECENT_RESULT", achievedOn: "2026-10-01" }
}

describe("explicit same-event long race-pace bindings", () => {
  it("adds nine rows without rewriting any existing template", () => {
    const previous = ALL_WORKOUT_CATALOG.filter(entry => !entry.id.startsWith("RP-"))
    expect(previous).toHaveLength(117)
    expect(buildSameEventRacePaceCatalog(previous)).toEqual(ALL_WORKOUT_CATALOG.filter(entry => entry.id.startsWith("RP-")))
  })
  for (const [distance, idPart, seconds] of events) {
    for (const goal of [false, true]) {
      for (const [format, experience, repetitions, duration] of [
        ["INTRO", "NEW_TO_RUNNING", 2, 240], ["TIMED", "DEVELOPING", 3, 420], ["DISTANCE", "EXPERIENCED", 5, null],
      ] as const) {
        it(`${distance} ${format} ${goal ? "goal" : "actual"}: exact source, raw targets and unchanged recovery`, () => {
          const id = `RP-${idPart}-${format}`
          const entry = ALL_WORKOUT_CATALOG.find(row => row.id === id)!
          expect(entry).toBeDefined()
          const segmentId = entry.segments[0]!.segmentId
          const inputs: WorkoutCalculationInputs = { eventDistanceM: distance, experience, availableSeconds: null,
            confirmedRequirements: [], fiveK: null, segmentPaces: [],
            paceReferences: [createSegmentRecordReference(segmentId, source(distance, seconds, goal), "2026-10-02")] }
          const result = calculateCatalogWorkout(id, inputs)!
          expect(result).not.toBeNull()
          expect(result.unavailable).toEqual([])
          const work = result.steps.filter(step => step.phase === "main" && step.kind === "WORK")
          expect(work).toHaveLength(repetitions)
          expect(work.every(step => step.referenceEventDistanceM === distance)).toBe(true)
          expect(work.every(step => step.targetModel === (goal ? "GOAL_RACE_REFERENCE" : "ACTUAL_RACE_REFERENCE"))).toBe(true)
          expect(work[0]!.seconds!.minimum).toBeCloseTo(duration ?? seconds * 1000 / distance, 10)
          expect(work.every(step => step.distanceM === (duration === null ? 1000 : null))).toBe(true)
          expect(result.steps.filter(step => step.phase === "main" && step.kind === "RECOVERY").map(step => step.seconds!.minimum))
            .toEqual(Array.from({ length: repetitions - 1 }, () => 60))
          const wrong = { ...inputs.paceReferences![0]!, eventDistanceM: 5000 }
          expect(calculateCatalogWorkout(id, { ...inputs, paceReferences: [wrong] })).toBeNull()
          expect(calculateCatalogWorkout(id, { ...inputs, paceReferences: [] })!.unavailable).toContain("RACE_PACE_REFERENCE_REQUIRED")
        })
      }
    }
  }
  it("reads legacy half aliases without rounding the actual reference distance", () => {
    const record = source(21097, 5400)
    const reference = createSegmentRecordReference("X-LT-01-1-1", record, "2026-10-02")
    const result = calculateCatalogWorkout("RP-HALF-DISTANCE", { eventDistanceM: 21097,
      experience: "EXPERIENCED", availableSeconds: null, confirmedRequirements: [], fiveK: null,
      segmentPaces: [], paceReferences: [reference] })!
    expect(result.unavailable).toEqual([])
    expect(result.steps.find(step => step.kind === "WORK")!.seconds!.minimum).toBeCloseTo(5400 * 1000 / 21097.5, 10)
  })
  it("does not admit record-derived targets outside the existing direct-input pace envelope", () => {
    const entry = ALL_WORKOUT_CATALOG.find(row => row.id === "RP-10000-INTRO")!
    for (const seconds of [0.1, 86400]) {
      for (const goal of [false, true]) {
        const result = calculateCatalogWorkout(entry.id, { eventDistanceM: 10000, experience: "NEW_TO_RUNNING",
          availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [],
          paceReferences: [createSegmentRecordReference(entry.segments[0]!.segmentId, source(10000, seconds, goal), "2026-10-02")] })!
        expect(result.unavailable).toContain("RACE_PACE_REFERENCE_OUT_OF_RANGE")
      }
    }
  })
})
