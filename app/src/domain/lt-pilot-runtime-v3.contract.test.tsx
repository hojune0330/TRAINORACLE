import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { LT_PILOT_MULTI_PLAN_RUNTIME_V3 } from "./lt-pilot-runtime-v3"
import { prepareMultiAdjustedPlanCandidateV3 } from "./adjusted-plan-multi-candidate-v3"
import { MultiAdjustedPlanEditFlowV3 } from "../screens/plan-beta/MultiAdjustedPlanEditFlowV3"
import { saveSelectedMultiAdjustedPlanV6 } from "./adjusted-plan-storage-v6"
import { readPlanBetaStateFromStorage } from "./plan-beta-store"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { PlanBeta } from "../screens/PlanBeta"

const NOW = new Date("2026-09-28T12:00:00.000Z")
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.useFakeTimers(); vi.setSystemTime(NOW)
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

function generatedPilot(distance: 5000 | 1500 = 5000) {
  return generatePlanFromDraft({ eventGroup: distance === 5000 ? "FIVE_K" : "MIDDLE_DISTANCE",
    eventDistanceM: distance, competitionDivision: "NOT_PROVIDED", experienceBand: "EXPERIENCED",
    availableDayCount: 3, requestedFrameLength: 9, trainingFocus: "LT_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES",
    selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK", {})
}

function entryFor(candidateIndex = 0) {
  const result = generatedPilot()
  if (result.kind !== "generated") throw Error("Missing pilot candidate")
  const candidate = result.generated.candidates[candidateIndex]!
  const context = { generated: result.generated, gate: result.gate, intake: result.intake,
    athleteEvidence: result.athleteEvidence, currentCheck: "NO_KNOWN_RISK" as const,
    candidateId: candidate.candidateId, startDate: "2026-09-28" }
  const entry = LT_PILOT_MULTI_PLAN_RUNTIME_V3.multiAdjustmentResolverV3?.(context)
  if (!entry) throw Error("Missing pilot runtime entry")
  return entry
}

it("opens only the exact approved LT pilot for both schedule candidates", () => {
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
  const other = generatedPilot(1500)
  expect(other.kind).toBe("generated")
  if (other.kind !== "generated") return
  expect(LT_PILOT_MULTI_PLAN_RUNTIME_V3.multiAdjustmentResolverV3?.({ generated: other.generated,
    gate: other.gate, intake: other.intake, athleteEvidence: other.athleteEvidence,
    currentCheck: "NO_KNOWN_RISK", candidateId: other.generated.candidates[0]!.candidateId,
    startDate: "2026-09-28" })).toBeNull()
})

it("separates another method from the split-method time adjustment", () => {
  const entry = entryFor()
  render(<MultiAdjustedPlanEditFlowV3 {...entry} isCurrentDraft={() => true}
    onSaved={() => {}} onCancel={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "이 훈련 구성 바꾸기" }))
  expect(screen.getByRole("radio", { name: "20분 연속" })).toBeChecked()
  fireEvent.click(screen.getByRole("button", { name: "다른 훈련" }))
  expect(screen.getAllByText("10분×2 · 사이 1분 조깅").length).toBeGreaterThan(0)
  expect(screen.getByRole("radio", { name: "10분×2 · 사이 1분 조깅" })).toBeChecked()
  expect(screen.getByRole("button", { name: "1회 운동 시간 줄이기" })).toBeEnabled()
  fireEvent.click(screen.getByRole("button", { name: "1회 운동 시간 줄이기" }))
  expect(screen.getAllByText("8분×2 · 사이 1분 조깅").length).toBeGreaterThan(0)
})

it("saves and reloads the selected detailed pilot with retained evidence", async () => {
  const entry = entryFor(), locks: PlanMutationLockManager = {
    request: async (_name, _options, callback) => callback({}),
  }
  const saved = await saveSelectedMultiAdjustedPlanV6({ request: entry.seed, readReview: entry.readReview,
    isCurrentDraft: () => true, locks })
  expect(saved.kind).toBe("saved")
  const retained = LT_PILOT_MULTI_PLAN_RUNTIME_V3.readMultiAdjustedEvidenceV3?.() ?? []
  expect(readPlanBetaStateFromStorage([], [], retained).kind).toBe("multi_adjusted_v3_loaded")
  await act(async () => Promise.resolve())
})

it("opens the detailed workout flow from the first plan result action", () => {
  sessionStorage.setItem("trainoracle.plan-beta.previous-intake.v1", JSON.stringify({
    eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "NOT_PROVIDED",
    experienceBand: "EXPERIENCED", availableDayCount: 3, requestedFrameLength: 9,
    trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null,
  }))
  render(<PlanBeta {...LT_PILOT_MULTI_PLAN_RUNTIME_V3} />)
  fireEvent.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
  expect(screen.getByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "상세 훈련 고르고 시작" }))
  expect(screen.getByRole("heading", { name: "주요 훈련을 하나씩 확인해 주세요" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "이 훈련 구성 바꾸기" }))
  expect(screen.getByRole("radio", { name: "20분 연속" })).toBeChecked()
})
