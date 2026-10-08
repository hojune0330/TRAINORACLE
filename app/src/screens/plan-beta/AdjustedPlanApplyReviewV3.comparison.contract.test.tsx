import React from "react"
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { deriveSequenceV3Totals } from "@impl/prescription/sequence-v3"
import type { PlanMutationLockManager } from "../../domain/plan-mutation-lock"
import { adjustedPlanSelectionV3Fixture } from "../../domain/adjusted-plan-selection-v3.test-fixtures"
import { prepareAdjustedPlanCandidateV3 } from "../../domain/adjusted-plan-candidate"
import { formatTrainingSeconds } from "./labels"
import { AdjustedPlanApplyReviewV3 } from "./AdjustedPlanApplyReviewV3"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const locks: PlanMutationLockManager = { request: async (_name, _options, callback) => callback({}) }
const display = (value: number | null, unit: string) => value === null ? "—"
  : unit === "초" ? formatTrainingSeconds(value) : `${value}${unit}`

it("shows the actual source and prepared workout side by side before final save", () => {
  const { request, policy, retained } = adjustedPlanSelectionV3Fixture()
  const prepared = prepareAdjustedPlanCandidateV3(request.preparation)
  if (prepared.kind !== "prepared") throw new Error("Synthetic fixture must prepare")
  const address = prepared.candidate.changedSlot
  const changed = prepared.candidate.sessions.find(session => session.day === address.day && session.slot === address.slot)
  if (changed?.role !== "QUALITY" || changed.prescription.kind !== "ADJUSTED_METHOD_V3") {
    throw new Error("Synthetic fixture must have a prepared adjusted quality session")
  }
  const receipt = changed.prescription.snapshot.receipt
  const before = deriveSequenceV3Totals(receipt.before.sequence).main
  const after = deriveSequenceV3Totals(receipt.after.sequence).main
  const onSaved = vi.fn()
  render(<AdjustedPlanApplyReviewV3 seed={request} readReview={() => ({ source: request.preparation.source,
    explanation: request.preparation.explanation, policies: [policy], retained: [retained] })}
    isCurrentDraft={() => true} locks={locks} onSaved={onSaved} onCancel={vi.fn()} />)

  const comparison = screen.getByRole("table", { name: "현재와 변경안 핵심 수치" })
  const cells = (label: string) => within(within(comparison).getByRole("rowheader", { name: label }).closest("tr")!)
    .getAllByRole("cell").map(cell => cell.textContent)
  expect(cells("반복 횟수")).toEqual([display(before.repetitionBlocks, "회"), display(after.repetitionBlocks, "회")])
  expect(cells("회복 시간")).toEqual([display(before.recoverySeconds, "초"), display(after.recoverySeconds, "초")])
  expect(screen.getByRole("region", { name: "현재 구성" })).toBeVisible()
  expect(screen.getByRole("region", { name: "변경 후 구성" })).toBeVisible()
  expect(screen.getByRole("button", { name: "이 구성으로 계획 저장" })).toBeEnabled()
  expect(onSaved).not.toHaveBeenCalled()
})
