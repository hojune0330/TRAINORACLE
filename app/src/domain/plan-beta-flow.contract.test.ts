import { beforeEach, describe, expect, it } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("legacy plan intake boundary", () => {
  it("returns a stable review code instead of generating from a legacy frame request", () => {
    // Given
    const draft = {
      eventGroup: "MIDDLE_DISTANCE" as const,
      experienceBand: "DEVELOPING" as const,
      availableDayCount: 3 as const,
      requestedFrameLength: 9 as const,
      trainingFocus: "LT_INTENT" as const,
      secondSessionMode: "SINGLE_SESSION_ONLY" as const,
    }

    // When
    const result = generatePlanFromDraft(draft, "NO_KNOWN_RISK")

    // Then
    expect(result).toEqual({
      kind: "rejected",
      code: "FORMATION_REVIEW_REQUIRED",
    })
  })
})
