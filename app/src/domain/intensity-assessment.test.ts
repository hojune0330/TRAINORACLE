import { describe, expect, it } from "vitest"
import * as intensityAssessment from "./intensity-assessment"
import { parseSessionIntensityAssessment, summarizeIntensityAssessment } from "./intensity-assessment"

describe("parseSessionIntensityAssessment", () => {
  it.each([
    ["planned RPE above ten", { schemaVersion: 1, plannedRpe: 11, objectiveComponents: [] }],
    ["duplicate component IDs", {
      schemaVersion: 1,
      objectiveComponents: [
        { componentId: "same", kind: "PLYOMETRIC", exerciseType: "hops", contacts: 40 },
        { componentId: "same", kind: "PLYOMETRIC", exerciseType: "bounds", contacts: 30 },
      ],
    }],
    ["an interval missing its paired reference pace", {
      schemaVersion: 1,
      objectiveComponents: [{
        componentId: "interval-1",
        kind: "INTERVALS",
        repetitions: 6,
        workSeconds: 60,
        recoverySeconds: 90,
        actualPaceSecondsPerKm: 180,
      }],
    }],
    ["strength with negative RIR", {
      schemaVersion: 1,
      objectiveComponents: [{
        componentId: "strength-1",
        kind: "STRENGTH",
        exerciseType: "squat",
        sets: 4,
        repetitions: 5,
        repsInReserve: -1,
      }],
    }],
  ])("rejects %s", (_label, value) => {
    const parsed = parseSessionIntensityAssessment(value)
    expect(parsed).toBeNull()
  })
})

describe("intensity coverage summary contract", () => {
  it("exports a pure summarizer before UI integration", () => {
    const candidate: unknown = Reflect.get(intensityAssessment, "summarizeIntensityAssessment")
    expect(candidate).toBeTypeOf("function")
  })

  it("keeps an objective-only interval record explicit without fabricating RPE", () => {
    const summary = summarizeIntensityAssessment({
      schemaVersion: 1,
      objectiveComponents: [{
        componentId: "interval-1",
        kind: "INTERVALS",
        repetitions: 6,
        workSeconds: 60,
        recoverySeconds: 60,
        actualPaceSecondsPerKm: 180,
        referencePaceSecondsPerKm: 189,
      }],
    }, 0)

    expect(summary.coverage).toBe("OBJECTIVE_ONLY")
    expect(summary.reportedRpe).toBeUndefined()
    expect(summary.objectiveComponents[0]?.facts.map((fact) => fact.text)).toEqual([
      "6회 · 운동 60초 / 회복 60초",
      "운동 비중 50%",
      "개인 기준 페이스 대비 105%",
    ])
    expect(summary.objectiveComponents[0]?.facts[1]).toEqual({
      text: "운동 비중 50%",
      provenance: "DERIVED",
      derivationRuleId: "INTENSITY_INTERVAL_WORK_DENSITY_V1",
      derivedFrom: ["workSeconds", "recoverySeconds"],
    })
  })

  it("preserves planned and reported values beside objective facts", () => {
    const summary = summarizeIntensityAssessment({
      schemaVersion: 1,
      plannedRpe: 7,
      objectiveComponents: [{
        componentId: "strength-1",
        kind: "STRENGTH",
        exerciseType: "스쿼트",
        sets: 4,
        repetitions: 5,
        loadPercent1Rm: 80,
        repsInReserve: 2,
      }],
    }, 8)

    expect(summary).toMatchObject({ coverage: "COMBINED", plannedRpe: 7, reportedRpe: 8 })
    expect(summary.objectiveComponents[0]?.facts).toContainEqual({ text: "80% 1RM", provenance: "EXPLICIT" })
  })
})
