import { describe, expect, it } from "vitest"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import { recordPlanProgress } from "../src/plan-generator/progress"
import { selectPlanCandidate } from "../src/plan-generator/selection"
import { baseRequest, clearedGate, expectGenerated } from "./fixtures/plan-beta-request"

describe("plan adaptation baseline", () => {
  it("does not mutate active plan bytes when progress is recorded", () => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const selected = selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      generatedPlan: generated,
      selectedCandidateId: generated.candidates[0].candidateId,
      actor: "SELF",
      safetyGate: clearedGate(),
    })
    expect(selected.kind).toBe("selected")
    if (selected.kind !== "selected") throw new Error("baseline selection failed")
    const before = JSON.stringify(selected.activePlan)

    const result = recordPlanProgress({
      kind: "PLAN_BETA_PROGRESS_REQUEST",
      activePlan: selected.activePlan,
      sessionDay: selected.activePlan.sessions[0]?.day ?? 1,
      sessionSlot: selected.activePlan.sessions[0]?.slot ?? "AM",
      state: "COMPLETED",
    })

    expect(result.kind).toBe("recorded")
    expect(JSON.stringify(selected.activePlan)).toBe(before)
  })
})
