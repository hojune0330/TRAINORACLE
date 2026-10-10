import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { PlanActiveState } from "./PlanActiveState"
import type { ActivePlan } from "./ActivePlan"
import type { ActivePlanRebuildEditor } from "./ActivePlanRebuildEditor"

vi.mock("./ActivePlan", () => ({ ActivePlan: ({ onEditPlan, futureTrainingEditor, showCreatedCelebration, onCreatedCelebrationConsumed }: React.ComponentProps<typeof ActivePlan>) => {
  const [showCreated, setShowCreated] = React.useState(false)
  React.useEffect(() => {
    if (showCreatedCelebration) {
      setShowCreated(true)
      onCreatedCelebrationConsumed?.()
    }
  }, [showCreatedCelebration, onCreatedCelebrationConsumed])
  return <>
  {showCreated && <div role="status">훈련 계획이 완성됐어요</div>}
  <button type="button" onClick={onEditPlan}>계획 수정</button>{futureTrainingEditor}
</> } }))
vi.mock("./ActivePlanRebuildEditor", () => ({ ActivePlanRebuildEditor: ({ onManageRecords, onCancel }: React.ComponentProps<typeof ActivePlanRebuildEditor>) => <>
  <button type="button" onClick={onManageRecords}>기준 기록 확인하기</button>
  <button type="button" onClick={onCancel}>취소</button>
</> }))

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)

it("reports the existing editor visibility without changing the plan, then clears it on close and unmount", () => {
  const state = stateFixture(), original = JSON.stringify(state)
  const onEditingChange = vi.fn(), onStateChange = vi.fn()
  const view = render(<PlanActiveState state={state} onStateChange={onStateChange} onPrepareNextFrame={vi.fn()}
    onEditingChange={onEditingChange} />)
  expect(onEditingChange).toHaveBeenLastCalledWith(false)
  fireEvent.click(screen.getByRole("button", { name: "계획 수정" }))
  expect(onEditingChange).toHaveBeenLastCalledWith(true)
  fireEvent.click(screen.getByRole("button", { name: "계획 수정 닫기" }))
  expect(onEditingChange).toHaveBeenLastCalledWith(false)
  fireEvent.click(screen.getByRole("button", { name: "계획 수정" }))
  view.unmount()
  expect(onEditingChange).toHaveBeenLastCalledWith(false)
  expect(onStateChange).not.toHaveBeenCalled()
  expect(JSON.stringify(state)).toBe(original)
})

it("opens record management from a new-plan record recovery action without changing the current plan", () => {
  const state = stateFixture(), original = JSON.stringify(state)
  const onManagePaceRecords = vi.fn(), onStateChange = vi.fn()
  render(<PlanActiveState state={state} onStateChange={onStateChange} onPrepareNextFrame={vi.fn()}
    onManagePaceRecords={onManagePaceRecords} />)
  fireEvent.click(screen.getByRole("button", { name: "계획 수정" }))
  fireEvent.click(screen.getByRole("button", { name: "새 계획 만들기" }))
  fireEvent.click(screen.getByRole("button", { name: "기준 기록 확인하기" }))
  expect(onManagePaceRecords).toHaveBeenCalledOnce()
  expect(onStateChange).not.toHaveBeenCalled()
  expect(JSON.stringify(state)).toBe(original)
})

it("does not replay the creation confirmation when cancelling an unchanged rebuild", () => {
  const state = stateFixture(), original = JSON.stringify(state)
  const onStateChange = vi.fn()
  render(<PlanActiveState state={state} celebrateOnMount onStateChange={onStateChange} onPrepareNextFrame={vi.fn()} />)

  expect(screen.getByText("훈련 계획이 완성됐어요")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "계획 수정" }))
  fireEvent.click(screen.getByRole("button", { name: "새 계획 만들기" }))
  fireEvent.click(screen.getByRole("button", { name: "취소" }))

  expect(screen.queryByText("훈련 계획이 완성됐어요")).toBeNull()
  expect(onStateChange).not.toHaveBeenCalled()
  expect(JSON.stringify(state)).toBe(original)
})
