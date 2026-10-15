import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { adjustedPlanReviewScopeV3 } from "../../domain/adjusted-plan-review-v3"
import { adjustedPlanSelectionV3Fixture } from "../../domain/adjusted-plan-selection-v3.test-fixtures"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { AdjustedPrescriptionV3 } from "./AdjustedPrescriptionV3"

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  await initializeCanonicalJournalFixture()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(TODAY)
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it("keeps complete adjusted execution outside rationale only while reading a plan", () => {
  const { request } = adjustedPlanSelectionV3Fixture()
  const reviewed = adjustedPlanReviewScopeV3(request.preparation, request.intake.experienceBand)
  if (reviewed.kind !== "scope") throw Error(reviewed.code)
  const session = reviewed.candidate.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD_V3")!
  const original = JSON.stringify(session)
  const props = { session, explanation: request.preparation.explanation }
  const { container, rerender } = render(<AdjustedPrescriptionV3 {...props} memoState="PLAN" />)

  const execution = container.querySelector(".prescription-structure")!
  expect(execution).toBeVisible()
  expect(execution.closest("details")).toBeNull()
  expect(screen.getByLabelText("계획된 전체 시간")).toBeVisible()
  expect(execution.querySelector(".prescription-structure__nodes")).not.toBeNull()

  for (const memoState of ["HISTORICAL", "PREVIEW"] as const) {
    rerender(<AdjustedPrescriptionV3 {...props} memoState={memoState} />)
    const historicalExecution = container.querySelector(".prescription-structure")!
    expect(historicalExecution.closest("details")).not.toBeNull()
    expect(historicalExecution).not.toBeVisible()
  }
  expect(JSON.stringify(session)).toBe(original)
})
