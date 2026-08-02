import { describe, expect, it } from "vitest"
import { planHistoryListSchema } from "./plan-beta-schema"

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
