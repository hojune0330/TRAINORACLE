import { beforeEach, describe, expect, it } from "vitest"
import {
  archiveAndClearActivePlan,
  loadPlanBetaState,
  loadPreviousContinuity,
  savePlanBetaState,
  updateStoredProgress,
} from "./plan-beta-store"
import type { PlanBetaState } from "./plan-beta-store"

const stateFixture = (): PlanBetaState => ({
  version: 1,
  intake: {
    eventGroup: "FIVE_K",
    experienceBand: "DEVELOPING",
    availableDayCount: 4,
    requestedFrameLength: 9,
  },
  activePlan: {
    kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
    activationState: "SELECTED_BETA_SNAPSHOT",
    candidateId: "candidate-1",
    candidateKind: "BALANCED",
    selectionActor: "SELF",
    sourceMode: "PROFILE_ONLY",
    frame: {
      lengthDays: 9,
      continuity: { kind: "STANDARD_FRAME" },
    },
    sessions: [
      {
        day: 1,
        role: "EASY",
        prescription: {
          kind: "RPE_TIME_RANGE",
          rpe: { minimum: 2, maximum: 4 },
          durationMinutes: { minimum: 20, maximum: 30 },
        },
      },
    ],
  },
  progress: [],
  generatedAt: "2026-07-24T00:00:00.000Z",
})

describe("plan beta local store", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it("round-trips a structured active plan without memo fields", () => {
    const state = stateFixture()

    savePlanBetaState(state)

    expect(loadPlanBetaState()).toEqual(state)
    expect(JSON.stringify(loadPlanBetaState())).not.toMatch(/memo|symptom/u)
  })

  it("replaces progress for the same session day", () => {
    const first = updateStoredProgress(stateFixture(), {
      sessionDay: 1,
      state: "COMPLETED",
    })
    const second = updateStoredProgress(first, {
      sessionDay: 1,
      state: "PAIN_CHECKIN",
    })

    expect(second.progress).toEqual([
      { sessionDay: 1, state: "PAIN_CHECKIN" },
    ])
  })

  it("ignores malformed persisted data", () => {
    window.localStorage.setItem(
      "trainoracle.plan-beta.v1",
      JSON.stringify({ version: 1, activePlan: { hiddenPlan: true } }),
    )

    expect(loadPlanBetaState()).toBeNull()
  })

  it("retains only structured progress as next-frame continuity", () => {
    const state = updateStoredProgress(
      updateStoredProgress(stateFixture(), {
        sessionDay: 1,
        state: "COMPLETED",
      }),
      {
        sessionDay: 2,
        state: "PAIN_CHECKIN",
      },
    )

    archiveAndClearActivePlan(state)

    expect(loadPlanBetaState()).toBeNull()
    expect(loadPreviousContinuity()).toEqual({
      previousCandidateKind: "BALANCED",
      progressStateCounts: [
        { state: "COMPLETED", count: 1 },
        { state: "RESTED", count: 0 },
        { state: "SKIPPED", count: 0 },
        { state: "PAIN_CHECKIN", count: 1 },
      ],
    })
    expect(JSON.stringify(window.localStorage)).not.toMatch(/memo|symptom/u)
  })
})
