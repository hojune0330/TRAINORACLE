import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  archiveAndClearActivePlan,
  loadPlanBetaState,
  loadPreviousIntake,
  loadPreviousContinuity,
  savePlanBetaState,
  updateStoredProgress,
} from "./plan-beta-store"
import type { PlanBetaState } from "./plan-beta-store"
import { stateFixture } from "./plan-beta-store.test-fixture"

function migratedState(state: PlanBetaState): PlanBetaState {
  return { ...state, version: 2 }
}

describe("plan beta local store", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("round-trips a structured active plan without memo fields", () => {
    const state = stateFixture()

    expect(savePlanBetaState(state)).toEqual({ ok: true })

    expect(loadPlanBetaState()).toEqual(migratedState(state))
    expect(JSON.stringify(loadPlanBetaState())).not.toMatch(/memo|symptom/u)
  })

  it.each([
    "trainingFocus",
    "availableDayCount",
    "requestedFrameLength",
    "trainingTimePreference",
    "secondSessionMode",
  ] as const)("preserves a missing stored %s answer instead of inventing one", (field) => {
    const state = stateFixture()
    const intake = Object.fromEntries(
      Object.entries(state.intake).filter(([key]) => key !== field),
    )
    window.localStorage.setItem(
      "trainoracle.plan-beta.v1",
      JSON.stringify({ ...state, intake }),
    )

    const loaded = loadPlanBetaState()

    expect(loaded).not.toBeNull()
    expect(loaded?.intake).not.toHaveProperty(field)
  })

  it.each([
    "trainingFocus",
    "availableDayCount",
    "requestedFrameLength",
    "trainingTimePreference",
    "secondSessionMode",
  ] as const)("preserves a missing previous %s answer instead of inventing one", (field) => {
    const state = stateFixture()
    const intake = Object.fromEntries(
      Object.entries(state.intake).filter(([key]) => key !== field),
    )
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(intake),
    )

    const loaded = loadPreviousIntake()

    expect(loaded).not.toBeNull()
    expect(loaded).not.toHaveProperty(field)
  })

  it("reports a failed active-plan write instead of pretending it was saved", () => {
    const state = stateFixture()
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })

    expect(savePlanBetaState(state)).toEqual({
      ok: false,
      code: "PLAN_STORAGE_WRITE_FAILED",
    })
    expect(loadPlanBetaState()).toBeNull()
  })

  it("keeps the active plan when next-frame archiving cannot be saved", () => {
    const state = stateFixture()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.history.v1") {
        throw new Error("QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })

    expect(archiveAndClearActivePlan(state)).toEqual({
      ok: false,
      code: "PLAN_ARCHIVE_WRITE_FAILED",
      rollbackComplete: true,
    })
    expect(loadPlanBetaState()).toEqual(migratedState(state))
    expect(loadPreviousContinuity()).toBeUndefined()
  })

  it("rolls history back when previous-intake persistence fails", () => {
    const state = stateFixture()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.previous-intake.v1") {
        throw new Error("QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })

    expect(archiveAndClearActivePlan(state)).toMatchObject({
      ok: false,
      rollbackComplete: true,
    })
    expect(loadPlanBetaState()).toEqual(migratedState(state))
    expect(loadPreviousContinuity()).toBeUndefined()
  })

  it("keeps the active plan when staged history is silently not persisted", () => {
    const state = stateFixture()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.history.v1") return
      return realSetItem.call(this, key, value)
    })

    expect(archiveAndClearActivePlan(state)).toMatchObject({
      ok: false,
      rollbackComplete: true,
    })
    expect(loadPlanBetaState()).toEqual(migratedState(state))
    expect(loadPreviousContinuity()).toBeUndefined()
  })

  it("keeps the active plan when previous intake is silently not persisted", () => {
    const state = stateFixture()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.previous-intake.v1") return
      return realSetItem.call(this, key, value)
    })

    expect(archiveAndClearActivePlan(state)).toMatchObject({
      ok: false,
      rollbackComplete: true,
    })
    expect(loadPlanBetaState()).toEqual(migratedState(state))
    expect(loadPreviousContinuity()).toBeUndefined()
  })

  it("rolls staged history back when active-plan removal fails", () => {
    const state = stateFixture()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const realRemoveItem = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key === "trainoracle.plan-beta.v1") {
        throw new Error("StorageUnavailable")
      }
      return realRemoveItem.call(this, key)
    })

    expect(archiveAndClearActivePlan(state)).toMatchObject({
      ok: false,
      rollbackComplete: true,
    })
    expect(loadPlanBetaState()).toEqual(migratedState(state))
    expect(loadPreviousContinuity()).toBeUndefined()
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

  it("ignores malformed previous intake data", () => {
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify({ ...stateFixture().intake, availableDayCount: "WEEKLY" }),
    )

    expect(loadPreviousIntake()).toBeNull()
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

  it("loads an older single-session snapshot as AM-only without inventing consent", () => {
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

    expect(loaded?.intake.secondSessionMode).toBeUndefined()
    expect(loaded?.activePlan.sessions[0]?.slot).toBe("AM")
  })

  it("round-trips every explicit refinement through next-frame intake storage", () => {
    const state = stateFixture()

    expect(archiveAndClearActivePlan(state)).toMatchObject({ ok: true })

    expect(loadPreviousIntake()).toEqual(state.intake)
  })

  it("keeps an existing legacy 7-day standard frame visible", () => {
    const state = stateFixture()
    window.localStorage.setItem(
      "trainoracle.plan-beta.v1",
      JSON.stringify({
        ...state,
        activePlan: {
          ...state.activePlan,
          frame: { lengthDays: 7, continuity: { kind: "STANDARD_FRAME" } },
        },
      }),
    )

    const loaded = loadPlanBetaState()

    expect(loaded?.activePlan.frame).toEqual({
      lengthDays: 7,
      continuity: { kind: "STANDARD_FRAME" },
    })
  })

  it("loads a persisted two-session plan with explicit consent", () => {
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

    expect(loadPlanBetaState()).not.toBeNull()
  })
})
