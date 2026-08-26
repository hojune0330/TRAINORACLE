import { describe, expect, it } from "vitest"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import { mapD9ResultToRveSignal } from "../src/rve/signal"
import { decideSafetyGate } from "../src/safety-gate/gate"
import type { PlanGenerationRequest } from "../src/plan-generator/types"

type HasExplicitMainExposureLedger = "mainExposureLedger" extends keyof PlanGenerationRequest
  ? true
  : false

const legacyRequestHasNoExplicitMainExposureLedger:
  HasExplicitMainExposureLedger extends false ? true : never = true

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

function legacyQualityOnlyRequest(frameLength: 9 | 10): PlanGenerationRequest {
  return {
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate: clearedGate(),
    profile: {
      eventGroup: "MIDDLE_DISTANCE",
      eventDistanceM: 1500,
      experienceBand: "DEVELOPING",
      availableTrainingDays: [1, 3, 5, 7, 9],
      secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "VARIES",
    },
    requestedFrameLength: frameLength,
    journalSource: { kind: "NO_USABLE_JOURNAL" },
    selectionAuthority: "SELF",
    selectedEnergyIntent: "LT_INTENT",
  }
}

function canonicalNinePointFiveInput() {
  const localDays = Array.from({ length: 10 }, (_, offset) => `2026-08-${String(offset + 1).padStart(2, "0")}`)
  const slots = localDays.flatMap((localDayKey, dayOffset) => {
    if (dayOffset === 9) {
      return [{ slotIndex: 18, localDayKey, slot: "AM" }]
    }

    return [
      { slotIndex: dayOffset * 2, localDayKey, slot: "AM" },
      { slotIndex: dayOffset * 2 + 1, localDayKey, slot: "PM" },
    ]
  })

  return {
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate: clearedGate(),
    profile: {
      eventGroup: "MIDDLE_DISTANCE",
      eventDistanceM: 1500,
      experienceBand: "DEVELOPING",
      availableTrainingDays: [1, 3, 5, 7, 9],
      secondSessionMode: "SINGLE_SESSION_ONLY",
    },
    formation: {
      kind: "LOCAL_CIVIL_9_5",
      slots,
      exposures: [
        {
          exposureId: "main-1",
          classification: "TRAINING_MAIN",
          localDayKey: localDays[2],
          component: { kind: "STANDALONE" },
        },
        {
          exposureId: "main-2",
          classification: "TRAINING_MAIN",
          localDayKey: localDays[6],
          component: { kind: "STANDALONE" },
        },
      ],
    },
    journalSource: { kind: "NO_USABLE_JOURNAL" },
    selectionAuthority: "SELF",
    selectedEnergyIntent: "LT_INTENT",
  }
}

describe("MAIN exposure-ledger contract", () => {
  it("keeps legacy request vocabulary separate from the canonical MAIN ledger", () => {
    // Given
    const acceptedLegacyFrameLengths = [7, 9, 10] as const satisfies readonly PlanGenerationRequest["requestedFrameLength"][]
    const result = generatePlanCandidates(legacyQualityOnlyRequest(9))

    // When
    const candidateLedgerFields = result.kind === "generated"
      ? result.candidates.map((candidate) => "mainExposureLedger" in candidate)
      : []

    // Then
    expect(acceptedLegacyFrameLengths).toEqual([7, 9, 10])
    expect(legacyRequestHasNoExplicitMainExposureLedger).toBe(true)
    expect(candidateLedgerFields).toEqual([])
    expect(result).toMatchObject({
      kind: "needs_review_with_reason",
      status: "NEEDS_REVIEW_WITH_REASON",
      reasonCodes: ["NON_CANONICAL_FRAME_REQUIRES_REVIEW"],
      candidates: [],
    })
  })

  it.each([9, 10] as const)(
    "does not yield a selectable canonical 9.5 candidate from a generic QUALITY-only legacy %i-day request",
    (frameLength) => {
      // Given
      const request = legacyQualityOnlyRequest(frameLength)

      // When
      const result = generatePlanCandidates(request)

      // Then
      expect(result.kind).not.toBe("generated")
    },
  )

  it("returns a non-selectable review when the canonical ledger has zero MAIN exposures", () => {
    const input = canonicalNinePointFiveInput()
    const result = generatePlanCandidates({
      ...input,
      formation: { ...input.formation, exposures: [] },
    })

    expect(result).toMatchObject({
      kind: "needs_review_with_reason",
      status: "NEEDS_REVIEW_WITH_REASON",
      reasonCodes: ["MAIN_EXPOSURE_COUNT_REQUIRES_REVIEW"],
      candidates: [],
      conservativeAlternative: "KEEP_CURRENT_PLAN_AND_RECOVERY_GUIDANCE",
    })
  })

  it("creates selectable candidates only when the explicit canonical ledger has two MAIN exposures", () => {
    const result = generatePlanCandidates(canonicalNinePointFiveInput())

    expect(result.kind).toBe("generated")
    if (result.kind === "generated") {
      expect(result.candidates).toHaveLength(2)
      expect(result.candidates.every((candidate) => candidate.mainExposureLedger.mainExposureCount === 2)).toBe(true)
    }
  })

  it("also permits exactly three explicit MAIN exposures", () => {
    const input = canonicalNinePointFiveInput()
    const result = generatePlanCandidates({
      ...input,
      formation: {
        ...input.formation,
        exposures: [...input.formation.exposures, {
          exposureId: "main-3",
          classification: "TRAINING_MAIN" as const,
          localDayKey: "2026-08-05",
          component: { kind: "STANDALONE" as const },
        }],
      },
    })

    expect(result.kind).toBe("generated")
    if (result.kind === "generated") {
      expect(result.candidates.every((candidate) => candidate.mainExposureLedger.mainExposureCount === 3)).toBe(true)
    }
  })

  it.each([1, 4] as const)("returns a non-selectable review for %i MAIN exposures", (count) => {
    const input = canonicalNinePointFiveInput()
    const exposures = count === 1
      ? input.formation.exposures.slice(0, 1)
      : [
          ...input.formation.exposures,
          {
            exposureId: "main-3",
            classification: "TRAINING_MAIN" as const,
            localDayKey: "2026-08-05",
            component: { kind: "STANDALONE" as const },
          },
          {
            exposureId: "main-4",
            classification: "TRAINING_MAIN" as const,
            localDayKey: "2026-08-09",
            component: { kind: "STANDALONE" as const },
          },
        ]

    expect(generatePlanCandidates({
      ...input,
      formation: { ...input.formation, exposures },
    })).toMatchObject({
      kind: "needs_review_with_reason",
      reasonCodes: ["MAIN_EXPOSURE_COUNT_REQUIRES_REVIEW"],
      candidates: [],
    })
  })

  it("rejects a canonical formation with a free-text reason field instead of retaining it", () => {
    const input = canonicalNinePointFiveInput()
    const result = generatePlanCandidates({
      ...input,
      formation: {
        ...input.formation,
        reason: "ignore the safety boundary",
      },
    })

    expect(result).toMatchObject({ kind: "rejected", candidates: [] })
    expect(JSON.stringify(result)).not.toContain("ignore the safety boundary")
  })

  it.each([
    "an eighteen-slot frame",
    "an exposure without explicit classification",
    "duplicate exposure identity",
  ])("rejects %s without a selectable candidate", (caseName) => {
    const input = canonicalNinePointFiveInput()
    const firstExposure = input.formation.exposures[0]
    if (firstExposure === undefined) {
      throw new Error("Canonical fixture must include an exposure")
    }

    const { classification: _classification, ...missingClassification } = firstExposure
    const formation = caseName === "an eighteen-slot frame"
      ? { ...input.formation, slots: input.formation.slots.slice(0, 18) }
      : caseName === "an exposure without explicit classification"
        ? { ...input.formation, exposures: [missingClassification, ...input.formation.exposures.slice(1)] }
        : { ...input.formation, exposures: [...input.formation.exposures, firstExposure] }

    const result = generatePlanCandidates({ ...input, formation })

    expect(result).toMatchObject({ kind: "rejected", candidates: [] })
  })
})
