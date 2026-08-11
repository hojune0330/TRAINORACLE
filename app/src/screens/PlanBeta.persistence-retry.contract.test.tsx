import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { savePlanBetaState } from "../domain/plan-beta-store"
import { stateFixture } from "../domain/plan-beta-store.test-fixture"
import { PlanBeta } from "./PlanBeta"

describe("active plan persistence retry", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("retries a failed completed-session save without losing the selected progress", async () => {
    // Given: an active plan exists and the next active-plan write is temporarily unavailable.
    expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })
    const realSetItem = Storage.prototype.setItem
    let planWritesBlocked = true
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1" && planWritesBlocked) {
        throw new DOMException("Storage is full", "QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })
    const user = userEvent.setup()
    render(<PlanBeta />)

    // When: the athlete marks a session complete and the first write fails.
    const firstProgress = screen.getByLabelText(/DAY 1.*진행 기록/u)
    await user.click(within(firstProgress).getByRole("button", { name: "완료" }))

    // Then: the choice remains pending and a direct retry preserves it once storage returns.
    expect(screen.getByRole("alert")).toHaveTextContent("계획을 이 기기에 저장하지 못했어요")
    expect(screen.getByRole("button", { name: "진행 상태 다시 저장하기" })).toBeVisible()
    expect(screen.getByText("예정")).toBeVisible()

    planWritesBlocked = false
    await user.click(screen.getByRole("button", { name: "진행 상태 다시 저장하기" }))

    expect(screen.getByText("완료", { selector: "em" })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toContain("COMPLETED")
  })

  it("retries a failed next-frame archive without clearing the active plan early", async () => {
    // Given: an active plan exists and archiving cannot first write its history.
    expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })
    const realSetItem = Storage.prototype.setItem
    let historyWritesBlocked = true
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.history.v1" && historyWritesBlocked) {
        throw new DOMException("Storage is full", "QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })
    const user = userEvent.setup()
    render(<PlanBeta />)

    // When: the athlete starts the next frame but history storage fails.
    await user.click(screen.getByRole("button", { name: "다음 주기 후보 만들기" }))

    // Then: the active plan remains until the same action can be retried successfully.
    expect(screen.getByRole("alert")).toHaveTextContent("지금 계획과 진행 기록은 그대로")
    expect(screen.getByRole("button", { name: "다음 주기 다시 만들기" })).toBeVisible()
    expect(screen.getByRole("heading", { name: /9일 계획/u })).toBeVisible()

    historyWritesBlocked = false
    await user.click(screen.getByRole("button", { name: "다음 주기 다시 만들기" }))

    expect(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })
})
