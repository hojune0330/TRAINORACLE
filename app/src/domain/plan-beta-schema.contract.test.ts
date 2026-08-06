import { describe, expect, it } from "vitest"
import { parsePlanBetaState, planHistoryListSchema } from "./plan-beta-schema"
import { activePlanSchema } from "./plan-session-schema"

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

describe("B-3 storage gate current behavior (C-4 — ㉢-b에서 개정 예정)", () => {
  // The storage gate (planBetaStateSchema → parsePlanBetaState) is the gate that
  // reads a saved plan back (loadPlanBetaState) and re-validates on save
  // (savePlanBetaState). These fix the CURRENT C-4 behavior: a PM session must
  // be EASY + RECOVERY_INTENT (RPE 1-2) and a PM may not follow QUALITY (C-5).
  // OD-SLOT-1/7 supersede this for generation, but the storage gate itself is
  // reworked only in ㉢-b (진행 순서 step 3) — until then C-4 is current and
  // these tests stay green. C-7 (leaf refine)는 OD-SLOT-1에 따라 철회됨.
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

  it("rejects a stored plan whose PM session is QUALITY", () => {
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
    expect(result).toBeNull()
  })

  it("rejects a stored plan whose PM session is REST (PM is EASY+RECOVERY only)", () => {
    const result = parsePlanBetaState(pmState({
      day: 1,
      slot: "PM",
      role: "REST",
      plannedEnergyIntent: "RECOVERY_INTENT",
      prescription: { kind: "REST" },
    }))
    expect(result).toBeNull()
  })

  it("rejects a stored plan whose PM EASY session is not RECOVERY intent", () => {
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
    expect(result).toBeNull()
  })
})
