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
})
