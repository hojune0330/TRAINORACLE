import { describe, expect, it } from "vitest"
import { mapD9ResultToRveSignal } from "../src/rve/signal"
import { decideSafetyGate } from "../src/safety-gate/gate"
import {
  generatePlanCandidates,
} from "../src/plan-generator/generator"
import { recordPlanProgress } from "../src/plan-generator/progress"
import { selectPlanCandidate } from "../src/plan-generator/selection"
import type {
  BetaActivePlanSnapshot,
  PlanSession,
} from "../src/plan-generator/types"

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
  const localDays = Array.from(
    { length: 10 },
    (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`,
  )
  const slots = localDays.flatMap((localDayKey, day) => day === 9
    ? [{ slotIndex: 18, localDayKey, slot: "AM" as const }]
    : [
        { slotIndex: day * 2, localDayKey, slot: "AM" as const },
        { slotIndex: day * 2 + 1, localDayKey, slot: "PM" as const },
      ])
  const result = generatePlanCandidates({
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate: clearedGate(),
    profile: {
      eventGroup: "MIDDLE_DISTANCE",
      experienceBand: "DEVELOPING",
      availableTrainingDays: [1, 3, 5, 7, 9],
      secondSessionMode: "SINGLE_SESSION_ONLY",
    },
    formation: {
      kind: "LOCAL_CIVIL_9_5",
      slots,
      exposures: [
        {
          exposureId: "coach-main-one",
          classification: "TRAINING_MAIN",
          localDayKey: localDays[2],
          component: { kind: "STANDALONE" },
        },
        {
          exposureId: "coach-main-two",
          classification: "TRAINING_MAIN",
          localDayKey: localDays[6],
          component: { kind: "STANDALONE" },
        },
      ],
    },
    journalSource: {
      kind: "NO_USABLE_JOURNAL",
    },
    selectionAuthority: "COACH_REQUIRED",
    selectedEnergyIntent: "LT_INTENT",
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
      const sessionSlot = selection.activePlan.sessions[0]?.slot ?? "AM"

      // When
      const result = recordPlanProgress({
        kind: "PLAN_BETA_PROGRESS_REQUEST",
        activePlan: selection.activePlan,
        sessionDay,
        sessionSlot,
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

  it("rejects a progress record for a slot that the selected plan does not contain", () => {
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

    const result = recordPlanProgress({
      kind: "PLAN_BETA_PROGRESS_REQUEST",
      activePlan: selection.activePlan,
      sessionDay: 1,
      sessionSlot: "PM",
      state: "COMPLETED",
    })

    expect(result).toMatchObject({
      kind: "rejected",
      code: "SESSION_SLOT_NOT_IN_ACTIVE_PLAN",
    })
  })

  it("records progress for a QUALITY session placed in the PM slot (경로 B 확장 좌표)", () => {
    // Given — a hand-built active-plan snapshot carrying a PM QUALITY session.
    // The AM-first generator never produces this coordinate; it is only reachable
    // through the type extension (B-1/B-2) and the future move/replan flow.
    const pmQualitySession: PlanSession = {
      day: 2,
      slot: "PM",
      role: "QUALITY",
      plannedEnergyIntent: "LT_INTENT",
      prescription: {
        kind: "RPE_TIME_RANGE",
        rpe: { minimum: 5, maximum: 6 },
        durationMinutes: { minimum: 25, maximum: 40 },
      },
    }
    const activePlan: BetaActivePlanSnapshot = {
      kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
      activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId: "candidate-pm-quality",
      candidateKind: "BALANCED",
      selectionActor: "COACH",
      sourceMode: "PROFILE_ONLY",
      selectedEnergyIntent: "LT_INTENT",
      frame: {
        formationKind: "LOCAL_CIVIL_9_5",
        lengthDays: 9.5,
        slotCount: 19,
        continuity: { kind: "STANDARD_FRAME" },
      },
      sessions: [pmQualitySession],
    }

    // When
    const result = recordPlanProgress({
      kind: "PLAN_BETA_PROGRESS_REQUEST",
      activePlan,
      sessionDay: 2,
      sessionSlot: "PM",
      state: "COMPLETED",
    })

    // Then — the new coordinate flows through the coordinate check naturally.
    expect(result).toMatchObject({
      kind: "recorded",
      progress: {
        sessionDay: 2,
        sessionSlot: "PM",
        state: "COMPLETED",
      },
    })
  })

  it("rejects a progress record for a slot the extended plan does not contain", () => {
    // Given — the same extended snapshot has a PM QUALITY session on day 2 only.
    const activePlan: BetaActivePlanSnapshot = {
      kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
      activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId: "candidate-pm-quality",
      candidateKind: "BALANCED",
      selectionActor: "COACH",
      sourceMode: "PROFILE_ONLY",
      selectedEnergyIntent: "LT_INTENT",
      frame: {
        formationKind: "LOCAL_CIVIL_9_5",
        lengthDays: 9.5,
        slotCount: 19,
        continuity: { kind: "STANDARD_FRAME" },
      },
      sessions: [{
        day: 2,
        slot: "PM",
        role: "QUALITY",
        plannedEnergyIntent: "LT_INTENT",
        prescription: {
          kind: "RPE_TIME_RANGE",
          rpe: { minimum: 5, maximum: 6 },
          durationMinutes: { minimum: 25, maximum: 40 },
        },
      }],
    }

    // When — request the AM slot on the same day, which the plan does not contain.
    const result = recordPlanProgress({
      kind: "PLAN_BETA_PROGRESS_REQUEST",
      activePlan,
      sessionDay: 2,
      sessionSlot: "AM",
      state: "COMPLETED",
    })

    // Then
    expect(result).toMatchObject({
      kind: "rejected",
      code: "SESSION_SLOT_NOT_IN_ACTIVE_PLAN",
    })
  })
})
