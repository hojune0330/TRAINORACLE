import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout, calculatedWorkoutSequence, type WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { parsePrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import { bindCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { projectInstantToday } from "./instant-plan-today"
import { projectInstantRecommendation } from "./instant-plan-projection"
import { formatTrainingSeconds, prescriptionLabel } from "./labels"
import { CatalogWorkoutDetail } from "./CatalogWorkoutDetail"

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
  expect(projected.steps[0]).toEqual({ label: "본운동", instruction: prescriptionLabel(session) })
  expect(projected.steps.find(step => step.label === "전체 예정시간")?.instruction).toContain(formatTrainingSeconds(calculation.totals.seconds!.maximum))
  expect(projectInstantRecommendation({ ...source, sessions: [session] }, "2026-09-30")!.days[0]!.sessions[0]!.notation).toBe(prescriptionLabel(session))
  const generic = { ...session, prescription: { kind: "RPE_TIME_RANGE" as const, rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 20, maximum: 30 } } }
  expect(projectInstantToday({ ...state, activePlan: { ...state.activePlan, sessions: [generic] } }, "2026-09-30").sessions[0]!.guidanceNotice)
    .toContain("반복 횟수와 회복 시간은 정해지지 않았어요")
})
