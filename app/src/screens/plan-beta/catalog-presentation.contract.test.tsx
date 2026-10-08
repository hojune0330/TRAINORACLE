import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout, calculatedWorkoutSequence, type WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { parsePrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import { bindCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { projectInstantToday } from "./instant-plan-today"
import { projectInstantRecommendation } from "./instant-plan-projection"
import { formatTrainingSeconds, prescriptionLabel, sessionExecutionSteps } from "./labels"
import { CatalogWorkoutDetail } from "./CatalogWorkoutDetail"
import { PlanSchedulePreview } from "./PlanSchedulePreview"
import { WorkoutNotation } from "./WorkoutNotation"

afterEach(cleanup)

const inputs: WorkoutCalculationInputs = { eventDistanceM: 800, experience: "DEVELOPING", availableSeconds: null,
  confirmedRequirements: [], fiveK: null, segmentPaces: [] }

it("preserves distance recovery when the athlete supplies its time, without crashing the detail", () => {
  const initial = calculateCatalogWorkout("P-RHYTHM-300", inputs)!
  const gap = initial.steps.find(step => step.kind === "RECOVERY" && step.distanceM !== null && step.seconds === null)!
  expect(gap).toBeDefined()
  const completed = calculateCatalogWorkout(initial.catalogId, { ...inputs, recoverySeconds: [{ segmentId: gap.segmentId, seconds: 45 }] })!
  expect(completed.steps.find(step => step.segmentId === gap.segmentId)).toMatchObject({ distanceM: 100, seconds: { minimum: 45, maximum: 45 } })
  expect(parsePrescriptionSequenceV3(calculatedWorkoutSequence(completed)).kind).toBe("parsed")
  render(<CatalogWorkoutDetail workout={completed} />)
  expect(screen.getAllByText(/직접 정한 회복 시간/).length).toBeGreaterThan(0)
  expect(screen.getByText(/45초.*100m/)).toBeVisible()
})

it("keeps the rendered sequence valid for every catalog's explicit recovery targets", () => {
  let checked = 0
  for (const entry of ALL_WORKOUT_CATALOG) {
    if (!entry.sequence) continue
    const first = calculateCatalogWorkout(entry.id, inputs)!
    const gaps = [...new Map(first.steps.filter(step => step.kind === "RECOVERY" && step.seconds === null).map(step => [step.segmentId, step])).values()]
    const result = calculateCatalogWorkout(entry.id, { ...inputs, recoverySeconds: gaps.map(step => ({ segmentId: step.segmentId, seconds: 45 })) })!
    expect(result, entry.id).not.toBeNull()
    expect(parsePrescriptionSequenceV3(calculatedWorkoutSequence(result)).kind, entry.id).toBe("parsed")
    checked++
  }
  expect(checked).toBeGreaterThan(100)
})

it("separates a bound catalog's main workout and full time, and never calls its recovery undefined", () => {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: 5, requestedFrameLength: 9, trainingFocus: "VO2_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(result.kind)
  const source = result.generated.candidates[0]
  const quality = source.sessions.find(session => session.role === "QUALITY")!
  const bound = bindCatalogSession(quality, "X-VO2-08", { ...inputs, eventDistanceM: 5000, experience: "EXPERIENCED" }, true)
  expect(bound).not.toBeNull()
  if (!bound || bound.role !== "QUALITY" || bound.prescription.kind !== "RPE_TIME_RANGE" || !bound.prescription.catalogWorkout) throw Error("binding failed")
  const calculation = resolveCatalogBinding(bound.prescription.catalogWorkout)!
  const session = { ...bound, day: 1 }
  const original = stateFixture()
  if (original.version !== 3) throw Error("expected V3 fixture")
  const state = { ...original, intake: { ...original.intake, startDate: "2026-09-30" }, activePlan: { ...original.activePlan, sessions: [session] } }
  const projected = projectInstantToday(state, "2026-09-30").sessions[0]!
  expect(projected.guidanceNotice).toBeUndefined()
  expect(projected.steps[0]).toMatchObject({ role: "TOTAL_DURATION", label: "총 시간" })
  expect(projected.steps[1]).toMatchObject({ role: "PREPARATION", label: "준비" })
  const totalStep = projected.steps.find(step => step.role === "TOTAL_DURATION")!
  const mainStep = projected.steps.find(step => step.role === "MAIN")!
  expect(mainStep.instruction).toBe("3 세트 × (6 × 15초 · 힘든 정도 7–8/10 · 반복 사이 15초 조깅) · 세트 사이 3분 걷기/서서 쉬기")
  expect(totalStep.instruction).toContain(formatTrainingSeconds(calculation.totals.seconds!.maximum))
  expect(projected.steps.indexOf(totalStep)).toBeLessThan(projected.steps.indexOf(mainStep))
  expect(projected.steps.find(step => step.role === "COOLDOWN")?.instruction)
    .toContain("통증\u2060·\u2060어지럼\u2060·\u2060자세\u00a0무너짐이 생기면 시간을 채우지 말고 중단하세요.")
  const executionSteps = sessionExecutionSteps(session)
  expect(executionSteps[0]).toMatchObject({ role: "TOTAL_DURATION", title: "총 시간" })
  expect(executionSteps.at(-1)?.detail).toContain("시간을 채우지 말고 중단하세요.")
  const sequence = calculatedWorkoutSequence(calculation)
  if (!sequence) throw Error("sequence missing")
  const notation = render(<WorkoutNotation sequence={sequence} intent={session.plannedEnergyIntent} />).container.querySelector("code")!
  expect(notation.textContent).toContain("힘든 정도 7–8/10")
  expect(notation.textContent).not.toMatch(/\bRPE\b/u)
  render(<PlanSchedulePreview startDate="2026-09-30" frameLengthDays={9} sessions={[session]} />)
  expect(screen.getByText(totalStep.instruction)).toBeVisible()
  expect(screen.getByText(/시간을 채우지 말고 중단하세요/u)).toBeVisible()
  expect(projectInstantRecommendation({ ...source, sessions: [session] }, "2026-09-30")!.days[0]!.sessions[0]!.notation).toBe(prescriptionLabel(session))
  const generic = { ...session, prescription: { kind: "RPE_TIME_RANGE" as const, rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 20, maximum: 30 } } }
  expect(projectInstantToday({ ...state, activePlan: { ...state.activePlan, sessions: [generic] } }, "2026-09-30").sessions[0]!.guidanceNotice)
    .toContain("반복 횟수와 회복 시간은 정해지지 않았어요")
})
