import { describe, expect, it } from "vitest"
import { planFrameSchema } from "./plan-session-schema"

describe("stored plan frame compatibility", () => {
  it("accepts a canonical local-civil 9.5-day frame without treating it as a legacy frame", () => {
    // Given
    const canonicalFrame = {
      formationKind: "LOCAL_CIVIL_9_5",
      lengthDays: 9.5,
      slotCount: 19,
      continuity: { kind: "STANDARD_FRAME" },
    }

    // When
    const result = planFrameSchema.safeParse(canonicalFrame)

    // Then
    expect(result.success).toBe(true)
  })

  it.each([
    [7, { kind: "SEVEN_DAY_CONTINUITY", nextFrameInput: "SELECTED_PLAN_AND_PROGRESS" }],
    [9, { kind: "STANDARD_FRAME" }],
    [10, { kind: "STANDARD_FRAME" }],
  ] as const)("accepts projection %s only with its matching continuity", (projectionLengthDays, continuity) => {
    const result = planFrameSchema.safeParse({
      formationKind: "LOCAL_CIVIL_9_5",
      lengthDays: 9.5,
      slotCount: 19,
      projectionLengthDays,
      continuity,
    })

    expect(result.success).toBe(true)
  })

  it.each([
    [7, { kind: "STANDARD_FRAME" }],
    [9, { kind: "SEVEN_DAY_CONTINUITY", nextFrameInput: "SELECTED_PLAN_AND_PROGRESS" }],
    [10, { kind: "SEVEN_DAY_CONTINUITY", nextFrameInput: "SELECTED_PLAN_AND_PROGRESS" }],
  ] as const)("rejects projection %s with an impossible continuity", (projectionLengthDays, continuity) => {
    const result = planFrameSchema.safeParse({
      formationKind: "LOCAL_CIVIL_9_5",
      lengthDays: 9.5,
      slotCount: 19,
      projectionLengthDays,
      continuity,
    })

    expect(result.success).toBe(false)
  })
})
