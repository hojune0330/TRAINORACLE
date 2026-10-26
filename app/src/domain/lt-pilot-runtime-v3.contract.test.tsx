import React from "react"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { generatePlanCandidates } from "@impl/plan-generator/generator"
import { evaluatePlanSafety, generatePlanFromDraft } from "./plan-beta-flow"
import { createPlanFormation } from "./plan-beta-formation"
import { LT_PILOT_MULTI_PLAN_RUNTIME_V3 } from "./lt-pilot-runtime-v3"
import { prepareMultiAdjustedPlanCandidateV3 } from "./adjusted-plan-multi-candidate-v3"
import { MultiAdjustedPlanEditFlowV3 } from "../screens/plan-beta/MultiAdjustedPlanEditFlowV3"
import { saveSelectedMultiAdjustedPlanV6 } from "./adjusted-plan-storage-v6"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage, type PlanBetaIntake } from "./plan-beta-store"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { PlanBeta } from "../screens/PlanBeta"
import { AdjustedPrescriptionV3 } from "../screens/plan-beta/AdjustedPrescriptionV3"
import { nextTrainingPrescriptionLabel } from "../screens/home/TrainingHome"
import historicalLtPilot from "./lt-pilot-e8cad36c-v6.test-fixture.json"

const NOW = new Date("2026-09-28T12:00:00.000Z")
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.useFakeTimers(); vi.setSystemTime(NOW)
  await initializeCanonicalJournalFixture()
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true,
    value() { this.setAttribute("open", "") } })
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true,
    value() { this.removeAttribute("open") } })
})

afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks()
  for (const [key, descriptor] of [["showModal", show], ["close", close]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  }
})

function pilotIntake(distance: 5000 | 1500 = 5000): PlanBetaIntake {
  return { eventGroup: distance === 5000 ? "FIVE_K" : "MIDDLE_DISTANCE",
    eventDistanceM: distance, competitionDivision: "NOT_PROVIDED", experienceBand: "EXPERIENCED",
    availableDayCount: 3, requestedFrameLength: 9, trainingFocus: "LT_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES",
    selectedDetailedTemplateRef: null }
}

// The exact 2026-09-28 pilot reviewed raw RPE plans. Generate those plans at
// the core boundary; new app plans now retain their default catalog bindings.
function generatedHistoricalRawRpePilot(distance: 5000 | 1500 = 5000) {
  const intake = pilotIntake(distance)
  const safety = evaluatePlanSafety("NO_KNOWN_RISK", NOW)
  if (safety.kind !== "passed") throw Error("Missing historical pilot safety gate")
  const days = [1, 5, 9]
  const generated = generatePlanCandidates({ kind: "PLAN_BETA_GENERATION_REQUEST", safetyGate: safety.gate,
    profile: { eventGroup: intake.eventGroup, eventDistanceM: intake.eventDistanceM,
      experienceBand: intake.experienceBand, availableTrainingDays: days,
      secondSessionMode: intake.secondSessionMode, trainingTimePreference: intake.trainingTimePreference },
    formation: createPlanFormation("2026-09-28", days, intake.experienceBand),
    requestedFrameLength: intake.requestedFrameLength, selectedEnergyIntent: intake.trainingFocus,
    selectedDetailedTemplateRef: intake.selectedDetailedTemplateRef,
    journalSource: safety.journalSource, selectionAuthority: "SELF" })
  if (generated.kind !== "generated") throw Error("Missing historical pilot candidate")
  for (const candidate of generated.candidates) for (const session of candidate.sessions) {
    if (session.prescription.kind === "RPE_TIME_RANGE") expect(session.prescription.catalogWorkout).toBeUndefined()
  }
  return { generated, gate: safety.gate, intake,
    athleteEvidence: { storedRecordCount: 0, goalRecordCount: 0, recentJournalSessionCount: 0 } }
}

function entryFor(candidateIndex = 0) {
  const result = generatedHistoricalRawRpePilot()
  const candidate = result.generated.candidates[candidateIndex]!
  const context = { generated: result.generated, gate: result.gate, intake: result.intake,
    athleteEvidence: result.athleteEvidence, currentCheck: "NO_KNOWN_RISK" as const,
    candidateId: candidate.candidateId, startDate: "2026-09-28" }
  const entry = LT_PILOT_MULTI_PLAN_RUNTIME_V3.multiAdjustmentResolverV3?.(context)
  if (!entry) throw Error("Missing pilot runtime entry")
  return entry
}

it("opens only the exact approved LT pilot for both historical raw-RPE schedule candidates", () => {
  for (const index of [0, 1]) {
    const entry = entryFor(index), review = entry.readReview()
    const prepared = prepareMultiAdjustedPlanCandidateV3(entry.seed.preparations, review.rpeBindings)
    if (prepared.kind !== "prepared") throw Error(prepared.code)
    const adjusted = prepared.candidate.sessions.find(session => session.prescription.kind === "ADJUSTED_METHOD_V3")
    expect(adjusted?.prescription.kind).toBe("ADJUSTED_METHOD_V3")
    if (adjusted?.prescription.kind === "ADJUSTED_METHOD_V3") {
      expect(adjusted.prescription.snapshot.receipt.after.sequence.label).toBe("20분 연속")
    }
  }
  const other = generatedHistoricalRawRpePilot(1500)
  expect(LT_PILOT_MULTI_PLAN_RUNTIME_V3.multiAdjustmentResolverV3?.({ generated: other.generated,
    gate: other.gate, intake: other.intake, athleteEvidence: other.athleteEvidence,
    currentCheck: "NO_KNOWN_RISK", candidateId: other.generated.candidates[0]!.candidateId,
    startDate: "2026-09-28" })).toBeNull()
})

it("separates another method from the split-method time adjustment for historical raw-RPE plans", () => {
  const entry = entryFor()
  render(<MultiAdjustedPlanEditFlowV3 {...entry} isCurrentDraft={() => true}
    onSaved={() => {}} onCancel={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "이 훈련 구성 바꾸기" }))
  fireEvent.click(screen.getByText("훈련 목록·다른 설정", { exact: true }))
  expect(screen.getByRole("radio", { name: "템포런 · Tempo Run · 20min @ RPE 6–7" })).toBeVisible()
  expect(screen.getByRole("radio", { name: "템포런 · Tempo Run · 20min @ RPE 6–7" })).toBeChecked()
  fireEvent.click(screen.getByRole("button", { name: "다른 훈련" }))
  expect(screen.getByRole("radio", { name: "크루즈 인터벌 · Cruise Intervals · 2 × 10min @ RPE 6–7 · r60s Jog" })).toBeVisible()
  expect(screen.getByRole("radio", { name: "크루즈 인터벌 · Cruise Intervals · 2 × 10min @ RPE 6–7 · r60s Jog" })).toBeChecked()
  expect(screen.getByRole("button", { name: "1회 운동 시간 줄이기" })).toBeEnabled()
  fireEvent.click(screen.getByRole("button", { name: "1회 운동 시간 줄이기" }))
  expect(screen.getByRole("radio", { name: "크루즈 인터벌 · Cruise Intervals · 2 × 8min @ RPE 6–7 · r60s Jog" })).toBeVisible()
  expect(screen.getByRole("radio", { name: "크루즈 인터벌 · Cruise Intervals · 2 × 8min @ RPE 6–7 · r60s Jog" })).toBeChecked()
})

it("blocks new raw-RPE pilot activation without storing a plan", async () => {
  const entry = entryFor(), locks: PlanMutationLockManager = {
    request: async (_name, _options, callback) => callback({}),
  }
  const saved = await saveSelectedMultiAdjustedPlanV6({ request: entry.seed, readReview: entry.readReview,
    isCurrentDraft: () => true, locks })
  expect(saved).toEqual({ kind: "rejected", code: "MAIN_CONFIGURATION_REQUIRED" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  await act(async () => Promise.resolve())
})

it("reloads the exact historical raw-RPE V6 pilot saved by e8cad36c with retained evidence", async () => {
  // Captured from e8cad36c's actual save/selection/assembly module graph. Its
  // successful save wrote this exact V6 state; no current activation gate is bypassed.
  expect(historicalLtPilot.sourceCommit).toBe("e8cad36c372cdb9588fb62109efee1e8accc5990")
  localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(historicalLtPilot.state))
  const retained = LT_PILOT_MULTI_PLAN_RUNTIME_V3.readMultiAdjustedEvidenceV3?.() ?? []
  const reloaded = readPlanBetaStateFromStorage([], [], retained)
  expect(reloaded.kind).toBe("multi_adjusted_v3_loaded")
  if (reloaded.kind !== "multi_adjusted_v3_loaded") throw Error("Historical pilot did not survive the current retained reader")
  expect(reloaded.state).toEqual(historicalLtPilot.state)
  await act(async () => Promise.resolve())
})

it("preserves exact time and effort on home and details with historical raw-RPE source labels and explanation evidence", () => {
  const entry = entryFor(), review = entry.readReview()
  const prepared = prepareMultiAdjustedPlanCandidateV3(entry.seed.preparations, review.rpeBindings)
  if (prepared.kind !== "prepared") throw Error(prepared.code)
  const session = prepared.candidate.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD_V3")!
  const explanation = entry.seed.preparations.find(item => item.address.day === session.day && item.address.slot === session.slot)!.explanation
  const before = JSON.stringify({ session, explanation })
  const homeText = nextTrainingPrescriptionLabel(session)
  const effortText = "힘들지만 정해진 구간 동안 고르게 유지하는 노력 · 본운동 체감 제안 힘든 정도 6–7/10"
  const view = render(<AdjustedPrescriptionV3 session={session} explanation={explanation} />)
  expect(homeText).toBe("20분 · 힘들지만 정해진 구간 동안 고르게 유지하는 노력 · 본운동 체감 제안 힘든 정도 6–7/10")
  const paper = screen.getByRole("article", { name: "훈련 메모 미리보기" })
  expect(paper).toHaveTextContent("20분")
  expect(paper).toHaveTextContent(effortText)
  expect(screen.getByText("템포런 · Tempo Run")).toBeVisible()
  expect(screen.queryByText(explanation.purpose)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "자세히" }))
  fireEvent.click(screen.getByText("이 훈련의 이유"))
  expect(screen.getByText(explanation.purpose)).toBeVisible()
  expect(screen.getByText(explanation.recoveryRationale)).toBeVisible()
  expect(paper).toHaveTextContent("준비")
  expect(paper).toHaveTextContent("정리")
  fireEvent.click(screen.getByText("근거와 설명 버전"))
  for (const ref of explanation.evidenceRefs) expect(screen.getByText(ref)).toBeVisible()
  expect(JSON.stringify({ session, explanation })).toBe(before)
  view.rerender(<AdjustedPrescriptionV3 session={session} />)
  expect(screen.getByText(/연결된 설명을 확인하지 못했어요/)).toBeVisible()
  expect(screen.queryByText(explanation.purpose)).toBeNull()
  expect(screen.getByRole("article", { name: "훈련 메모 미리보기" })).toHaveTextContent("20분")
  expect(screen.getByRole("article", { name: "훈련 메모 미리보기" })).toHaveTextContent(effortText)
})

it("keeps current catalog plans outside the historical LT pilot without rewriting the candidate", () => {
  const result = generatePlanFromDraft(pilotIntake(), "NO_KNOWN_RISK", {})
  if (result.kind !== "generated") throw Error("Missing current catalog candidate")
  const before = JSON.stringify(result)
  for (const candidate of result.generated.candidates) {
    expect(candidate.sessions.some(session => session.prescription.kind === "RPE_TIME_RANGE"
      && session.prescription.catalogWorkout !== undefined)).toBe(true)
    expect(LT_PILOT_MULTI_PLAN_RUNTIME_V3.multiAdjustmentResolverV3?.({ generated: result.generated,
      gate: result.gate, intake: result.intake, athleteEvidence: result.athleteEvidence,
      currentCheck: "NO_KNOWN_RISK", candidateId: candidate.candidateId, startDate: "2026-09-28" })).toBeNull()
  }
  expect(JSON.stringify(result)).toBe(before)
})

it("opens the current catalog workout flow from the first plan result action without widening the LT pilot", () => {
  sessionStorage.setItem("trainoracle.plan-beta.previous-intake.v1", JSON.stringify(pilotIntake()))
  const resolver = vi.fn(LT_PILOT_MULTI_PLAN_RUNTIME_V3.multiAdjustmentResolverV3!)
  render(<PlanBeta {...LT_PILOT_MULTI_PLAN_RUNTIME_V3} multiAdjustmentResolverV3={resolver} />)
  fireEvent.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
  expect(screen.getByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
  expect(resolver).toHaveBeenCalled()
  expect(resolver.mock.results.every(result => result.value === null)).toBe(true)
  const beforeSchedule = resolver.mock.calls.at(-1)![0].generated.candidates.map(candidate => ({
    kind: candidate.kind, sessions: candidate.sessions.map(({ day, slot, role }) => ({ day, slot, role })),
  }))
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "훈련 조절" }))
  const address = screen.getByRole("combobox", { name: "바꿀 일정" })
  expect(address).toBeVisible()
  expect(address).toHaveValue("5:AM")
  fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "P-LT-B" } })
  expect(screen.getByRole("combobox", { name: "훈련 구성" })).toHaveValue("P-LT-B")
  expect(screen.getByText("준비·회복·정리 포함 약 50분 20초")).toBeVisible()
  expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox", { name: /준비·회복·정리까지 최대/u }))
  expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeEnabled()
  resolver.mockClear()
  fireEvent.click(screen.getByRole("button", { name: "이 구성으로 바꾸기" }))
  expect(screen.getByText("계획안에 반영했어요. 날짜와 훈련 횟수는 그대로예요.")).toBeVisible()
  expect(resolver).toHaveBeenCalled()
  expect(resolver.mock.results.every(result => result.value === null)).toBe(true)
  const afterCandidates = resolver.mock.calls.at(-1)![0].generated.candidates
  expect(afterCandidates.map(candidate => ({
    kind: candidate.kind, sessions: candidate.sessions.map(({ day, slot, role }) => ({ day, slot, role })),
  }))).toEqual(beforeSchedule)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  for (const candidate of afterCandidates) {
    const session = candidate.sessions.find(item => item.day === 5 && item.slot === "AM")!
    expect(session.prescription.kind).toBe("RPE_TIME_RANGE")
    if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Missing current catalog workout")
    expect(session.prescription.catalogWorkout?.catalogId).toBe("P-LT-B")
    expect(session.prescription.catalogWorkout?.acceptedDurationSeconds).toBe(3020)
    expect(session.prescription.rpe).toEqual({ minimum: 6, maximum: 7 })
  }
})
