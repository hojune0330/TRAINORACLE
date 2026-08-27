import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { ActivePlan } from "./ActivePlan"

afterEach(cleanup)

describe("active plan adaptation entry", () => {
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

    const action = screen.getByRole("button", { name: "다음 계획 조정하기" })
    const timeline = screen.getByRole("list", { name: "날짜별 계획 미리보기" })
    expect(timeline.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })
})
