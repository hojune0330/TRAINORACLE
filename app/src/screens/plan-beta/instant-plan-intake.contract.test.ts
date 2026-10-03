import { beforeEach, describe, expect, it } from "vitest"
import { prepareInstantIntake } from "./instant-plan-intake"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { SupportedPlanEventDistanceM } from "@impl/plan-generator/types"

const evaluatedAt = "2026-09-20T00:00:00Z"
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
describe("instant intake proposals", () => {
  it("preserves an explicitly selected RPE method after returning to questions", () => {
    expect(prepareInstantIntake({ eventDistanceM: 5000, experienceBand: "EXPERIENCED", selectedDetailedTemplateRef: null },
      { kind: "CURRENT_RECORD", eventDistanceM: 5000, achievedOn: "2026-09-01", performanceSeconds: 1111 }, evaluatedAt)
      .selectedDetailedTemplateRef).toBeNull()
  })
  it.each([800, 1500, 3000, 5000] as const)("proposes an existing authorized method for %sm without dose invention", distance => {
    const draft: Partial<PlanBetaIntake> = { eventDistanceM: distance, experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY" }
    const result = prepareInstantIntake(draft, { kind: "CURRENT_RECORD", eventDistanceM: distance,
      achievedOn: "2026-09-01", performanceSeconds: 123.4 }, evaluatedAt)
    expect(result.selectedDetailedTemplateRef).not.toBeNull()
    expect(resolveDetailedPlanTemplateOptions(result, evaluatedAt).some(option => option.ref.templateId === result.selectedDetailedTemplateRef?.templateId)).toBe(true)
    expect(result.availableDayCount).toBe("EVERY_DAY")
    expect(result.secondSessionMode).toBe("SINGLE_SESSION_ONLY")
  })
  it("does not invent a pace method without a record", () => {
    expect(prepareInstantIntake({ eventDistanceM: 5000, experienceBand: "EXPERIENCED" },
      { kind: "NO_RECORD", eventDistanceM: 5000 }, evaluatedAt)
      .selectedDetailedTemplateRef).toBeNull()
  })
  it.each([800, 1500, 3000, 5000] as const)("offers an approved method for a %sm goal without confirming its pace", distance => {
    const draft = { eventDistanceM: distance, experienceBand: "EXPERIENCED" as const }
    const goal = { kind: "GOAL_ONLY" as const, eventDistanceM: distance, performanceSeconds: 121.5 }
    const result = prepareInstantIntake(draft, goal, evaluatedAt)
    expect(result.selectedDetailedTemplateRef).not.toBeNull()
    expect(resolveDetailedPlanTemplateOptions(result, evaluatedAt).some(option =>
      option.ref.templateId === result.selectedDetailedTemplateRef?.templateId)).toBe(true)
    expect(result).not.toHaveProperty("selectedRecordId")
    expect(goal.kind).toBe("GOAL_ONLY")
    expect(prepareInstantIntake({ ...draft, selectedDetailedTemplateRef: null }, goal, evaluatedAt)
      .selectedDetailedTemplateRef).toBeNull()
  })
  it.each(["NEW_TO_RUNNING", "DEVELOPING"] as const)("preserves %s eligibility", experienceBand => {
    expect(prepareInstantIntake({ eventDistanceM: 5000, experienceBand }, { kind: "CURRENT_RECORD", eventDistanceM: 5000,
      achievedOn: "2026-09-01", performanceSeconds: 1111 }, evaluatedAt).selectedDetailedTemplateRef).toBeNull()
  })
  it("does not change an explicit recovery purpose to get a numerical workout", () => {
    expect(prepareInstantIntake({ eventDistanceM: 5000, experienceBand: "EXPERIENCED", trainingFocus: "RECOVERY_INTENT" },
      { kind: "CURRENT_RECORD", eventDistanceM: 5000, achievedOn: "2026-09-01", performanceSeconds: 1111 }, evaluatedAt))
      .toMatchObject({ trainingFocus: "RECOVERY_INTENT", selectedDetailedTemplateRef: null })
  })
  it.each([10000, 21097, 42195] as SupportedPlanEventDistanceM[])("does not invent an approved method for %s", distance => {
    expect(prepareInstantIntake({ eventDistanceM: distance, experienceBand: "EXPERIENCED" },
      { kind: "CURRENT_RECORD", eventDistanceM: distance, achievedOn: "2026-09-01", performanceSeconds: 3600 }, evaluatedAt)
      .selectedDetailedTemplateRef).toBeNull()
  })
  it("does not reuse another event record or invalid authority time", () => {
    expect(prepareInstantIntake({ eventDistanceM: 1500, experienceBand: "EXPERIENCED" },
      { kind: "CURRENT_RECORD", eventDistanceM: 5000, achievedOn: "2026-09-01", performanceSeconds: 1111 }, evaluatedAt).selectedDetailedTemplateRef).toBeNull()
    expect(prepareInstantIntake({ eventDistanceM: 5000, experienceBand: "EXPERIENCED" },
      { kind: "CURRENT_RECORD", eventDistanceM: 5000, achievedOn: "2026-09-01", performanceSeconds: 1111 }, "invalid").selectedDetailedTemplateRef).toBeNull()
  })
})
