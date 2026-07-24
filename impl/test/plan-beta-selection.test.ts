import { describe, expect, it } from "vitest"
import { mapD9ResultToRveSignal } from "../src/rve/signal"
import { decideSafetyGate } from "../src/safety-gate/gate"
import {
  generatePlanCandidates,
} from "../src/plan-generator/generator"
import { recordPlanProgress } from "../src/plan-generator/progress"
import { selectPlanCandidate } from "../src/plan-generator/selection"

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

function generatedCoachRequiredPlan() {
  const result = generatePlanCandidates({
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate: clearedGate(),
    profile: {
      eventGroup: "MIDDLE_DISTANCE",
      experienceBand: "DEVELOPING",
      availableTrainingDays: [1, 3, 5, 7, 9],
    },
    requestedFrameLength: 9,
    journalSource: {
      kind: "NO_USABLE_JOURNAL",
    },
    selectionAuthority: "COACH_REQUIRED",
  })

  if (result.kind !== "generated") {
    throw new Error(`Expected generated plan result, received ${result.kind}`)
  }

  return result
}

describe("plan beta selection and progress contract", () => {
  it("rejects self selection when a coach selection is required", () => {
    // Given
    const generatedPlan = generatedCoachRequiredPlan()
    const candidateId = generatedPlan.candidates[0]?.candidateId ?? "missing-candidate"

    // When
    const result = selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      generatedPlan,
      selectedCandidateId: candidateId,
      actor: "SELF",
      safetyGate: clearedGate(),
    })

    // Then
    expect(result).toEqual({
      kind: "rejected",
      code: "COACH_SELECTION_REQUIRED",
      audit: {
        event: "PLAN_BETA_SELECTION_REJECTED",
        codes: ["COACH_SELECTION_REQUIRED"],
        privacy: "STRUCTURED_CODES_ONLY",
      },
    })
  })

  it("creates an immutable active-plan snapshot when the coach selects a candidate", () => {
    // Given
    const generatedPlan = generatedCoachRequiredPlan()
    const candidateId = generatedPlan.candidates[0]?.candidateId ?? "missing-candidate"

    // When
    const result = selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      generatedPlan,
      selectedCandidateId: candidateId,
      actor: "COACH",
      safetyGate: clearedGate(),
    })

    // Then
    expect(result.kind).toBe("selected")
    if (result.kind !== "selected") {
      throw new Error("Expected coach selection to succeed")
    }
    expect(result.activePlan.candidateId).toBe(candidateId)
    expect(result.activePlan.selectionActor).toBe("COACH")
    expect(Object.isFrozen(result.activePlan)).toBe(true)
    expect(Object.isFrozen(result.activePlan.sessions)).toBe(true)
  })

  it.each(["COMPLETED", "RESTED", "SKIPPED", "PAIN_CHECKIN"] as const)(
    "records %s with structured audit only and no reward output",
    (state) => {
      // Given
      const generatedPlan = generatedCoachRequiredPlan()
      const candidateId = generatedPlan.candidates[0]?.candidateId ?? "missing-candidate"
      const selection = selectPlanCandidate({
        kind: "PLAN_BETA_SELECTION_REQUEST",
        generatedPlan,
        selectedCandidateId: candidateId,
        actor: "COACH",
        safetyGate: clearedGate(),
      })

      if (selection.kind !== "selected") {
        throw new Error("Expected coach selection to succeed")
      }

      const sessionDay = selection.activePlan.sessions[0]?.day ?? 1

      // When
      const result = recordPlanProgress({
        kind: "PLAN_BETA_PROGRESS_REQUEST",
        activePlan: selection.activePlan,
        sessionDay,
        state,
      })

      // Then
      expect(result).toMatchObject({
        kind: "recorded",
        progress: {
          state,
        },
      })
      expect(JSON.stringify(result)).not.toContain("point")
      expect(JSON.stringify(result)).not.toContain("reward")
    },
  )
})
