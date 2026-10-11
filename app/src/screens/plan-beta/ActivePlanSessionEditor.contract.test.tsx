import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import type { ActivePlanEditPreparation, ActivePlanEditProposal, ActivePlanEditTarget } from "../../domain/active-plan-edit"
import type { PlanBetaStateV3 } from "../../domain/plan-beta-schema"
import type { ActivePlanEditSelection } from "../../domain/active-plan-edit-store"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { ActivePlanSessionEditor } from "./ActivePlanSessionEditor"

vi.mock("./CatalogWorkoutPicker", () => ({
  CatalogWorkoutEditor: ({ onSelect, onDraftChange, onCancel, disabled }: {
    onSelect?: (id: string, inputs: WorkoutCalculationInputs, acceptLonger: boolean, acceptStronger: boolean) => void
    onDraftChange?: () => void
    onCancel?: () => void
    disabled?: boolean
  }) => <div>
    <input aria-label="카탈로그 편집 테스트 값" defaultValue="saved binding" onChange={() => onDraftChange?.()} />
    <button type="button" disabled={disabled} onClick={() => onSelect?.("catalog-fixture", {} as WorkoutCalculationInputs, false, false)}>구성 선택 저장</button>
    <button type="button" disabled={disabled} onClick={() => onDraftChange?.()}>구성 입력 변경</button>
    <button type="button" disabled={disabled} onClick={onCancel}>변경 취소</button>
  </div>,
}))

afterEach(cleanup)

function fixture(): PlanBetaStateV3 {
  const original = stateFixture()
  return { ...original, intake: { ...original.intake, startDate: "2026-10-01" } } as PlanBetaStateV3
}

function sourceOption(state: PlanBetaStateV3, options: Partial<ActivePlanEditTarget> = {}): ActivePlanEditTarget {
  const session = state.activePlan.sessions[0]!
  return {
    address: { day: session.day, slot: session.slot },
    date: "2026-10-01",
    role: session.role,
    actions: ["DURATION", "SWAP", "CATALOG"],
    swapTargets: [],
    ...options,
  }
}

function proposalFixture(state: PlanBetaStateV3): ActivePlanEditProposal {
  const source = state.activePlan.sessions[0]!
  return {
    policy: "ACTIVE_PLAN_EDIT_V1",
    action: "DURATION",
    proposalId: "proposal-fixture",
    baseStateFingerprint: "base-fixture",
    originalPlanId: state.activePlan.candidateId,
    newPlanId: "new-plan-fixture",
    createdAt: "2026-10-01T01:00:00.000Z",
    source: { day: source.day, slot: source.slot },
    target: null,
    before: state,
    after: state,
    beforeSessions: [source],
    afterSessions: [{ ...source, prescription: { ...source.prescription, durationMinutes: { minimum: 20, maximum: 25 } } }],
  } as unknown as ActivePlanEditProposal
}

describe("active plan session editor", () => {
  it("requires an unstarted confirmation, previews before apply, and requires the current safety check", async () => {
    const user = userEvent.setup()
    const state = fixture()
    const proposal = proposalFixture(state)
    const option = sourceOption(state)
    const onPrepare = vi.fn(async (_selection: ActivePlanEditSelection) => ({
      kind: "ready" as const,
      proposal,
      permittedTargets: [option],
    }))
    const onApply = vi.fn(async () => ({ kind: "applied" as const, state }))
    const onApplied = vi.fn()
    const onClose = vi.fn()

    render(<ActivePlanSessionEditor state={state} sourceOptions={[option]} entriesReady intent="workout" contextKey="guest:plan-1"
      onRetryEntries={vi.fn()} onPrepare={onPrepare} onApply={onApply} onClose={onClose} onApplied={onApplied} records={[]} />)

    const editor = screen.getByRole("region", { name: "훈련 내용 바꾸기" })
    const previewButton = within(editor).getByRole("button", { name: "변경안 미리보기" })
    expect(previewButton).toBeDisabled()
    await user.click(within(editor).getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }))
    await user.type(within(editor).getByRole("spinbutton", { name: /새 최대 시간/u }), "25")
    await user.click(previewButton)

    await waitFor(() => expect(onPrepare).toHaveBeenCalledOnce())
    expect(onPrepare).toHaveBeenCalledWith(expect.objectContaining({ action: "DURATION", unstartedConfirmed: true, maximumMinutes: 25 }))
    expect(screen.getByRole("heading", { name: "변경안 미리보기" })).toBeVisible()
    const summaries = document.querySelectorAll(".active-plan-session-editor__session-summary")
    expect(summaries.length).toBeGreaterThanOrEqual(2)
    for (const summary of summaries) {
      expect(summary).toHaveTextContent("전체")
      expect(summary).toHaveTextContent(/힘든 정도 .*\/10/u)
      expect(summary).not.toHaveTextContent(/RPE| min| @ /u)
    }
    expect(summaries[summaries.length - 1]).toHaveTextContent("전체 20–25분")
    const applyButton = screen.getByRole("button", { name: "변경안 적용하기" })
    expect(applyButton).toBeDisabled()
    expect(onApply).not.toHaveBeenCalled()

    await user.click(screen.getByRole("checkbox", { name: "지금 통증이나 몸 상태 이상이 없어요." }))
    await user.click(applyButton)
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(proposal, true))
    expect(onApplied).toHaveBeenCalledWith(state)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("requires confirmations for both sessions and fixed commitments before a date swap preview", async () => {
    const user = userEvent.setup()
    const state = fixture()
    const source = state.activePlan.sessions[0]!
    const destination = {
      day: 2,
      slot: source.slot,
      role: "REST" as const,
      plannedEnergyIntent: "RECOVERY_INTENT" as const,
      prescription: { kind: "REST" as const },
    }
    const stateWithTarget = {
      ...state,
      activePlan: { ...state.activePlan, sessions: [...state.activePlan.sessions, destination] },
    } as PlanBetaStateV3
    const option = sourceOption(stateWithTarget, { swapTargets: [{ day: 2, slot: source.slot }] })
    const onPrepare = vi.fn(async (_selection: ActivePlanEditSelection) => ({
      kind: "blocked" as const,
      reasonCode: "TARGET_UNAVAILABLE" as const,
      message: "fixture",
      permittedTargets: [option],
    }))

    render(<ActivePlanSessionEditor state={stateWithTarget} sourceOptions={[option]} entriesReady intent="schedule" contextKey="guest:plan-2"
      onRetryEntries={vi.fn()} onPrepare={onPrepare} onApply={vi.fn()} onClose={vi.fn()} onApplied={vi.fn()} records={[]} />)

    const editor = screen.getByRole("region", { name: "훈련 날짜 바꾸기" })
    const preview = within(editor).getByRole("button", { name: "바꿀 날짜 보기" })
    expect(preview).toBeDisabled()
    await user.click(within(editor).getByRole("checkbox", { name: "옮길 훈련은 아직 시작하지 않았어요." }))
    await user.click(within(editor).getByRole("checkbox", { name: "바꿀 날짜에 고정된 일정이 없어요." }))
    expect(within(editor).getByRole("combobox", { name: "바꿀 날짜의 기존 훈련" })).toBeEnabled()
    await user.click(preview)
    await waitFor(() => expect(onPrepare).toHaveBeenCalledOnce())

    const targetPicker = within(editor).getByRole("combobox", { name: "바꿀 날짜의 기존 훈련" })
    await user.selectOptions(targetPicker, "2:AM")
    await user.click(within(editor).getByRole("checkbox", { name: "바꿀 훈련도 아직 시작하지 않았어요." }))
    await user.click(within(editor).getByRole("button", { name: "변경안 미리보기" }))
    await waitFor(() => expect(onPrepare).toHaveBeenCalledTimes(2))
    expect(onPrepare).toHaveBeenLastCalledWith(expect.objectContaining({
      action: "SWAP",
      target: { day: 2, slot: "AM" },
      unstartedConfirmed: true,
      noFixedFutureCommitments: true,
    }))
  })

  it("keeps browsing and canceling read only and invalidates a preview on context change", async () => {
    const user = userEvent.setup()
    const state = fixture()
    const option = sourceOption(state)
    const proposal = proposalFixture(state)
    const onPrepare = vi.fn(async () => ({ kind: "ready" as const, proposal, permittedTargets: [option] }))
    const onApply = vi.fn()
    const before = JSON.stringify(state)
    const props = { state, sourceOptions: [option], entriesReady: true, intent: "workout" as const, onRetryEntries: vi.fn(),
      onPrepare, onApply, onClose: vi.fn(), onApplied: vi.fn(), records: [] as const }
    const view = render(<ActivePlanSessionEditor {...props} contextKey="guest:plan-a" />)

    await user.click(screen.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }))
    await user.type(screen.getByRole("spinbutton", { name: /새 최대 시간/u }), "25")
    await user.click(screen.getByRole("button", { name: "변경안 미리보기" }))
    await waitFor(() => expect(screen.getByRole("heading", { name: "변경안 미리보기" })).toBeVisible())
    view.rerender(<ActivePlanSessionEditor {...props} contextKey="account:plan-b" />)
    expect(screen.queryByRole("heading", { name: "변경안 미리보기" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "취소" }))
    expect(onApply).not.toHaveBeenCalled()
    expect(JSON.stringify(state)).toBe(before)
  })

  it("invalidates a staged catalog preview when the child calculation draft changes", async () => {
    const user = userEvent.setup()
    const state = fixture()
    const option = sourceOption(state)
    const proposal = proposalFixture(state)
    const onPrepare = vi.fn(async (_selection: ActivePlanEditSelection) => ({ kind: "ready" as const, proposal, permittedTargets: [option] }))
    const onApply = vi.fn()

    render(<ActivePlanSessionEditor state={state} sourceOptions={[option]} entriesReady intent="workout" contextKey="guest:catalog"
      onRetryEntries={vi.fn()} onPrepare={onPrepare} onApply={onApply} onClose={vi.fn()} onApplied={vi.fn()} records={[]} />)
    await user.click(screen.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }))
    await user.click(screen.getByRole("button", { name: "훈련 구성 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "구성 선택 저장" }))
    await user.click(screen.getByRole("button", { name: "변경안 미리보기" }))
    await waitFor(() => expect(screen.getByRole("heading", { name: "변경안 미리보기" })).toBeVisible())
    expect(onPrepare).toHaveBeenCalledOnce()

    await user.click(screen.getByRole("button", { name: "구성 입력 변경" }))
    expect(screen.queryByRole("heading", { name: "변경안 미리보기" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "변경안 미리보기" })).toBeDisabled()
    expect(onApply).not.toHaveBeenCalled()
  })

  it("resets the embedded catalog draft when its cancel action is used", async () => {
    const user = userEvent.setup()
    const state = fixture()
    const option = sourceOption(state)
    const onPrepare = vi.fn()

    render(<ActivePlanSessionEditor state={state} sourceOptions={[option]} entriesReady intent="workout" contextKey="guest:catalog-cancel"
      onRetryEntries={vi.fn()} onPrepare={onPrepare} onApply={vi.fn()} onClose={vi.fn()} onApplied={vi.fn()} records={[]} />)
    await user.click(screen.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }))
    await user.click(screen.getByRole("button", { name: "훈련 구성 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "구성 선택 저장" }))
    const draftInput = screen.getByRole("textbox", { name: "카탈로그 편집 테스트 값" })
    await user.clear(draftInput)
    await user.type(draftInput, "changed draft")
    expect(screen.getByRole("button", { name: "변경안 미리보기" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "변경 취소" }))

    expect(screen.getByRole("textbox", { name: "카탈로그 편집 테스트 값" })).toHaveValue("saved binding")
    expect(screen.getByRole("button", { name: "변경안 미리보기" })).toBeDisabled()
    expect(onPrepare).not.toHaveBeenCalled()
  })

  it("locks apply after an uncertain save until a fresh read context is supplied", async () => {
    const user = userEvent.setup()
    const state = fixture()
    const option = sourceOption(state)
    const proposal = proposalFixture(state)
    const onRetryEntries = vi.fn()
    const onApply = vi.fn(async () => ({ kind: "uncertain" as const, message: "결과 미확인" }))
    const props = { state, sourceOptions: [option], entriesReady: true, intent: "workout" as const, onRetryEntries,
      onPrepare: vi.fn(async () => ({ kind: "ready" as const, proposal, permittedTargets: [option] })),
      onApply, onClose: vi.fn(), onApplied: vi.fn(), records: [] as const }
    const view = render(<ActivePlanSessionEditor {...props} contextKey="guest:uncertain" />)

    await user.click(screen.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }))
    await user.type(screen.getByRole("spinbutton", { name: /새 최대 시간/u }), "25")
    await user.click(screen.getByRole("button", { name: "변경안 미리보기" }))
    await waitFor(() => expect(screen.getByRole("heading", { name: "변경안 미리보기" })).toBeVisible())
    await user.click(screen.getByRole("checkbox", { name: "지금 통증이나 몸 상태 이상이 없어요." }))
    await user.click(screen.getByRole("button", { name: "변경안 적용하기" }))
    expect(await screen.findByText("저장 결과를 확인하지 못했어요. 다시 적용하지 말고 현재 계획을 읽어 주세요.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "변경안 적용하기" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "현재 계획 다시 읽기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "현재 계획 다시 읽기" }))
    expect(onRetryEntries).toHaveBeenCalledOnce()

    view.rerender(<ActivePlanSessionEditor {...props} contextKey="guest:uncertain-refreshed" />)
    expect(screen.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." })).toBeVisible()
    expect(screen.queryByRole("button", { name: "현재 계획 다시 읽기" })).not.toBeInTheDocument()
  })
})
