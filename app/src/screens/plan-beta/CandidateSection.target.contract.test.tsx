import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { draftFor, RUNTIME_CASES } from "../../domain/prescription-quality-matrix.test-fixtures"
import { listDetailedSessionTargets } from "../../domain/plan-session-target"
import { CandidateSection } from "./CandidateSection"

afterEach(cleanup)

it("uses an explicit apply/cancel transaction on the exact schedule slot", () => {
  const result = generatePlanFromDraft(draftFor(RUNTIME_CASES[3]!), "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new Error("Expected candidate fixture")
  const targets = listDetailedSessionTargets(result.generated)
  expect(targets.length).toBeGreaterThan(1)
  const candidate = result.generated.candidates[0]
  const before = JSON.stringify(candidate)
  const onChange = vi.fn()
  const props = { candidate, startDate: "2026-09-06", canSelect: true, expanded: true,
    onToggleSchedule: vi.fn(), onSelect: vi.fn(), detailedTargets: targets,
    onChangeSessionTarget: onChange }
  const view = render(<CandidateSection {...props} />)
  const choose = () => fireEvent.click(screen.getAllByRole("button", { name: "이 훈련을 개인 페이스로 받기" }).at(-1)!)
  const acceptPlan = screen.getByRole("button", { name: "시간 조절 계획 선택하기" })
  expect(acceptPlan).toBeEnabled()
  choose()
  expect(acceptPlan).toBeDisabled()
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "변경 취소" }))
  expect(acceptPlan).toBeEnabled()
  expect(JSON.stringify(candidate)).toBe(before)
  choose()
  fireEvent.click(screen.getByRole("button", { name: "이 날짜에 적용" }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith(targets.at(-1))
  expect(JSON.stringify(candidate)).toBe(before)
  choose()
  view.rerender(<CandidateSection {...props} startDate="2026-09-07" />)
  expect(screen.queryByRole("button", { name: "이 날짜에 적용" })).not.toBeInTheDocument()
})
