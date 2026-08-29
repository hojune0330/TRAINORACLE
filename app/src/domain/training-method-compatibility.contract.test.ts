import { describe, expect, it } from "vitest"
import { deriveTrainingMethodCompatibility } from "./training-method-compatibility"
import { trainingContentById } from "./training-content-catalog"
import type { PlanBetaState } from "./plan-beta-schema"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { planBetaStateV3Schema } from "./plan-beta-schema"

function plan(overrides: {
  readonly experienceBand?: "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED"
  readonly availableDayCount?: 3 | 4 | 5 | 6 | "EVERY_DAY"
} = {}): PlanBetaState {
  const state = stateFixture()
  return planBetaStateV3Schema.parse({
    ...state,
    intake: {
      ...state.intake,
      experienceBand: "EXPERIENCED",
      availableDayCount: 6,
      ...overrides,
    },
  })
}

describe("training method compatibility", () => {
  it("keeps an empty comparison descriptive and non-prescriptive", () => {
    const result = deriveTrainingMethodCompatibility({
      article: trainingContentById("CRUISE_INTERVALS"),
      observations: [],
      planState: null,
      today: "2026-08-29",
    })
    expect(result.status).toBe("NOT_ENOUGH_DATA")
    expect(result.dataSufficiency).toBe("EMPTY")
    expect(result.planEligibility).toBe("NOT_PLAN_ELIGIBLE")
  })

  it("finds matching cruise-interval context without granting plan authority", () => {
    const result = deriveTrainingMethodCompatibility({
      article: trainingContentById("CRUISE_INTERVALS"),
      observations: [],
      planState: plan(),
      today: "2026-08-29",
    })
    expect(result.supports.join(" ")).toContain("5000m")
    expect(result.conflicts).toHaveLength(0)
    expect(result.status).toBe("PARTIAL_MATCH")
    expect(result.planEligibility).toBe("NOT_PLAN_ELIGIBLE")
  })

  it("does not present double-threshold as compatible with a developing single-session plan", () => {
    const result = deriveTrainingMethodCompatibility({
      article: trainingContentById("NORWEGIAN_DOUBLE_THRESHOLD"),
      observations: [],
      planState: plan({ experienceBand: "DEVELOPING", availableDayCount: 4 }),
      today: "2026-08-29",
    })
    expect(result.status).toBe("CONTEXT_MISMATCH")
    expect(result.conflicts.join(" ")).toContain("품질훈련 두 번")
    expect(result.conflicts.join(" ")).toContain("경험")
  })
})
