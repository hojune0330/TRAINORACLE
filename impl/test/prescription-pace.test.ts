import { describe, expect, it } from "vitest"
import {
  calculateSameEventRacePace,
  createStructuredPrescription,
} from "../src/prescription/runtime"
import { parsePrescriptionNotation } from "../src/prescription/notation"
import type { PaceAnchorRecord } from "../src/prescription/types"

const notationText = "2×(10×400m) @5000m RP · r60″ · R3′"

function parsedNotation() {
  const result = parsePrescriptionNotation(notationText)
  if (result.kind !== "parsed") {
    throw new Error(`Expected parsed notation, received ${result.code}`)
  }
  return result.notation
}

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

function boundPrescription() {
  const result = createStructuredPrescription({
    notation: parsedNotation(),
    anchor: currentFiveKAnchor(),
    displayRoundingPolicyVersion: "seconds-v1",
  })
  if (result.kind !== "created") {
    throw new Error(`Expected structured prescription, received ${result.code}`)
  }
  return result.prescription
}

describe("same-event race-pace calculation", () => {
  it("calculates a 400m target from an explicitly selected current 5000m anchor", () => {
    // Given
    const prescription = boundPrescription()
    const anchor = currentFiveKAnchor()

    // When
    const result = calculateSameEventRacePace({ prescription, anchor })

    // Then
    expect(result).toEqual({
      kind: "calculated",
      targetRepSeconds: 80,
      displayRoundingPolicyVersion: "seconds-v1",
    })
  })

  it("rejects a different-event anchor instead of converting across events", () => {
    // Given
    const prescription = boundPrescription()
    const anchor = { ...currentFiveKAnchor(), eventDistanceM: 1500 }

    // When
    const result = calculateSameEventRacePace({ prescription, anchor })

    // Then
    expect(result).toEqual({ kind: "rejected", code: "CROSS_EVENT_MODEL_REQUIRED" })
  })

  it("rejects a GOAL anchor as current capability", () => {
    // Given
    const anchor = {
      ...currentFiveKAnchor(),
      kind: "GOAL" as const,
      purpose: "ASPIRATIONAL_TARGET" as const,
    }
    const created = createStructuredPrescription({
      notation: parsedNotation(),
      anchor,
      displayRoundingPolicyVersion: "seconds-v1",
    })

    // When
    const result = created.kind === "created"
      ? calculateSameEventRacePace({ prescription: created.prescription, anchor })
      : created

    // Then
    expect(result).toEqual({ kind: "rejected", code: "GOAL_ANCHOR_FORBIDDEN" })
  })

  it("rejects a stale PB instead of treating it as current capability", () => {
    // Given
    const anchor = {
      ...currentFiveKAnchor(),
      kind: "PB" as const,
      freshnessState: "STALE" as const,
    }

    // When
    const result = createStructuredPrescription({
      notation: parsedNotation(),
      anchor,
      displayRoundingPolicyVersion: "seconds-v1",
    })

    // Then
    expect(result).toEqual({ kind: "rejected", code: "ANCHOR_NOT_CURRENT" })
  })

  it("rejects an SB without its season provenance", () => {
    // Given
    const anchor = {
      ...currentFiveKAnchor(),
      kind: "SB" as const,
      purpose: "SEASON_CONTEXT" as const,
      seasonId: null,
    }

    // When
    const result = createStructuredPrescription({
      notation: parsedNotation(),
      anchor,
      displayRoundingPolicyVersion: "seconds-v1",
    })

    // Then
    expect(result).toEqual({ kind: "rejected", code: "ANCHOR_PROVENANCE_INCOMPLETE" })
  })

  it("rejects 30m sprint race-pace conversion", () => {
    // Given
    const sprintNotation = parsePrescriptionNotation("3×30m @30m RP · r120″")
    if (sprintNotation.kind !== "parsed") {
      throw new Error(`Expected parsed notation, received ${sprintNotation.code}`)
    }
    const anchor = {
      ...currentFiveKAnchor(),
      eventDistanceM: 30,
      kind: "SPRINT_BENCHMARK" as const,
      purpose: "SPRINT_REFERENCE" as const,
    }
    const created = createStructuredPrescription({
      notation: sprintNotation.notation,
      anchor,
      displayRoundingPolicyVersion: "seconds-v1",
    })

    // When
    const result = created.kind === "created"
      ? calculateSameEventRacePace({ prescription: created.prescription, anchor })
      : created

    // Then
    expect(result).toEqual({ kind: "rejected", code: "SPRINT_RACE_PACE_FORBIDDEN" })
  })
})
