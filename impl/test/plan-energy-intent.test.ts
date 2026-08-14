import { describe, expect, it } from "vitest"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import { decideSafetyGate } from "../src/safety-gate/gate"
import { mapD9ResultToRveSignal } from "../src/rve/signal"
import { canonicalFormation } from "./fixtures/canonical-formation"

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

function generateFor(selectedEnergyIntent: string) {
  return generatePlanCandidates({
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate: clearedGate(),
    profile: {
      eventGroup: "FIVE_K",
      experienceBand: "DEVELOPING",
      availableTrainingDays: [1, 3, 5, 7, 9],
      secondSessionMode: "SINGLE_SESSION_ONLY",
    },
    formation: canonicalFormation(),
    journalSource: { kind: "NO_USABLE_JOURNAL" },
    selectionAuthority: "SELF",
    selectedEnergyIntent,
  })
}

function expectGenerated(result: ReturnType<typeof generatePlanCandidates>) {
  if (result.kind !== "generated") {
    throw new Error(`Expected generated plan result, received ${result.kind}`)
  }
  return result
}

describe("personal plan energy intention contract", () => {
  it("keeps the selected quality focus in both candidates and reduces Candidate B duration dose", () => {
    // Given
    const generated = expectGenerated(generateFor("VO2_INTENT"))

    // When
    const [balanced, conservative] = generated.candidates
    const balancedQuality = balanced.sessions.find((session) => session.role === "QUALITY")
    const conservativeQuality = conservative.sessions.find((session) => session.role === "QUALITY")

    // Then
    expect(balancedQuality?.plannedEnergyIntent).toBe("VO2_INTENT")
    expect(conservativeQuality?.plannedEnergyIntent).toBe("VO2_INTENT")
    if (balancedQuality?.role !== "QUALITY" || conservativeQuality?.role !== "QUALITY") return
    expect(conservativeQuality.prescription.durationMinutes.maximum).toBeLessThan(
      balancedQuality.prescription.durationMinutes.maximum,
    )
  })

  it("preserves recovery-support duration while Candidate B reduces non-recovery dose", () => {
    const generated = expectGenerated(generatePlanCandidates({
      kind: "PLAN_BETA_GENERATION_REQUEST",
      safetyGate: clearedGate(),
      profile: {
        eventGroup: "FIVE_K",
        experienceBand: "EXPERIENCED",
        availableTrainingDays: [1, 3, 5, 7, 9],
        secondSessionMode: "RECOVERY_PM_ALLOWED",
      },
      formation: canonicalFormation(),
      journalSource: { kind: "NO_USABLE_JOURNAL" },
      selectionAuthority: "SELF",
      selectedEnergyIntent: "VO2_INTENT",
    }))
    const [balanced, conservative] = generated.candidates
    const balancedRecovery = balanced.sessions.find(
      (session) => session.role === "EASY" && session.plannedEnergyIntent === "RECOVERY_INTENT",
    )
    const conservativeRecovery = conservative.sessions.find(
      (session) => session.role === "EASY" && session.plannedEnergyIntent === "RECOVERY_INTENT",
    )

    expect(balancedRecovery?.prescription).toEqual(conservativeRecovery?.prescription)
  })

  it("keeps at most one QUALITY session per day and companion RPE within 1-3", () => {
    // Given
    const generated = expectGenerated(generatePlanCandidates({
      kind: "PLAN_BETA_GENERATION_REQUEST",
      safetyGate: clearedGate(),
      profile: {
        eventGroup: "FIVE_K",
        experienceBand: "EXPERIENCED",
        availableTrainingDays: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        secondSessionMode: "RECOVERY_PM_ALLOWED",
        trainingTimePreference: "EVENING",
      },
      formation: canonicalFormation(),
      journalSource: { kind: "NO_USABLE_JOURNAL" },
      selectionAuthority: "SELF",
      selectedEnergyIntent: "VO2_INTENT",
    }))

    for (const candidate of generated.candidates) {
      for (let day = 1; day <= 10; day += 1) {
        const sessions = candidate.sessions.filter((session) => session.day === day)
        expect(sessions.filter((session) => session.role === "QUALITY")).toHaveLength(
          sessions.some((session) => session.role === "QUALITY") ? 1 : 0,
        )
        for (const companion of sessions.filter((session) => session.role === "EASY")) {
          if (!sessions.some((session) => session.role === "QUALITY")) continue
          expect(companion.prescription.rpe.minimum).toBeGreaterThanOrEqual(1)
          expect(companion.prescription.rpe.maximum).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it.each([
    ["LT_INTENT", { minimum: 5, maximum: 6 }],
    ["VO2_INTENT", { minimum: 7, maximum: 8 }],
    ["GLY_INTENT", { minimum: 7, maximum: 8 }],
    ["ATP_PC_INTENT", { minimum: 8, maximum: 9 }],
  ])(
    "keeps %s visible to a self-selecting athlete with RPE-only detail",
    (selectedEnergyIntent, expectedRpe) => {
      const generated = expectGenerated(generateFor(selectedEnergyIntent))
      const balanced = generated.candidates[0]

      expect(balanced?.selectionAuthority).toBe("SELF")
      expect(balanced?.sessions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          role: "QUALITY",
          plannedEnergyIntent: selectedEnergyIntent,
          prescription: expect.objectContaining({ rpe: expectedRpe }),
        }),
      ]))
      expect(JSON.stringify(balanced)).not.toContain("repeatCount")
      expect(JSON.stringify(balanced)).not.toContain("targetPace")
    },
  )

  it("uses RPE 1-2 recovery guidance without turning recovery into a hidden quality day", () => {
    const generated = expectGenerated(generateFor("RECOVERY_INTENT"))
    const balanced = generated.candidates[0]

    expect(balanced?.sessions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "QUALITY" }),
    ]))
    expect(balanced?.sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: "EASY",
        plannedEnergyIntent: "RECOVERY_INTENT",
        prescription: expect.objectContaining({
          rpe: { minimum: 1, maximum: 2 },
        }),
      }),
    ]))
  })

  it("keeps two recovery sessions on every selected day when an athlete explicitly chooses two-a-day recovery", () => {
    // Given
    const result = generatePlanCandidates({
      kind: "PLAN_BETA_GENERATION_REQUEST",
      safetyGate: clearedGate(),
      profile: {
        eventGroup: "FIVE_K",
        experienceBand: "DEVELOPING",
        availableTrainingDays: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        secondSessionMode: "RECOVERY_PM_ALLOWED",
      },
      formation: canonicalFormation(),
      journalSource: { kind: "NO_USABLE_JOURNAL" },
      selectionAuthority: "SELF",
      selectedEnergyIntent: "RECOVERY_INTENT",
    })

    // When
    const balanced = expectGenerated(result).candidates[0]

    // Then
    const pmSessions = balanced.sessions.filter((session) => session.slot === "PM")
    expect(pmSessions).toHaveLength(9)
    expect(new Set(pmSessions.map((session) => session.day))).toEqual(
      new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    )
    expect(balanced.sessions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "QUALITY" }),
    ]))
  })

  it("adds a separate PM recovery session on every selected training day when an athlete chooses two-a-day training", () => {
    // Given
    const result = generatePlanCandidates({
      kind: "PLAN_BETA_GENERATION_REQUEST",
      safetyGate: clearedGate(),
      profile: {
        eventGroup: "FIVE_K",
        experienceBand: "EXPERIENCED",
        availableTrainingDays: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        secondSessionMode: "RECOVERY_PM_ALLOWED",
      },
      formation: canonicalFormation(),
      journalSource: { kind: "NO_USABLE_JOURNAL" },
      selectionAuthority: "SELF",
      selectedEnergyIntent: "LT_INTENT",
    })

    // When
    const generated = expectGenerated(result)
    const balanced = generated.candidates[0]
    const conservative = generated.candidates[1]
    const pmSessions = balanced?.sessions.filter((session) => (
      "slot" in session && session.slot === "PM"
    )) ?? []

    // Then
    expect(pmSessions).toHaveLength(9)
    expect(pmSessions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: "EASY",
        plannedEnergyIntent: "RECOVERY_INTENT",
        prescription: expect.objectContaining({
          rpe: { minimum: 1, maximum: 2 },
        }),
      }),
    ]))
    expect(pmSessions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "QUALITY" }),
    ]))
    expect(
      new Set(pmSessions.map((session) => session.day)).size,
    ).toBe(pmSessions.length)
    expect(
      conservative?.sessions.filter((session) => "slot" in session && session.slot === "PM"),
    ).toHaveLength(9)
  })

  it("does not add extra quality sessions when an athlete can move every day", () => {
    const generated = expectGenerated(generatePlanCandidates({
      kind: "PLAN_BETA_GENERATION_REQUEST",
      safetyGate: clearedGate(),
      profile: {
        eventGroup: "FIVE_K",
        experienceBand: "EXPERIENCED",
        availableTrainingDays: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        secondSessionMode: "RECOVERY_PM_ALLOWED",
      },
      formation: canonicalFormation(),
      journalSource: { kind: "NO_USABLE_JOURNAL" },
      selectionAuthority: "SELF",
      selectedEnergyIntent: "VO2_INTENT",
    }))

    const balanced = generated.candidates[0]
    const qualitySessions = balanced.sessions.filter((session) => session.role === "QUALITY")

    expect(qualitySessions).toHaveLength(2)
    expect(qualitySessions.every((session) => session.slot === "AM")).toBe(true)
    expect(balanced.sessions.filter((session) => session.slot === "PM")).toHaveLength(9)
  })
})
