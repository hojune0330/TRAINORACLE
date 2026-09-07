import { beforeEach, describe, expect, it } from "vitest"
import { resolveDetailedPlanTemplateOption, resolveDetailedPlanTemplateOptions } from "./plan-template-options"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("explicit detailed plan template options", () => {
  it.each([
    [800, "GLY_INTENT", "MD-800-01", "10×200m @800m RP · r60″ STAND"],
    [1500, "MIXED_INTENT", "MD-1500-01", "3×500m @1500m RP · r180″ STAND"],
    [3000, "VO2_INTENT", "MD-3000-01", "4×800m @3000m RP · r180″ WALK"],
    [5000, "VO2_INTENT", "V2-SEED-05", "5×1000m @5000m RP · r150″ JOG"],
  ] as const)("exposes the current %sm template only for its approved purpose", (
    eventDistanceM,
    trainingFocus,
    templateId,
    notation,
  ) => {
    const option = resolveDetailedPlanTemplateOption(
      { eventDistanceM, trainingFocus, experienceBand: "EXPERIENCED" },
      "2026-08-24T09:00:00.000Z",
    )

    expect(option?.ref.templateId).toBe(templateId)
    expect(option?.notation).toBe(notation)
    expect(option?.mainSummary).toMatch(/^\d+m \d+회$/u)
    expect(option?.preparationSummary).toContain("준비 15분")
  })

  it("does not show a mismatched or expired detailed template", () => {
    expect(resolveDetailedPlanTemplateOption(
      { eventDistanceM: 1500, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" },
      "2026-08-24T09:00:00.000Z",
    )).toBeNull()
    expect(resolveDetailedPlanTemplateOption(
      { eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" },
      "2028-08-24T09:00:00.000Z",
    )).toBeNull()
  })

  it("returns an ordered list so more than one independently approved method can be offered", () => {
    const options = resolveDetailedPlanTemplateOptions(
      { eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" },
      "2026-08-24T09:00:00.000Z",
    )
    expect(options.map(option => option.ref.templateId)).toEqual(["V2-SEED-05"])
    expect(options[0]).toMatchObject({ mainSummary: "1000m 5회", recoverySummary: "반복 사이 2분 30초 조깅" })
  })

  it("passes observed selection and performance history into the live recommendation", () => {
    const method = { familyId: "race-pace-distance-repetitions", configurationId: "V2-SEED-05", version: "1.0.0" }
    const options = resolveDetailedPlanTemplateOptions(
      { eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" },
      "2026-09-05T00:00:00.000Z",
      [{ selected: method, performed: { status: "PERFORMED", method } }],
      "PREFER_VARIETY",
    )
    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({
      recommended: true,
      recommendationReason: "현재 조건에서 검토가 끝난 상세 방법",
      observedPerformedCount: 1,
      selectedCount: 1,
    })
  })

  it("loads archived method history on the default app path", () => {
    const reference = {
      templateId: "V2-SEED-05",
      version: "1.0.0",
      fingerprint: `sha256:${"ad4a8c436a5a6e7a9c81342d79b359d84b1b8ea1034f9589141429eea8d0e42a"}`,
    }
    window.localStorage.setItem("trainoracle.plan-beta.history.v1", JSON.stringify([{
      version: 4,
      candidateId: "archived-candidate",
      pairId: "plan-pair:v3:history",
      candidateKind: "BALANCED",
      eventDistanceM: 5000,
      selectedDetailedTemplateRef: reference,
      frameLengthDays: 9.5,
      progress: [{ sessionDay: 2, sessionSlot: "AM", state: "COMPLETED" }],
      methodHistory: [{
        sessionDay: 2,
        sessionSlot: "AM",
        selectedDetailedTemplateRef: reference,
        outcome: "PERFORMED",
      }],
      archivedAt: "2026-09-05T00:00:00.000Z",
    }]))
    const storedBefore = window.localStorage.getItem("trainoracle.plan-beta.history.v1")
    const options = resolveDetailedPlanTemplateOptions(
      { eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" },
      "2026-09-05T01:00:00.000Z",
    )
    expect(options[0]).toMatchObject({
      ref: { templateId: "V2-SEED-05" },
      observedPerformedCount: 1,
      selectedCount: 1,
    })
    expect(window.localStorage.getItem("trainoracle.plan-beta.history.v1")).toBe(storedBefore)
  })

  it.each([undefined, "NEW_TO_RUNNING", "DEVELOPING"] as const)("does not offer experienced-only templates to %s", (experienceBand) => {
    expect(resolveDetailedPlanTemplateOptions({ eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand }, "2026-09-02T00:00:00.000Z")).toEqual([])
  })
})
