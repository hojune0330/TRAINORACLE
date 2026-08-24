import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  archiveAndClearActivePlan,
  archiveAndClearActivePlanWithLock,
  loadPlanBetaState,
  loadPreviousIntake,
  loadPreviousContinuity,
  savePlanBetaState,
  savePlanProgressWithLock,
  updateStoredProgress,
} from "./plan-beta-store"
import type { PlanBetaState } from "./plan-beta-store"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"
import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"

let locksDescriptor: PropertyDescriptor | undefined

function legacyStateFixture() {
  const current = stateFixture()
  if (current.version !== 3) throw new TypeError("Expected current v3 fixture")
  const {
    eventDistanceM: _eventDistanceM,
    selectedDetailedTemplateRef: _selectedDetailedTemplateRef,
    ...intake
  } = current.intake
  const {
    pairId: _pairId,
    selectedDetailedTemplateRef: _activeTemplateRef,
    ...activePlan
  } = current.activePlan
  return { ...current, version: 1 as const, intake, activePlan }
}

describe("plan beta local store", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
          expect(name).toBe(PLAN_BETA_MUTATION_LOCK_NAME)
          return callback({})
        },
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (locksDescriptor === undefined) Reflect.deleteProperty(navigator, "locks")
    else Object.defineProperty(navigator, "locks", locksDescriptor)
  })

  it("round-trips a structured active plan without memo fields", () => {
    const state = stateFixture()

    expect(savePlanBetaState(state)).toEqual({ ok: true })

    expect(loadPlanBetaState()).toEqual(state)
    expect(JSON.stringify(loadPlanBetaState())).not.toMatch(/memo|symptom/u)
  })

  it.each([
    "trainingFocus",
    "availableDayCount",
    "requestedFrameLength",
    "trainingTimePreference",
    "secondSessionMode",
  ] as const)("preserves a missing stored %s answer instead of inventing one", (field) => {
    const state = legacyStateFixture()
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
    const state = legacyStateFixture()
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
      rollbackComplete: true,
    })
    expect(loadPlanBetaState()).toBeNull()
  })

  it("returns a typed failure when the initial active-plan snapshot cannot be read", () => {
    const realGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === "trainoracle.plan-beta.v1") throw new Error("SecurityError")
      return realGetItem.call(this, key)
    })

    expect(savePlanBetaState(stateFixture())).toEqual({
      ok: false,
      code: "PLAN_STORAGE_WRITE_FAILED",
      rollbackComplete: false,
    })
  })

  it("propagates an uncertain rollback when progress storage cannot capture its snapshot", async () => {
    const state = stateFixture()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const realGetItem = Storage.prototype.getItem
    let activeReads = 0
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === "trainoracle.plan-beta.v1") {
        activeReads += 1
        if (activeReads === 2) throw new Error("SecurityError")
      }
      return realGetItem.call(this, key)
    })
    const session = state.activePlan.sessions[0]
    if (session === undefined) throw new TypeError("Expected an active session")

    await expect(savePlanProgressWithLock(state.activePlan.candidateId, {
      sessionDay: session.day,
      sessionSlot: session.slot,
      state: "COMPLETED",
    })).resolves.toEqual({
      kind: "failed",
      code: "PLAN_STORAGE_WRITE_FAILED",
      rollbackComplete: false,
    })
  })

  it("fails closed when previous-intake or history storage cannot be read", () => {
    const realGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === "trainoracle.plan-beta.previous-intake.v1"
          || key === "trainoracle.plan-beta.history.v1") throw new Error("SecurityError")
      return realGetItem.call(this, key)
    })

    expect(loadPreviousIntake()).toBeNull()
    expect(loadPreviousContinuity()).toBeUndefined()
  })

  it("distinguishes active-plan storage access failure from a stale plan", async () => {
    const state = stateFixture()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const realGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === "trainoracle.plan-beta.v1") throw new Error("SecurityError")
      return realGetItem.call(this, key)
    })
    const session = state.activePlan.sessions[0]
    if (session === undefined) throw new TypeError("Expected an active session")

    await expect(savePlanProgressWithLock(state.activePlan.candidateId, {
      sessionDay: session.day,
      sessionSlot: session.slot,
      state: "COMPLETED",
    })).resolves.toEqual({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
    await expect(archiveAndClearActivePlanWithLock(state.activePlan.candidateId))
      .resolves.toEqual({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
  })

  it("distinguishes an invalid active-plan payload from a missing or stale plan", async () => {
    const state = stateFixture()
    window.localStorage.setItem("trainoracle.plan-beta.v1", "{\"corrupt\":true}")
    const session = state.activePlan.sessions[0]
    if (session === undefined) throw new TypeError("Expected an active session")

    await expect(savePlanProgressWithLock(state.activePlan.candidateId, {
      sessionDay: session.day,
      sessionSlot: session.slot,
      state: "COMPLETED",
    })).resolves.toEqual({ kind: "rejected", code: "INVALID_STORED_PLAN" })
    await expect(archiveAndClearActivePlanWithLock(state.activePlan.candidateId))
      .resolves.toEqual({ kind: "rejected", code: "INVALID_STORED_PLAN" })
  })

  it("fails closed without overwriting progress while the shared plan lock is held", async () => {
    const state = stateFixture()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const before = window.localStorage.getItem("trainoracle.plan-beta.v1")
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
          expect(name).toBe(PLAN_BETA_MUTATION_LOCK_NAME)
          return callback(null)
        },
      },
    })

    await expect(savePlanProgressWithLock(state.activePlan.candidateId, {
      sessionDay: state.activePlan.sessions[0]?.day ?? 1,
      sessionSlot: state.activePlan.sessions[0]?.slot ?? "AM",
      state: "COMPLETED",
    })).resolves.toEqual({ kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" })
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBe(before)
  })

  it("reads the latest active state inside the lock before appending progress", async () => {
    const initial = stateFixture()
    if (initial.version !== 3) throw new TypeError("Expected current plan state")
    if (!("formationKind" in initial.activePlan.frame)) throw new TypeError("Expected canonical frame")
    const first = initial.activePlan.sessions[0]
    if (first === undefined) throw new TypeError("Expected a session")
    const sessions = [first, { ...first, day: 2 }]
    const candidateId = deriveCandidateId(initial.activePlan.candidateId, {
      kind: initial.activePlan.candidateKind,
      eventDistanceM: initial.activePlan.eventDistanceM,
      selectedDetailedTemplateRef: initial.activePlan.selectedDetailedTemplateRef,
      selectedEnergyIntent: initial.activePlan.selectedEnergyIntent,
      sourceMode: initial.activePlan.sourceMode,
      selectionAuthority: initial.activePlan.selectionActor === "SELF" ? "SELF" : "COACH_REQUIRED",
      frame: initial.activePlan.frame,
      sessions,
    })
    const state = {
      ...initial,
      activePlan: {
        ...initial.activePlan,
        candidateId,
        sessions,
      },
    } satisfies PlanBetaState
    const [firstSession, secondSession] = state.activePlan.sessions
    if (firstSession === undefined || secondSession === undefined) throw new TypeError("Expected two sessions")
    const current = updateStoredProgress(state, {
      sessionDay: firstSession.day,
      sessionSlot: firstSession.slot,
      state: "COMPLETED",
    })
    expect(savePlanBetaState(current)).toEqual({ ok: true })

    const result = await savePlanProgressWithLock(state.activePlan.candidateId, {
      sessionDay: secondSession.day,
      sessionSlot: secondSession.slot,
      state: "RESTED",
    })

    expect(result.kind).toBe("saved")
    if (result.kind !== "saved") return
    expect(result.state.progress).toHaveLength(2)
    expect(loadPlanBetaState()?.progress).toHaveLength(2)
  })

  it("rejects a concurrent archive while progress owns the shared mutation lock", async () => {
    const state = stateFixture()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const session = state.activePlan.sessions[0]
    if (session === undefined) throw new TypeError("Expected an active session")

    let releaseFirst!: () => void
    let markEntered!: () => void
    const entered = new Promise<void>((resolve) => { markEntered = resolve })
    const release = new Promise<void>((resolve) => { releaseFirst = resolve })
    let held = false
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (
          name: string,
          _options: unknown,
          callback: (lock: object | null) => unknown,
        ) => {
          expect(name).toBe(PLAN_BETA_MUTATION_LOCK_NAME)
          if (held) return callback(null)
          held = true
          markEntered()
          await release
          try {
            return await callback({})
          } finally {
            held = false
          }
        },
      },
    })

    const progressWrite = savePlanProgressWithLock(state.activePlan.candidateId, {
      sessionDay: session.day,
      sessionSlot: session.slot,
      state: "COMPLETED",
    })
    await entered
    await expect(archiveAndClearActivePlanWithLock(state.activePlan.candidateId))
      .resolves.toEqual({ kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" })
    releaseFirst()
    await expect(progressWrite).resolves.toMatchObject({ kind: "saved" })
    expect(loadPlanBetaState()?.progress).toEqual([{
      sessionDay: session.day,
      sessionSlot: session.slot,
      state: "COMPLETED",
    }])
  })

  it("returns a typed archive failure when its initial snapshots cannot be read", async () => {
    const state = stateFixture()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const realGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === "trainoracle.plan-beta.history.v1") throw new Error("SecurityError")
      return realGetItem.call(this, key)
    })

    await expect(archiveAndClearActivePlanWithLock(state.activePlan.candidateId)).resolves.toEqual({
      kind: "failed",
      code: "PLAN_ARCHIVE_WRITE_FAILED",
      rollbackComplete: false,
    })
  })

  it("restores the previous active plan after a silent readback mismatch", () => {
    const previous = stateFixture()
    expect(savePlanBetaState(previous)).toEqual({ ok: true })
    const previousBytes = window.localStorage.getItem("trainoracle.plan-beta.v1")
    const replacement = { ...stateFixture(), generatedAt: "2026-08-24T12:00:00.000Z" }
    const realSetItem = Storage.prototype.setItem
    let corruptOnce = true
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1" && corruptOnce) {
        corruptOnce = false
        return realSetItem.call(this, key, "{\"corrupt\":true}")
      }
      return realSetItem.call(this, key, value)
    })

    expect(savePlanBetaState(replacement)).toEqual({
      ok: false,
      code: "PLAN_STORAGE_WRITE_FAILED",
      rollbackComplete: true,
    })
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBe(previousBytes)
    expect(loadPlanBetaState()).toEqual(previous)
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
    expect(loadPlanBetaState()).toEqual(state)
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
    expect(loadPlanBetaState()).toEqual(state)
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
    expect(loadPlanBetaState()).toEqual(state)
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
    expect(loadPlanBetaState()).toEqual(state)
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
    expect(loadPlanBetaState()).toEqual(state)
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
    const fixture = stateFixture()
    if (fixture.version !== 3) throw new TypeError("Expected current v3 fixture")
    const state: PlanBetaState = {
      ...fixture,
      intake: {
        ...fixture.intake,
        secondSessionMode: "RECOVERY_PM_ALLOWED",
      },
      activePlan: {
        ...fixture.activePlan,
        sessions: [
          ...fixture.activePlan.sessions,
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
    const state = legacyStateFixture()
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

  it("preserves an exact target and template choice when another previous-intake answer is missing", () => {
    const { trainingFocus: _focus, ...partial } = stateFixture().intake
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify(partial),
    )

    expect(loadPreviousIntake()).toMatchObject({
      eventGroup: "FIVE_K",
      eventDistanceM: 5000,
      selectedDetailedTemplateRef: null,
    })
  })

  it("rejects a previous intake whose exact target conflicts with its event group", () => {
    const intake = stateFixture().intake
    window.sessionStorage.setItem(
      "trainoracle.plan-beta.previous-intake.v1",
      JSON.stringify({ ...intake, eventGroup: "GENERAL_ENDURANCE" }),
    )

    expect(loadPreviousIntake()).toBeNull()
  })

  it("keeps an existing legacy 7-day standard frame visible", () => {
    const state = legacyStateFixture()
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
    const state = legacyStateFixture()
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
