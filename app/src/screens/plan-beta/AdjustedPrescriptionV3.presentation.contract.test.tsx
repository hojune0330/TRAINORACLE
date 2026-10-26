import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { adjustedPlanReviewScopeV3 } from "../../domain/adjusted-plan-review-v3"
import { adjustedPlanSelectionV3Fixture } from "../../domain/adjusted-plan-selection-v3.test-fixtures"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { AdjustedPrescriptionV3 } from "./AdjustedPrescriptionV3"
import { buildWorkoutMemo } from "../../domain/workout-memo"

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  await initializeCanonicalJournalFixture()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(TODAY)
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it("uses one memo for adjusted execution and retains source structure behind reasons", () => {
  const { request } = adjustedPlanSelectionV3Fixture()
  const reviewed = adjustedPlanReviewScopeV3(request.preparation, request.intake.experienceBand)
  if (reviewed.kind !== "scope") throw Error(reviewed.code)
  const session = reviewed.candidate.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD_V3")!
  const original = JSON.stringify(session)
  const props = { session, explanation: request.preparation.explanation }
  const { container, rerender } = render(<AdjustedPrescriptionV3 {...props} memoState="PLAN" />)

  const execution = container.querySelector(".prescription-structure")!
  expect(execution).not.toBeVisible()
  expect(execution.closest("details")).not.toBeNull()
  const paper = screen.getByRole("article", { name: "훈련 메모 미리보기" })
  expect(paper).toBeVisible()
  const model = buildWorkoutMemo(session)!
  expect(paper).toHaveAttribute("data-view", "core")
  expect(paper).toHaveTextContent(model.lines.find(line => line.label === "본운동")!.text)
  for (const line of model.lines.filter(line => line.label === "준비" || line.label === "정리")) {
    expect(paper).not.toHaveTextContent(line.text)
  }
  expect(model.totalDuration).not.toBeNull()
  expect(paper).not.toHaveTextContent(model.totalDuration!)
  fireEvent.click(screen.getByRole("button", { name: "자세히" }))
  expect(paper).toHaveAttribute("data-view", "explained")
  for (const line of model.lines) expect(paper).toHaveTextContent(line.text)
  expect(paper).toHaveTextContent(model.totalDuration!)
  expect(execution.querySelector(".prescription-structure__nodes")).not.toBeNull()

  for (const memoState of ["HISTORICAL", "PREVIEW"] as const) {
    rerender(<AdjustedPrescriptionV3 {...props} memoState={memoState} />)
    const historicalExecution = container.querySelector(".prescription-structure")!
    expect(historicalExecution.closest("details")).not.toBeNull()
    expect(historicalExecution).not.toBeVisible()
    expect(screen.getByRole("article", { name: "훈련 메모 미리보기" })).toHaveTextContent(memoState === "HISTORICAL" ? "당시 계획" : "계획안")
  }
  expect(JSON.stringify(session)).toBe(original)
})
