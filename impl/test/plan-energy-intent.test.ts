import { describe, expect, it } from "vitest"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import { decideSafetyGate } from "../src/safety-gate/gate"
import { mapD9ResultToRveSignal } from "../src/rve/signal"

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
    },
    requestedFrameLength: 9,
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
})
