import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { adjustedPlanSelectionFixture } from "../../domain/adjusted-plan-selection.test-fixtures"
import { selectAdjustedPlanForActivation } from "../../domain/adjusted-plan-selection"
import { buildTrainingHomeViewModel } from "../../domain/home-view-model"
import { TrainingHome, nextTrainingPrescriptionLabel } from "./TrainingHome"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { isoShift } from "../../domain/dates"
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
it("shows actual adjusted repetition/distance on the home card and opens the plan", () => {
  const { request, policy } = adjustedPlanSelectionFixture()
  const selected = selectAdjustedPlanForActivation(request, [policy], TODAY)
  if (selected.kind !== "selected_adjusted") throw Error(selected.code)
  const session = selected.state.activePlan.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD")!
  const date = isoShift(selected.state.intake.startDate!, session.day - 1)
  const model = buildTrainingHomeViewModel([], [], selected.state, date)
  expect(model.homeMode).toBe("TRAINING")
  expect(model.planSummary).not.toContain("저장된 계획 없음")
  expect(nextTrainingPrescriptionLabel(session)).toContain("본운동 2회 · 800m")
  expect(nextTrainingPrescriptionLabel(session)).not.toContain("1000m")
  const open = vi.fn()
  render(<TrainingHome model={model} onOpenPlan={open} />)
  const button = screen.getByRole("button", { name: /다음 훈련.*선택한 조정 구성/ })
  expect(button).toHaveTextContent("800m")
  fireEvent.click(button)
  expect(open).toHaveBeenCalledOnce()
  const after = buildTrainingHomeViewModel([], [], { ...selected.state,
    progress: [{ sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED" }] }, date)
  expect(after.nextTraining?.session.slot).toBe("PM")
  expect(after.nextTraining?.session.prescription.kind).not.toBe("ADJUSTED_METHOD")
})
