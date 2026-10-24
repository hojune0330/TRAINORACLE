import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { projectInstantRecommendation } from "./instant-plan-projection"
import { PlanCandidateOverview } from "./PlanCandidateOverview"

beforeEach(async () => { await initializeCanonicalJournalFixture() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const guidance: PlanSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "MIXED_INTENT",
  prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 50, maximum: 50 } } }

function bound(kind: "ACTUAL" | "GOAL") {
  const entry = ALL_WORKOUT_CATALOG.find(item => item.id === "RP-10000-TIMED")!
  const session = bindCatalogSession(guidance, entry.id, {
    eventDistanceM: 10000, experience: "EXPERIENCED", availableSeconds: null,
    confirmedRequirements: [], fiveK: null, segmentPaces: [],
    paceReferences: entry.segments.map(segment => ({ segmentId: segment.segmentId, kind, confirmed: true,
      recordId: `synthetic-${kind}`, recordVersion: "2026-10-11T00:00:00.000Z", eventDistanceM: 10000,
      performanceSeconds: 2700, achievedOn: kind === "ACTUAL" ? "2026-10-10" : null,
      evaluatedOn: "2026-10-11", model: "RACE_AVERAGE_V1" })),
  }, true)
  if (!session || session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) throw Error("Expected verified RP fixture")
  return session
}

function show(session: PlanSession) {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: 3, requestedFrameLength: 9, trainingFocus: "MIXED_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error("Expected candidate fixture")
  const candidate = { ...result.generated.candidates[0], sessions: [session] }
  const recommendation = projectInstantRecommendation(candidate, "2026-10-24")!
  const original = JSON.stringify(candidate)
  const save = vi.spyOn(Storage.prototype, "setItem")
  render(<PlanCandidateOverview candidate={candidate} recommendation={recommendation} startDate="2026-10-24" />)
  return { candidate, original, save }
}

it.each(["ACTUAL", "GOAL"] as const)("shows verified %s MAIN with work, recovery, provenance and total before opening details", kind => {
  const { candidate, original, save } = show(bound(kind))
  const main = screen.getByText(new RegExp(`7분씩 3번.*1km에 4분 30초.*10km ${kind === "ACTUAL" ? "실제" : "목표"} 기록 기준.*사이 1분 조깅`))
  expect(main).toBeVisible()
  expect(main.closest("details")).toBeNull()
  expect(main).toHaveTextContent("힘들면 속도를 낮추거나 중단하세요")
  expect(main).not.toHaveTextContent(kind === "ACTUAL" ? "목표 기록 기준" : "실제 기록 기준")
  const total = screen.getByText("전체 구간 합계 52분 20초")
  expect(total).toBeVisible()
  expect(total.closest("details")).toBeNull()
  fireEvent.click(screen.getByText("준비·정리 방법"))
  expect(screen.getByText(/20초 가속 달리기 4번.*사이 40초 걷기.*마지막 뒤 1분 걷기/)).toBeVisible()
  expect(JSON.stringify(candidate)).toBe(original)
  expect(save).not.toHaveBeenCalled()
})

it("marks generic effort guidance as lacking fixed repetitions and keeps its total outside the disclosure", () => {
  show(guidance)
  expect(screen.getByText(/반복 횟수와 회복 시간은 아직 정하지 않았어요/)).toBeVisible()
  expect(screen.getByText(/총 시간을 계속 강하게 달리는 시간으로 쓰지 마세요/)).toBeVisible()
  const total = screen.getByText("총 시간").nextElementSibling!
  expect(total).toHaveTextContent("50분")
  expect(total.closest("details")).toBeNull()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("does not turn a broken catalog binding into generic guidance or display stale MAIN values", () => {
  const session = bound("GOAL")
  if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) throw Error("Expected catalog fixture")
  show({ ...session, prescription: { ...session.prescription, catalogWorkout: {
    ...session.prescription.catalogWorkout, calculationFingerprint: "invalid-calculation-fingerprint",
  } } })
  expect(screen.getByRole("alert")).toHaveTextContent("이 훈련의 계산을 확인하지 못했어요")
  expect(screen.queryByText(/반복 횟수와 회복 시간은 아직 정하지 않았어요/)).toBeNull()
  expect(screen.queryByText("본운동")).toBeNull()
  expect(screen.queryByText("총 시간")).toBeNull()
  expect(screen.queryByText(/7분씩 3번/)).toBeNull()
})
