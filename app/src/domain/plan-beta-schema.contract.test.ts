import { describe, expect, it } from "vitest"
import { parsePlanBetaState, planHistoryListSchema } from "./plan-beta-schema"
import { activePlanSchema } from "./plan-session-schema"
import { stateFixture } from "./plan-beta-store.test-fixture"

describe("plan history frame compatibility", () => {
  it("preserves a canonical 9.5-day frame length in history", () => {
    // Given
    const history = [{
      candidateId: "canonical-candidate",
      candidateKind: "BALANCED",
      frameLengthDays: 9.5,
      progress: [],
      archivedAt: "2026-08-02T00:00:00.000Z",
    }]

    // When
    const result = planHistoryListSchema.safeParse(history)

    // Then
    expect(result.success).toBe(true)
  })

  it("defaults a legacy intake without training time to VARIES", () => {
    // Given
    const legacy = {
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
        candidateId: "legacy",
        candidateKind: "BALANCED",
        selectionActor: "SELF",
        sourceMode: "PROFILE_ONLY",
        frame: { lengthDays: 9, continuity: { kind: "STANDARD_FRAME" } },
        sessions: [],
      },
      progress: [],
      generatedAt: "2026-08-08T00:00:00.000Z",
    }

    // When
    const result = parsePlanBetaState(legacy)

    // Then
    expect(result?.intake.trainingTimePreference).toBe("VARIES")
  })

  it("preserves a valid selected calendar date and rejects a malformed one", () => {
    // Given
    const selected = {
      ...stateFixture(),
      intake: {
        ...stateFixture().intake,
        startDate: "2026-08-17",
      },
    }
    const malformed = {
      ...selected,
      intake: {
        ...selected.intake,
        startDate: "2026-02-31",
      },
    }

    // When
    const accepted = parsePlanBetaState(selected)
    const rejected = parsePlanBetaState(malformed)

    // Then
    expect(accepted?.intake.startDate).toBe("2026-08-17")
    expect(rejected).toBeNull()
  })
})

describe("B-3 activePlanSchema slot extension (경로 B)", () => {
  const base = {
    kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
    activationState: "SELECTED_BETA_SNAPSHOT",
    candidateId: "candidate-1",
    candidateKind: "BALANCED",
    selectionActor: "SELF",
    sourceMode: "PROFILE_ONLY",
    frame: {
      formationKind: "LOCAL_CIVIL_9_5",
      lengthDays: 9.5,
      slotCount: 19,
      continuity: { kind: "STANDARD_FRAME" },
    },
  }

  it("accepts a QUALITY session in the PM slot (OD-SLOT-1)", () => {
    // OD-SLOT-1: 고강도(QUALITY)는 오전·오후 어느 슬롯에도 배치할 수 있다.
    // 오전 강제 금지(하드). C-7로 추가됐던 leaf refine은 철회되어 이 좌표는 유효하다.
    const plan = {
      ...base,
      sessions: [{
        day: 2,
        slot: "PM",
        role: "QUALITY",
        plannedEnergyIntent: "LT_INTENT",
        prescription: {
          kind: "RPE_TIME_RANGE",
          rpe: { minimum: 5, maximum: 6 },
          durationMinutes: { minimum: 25, maximum: 40 },
        },
      }],
    }
    const result = activePlanSchema.safeParse(plan)
    expect(result.success).toBe(true)
  })

  it("accepts a REST session in the PM slot", () => {
    const plan = {
      ...base,
      sessions: [{
        day: 3,
        slot: "PM",
        role: "REST",
        plannedEnergyIntent: "RECOVERY_INTENT",
        prescription: { kind: "REST" },
      }],
    }
    const result = activePlanSchema.safeParse(plan)
    expect(result.success).toBe(true)
  })

  it("defaults a missing slot to AM (backward compatible)", () => {
    const plan = {
      ...base,
      sessions: [{
        day: 1,
        role: "QUALITY",
        plannedEnergyIntent: "LT_INTENT",
        prescription: {
          kind: "RPE_TIME_RANGE",
          rpe: { minimum: 5, maximum: 6 },
          durationMinutes: { minimum: 25, maximum: 40 },
        },
      }],
    }
    const result = activePlanSchema.safeParse(plan)
    expect(result.success).toBe(true)
    if (result.success && result.data.sessions[0] !== undefined) {
      expect(result.data.sessions[0].slot).toBe("AM")
    }
  })
})

describe("B-3 storage gate session placement rules", () => {
  const pmState = (session: object) => ({
    version: 1,
    intake: {
      eventGroup: "FIVE_K",
      experienceBand: "DEVELOPING",
      availableDayCount: 4,
      requestedFrameLength: 9,
      trainingFocus: "LT_INTENT",
      secondSessionMode: "RECOVERY_PM_ALLOWED",
    },
    activePlan: {
      kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
      activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId: "candidate-1",
      candidateKind: "BALANCED",
      selectionActor: "SELF",
      sourceMode: "PROFILE_ONLY",
      selectedEnergyIntent: "LT_INTENT",
      frame: { lengthDays: 9, continuity: { kind: "STANDARD_FRAME" } },
      sessions: [session],
    },
    progress: [],
    generatedAt: "2026-07-24T00:00:00.000Z",
  })

  it("accepts a stored plan whose only session is PM QUALITY", () => {
    const result = parsePlanBetaState(pmState({
      day: 1,
      slot: "PM",
      role: "QUALITY",
      plannedEnergyIntent: "LT_INTENT",
      prescription: {
        kind: "RPE_TIME_RANGE",
        rpe: { minimum: 5, maximum: 6 },
        durationMinutes: { minimum: 25, maximum: 40 },
      },
    }))
    expect(result).not.toBeNull()
  })

  it("accepts a stored plan whose only session is PM REST", () => {
    const result = parsePlanBetaState(pmState({
      day: 1,
      slot: "PM",
      role: "REST",
      plannedEnergyIntent: "RECOVERY_INTENT",
      prescription: { kind: "REST" },
    }))
    expect(result).not.toBeNull()
  })

  it("accepts a stored plan whose only PM EASY session is BASE intent", () => {
    const result = parsePlanBetaState(pmState({
      day: 1,
      slot: "PM",
      role: "EASY",
      plannedEnergyIntent: "BASE_INTENT",
      prescription: {
        kind: "RPE_TIME_RANGE",
        rpe: { minimum: 2, maximum: 4 },
        durationMinutes: { minimum: 20, maximum: 30 },
      },
    }))
    expect(result).not.toBeNull()
  })

  it("accepts a PM QUALITY plus AM EASY pair with explicit two-a-day consent", () => {
    const state = pmState({
      day: 1,
      slot: "PM",
      role: "QUALITY",
      plannedEnergyIntent: "LT_INTENT",
      prescription: {
        kind: "RPE_TIME_RANGE",
        rpe: { minimum: 5, maximum: 6 },
        durationMinutes: { minimum: 25, maximum: 40 },
      },
    })
    const result = parsePlanBetaState({
      ...state,
      activePlan: {
        ...state.activePlan,
        sessions: [
          {
            day: 1,
            slot: "AM",
            role: "EASY",
            plannedEnergyIntent: "RECOVERY_INTENT",
            prescription: {
              kind: "RPE_TIME_RANGE",
              rpe: { minimum: 1, maximum: 2 },
              durationMinutes: { minimum: 15, maximum: 25 },
            },
          },
          state.activePlan.sessions[0],
        ],
      },
    })

    expect(result).not.toBeNull()
  })

  it("rejects a second session when explicit two-a-day consent is absent", () => {
    const state = pmState({
      day: 1,
      slot: "PM",
      role: "QUALITY",
      plannedEnergyIntent: "LT_INTENT",
      prescription: {
        kind: "RPE_TIME_RANGE",
        rpe: { minimum: 5, maximum: 6 },
        durationMinutes: { minimum: 25, maximum: 40 },
      },
    })
    const result = parsePlanBetaState({
      ...state,
      intake: {
        ...state.intake,
        secondSessionMode: "SINGLE_SESSION_ONLY",
      },
      activePlan: {
        ...state.activePlan,
        sessions: [
          {
            day: 1,
            slot: "AM",
            role: "EASY",
            plannedEnergyIntent: "RECOVERY_INTENT",
            prescription: {
              kind: "RPE_TIME_RANGE",
              rpe: { minimum: 1, maximum: 2 },
              durationMinutes: { minimum: 15, maximum: 25 },
            },
          },
          state.activePlan.sessions[0],
        ],
      },
    })

    expect(result).toBeNull()
  })

  it("rejects two QUALITY sessions on one day until the explicit review flow exists", () => {
    const state = pmState({
      day: 1,
      slot: "PM",
      role: "QUALITY",
      plannedEnergyIntent: "LT_INTENT",
      prescription: {
        kind: "RPE_TIME_RANGE",
        rpe: { minimum: 5, maximum: 6 },
        durationMinutes: { minimum: 25, maximum: 40 },
      },
    })
    const result = parsePlanBetaState({
      ...state,
      activePlan: {
        ...state.activePlan,
        sessions: [
          ...state.activePlan.sessions,
          {
            day: 1,
            slot: "AM",
            role: "QUALITY",
            plannedEnergyIntent: "VO2_INTENT",
            prescription: {
              kind: "RPE_TIME_RANGE",
              rpe: { minimum: 7, maximum: 8 },
              durationMinutes: { minimum: 20, maximum: 30 },
            },
          },
        ],
      },
    })

    expect(result).toBeNull()
  })
})
