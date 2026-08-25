import { describe, expect, it } from "vitest"
import type { PlanBetaState } from "./plan-beta-store"
import { isTrainingHomeSeedValid, trainingHomeSeedFixture } from "./training-home-seed.fixture"

describe("training home seed fixture", () => {
  it("produces a state that passes parsePlanBetaState", () => {
    const seed: PlanBetaState = trainingHomeSeedFixture("2026-08-26")
    expect(isTrainingHomeSeedValid(seed)).toBe(true)
  })

  it("keeps a future session so homeMode becomes TRAINING", () => {
    const seed = trainingHomeSeedFixture("2026-08-26")
    const futureSessions = seed.activePlan.sessions.filter((session) => session.day >= 2)
    expect(futureSessions.length).toBeGreaterThan(0)
    expect(seed.intake.startDate).toBe("2026-08-26")
  })
})
