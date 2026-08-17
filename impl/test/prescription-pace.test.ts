import { describe, expect, it } from "vitest"
import {
  calculateSameEventRacePace,
  createStructuredPrescription,
} from "../src/prescription/runtime"
import { parsePrescriptionNotation } from "../src/prescription/notation"
import type { PaceAnchorRecord } from "../src/prescription/types"

const notationText = "2×(10×400m) @5000m RP · r60″ STAND · R3′ STAND"
const operationalComponents = {
  warmup: {
    componentRef: "WU-V2-5K-01", componentVersion: "1.0.0", authority: "OWNER_OPERATIONAL_ADAPTATION",
    easyDurationMinutes: 15, rpeMin: 2, rpeMax: 3,
    strides: { repetitions: 4, durationSeconds: 20, recoverySeconds: 40, recoveryMode: "WALK_OR_JOG", progression: "PROGRESSIVE" },
  },
  cooldown: {
    componentRef: "CD-V2-5K-01", componentVersion: "1.0.0", authority: "OWNER_OPERATIONAL_ADAPTATION",
    easyDurationMinutes: 10, rpeMin: 1, rpeMax: 2,
  },
  fallback: {
    componentRef: "RPE-ONLY-CONTROLLED-01", componentVersion: "1.0.0", code: "RPE_ONLY_CONTROLLED",
    behavior: "DELEGATE_TO_EXISTING_RPE_CANDIDATE", numericRepetitionVariant: null,
  },
  stopConditions: {
    componentRef: "STOP-V2-5K-01", componentVersion: "1.0.0", authority: "OWNER_PRECAUTIONARY_OPERATIONAL_RULE",
    diagnosticClaim: false,
    codes: ["STOP_NEW_OR_WORSENING_PAIN", "STOP_DIZZINESS_OR_FAINTNESS", "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING", "STOP_LOSS_OF_CONTROLLED_FORM"],
  },
} as const

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
    operationalComponents,
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
      operationalComponents,
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
      operationalComponents,
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
      operationalComponents,
    })

    // Then
    expect(result).toEqual({ kind: "rejected", code: "ANCHOR_PROVENANCE_INCOMPLETE" })
  })

  it("rejects a 59m same-event anchor as sprint pace", () => {
    // Given
    const notation = parsePrescriptionNotation("1×59m @59m RP")
    if (notation.kind !== "parsed") {
      throw new Error(`Expected parsed notation, received ${notation.code}`)
    }
    const anchor = {
      ...currentFiveKAnchor(),
      anchorId: "race:59:current",
      eventDistanceM: 59,
      performanceSeconds: 8,
      sourceRef: "journal:race:59:2026-07-20",
    }

    // When
    const result = createStructuredPrescription({
      notation: notation.notation,
      anchor,
      displayRoundingPolicyVersion: "seconds-v1",
      operationalComponents,
    })

    // Then
    expect(result).toEqual({ kind: "rejected", code: "SPRINT_RACE_PACE_FORBIDDEN" })
  })

  it("calculates a 60m same-event anchor without sprint rejection", () => {
    // Given
    const notation = parsePrescriptionNotation("1×60m @60m RP")
    if (notation.kind !== "parsed") {
      throw new Error(`Expected parsed notation, received ${notation.code}`)
    }
    const anchor = {
      ...currentFiveKAnchor(),
      anchorId: "race:60:current",
      eventDistanceM: 60,
      performanceSeconds: 8,
      sourceRef: "journal:race:60:2026-07-20",
    }

    // When
    const created = createStructuredPrescription({
      notation: notation.notation,
      anchor,
      displayRoundingPolicyVersion: "seconds-v1",
      operationalComponents,
    })

    // Then
    expect(created).toEqual({
      kind: "created",
      prescription: expect.objectContaining({
        paceTargetEventDistanceM: 60,
        paceAnchorRef: "race:60:current",
      }),
    })

    if (created.kind !== "created") {
      throw new Error(`Expected structured prescription, received ${created.code}`)
    }

    expect(calculateSameEventRacePace({ prescription: created.prescription, anchor })).toEqual({
      kind: "calculated",
      targetRepSeconds: 8,
      displayRoundingPolicyVersion: "seconds-v1",
    })
  })

  it("rejects 30m sprint race-pace conversion", () => {
    // Given
    const sprintNotation = parsePrescriptionNotation("3×30m @30m RP · r120″ STAND")
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
      operationalComponents,
    })

    // When
    const result = created.kind === "created"
      ? calculateSameEventRacePace({ prescription: created.prescription, anchor })
      : created

    // Then
    expect(result).toEqual({ kind: "rejected", code: "SPRINT_RACE_PACE_FORBIDDEN" })
  })
})
