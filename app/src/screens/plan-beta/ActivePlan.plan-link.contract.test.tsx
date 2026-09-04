import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { ActivePlan } from "./ActivePlan"
import { createInitialPeriodizationContext } from "../../domain/periodization-lineage"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { QuickSessionForm } from "../log-entry/QuickSessionForm"

afterEach(cleanup)
beforeEach(() => window.localStorage.clear())

function plannedDraft() {
  const state = stateFixture()
  const session = state.activePlan.sessions[0]
  if (session === undefined) throw new Error("Missing fixture session")
  const draft = createPlannedSessionLogDraft(state, session, "2026-08-28T03:00:00.000Z")
  if (draft === null) throw new Error("Missing planned session draft")
  return { state, session, draft }
}

function matchingSlotLabel(slot: "AM" | "PM"): "오전" | "오후" {
  return slot === "AM" ? "오전" : "오후"
}

function saveQuickPlanJournal(input: {
  readonly outcome: "COMPLETED" | "PARTIAL"
  readonly pain: "NONE" | "SIGNAL"
}) {
  const { draft } = plannedDraft()
  const view = render(<QuickSessionForm targetDate={draft.date} plannedSessionLink={draft.link} />)
  fireEvent.click(screen.getByRole("button", {
    name: input.outcome === "COMPLETED" ? "계획대로 마쳤어요" : "일부만 했거나 내용을 바꿨어요",
  }))
  fireEvent.click(screen.getByRole("button", { name: matchingSlotLabel(draft.link.sessionSlot) }))
  fireEvent.click(screen.getByRole("button", { name: /RPE 6,/ }))
  if (input.pain === "NONE") {
    fireEvent.click(screen.getByRole("button", { name: "없어요" }))
  } else {
    fireEvent.click(screen.getByRole("button", { name: "있어요" }))
    fireEvent.click(screen.getByRole("button", { name: /오른 무릎, 통증 없음/ }))
    fireEvent.click(screen.getByRole("button", { name: "이 상태로 기록" }))
  }
  view.unmount()
  return plannedDraft()
}

describe("active plan journal action", () => {
  it("opens a journal only from the exact non-rest planned session", async () => {
    const state = stateFixture()
    const onWriteSessionLog = vi.fn()
    const user = userEvent.setup()
    render(
      <ActivePlan
        state={state}
        onProgress={vi.fn()}
        onNextFrame={vi.fn()}
        onActivateNextFrame={vi.fn()}
        onCheckDetailedExecution={vi.fn()}
        onWriteSessionLog={onWriteSessionLog}
      />,
    )

    await user.click(screen.getByRole("button", { name: "이 훈련 일지 쓰기" }))
    expect(onWriteSessionLog).toHaveBeenCalledWith(state.activePlan.sessions[0])
  })

  it("shows the long direction without presenting it as automatic load progression", () => {
    const state = stateFixture()
    if (state.version !== 3) throw new Error("V3 fixture required")
    const periodization = createInitialPeriodizationContext(
      state.activePlan.candidateId,
      state.generatedAt,
    )!
    render(
      <ActivePlan
        state={{ ...state, periodization }}
        onProgress={vi.fn()}
        onNextFrame={vi.fn()}
        onActivateNextFrame={vi.fn()}
        onCheckDetailedExecution={vi.fn()}
      />,
    )

    expect(screen.getByText("24주 훈련 방향")).toBeVisible()
    expect(screen.getByText(/1\/18번째 계획/u)).toBeVisible()
    expect(screen.getByRole("progressbar", { name: "24주 훈련 방향 진행 위치" }))
      .toHaveAttribute("aria-valuenow", "1")
    expect(screen.getByText(/자동으로 올리지는 않아요/u)).toBeVisible()
  })

  it("offers one explicit completion action only after a matching completed no-pain journal", async () => {
    const { state, draft } = saveQuickPlanJournal({ outcome: "COMPLETED", pain: "NONE" })
    const onProgress = vi.fn()
    const user = userEvent.setup()
    render(
      <ActivePlan
        state={state}
        returnToSession={draft.link}
        onProgress={onProgress}
        onNextFrame={vi.fn()}
        onActivateNextFrame={vi.fn()}
        onCheckDetailedExecution={vi.fn()}
      />,
    )

    expect(screen.getByText("일지를 저장했어요. 계획의 진행 기록은 별도예요.")).toBeVisible()
    expect(screen.getAllByRole("button", { name: "계획에도 완료 표시" })).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "계획에도 완료 표시" }))
    expect(onProgress).toHaveBeenCalledWith({
      sessionDay: draft.link.sessionDay,
      sessionSlot: draft.link.sessionSlot,
      state: "COMPLETED",
    })
  })

  it.each([
    ["partial", { outcome: "PARTIAL", pain: "NONE" }],
    ["pain", { outcome: "COMPLETED", pain: "SIGNAL" }],
  ] as const)("does not offer completion for a saved linked %s journal", (_case, input) => {
    const { state, draft } = saveQuickPlanJournal(input)
    render(
      <ActivePlan
        state={state}
        returnToSession={draft.link}
        onProgress={vi.fn()}
        onNextFrame={vi.fn()}
        onActivateNextFrame={vi.fn()}
        onCheckDetailedExecution={vi.fn()}
      />,
    )

    expect(screen.getByText("일지를 저장했어요. 계획의 진행 기록은 별도예요.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "계획에도 완료 표시" })).toBeNull()
  })
})
