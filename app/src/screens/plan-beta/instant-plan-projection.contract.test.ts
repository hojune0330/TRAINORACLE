import { beforeEach, expect, it } from "vitest"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { defaultInstantCandidate, projectInstantRecommendation } from "./instant-plan-projection"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
const draft = { eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN", experienceBand: "EXPERIENCED",
  availableDayCount: "EVERY_DAY", requestedFrameLength: 9, trainingFocus: "MIXED_INTENT",
  secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "EVENING", selectedDetailedTemplateRef: null } as const

it("counts actual sessions/quality days rather than reserved formation exposure entries", () => {
  const result = generatePlanFromDraft(draft, "NO_KNOWN_RISK")
  expect(result.kind).toBe("generated")
  if (result.kind !== "generated") throw Error("fixture failed")
  const candidate = defaultInstantCandidate(result.generated)
  const view = projectInstantRecommendation(candidate, "2026-09-20")!
  const visible = candidate.sessions.filter(session => session.day <= 9)
  expect(view.sessionCount).toBe(visible.filter(session => session.role !== "REST").length)
  expect(view.days).toHaveLength(9)
  expect(view.days.flatMap(day => day.sessions).filter(session => session.role === "MAIN")).toHaveLength(
    visible.filter(session => session.role === "QUALITY").length)
  expect(view.days.filter(day => day.sessions.some(session => session.role === "MAIN")).map(day => day.date)).toEqual(["2026-09-21", "2026-09-28"])
  expect(view.days[0]!.sessions).toHaveLength(2)
  expect(view.days.every(day => day.sessions.map(session => session.slotLabel).join(",") === "오전,오후")).toBe(true)
  expect(view.days[1]!.sessions.find(session => session.role === "MAIN")?.slotLabel).toBe("오후")
  expect(projectInstantRecommendation(candidate, "2026-02-30")).toBeNull()
  expect(defaultInstantCandidate({ ...result.generated, candidates: [result.generated.candidates[1], result.generated.candidates[0]] }).kind).toBe("BALANCED")
})
