import { beforeEach, describe, expect, it } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { planPrescriptionBasis } from "./plan-prescription-basis"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

function fixture() {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000,
    competitionDivision: "OPEN", experienceBand: "EXPERIENCED", availableDayCount: 5,
    requestedFrameLength: 9, trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(result.kind)
  return result.generated
}

describe("prescription basis uses calculated inputs", () => {
  it("does not claim personal pace for a record-free detailed MAIN", () => {
    expect(planPrescriptionBasis(fixture().candidates[0].sessions).label).toBe("시간·체감 강도 기준")
  })

  it("distinguishes pending and confirmed actual record-derived segments", () => {
    const generated = fixture()
    const selected = generated.candidates[0].sessions.find(session => session.role === "QUALITY")!
    const changed = replaceCandidateCatalogWorkout(generated, selected, "X-LT-01", {
      eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null, confirmedRequirements: [],
      fiveK: { recordId: "basis-5k", seconds: 1111.7, achievedAt: "2026-09-01", evaluatedAt: "2026-09-30" },
      segmentPaces: [],
    }, true)
    expect(changed).not.toBeNull()
    const sessions = changed!.candidates[0].sessions
    expect(planPrescriptionBasis(sessions, true).label).toBe("기록 확인 전 · 페이스 초안")
    expect(planPrescriptionBasis(sessions).label).toBe("기록 기준 페이스 · 주요 훈련 1회")
    expect(planPrescriptionBasis(sessions).detail).toContain("모든 훈련 수치가 기록에서 계산된 것은 아니에요")
  })

  it("does not count EASY sessions as personally paced MAIN", () => {
    expect(planPrescriptionBasis(fixture().candidates[0].sessions.filter(session => session.role !== "QUALITY")).label)
      .toBe("시간·체감 강도 기준")
  })
})
