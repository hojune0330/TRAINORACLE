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
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); await initializeCanonicalJournalFixture(); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
it("keeps the adjusted prescription unchanged and opens it through the concise home card", () => {
  const { request, policy } = adjustedPlanSelectionFixture()
  const selected = selectAdjustedPlanForActivation(request, [policy], TODAY)
  if (selected.kind !== "selected_adjusted") throw Error(selected.code)
  const session = selected.state.activePlan.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD")!
  const date = isoShift(selected.state.intake.startDate!, session.day - 1)
  const model = buildTrainingHomeViewModel([], [], selected.state, date)
  expect(model.homeMode).toBe("TRAINING")
  expect(model.planSummary).not.toContain("저장된 계획 없음")
  expect(nextTrainingPrescriptionLabel(session)).toContain("2 × 400m")
  expect(nextTrainingPrescriptionLabel(session)).toContain("반복 사이 17초 서서 쉬기")
  expect(nextTrainingPrescriptionLabel(session)).not.toContain("1000m")
  const open = vi.fn()
  render(<TrainingHome model={model} onOpenPlan={open} />)
  const button = screen.getByRole("button", { name: /^다음 훈련/ })
  expect(button).toHaveTextContent("오후 훈련도 있어요")
  expect(button).toHaveTextContent("2 × 400m")
  expect(button).toHaveTextContent("반복 사이 17초 서서 쉬기")
  fireEvent.click(button)
  expect(open).toHaveBeenCalledOnce()
  const after = buildTrainingHomeViewModel([], [], { ...selected.state,
    progress: [{ sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED" }] }, date)
  expect(after.nextTraining?.session.slot).toBe("PM")
  expect(after.nextTraining?.session.prescription.kind).not.toBe("ADJUSTED_METHOD")
})
