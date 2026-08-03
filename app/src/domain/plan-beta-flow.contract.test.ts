import { beforeEach, describe, expect, it } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("canonical plan intake boundary", () => {
  it("generates two selectable 9.5-day candidates from the athlete intake", () => {
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
    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return

    expect(result.generated.candidates).toHaveLength(2)
    for (const candidate of result.generated.candidates) {
      expect(candidate.frame).toMatchObject({
        formationKind: "LOCAL_CIVIL_9_5",
        lengthDays: 9.5,
        slotCount: 19,
      })
      expect(candidate.mainExposureLedger.mainExposureCount).toBeGreaterThanOrEqual(2)
      expect(candidate.mainExposureLedger.mainExposureCount).toBeLessThanOrEqual(3)
    }
  })
})
