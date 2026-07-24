import { describe, expect, it } from "vitest"
import { mapD9ResultToRveSignal } from "../src/rve/signal"
import { decideSafetyGate } from "../src/safety-gate/gate"
import { generatePlanCandidates } from "../src/plan-generator/generator"

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

function request(frameLength: 7 | 9 | 10, includeContinuity: boolean) {
  return {
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate: clearedGate(),
    profile: {
      eventGroup: "MIDDLE_DISTANCE",
      experienceBand: "DEVELOPING",
      availableTrainingDays: frameLength === 7 ? [1, 3, 5, 7] : [1, 3, 5, 7, 9],
    },
    requestedFrameLength: frameLength,
    journalSource: { kind: "NO_USABLE_JOURNAL" },
    selectionAuthority: "SELF",
    ...(includeContinuity
      ? {
          continuity: {
            previousCandidateKind: "CONSERVATIVE",
            progressStateCounts: [
              { state: "COMPLETED", count: 2 },
              { state: "RESTED", count: 1 },
              { state: "SKIPPED", count: 0 },
              { state: "PAIN_CHECKIN", count: 1 },
            ],
          },
        }
      : {}),
  }
}

function expectGenerated(result: ReturnType<typeof generatePlanCandidates>) {
  if (result.kind !== "generated") {
    throw new Error(`Expected generated plan result, received ${result.kind}`)
  }
  return result
}

describe("plan beta continuity context", () => {
  it.each([7, 9, 10] as const)(
    "retains aggregate previous-frame context for a %i day successor without progression",
    (frameLength) => {
      // Given
      const withContinuity = request(frameLength, true)
      const withoutContinuity = request(frameLength, false)

      // When
      const nextFrame = expectGenerated(generatePlanCandidates(withContinuity))
      const baseline = expectGenerated(generatePlanCandidates(withoutContinuity))

      // Then
      for (const [index, candidate] of nextFrame.candidates.entries()) {
        expect(candidate.continuityContext).toEqual({
          kind: "PREVIOUS_FRAME_CONTEXT_RETAINED",
          previousCandidateKind: "CONSERVATIVE",
          progressStateCounts: [
            { state: "COMPLETED", count: 2 },
            { state: "RESTED", count: 1 },
            { state: "SKIPPED", count: 0 },
            { state: "PAIN_CHECKIN", count: 1 },
          ],
        })
        expect(candidate.rationaleCodes).toContain("PREVIOUS_FRAME_CONTEXT_RETAINED")
        expect(candidate.sessions).toEqual(baseline.candidates[index]?.sessions)
      }
    },
  )

  it("rejects unordered progress-state aggregates without processing them", () => {
    // Given
    const malformed = {
      ...request(9, true),
      continuity: {
        previousCandidateKind: "CONSERVATIVE",
        progressStateCounts: [
          { state: "RESTED", count: 1 },
          { state: "COMPLETED", count: 2 },
        ],
      },
    }

    // When
    const result = generatePlanCandidates(malformed)

    // Then
    expect(result).toMatchObject({
      kind: "rejected",
      code: "INVALID_CONTINUITY_CONTEXT",
      candidates: [],
    })
  })
})
