import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QuickSessionForm } from "./log-entry/QuickSessionForm"
import { OracleProfileExperience, type OracleProfileExperienceProps } from "./OracleProfileExperience"
import { PlanBeta } from "./PlanBeta"
import { enterPlanWithoutRecord } from "./plan-beta/instant-plan.test-helper"
import { loadEntries } from "../domain/journal-store"
import { loadPlanBetaState } from "../domain/plan-beta-store"

vi.mock("../hooks/useReaderDialog", () => ({ useReaderDialog: (ref: React.RefObject<HTMLDialogElement>, close: () => void) => {
  React.useEffect(() => { ref.current?.showModal() }, [ref])
  return close
} }))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function pointerClick(button: HTMLElement, x = 180, y = 220, detail = 1) {
  fireEvent.click(button, { clientX: x, clientY: y, detail })
}
function oracleProps(): OracleProfileExperienceProps {
  return { answers: {}, selectedCharacter: null, revision: 0, readings: [], account: false, status: "READY",
    readTopic: () => ({ state: "MISSING", facts: [], paragraphs: [], limitations: [] }),
    onDraft: vi.fn(), onCommit: vi.fn(async () => true), onRemember: vi.fn(async () => true),
    onDelete: vi.fn(async () => true), onRetry: vi.fn(), onBack: vi.fn(), onNavigate: vi.fn() }
}

describe("auto-advance answer activation", () => {
  it("does not turn a rapid repeated outcome tap into a time-slot answer", () => {
    let now = 1000
    vi.spyOn(performance, "now").mockImplementation(() => now)
    render(<QuickSessionForm />)
    pointerClick(screen.getByRole("button", { name: "운동을 마쳤어요" }))
    now += 80
    pointerClick(screen.getByRole("button", { name: "시간 미지정" }))
    expect(screen.getByRole("button", { name: "시간 미지정" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByRole("button", { name: /힘든 정도 6\/10/ })).toBeNull()
    expect(loadEntries()).toHaveLength(0)
    // A deliberate different-position answer remains available immediately.
    pointerClick(screen.getByRole("button", { name: "오후" }), 180, 340)
    expect(screen.getByRole("button", { name: /힘든 정도 6\/10/ })).toBeVisible()
  })

  it("keeps the second Oracle question unanswered after a repeated same-position tap", () => {
    let now = 1000
    vi.spyOn(performance, "now").mockImplementation(() => now)
    const props = oracleProps()
    render(<OracleProfileExperience {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "내 훈련 방식 알아보기 · 질문 3개" }))
    const reader = () => within(screen.getByRole("dialog"))
    pointerClick(reader().getByRole("button", { name: "전혀 그렇지 않아요" }))
    const heading = reader().getByRole("heading", { level: 1 }).textContent
    now += 80
    pointerClick(reader().getByRole("button", { name: "전혀 그렇지 않아요" }))
    expect(reader().getByRole("heading", { level: 1 })).toHaveTextContent(heading!)
    expect(props.onDraft).toHaveBeenCalledTimes(1)
    expect(props.onCommit).not.toHaveBeenCalled()
    now += 500
    pointerClick(reader().getByRole("button", { name: "전혀 그렇지 않아요" }))
    expect(reader().getByRole("heading", { level: 1 }).textContent).not.toBe(heading)
    expect(props.onDraft).toHaveBeenCalledTimes(2)
  })

  it("does not answer body safety when repeating the previous plan-days tap across an intake remount", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await enterPlanWithoutRecord("5km")
    await user.click(screen.getByRole("button", { name: /달리기를 막 시작했어요/ }))
    let now = 1000
    vi.spyOn(performance, "now").mockImplementation(() => now)
    pointerClick(screen.getByRole("button", { name: "3일" }))
    now += 80
    pointerClick(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ }))
    expect(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ })).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByRole("button", { name: "이 일정으로 시작" })).toBeNull()
    expect(loadPlanBetaState()).toBeNull()
    pointerClick(screen.getByRole("button", { name: /통증.*부상.*몸 이상이 있거나 잘 모르겠어요/ }), 180, 350)
    expect(screen.queryByRole("button", { name: "이 일정으로 시작" })).toBeNull()
    expect(loadPlanBetaState()).toBeNull()
  })
})
