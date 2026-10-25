import { describe, expect, it } from "vitest"
import { calculateCatalogWorkout, type WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import type { WorkoutDisplaySession } from "./workout-notation"
import { catalogPrescriptionBasis, sessionPrescriptionBasis } from "./prescription-basis"

const inputs: WorkoutCalculationInputs = {
  eventDistanceM: 10000, experience: "EXPERIENCED", availableSeconds: null,
  confirmedRequirements: [], fiveK: null, segmentPaces: [],
}
const reference = { segmentId: "X-LT-01-1-1", kind: "ACTUAL" as const, confirmed: true as const,
  recordId: "synthetic-record", recordVersion: "2026-10-11T00:00:00.000Z", eventDistanceM: 10000, performanceSeconds: 2700,
  achievedOn: "2026-10-10", evaluatedOn: "2026-10-25", model: "RACE_AVERAGE_V1" as const }

describe("saved prescription basis", () => {
  it.each(["ACTUAL", "GOAL"] as const)("labels the applied %s source without reading newer records", kind => {
    const workout = calculateCatalogWorkout("RP-10000-DISTANCE", { ...inputs,
      paceReferences: [{ ...reference, kind, achievedOn: kind === "GOAL" ? null : reference.achievedOn }],
    })!
    expect(workout.unavailable).toEqual([])
    expect(catalogPrescriptionBasis(workout)).toContain("10km 45:00")
    expect(catalogPrescriptionBasis(workout)).toContain(kind === "GOAL" ? "목표 기준 (현재 실력 아님)" : "저장된 기록 기준")
  })

  it("keeps direct seconds separate and rejects a competing record target", () => {
    const direct = { ...inputs,
      segmentSeconds: [{ segmentId: reference.segmentId, seconds: 300 }],
    }
    expect(calculateCatalogWorkout("RP-10000-DISTANCE", { ...direct, paceReferences: [reference] })).toBeNull()
    const workout = calculateCatalogWorkout("RP-10000-DISTANCE", direct)!
    expect(workout.unavailable).toEqual([])
    expect(catalogPrescriptionBasis(workout)).toBe("직접 지정한 구간 목표")
  })

  it("does not treat a missing RP reference as an effort prescription", () => {
    const workout = calculateCatalogWorkout("RP-10000-DISTANCE", inputs)!
    expect(workout.unavailable.length).toBeGreaterThan(0)
    expect(catalogPrescriptionBasis(workout)).toBe("이 구성의 목표 기준 확인 필요")
  })

  it("keeps an effort-only prescription distinct from record pace", () => {
    const workout = calculateCatalogWorkout("P-LT-S", inputs)!
    expect(catalogPrescriptionBasis(workout)).toBe("체감 강도 기준 · 경기 기록 환산 아님")
  })

  it("handles older display data without inventing a missing anchor", () => {
    const session = { role: "QUALITY", plannedEnergyIntent: "LT_INTENT", prescription: { kind: "PACE_TARGET" } } as WorkoutDisplaySession
    expect(sessionPrescriptionBasis(session)).toBe("저장된 기준 기록 확인 필요")
  })
})
