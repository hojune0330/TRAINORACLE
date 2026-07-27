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
    trainingFocus: "LT_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY",
  },
  activePlan: {
    kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
    activationState: "SELECTED_BETA_SNAPSHOT",
    candidateId: "candidate-1",
    candidateKind: "BALANCED",
    selectionActor: "SELF",
    sourceMode: "PROFILE_ONLY",
    selectedEnergyIntent: "LT_INTENT",
    frame: {
      lengthDays: 9,
      continuity: { kind: "STANDARD_FRAME" },
    },
    sessions: [
      {
        day: 1,
        slot: "AM",
        role: "EASY",
        plannedEnergyIntent: "BASE_INTENT",
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

  it("replaces progress for the same session slot", () => {
    const first = updateStoredProgress(stateFixture(), {
      sessionDay: 1,
      sessionSlot: "AM",
      state: "COMPLETED",
    })
    const second = updateStoredProgress(first, {
      sessionDay: 1,
      sessionSlot: "AM",
      state: "PAIN_CHECKIN",
    })

    expect(second.progress).toEqual([
      { sessionDay: 1, sessionSlot: "AM", state: "PAIN_CHECKIN" },
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
        sessionSlot: "AM",
        state: "COMPLETED",
      }),
      {
        sessionDay: 2,
        sessionSlot: "AM",
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

  it("keeps AM and PM progress separate for an explicitly selected two-a-day plan", () => {
    const state: PlanBetaState = {
      ...stateFixture(),
      intake: {
        ...stateFixture().intake,
        secondSessionMode: "RECOVERY_PM_ALLOWED",
      },
      activePlan: {
        ...stateFixture().activePlan,
        sessions: [
          ...stateFixture().activePlan.sessions,
          {
            day: 1,
            slot: "PM",
            role: "EASY",
            plannedEnergyIntent: "RECOVERY_INTENT",
            prescription: {
              kind: "RPE_TIME_RANGE",
              rpe: { minimum: 1, maximum: 2 },
              durationMinutes: { minimum: 15, maximum: 25 },
            },
          },
        ],
      },
    }

    const withMorning = updateStoredProgress(state, {
      sessionDay: 1,
      sessionSlot: "AM",
      state: "COMPLETED",
    })
    const withBoth = updateStoredProgress(withMorning, {
      sessionDay: 1,
      sessionSlot: "PM",
      state: "RESTED",
    })

    expect(withBoth.progress).toEqual([
      { sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" },
      { sessionDay: 1, sessionSlot: "PM", state: "RESTED" },
    ])
  })

  it("loads an older single-session snapshot as AM-only", () => {
    const state = stateFixture()
    const { secondSessionMode: _secondSessionMode, ...legacyIntake } = state.intake
    const legacySessions = state.activePlan.sessions.map(({ slot: _slot, ...session }) => session)
    window.localStorage.setItem(
      "trainoracle.plan-beta.v1",
      JSON.stringify({
        ...state,
        intake: legacyIntake,
        activePlan: { ...state.activePlan, sessions: legacySessions },
      }),
    )

    const loaded = loadPlanBetaState()

    expect(loaded?.intake.secondSessionMode).toBe("SINGLE_SESSION_ONLY")
    expect(loaded?.activePlan.sessions[0]?.slot).toBe("AM")
  })

  it("rejects a persisted PM session beside a quality session", () => {
    const state = stateFixture()
    window.localStorage.setItem(
      "trainoracle.plan-beta.v1",
      JSON.stringify({
        ...state,
        intake: {
          ...state.intake,
          secondSessionMode: "RECOVERY_PM_ALLOWED",
        },
        activePlan: {
          ...state.activePlan,
          sessions: [
            {
              day: 1,
              slot: "AM",
              role: "QUALITY",
              plannedEnergyIntent: "LT_INTENT",
              prescription: {
                kind: "RPE_TIME_RANGE",
                rpe: { minimum: 5, maximum: 6 },
                durationMinutes: { minimum: 25, maximum: 40 },
              },
            },
            {
              day: 1,
              slot: "PM",
              role: "EASY",
              plannedEnergyIntent: "RECOVERY_INTENT",
              prescription: {
                kind: "RPE_TIME_RANGE",
                rpe: { minimum: 1, maximum: 2 },
                durationMinutes: { minimum: 15, maximum: 25 },
              },
            },
          ],
        },
      }),
    )

    expect(loadPlanBetaState()).toBeNull()
  })
})
