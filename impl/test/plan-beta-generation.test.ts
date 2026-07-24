// noqa: SIZE_OK - one table-style contract suite covers the plan-generation boundary.
import { describe, expect, it } from "vitest"
import { mapD9ResultToRveSignal } from "../src/rve/signal"
import { decideSafetyGate } from "../src/safety-gate/gate"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import type { SafetyGateDecision } from "../src/safety-gate/gate"

function clearedGate() {
  const gate = decideSafetyGate(
    mapD9ResultToRveSignal({
      disposition: "D9_CLEARED",
      blocksPlanGeneration: false,
      reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
      evidence: [],
    }),
  )

  if (gate.kind !== "passed") {
    throw new Error("Expected cleared fixture to pass the Safety Gate")
  }

  return gate
}

function activeGate() {
  return decideSafetyGate(
    mapD9ResultToRveSignal({
      disposition: "D9_ACTIVE",
      blocksPlanGeneration: true,
      reasonCodes: ["D9_ACTIVE_MANUAL_OR_MEDICAL_HOLD"],
      evidence: [],
    }),
  )
}

function unknownGate() {
  return decideSafetyGate(
    mapD9ResultToRveSignal({
      disposition: "D9_UNKNOWN",
      blocksPlanGeneration: true,
      reasonCodes: ["D9_UNKNOWN_PAIN_WORSENING"],
      evidence: [],
    }),
  )
}

function baseRequest(frameLength = 9, safetyGate: SafetyGateDecision = clearedGate()) {
  return {
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate,
    profile: {
      eventGroup: "MIDDLE_DISTANCE",
      experienceBand: "DEVELOPING",
      availableTrainingDays: frameLength === 7 ? [1, 3, 5, 7] : [1, 3, 5, 7, 9],
    },
    requestedFrameLength: frameLength,
    journalSource: {
      kind: "NO_USABLE_JOURNAL",
    },
    selectionAuthority: "SELF",
  }
}

function expectGenerated(result: ReturnType<typeof generatePlanCandidates>) {
  if (result.kind !== "generated") {
    throw new Error(`Expected generated plan result, received ${result.kind}`)
  }

  return result
}

describe("plan beta generation contract", () => {
  it("blocks ACTIVE Safety Gate without options, sessions, or progression output", () => {
    // Given
    const request = baseRequest(9, activeGate())

    // When
    const result = generatePlanCandidates(request)

    // Then
    expect(result).toMatchObject({
      kind: "blocked",
      code: "SAFETY_GATE_ACTIVE",
      candidates: [],
    })
    expect(JSON.stringify(result)).not.toContain("sessions")
    expect(JSON.stringify(result)).not.toContain("progression")
  })

  it("blocks UNKNOWN Safety Gate without a hidden alternative candidate", () => {
    // Given
    const request = baseRequest(9, unknownGate())

    // When
    const result = generatePlanCandidates(request)

    // Then
    expect(result).toMatchObject({
      kind: "blocked",
      code: "SAFETY_GATE_UNKNOWN",
      candidates: [],
    })
    expect(JSON.stringify(result)).not.toContain("BALANCED")
    expect(JSON.stringify(result)).not.toContain("CONSERVATIVE")
  })

  it("creates two stable, distinct PROFILE_ONLY candidates with limited confidence", () => {
    // Given
    const request = baseRequest()

    // When
    const result = expectGenerated(generatePlanCandidates(request))

    // Then
    expect(result.sourceMode).toBe("PROFILE_ONLY")
    expect(result.confidence).toBe("LIMITED")
    expect(result.candidates.map((candidate) => candidate.kind)).toEqual([
      "BALANCED",
      "CONSERVATIVE",
    ])
    expect(result.candidates[0]?.candidateId).not.toBe(result.candidates[1]?.candidateId)
    expect(result.candidates[0]?.sessions).not.toEqual(result.candidates[1]?.sessions)
  })

  it.each(["MIDDLE_DISTANCE", "FIVE_K", "TEN_K", "GENERAL_ENDURANCE"])(
    "keeps %s in an explicit non-universal beta scope",
    (eventGroup) => {
      // Given
      const request = {
        ...baseRequest(),
        profile: {
          ...baseRequest().profile,
          eventGroup,
        },
      }

      // When
      const result = expectGenerated(generatePlanCandidates(request))

      // Then
      for (const candidate of result.candidates) {
        expect(candidate.eventGroup).toBe(eventGroup)
        expect(candidate.beta).toEqual({
          designation: "BETA",
          prescriptionBasis: "DURATION_RPE_ONLY",
          formationMethodClaim: "NOT_UNIVERSAL",
        })
      }
    },
  )

  it("returns identical candidate content and order for identical canonical input", () => {
    // Given
    const request = baseRequest()

    // When
    const first = expectGenerated(generatePlanCandidates(request))
    const second = expectGenerated(generatePlanCandidates(request))

    // Then
    expect(second.candidates).toEqual(first.candidates)
    expect(second.audit).toEqual(first.audit)
  })

  it.each([7, 9, 10])("respects a %i day frame", (frameLength) => {
    // Given
    const request = baseRequest(frameLength)

    // When
    const result = expectGenerated(generatePlanCandidates(request))

    // Then
    for (const candidate of result.candidates) {
      expect(candidate.frame.lengthDays).toBe(frameLength)
      expect(candidate.sessions).toHaveLength(frameLength)
    }
  })

  it("keeps explicit continuity metadata for a requested seven day frame", () => {
    // Given
    const request = baseRequest(7)

    // When
    const result = expectGenerated(generatePlanCandidates(request))

    // Then
    for (const candidate of result.candidates) {
      expect(candidate.frame.continuity).toEqual({
        kind: "SEVEN_DAY_CONTINUITY",
        nextFrameInput: "SELECTED_PLAN_AND_PROGRESS",
      })
    }
  })

  it("keeps sessions inside available days and separates quality sessions", () => {
    // Given
    const request = baseRequest()

    // When
    const result = expectGenerated(generatePlanCandidates(request))

    // Then
    for (const candidate of result.candidates) {
      const qualityDays = candidate.sessions
        .filter((session) => session.role === "QUALITY")
        .map((session) => session.day)

      for (const session of candidate.sessions) {
        if (session.role === "REST") {
          continue
        }
        expect(request.profile.availableTrainingDays).toContain(session.day)
      }

      for (const qualityDay of qualityDays) {
        for (const otherQualityDay of qualityDays) {
          if (qualityDay !== otherQualityDay) {
            expect(Math.abs(qualityDay - otherQualityDay)).toBeGreaterThanOrEqual(3)
          }
        }
      }
    }
  })

  it("limits sparse or beginner profile-only plans to one controlled quality day", () => {
    const sparse = {
      ...baseRequest(),
      profile: {
        ...baseRequest().profile,
        availableTrainingDays: [1, 4, 7],
      },
    }
    const beginner = {
      ...baseRequest(),
      profile: {
        ...baseRequest().profile,
        experienceBand: "NEW_TO_RUNNING",
      },
    }

    const sparseResult = expectGenerated(generatePlanCandidates(sparse))
    const beginnerResult = expectGenerated(generatePlanCandidates(beginner))

    for (const result of [sparseResult, beginnerResult]) {
      const balanced = result.candidates[0]
      expect(
        balanced.sessions.filter((session) => session.role === "QUALITY"),
      ).toHaveLength(1)
      expect(balanced.sessions[0]?.role).not.toBe("QUALITY")
    }
  })

  it("journal context cannot override an unsafe gate", () => {
    // Given
    const request = {
      ...baseRequest(9, activeGate()),
      journalSource: {
        kind: "RECENT_JOURNAL_CONTEXT",
        eligibleSessionCount: 4,
      },
    }

    // When
    const result = generatePlanCandidates(request)

    // Then
    expect(result).toMatchObject({
      kind: "blocked",
      code: "SAFETY_GATE_ACTIVE",
      candidates: [],
    })
  })

  it("labels recent journal presence as context-only without changing prescriptions", () => {
    // Given
    const profileOnly = expectGenerated(generatePlanCandidates(baseRequest()))
    const request = {
      ...baseRequest(),
      journalSource: {
        kind: "RECENT_JOURNAL_CONTEXT",
        eligibleSessionCount: 4,
      },
    }

    // When
    const result = expectGenerated(generatePlanCandidates(request))

    // Then
    expect(result.sourceMode).toBe("JOURNAL_CONTEXT_ONLY")
    for (const candidate of result.candidates) {
      expect(candidate.rationaleCodes).toContain("RECENT_JOURNAL_CONTEXT_PRESENT")
    }
    expect(result.candidates.map((candidate) => candidate.sessions)).toEqual(
      profileOnly.candidates.map((candidate) => candidate.sessions),
    )
  })

  it("does not invent pace or retain raw free text in plans or audits", () => {
    // Given
    const rawMemo = "free text must never cross the plan boundary"
    const request = {
      ...baseRequest(),
      rawMemo,
    }

    // When
    const result = expectGenerated(generatePlanCandidates(request))

    // Then
    expect(JSON.stringify(result)).not.toContain(rawMemo)
    expect(JSON.stringify(result)).not.toContain("pace")
    for (const candidate of result.candidates) {
      for (const session of candidate.sessions) {
        if (session.role !== "REST") {
          expect(session.prescription.kind).toBe("RPE_TIME_RANGE")
        }
      }
    }
  })

  it("returns a typed rejection for malformed or out-of-range input", () => {
    // Given
    const malformed = {
      ...baseRequest(),
      profile: {
        ...baseRequest().profile,
        availableTrainingDays: [11],
      },
    }

    // When
    const result = generatePlanCandidates(malformed)

    // Then
    expect(result).toMatchObject({
      kind: "rejected",
      candidates: [],
    })
  })

  it("rejects an out-of-range recent journal context with a stable code", () => {
    // Given
    const request = {
      ...baseRequest(),
      journalSource: {
        kind: "RECENT_JOURNAL_CONTEXT",
        eligibleSessionCount: 29,
      },
    }

    // When
    const result = generatePlanCandidates(request)

    // Then
    expect(result).toMatchObject({
      kind: "rejected",
      code: "INVALID_JOURNAL_CONTEXT",
      candidates: [],
    })
  })
})
