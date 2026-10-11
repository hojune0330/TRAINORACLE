import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import type { PlanBetaStateV3 } from "../../domain/plan-beta-store"
import { PlanActiveState, type PlanExecutionFeedback } from "./PlanActiveState"
import type { ActivePlan } from "./ActivePlan"
import type { ActivePlanRebuildEditor } from "./ActivePlanRebuildEditor"
import { activateAcceptedNextFrameSuccessor } from "../../domain/plan-successor-activation"
import { localJournalScopeGeneration, setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

vi.mock("../../domain/plan-successor-activation", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/plan-successor-activation")>(),
  activateAcceptedNextFrameSuccessor: vi.fn(),
}))

vi.mock("./ActivePlan", () => ({ ActivePlan: ({ state, executionMessage, onActivateNextFrame, onEditPlan, futureTrainingEditor, showCreatedCelebration, onCreatedCelebrationConsumed }: React.ComponentProps<typeof ActivePlan>) => {
  const [showCreated, setShowCreated] = React.useState(false)
  React.useEffect(() => {
    if (showCreatedCelebration) {
      setShowCreated(true)
      onCreatedCelebrationConsumed?.()
    }
  }, [showCreatedCelebration, onCreatedCelebrationConsumed])
  return <>
  {showCreated && <div role="status">훈련 계획이 완성됐어요</div>}
  {executionMessage && <div role="status">{executionMessage}</div>}
  <div data-testid="active-candidate">{state.activePlan.candidateId}</div>
  <button type="button" onClick={() => onActivateNextFrame?.("NO_KNOWN_RISK")}>다음 계획 시작</button>
  <button type="button" onClick={onEditPlan}>계획 수정</button>{futureTrainingEditor}
</> } }))
vi.mock("./ActivePlanRebuildEditor", () => ({ ActivePlanRebuildEditor: ({ onManageRecords, onCancel }: React.ComponentProps<typeof ActivePlanRebuildEditor>) => <>
  <button type="button" onClick={onManageRecords}>기준 기록 확인하기</button>
  <button type="button" onClick={onCancel}>취소</button>
</> }))

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.mocked(activateAcceptedNextFrameSuccessor).mockReset() })
afterEach(() => { cleanup(); setActiveLocalAccount(null) })

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

type State = React.ComponentProps<typeof PlanActiveState>["state"]
type Feedback = PlanExecutionFeedback
const FeedbackActiveState = PlanActiveState
const successorMessage = "선택한 다음 계획을 시작했어요. 이전 계획은 이 기기의 계획 이력에 보관했어요."
const samePlanMessage = "이미 시작된 다음 계획을 그대로 보여드려요."
const OWNER_A = "a1111111-1111-4111-8111-111111111111"
const OWNER_B = "b2222222-2222-4222-8222-222222222222"
function v3State(state: State): PlanBetaStateV3 {
  if (state.version !== 3) throw new Error("Successor feedback requires a v3 fixture")
  return state
}
function nextState(previous: State): PlanBetaStateV3 {
  const current = v3State(previous)
  return { ...current, generatedAt: "2026-10-11T01:00:00.000Z", progress: [],
    activePlan: { ...current.activePlan, candidateId: `${current.activePlan.candidateId}:successor` } }
}
function deferredActivation() {
  let resolve!: (result: Awaited<ReturnType<typeof activateAcceptedNextFrameSuccessor>>) => void
  const promise = new Promise<Awaited<ReturnType<typeof activateAcceptedNextFrameSuccessor>>>(done => { resolve = done })
  vi.mocked(activateAcceptedNextFrameSuccessor).mockReturnValue(promise)
  return resolve
}
function KeyedParent({ previous, successor, changed }: { previous: State; successor: State; changed: (state: State, feedback?: Feedback) => void }) {
  const [state, setState] = React.useState(previous)
  const [feedback, setFeedback] = React.useState<Feedback>()
  return <>
    <button type="button" onClick={() => setState(successor)}>계정 이벤트로 다음 후보 먼저 반영</button>
    <FeedbackActiveState key={state.activePlan.candidateId} state={state} executionFeedback={feedback}
      onPrepareNextFrame={vi.fn()} onStateChange={(value, notice) => {
        changed(value, notice); setState(value); setFeedback(notice)
      }} />
  </>
}

it("keeps the exact successor confirmation once after the actual child remounts for a new candidate", async () => {
  const previous = stateFixture(), original = JSON.stringify(previous), successor = nextState(previous)
  const changed = vi.fn()
  vi.mocked(activateAcceptedNextFrameSuccessor).mockResolvedValue({ kind: "activated", state: successor })
  render(<KeyedParent previous={previous} successor={successor} changed={changed} />)
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 시작" }))
  await waitFor(() => expect(screen.getByTestId("active-candidate")).toHaveTextContent(successor.activePlan.candidateId))
  expect(screen.getAllByRole("status")).toHaveLength(1)
  expect(screen.getByRole("status")).toHaveTextContent(successorMessage)
  expect(changed).toHaveBeenCalledExactlyOnceWith(successor, { candidateId: successor.activePlan.candidateId,
    generatedAt: successor.generatedAt, owner: null, scopeGeneration: localJournalScopeGeneration(), message: successorMessage })
  expect(JSON.stringify(previous)).toBe(original)
  expect(successor.progress).toEqual([])
})

it("shows the already-consumed confirmation once without remounting or repeating activation", async () => {
  const state = stateFixture(), before = JSON.stringify(state), changed = vi.fn()
  vi.mocked(activateAcceptedNextFrameSuccessor).mockResolvedValue({ kind: "already_consumed", state: v3State(state) })
  render(<KeyedParent previous={state} successor={nextState(state)} changed={changed} />)
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 시작" }))
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(samePlanMessage))
  expect(screen.getAllByRole("status")).toHaveLength(1)
  expect(activateAcceptedNextFrameSuccessor).toHaveBeenCalledOnce()
  expect(changed).toHaveBeenCalledExactlyOnceWith(state, { candidateId: state.activePlan.candidateId,
    generatedAt: state.generatedAt, owner: null, scopeGeneration: localJournalScopeGeneration(), message: samePlanMessage })
  expect(JSON.stringify(state)).toBe(before)
})

it.each(["another owner", "the same owner after A-to-B-to-A"] as const)("rejects a late activation result for %s", async mode => {
  setActiveLocalAccount(OWNER_A)
  const state = stateFixture(), before = JSON.stringify(state), changed = vi.fn(), resolve = deferredActivation()
  render(<FeedbackActiveState state={state} onStateChange={changed} onPrepareNextFrame={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 시작" }))
  act(() => {
    setActiveLocalAccount(OWNER_B)
    if (mode === "the same owner after A-to-B-to-A") setActiveLocalAccount(OWNER_A)
  })
  await act(async () => { resolve({ kind: "activated", state: nextState(state) }); await Promise.resolve() })
  expect(changed).not.toHaveBeenCalled()
  expect(screen.queryByRole("status")).toBeNull()
  expect(JSON.stringify(state)).toBe(before)
})

it("accepts late feedback after an account event has already remounted the next candidate", async () => {
  const previous = stateFixture(), before = JSON.stringify(previous), successor = nextState(previous), changed = vi.fn()
  const resolve = deferredActivation()
  render(<KeyedParent previous={previous} successor={successor} changed={changed} />)
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 시작" }))
  fireEvent.click(screen.getByRole("button", { name: "계정 이벤트로 다음 후보 먼저 반영" }))
  expect(screen.getByTestId("active-candidate")).toHaveTextContent(successor.activePlan.candidateId)
  expect(screen.queryByRole("status")).toBeNull()
  await act(async () => { resolve({ kind: "activated", state: successor }); await Promise.resolve() })
  expect(screen.getAllByRole("status")).toHaveLength(1)
  expect(screen.getByRole("status")).toHaveTextContent(successorMessage)
  expect(changed).toHaveBeenCalledOnce()
  expect(JSON.stringify(previous)).toBe(before)
})

it.each(["candidateId", "generatedAt", "owner", "scopeGeneration"] as const)("does not accept feedback for another %s", async field => {
  const state = stateFixture(), before = JSON.stringify(state)
  const feedback: Feedback = { candidateId: state.activePlan.candidateId, generatedAt: state.generatedAt,
    owner: null, scopeGeneration: localJournalScopeGeneration(), message: successorMessage }
  const mismatched = { ...feedback, [field]: field === "scopeGeneration" ? feedback.scopeGeneration + 1 : "another-value" }
  const view = render(<FeedbackActiveState state={state} onStateChange={vi.fn()} onPrepareNextFrame={vi.fn()} />)
  view.rerender(<FeedbackActiveState state={state} executionFeedback={mismatched} onStateChange={vi.fn()} onPrepareNextFrame={vi.fn()} />)
  expect(screen.queryByRole("status")).toBeNull()
  expect(JSON.stringify(state)).toBe(before)
})

it("keeps the existing message clearing when the athlete starts a new execution review", async () => {
  const state = stateFixture(), feedback: Feedback = { candidateId: state.activePlan.candidateId,
    generatedAt: state.generatedAt, owner: null, scopeGeneration: localJournalScopeGeneration(), message: successorMessage }
  render(<FeedbackActiveState state={state} executionFeedback={feedback} onStateChange={vi.fn()} onPrepareNextFrame={vi.fn()} />)
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(successorMessage))
  vi.mocked(activateAcceptedNextFrameSuccessor).mockResolvedValue({ kind: "blocked", code: "INCOMPLETE_FRAME" })
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 시작" }))
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("현재 화면에 보이는 훈련을 먼저 기록해 주세요"))
  expect(screen.queryByRole("status")).toBeNull()
})
