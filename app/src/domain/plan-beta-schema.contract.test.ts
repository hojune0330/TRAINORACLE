import { describe, expect, it } from "vitest"
import { planHistoryListSchema } from "./plan-beta-schema"
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

  it("accepts a QUALITY session in the PM slot", () => {
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
