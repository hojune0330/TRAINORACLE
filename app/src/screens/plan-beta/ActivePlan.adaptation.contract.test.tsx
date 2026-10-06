import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { ActivePlan } from "./ActivePlan"

afterEach(() => { cleanup(); vi.useRealTimers() })

describe("active plan adaptation entry", () => {
  it("offers a completed plan preview directly without activating it", () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-10T03:00:00.000Z"))
    const state = stateFixture(), next = vi.fn(), activate = vi.fn()
    render(<ActivePlan state={{ ...state, progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] }}
      onProgress={vi.fn()} onNextFrame={next} onActivateNextFrame={activate} onCheckDetailedExecution={vi.fn()} />)
    const primary = screen.getByRole("button", { name: "다음 계획안 만들기" })
    expect(primary.closest("details")).toBeNull()
    primary.click()
    expect(next).toHaveBeenCalledTimes(1)
    expect(activate).not.toHaveBeenCalled()
    expect(screen.getByText("계획안을 보고 고른 뒤에 시작해요.")).toBeVisible()
  })

  it("does not offer a new-plan action before completion", () => {
    render(<ActivePlan state={stateFixture()} onProgress={vi.fn()} onNextFrame={vi.fn()}
      onActivateNextFrame={vi.fn()} onCheckDetailedExecution={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "다음 계획안 만들기" })).toBeNull()
  })

  it("keeps the current schedule before the next-plan adjustment action", () => {
    const state = stateFixture()
    render(
      <ActivePlan
        state={{
          ...state,
          progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }],
        }}
        onProgress={vi.fn()}
        onNextFrame={vi.fn()}
        onActivateNextFrame={vi.fn()}
        onCheckDetailedExecution={vi.fn()}
      />,
    )

    const action = screen.getByRole("button", { name: "이번 주기 기록 확인" })
    const timeline = screen.getByRole("grid", { name: /달력/u })
    expect(timeline.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })
})
