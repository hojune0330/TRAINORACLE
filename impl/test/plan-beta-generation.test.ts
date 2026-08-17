import { describe, expect, it } from "vitest"
import { evaluateD9ColloquialLayer } from "../src/d9/evaluator"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import { mapD9ResultToRveSignal } from "../src/rve/signal"
import { decideSafetyGate } from "../src/safety-gate/gate"
import {
  baseRequest,
  clearedGate,
  expectGenerated,
  unknownGate,
} from "./fixtures/plan-beta-request"

const canonicalActiveGate = decideSafetyGate(
  mapD9ResultToRveSignal(evaluateD9ColloquialLayer("종아리 뚝 했고 절뚝거려요")),
)

describe("plan beta generation contract", () => {
  it("blocks ACTIVE Safety Gate without options, sessions, or progression output", () => {
    // Given
    const request = baseRequest(canonicalActiveGate)

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
    const request = baseRequest(unknownGate())

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
    for (const candidate of result.candidates) {
      expect(candidate.detailedPrescriptionFingerprint).toBeNull()
      expect(candidate.sessions.every((session) => (
        session.role !== "QUALITY" || session.prescription.kind === "RPE_TIME_RANGE"
      ))).toBe(true)
    }
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

  it("uses the 19-slot local-civil 9.5-day Formation frame", () => {
    // Given
    const request = baseRequest()

    // When
    const result = expectGenerated(generatePlanCandidates(request))

    // Then
    for (const candidate of result.candidates) {
      expect(candidate.frame).toMatchObject({
        formationKind: "LOCAL_CIVIL_9_5",
        lengthDays: 9.5,
        slotCount: 19,
      })
    }
  })

  it("keeps standard-frame metadata for a canonical local-civil frame", () => {
    // Given
    const request = baseRequest()

    // When
    const result = expectGenerated(generatePlanCandidates(request))

    // Then
    for (const candidate of result.candidates) {
      expect(candidate.frame.continuity).toEqual({
        kind: "STANDARD_FRAME",
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

  it("places quality in PM and keeps the counterpart in AM for an evening athlete", () => {
    // Given
    const request = {
      ...baseRequest(),
      profile: {
        ...baseRequest().profile,
        trainingTimePreference: "EVENING",
        secondSessionMode: "RECOVERY_PM_ALLOWED",
      },
    }

    // When
    const result = expectGenerated(generatePlanCandidates(request))
    const balanced = result.candidates[0]

    // Then
    const quality = balanced.sessions.find((session) => session.role === "QUALITY")
    expect(quality?.slot).toBe("PM")
    expect(quality === undefined ? [] : balanced.sessions.filter(
      (session) => session.day === quality.day && session.role === "EASY",
    )).toHaveLength(1)
    expect(quality === undefined ? undefined : balanced.sessions.find(
      (session) => session.day === quality.day && session.role === "EASY",
    )?.slot).toBe("AM")
  })

  it("adds one recovery counterpart on every selected training day for a two-a-day athlete", () => {
    // Given
    const request = {
      ...baseRequest(clearedGate(), [4, 7]),
      profile: {
        ...baseRequest(clearedGate(), [4, 7]).profile,
        availableTrainingDays: [1, 4, 7, 10],
        secondSessionMode: "RECOVERY_PM_ALLOWED",
      },
    }

    // When
    const result = expectGenerated(generatePlanCandidates(request))
    const balanced = result.candidates[0]

    // Then
    const recoverySupport = balanced.sessions.filter(
      (session) => session.plannedEnergyIntent === "RECOVERY_INTENT" && session.role === "EASY",
    )
    expect(recoverySupport).toHaveLength(4)
    expect(new Set(recoverySupport.map((session) => session.day)).size).toBe(4)
  })

  it("limits sparse or beginner profile-only plans to one controlled quality day", () => {
    const sparseBase = baseRequest(clearedGate(), [4, 7])
    const sparse = {
      ...sparseBase,
      profile: {
        ...sparseBase.profile,
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
      ...baseRequest(canonicalActiveGate),
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
