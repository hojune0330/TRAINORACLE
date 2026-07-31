import { describe, expect, it } from "vitest"
import { calculateGoalReferenceRacePace } from "../src/prescription/runtime"
import type { PaceAnchorRecord } from "../src/prescription/types"

function currentFiveKAnchor(): PaceAnchorRecord {
  return {
    anchorId: "race:5000:current",
    kind: "RECENT_RESULT",
    eventDistanceM: 5000,
    performanceSeconds: 1000,
    achievedAt: "2026-07-20",
    seasonId: null,
    enteredBy: "ATHLETE",
    sourceRef: "journal:race:5000:2026-07-20",
    verificationState: "SELF_REPORTED",
    freshnessState: "CURRENT",
    purpose: "CURRENT_CAPABILITY",
  }
}

function goalFiveKAnchor(): PaceAnchorRecord {
  return {
    ...currentFiveKAnchor(),
    anchorId: "race:5000:goal",
    kind: "GOAL",
    purpose: "ASPIRATIONAL_TARGET",
    performanceSeconds: 1050,
    freshnessState: "UNKNOWN",
    sourceRef: "journal:race:5000:goal",
  }
}

describe("display-only goal race-pace calculation", () => {
  it("calculates 210 seconds from a same-event 1050-second goal", () => {
    // Given
    const goalAnchor = goalFiveKAnchor()

    // When
    const result = calculateGoalReferenceRacePace({
      anchor: goalAnchor,
      targetEventDistanceM: 5000,
      repetitionDistanceM: 1000,
      displayRoundingPolicyVersion: "seconds-v1",
    })

    // Then
    expect(result).toEqual({
      kind: "calculated-goal-reference",
      targetRepSeconds: 210,
      displayOnly: true,
      sourceRef: "journal:race:5000:goal",
      displayRoundingPolicyVersion: "seconds-v1",
    })
  })

  it.each([
    ["enteredBy", ""],
    ["verificationState", ""],
    ["freshnessState", ""],
  ] as const)(
    "rejects invalid runtime %s provenance",
    (field, invalidValue) => {
      // Given
      const goalAnchor = {
        ...goalFiveKAnchor(),
        [field]: invalidValue,
      }

      // When
      const result = Reflect.apply(calculateGoalReferenceRacePace, undefined, [{
        anchor: goalAnchor,
        targetEventDistanceM: 5000,
        repetitionDistanceM: 1000,
        displayRoundingPolicyVersion: "seconds-v1",
      }])

      // Then
      expect(result).toEqual({
        kind: "rejected",
        code: "ANCHOR_PROVENANCE_INCOMPLETE",
      })
    },
  )

  it("rejects incomplete provenance", () => {
    // Given
    const goalAnchor = { ...goalFiveKAnchor(), sourceRef: "" }

    // When
    const result = calculateGoalReferenceRacePace({
      anchor: goalAnchor,
      targetEventDistanceM: 5000,
      repetitionDistanceM: 1000,
      displayRoundingPolicyVersion: "seconds-v1",
    })

    // Then
    expect(result).toEqual({ kind: "rejected", code: "ANCHOR_INCOMPLETE" })
  })

  it("rejects cross-event conversion", () => {
    // Given
    const goalAnchor = goalFiveKAnchor()

    // When
    const result = calculateGoalReferenceRacePace({
      anchor: goalAnchor,
      targetEventDistanceM: 1500,
      repetitionDistanceM: 1000,
      displayRoundingPolicyVersion: "seconds-v1",
    })

    // Then
    expect(result).toEqual({ kind: "rejected", code: "CROSS_EVENT_MODEL_REQUIRED" })
  })
})
