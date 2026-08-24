import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as planStore from "../domain/plan-beta-store"
import { savePlanBetaState } from "../domain/plan-beta-store"
import { stateFixture } from "../domain/plan-beta-store.test-fixture"
import type { PlanBetaState } from "../domain/plan-beta-store"
import { PlanBeta } from "./PlanBeta"
import { PlanActiveState } from "./plan-beta/PlanActiveState"
import { PLAN_BETA_MUTATION_LOCK_NAME } from "../domain/plan-mutation-lock"

let locksDescriptor: PropertyDescriptor | undefined

describe("active plan persistence retry", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
          expect(name).toBe(PLAN_BETA_MUTATION_LOCK_NAME)
          return callback({})
        },
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    if (locksDescriptor === undefined) Reflect.deleteProperty(navigator, "locks")
    else Object.defineProperty(navigator, "locks", locksDescriptor)
  })

  it("retries a failed completed-session save without losing the selected progress", async () => {
    // Given: an active plan exists and the next active-plan write is temporarily unavailable.
    expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })
    const realSetItem = Storage.prototype.setItem
    let failNextPlanWrite = true
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1" && failNextPlanWrite) {
        failNextPlanWrite = false
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

    await user.click(screen.getByRole("button", { name: "진행 상태 다시 저장하기" }))

    expect(screen.getByText("완료", { selector: "em" })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toContain("COMPLETED")
  })

  it("withholds progress retry when rollback could not be confirmed", async () => {
    const state = stateFixture()
    const onStateChange = vi.fn()
    vi.spyOn(planStore, "savePlanProgressWithLock").mockResolvedValue({
      kind: "failed",
      code: "PLAN_STORAGE_WRITE_FAILED",
      rollbackComplete: false,
    })
    const user = userEvent.setup()
    render(
      <PlanActiveState
        state={state}
        onStateChange={onStateChange}
        onArchived={vi.fn()}
      />,
    )

    const firstProgress = screen.getByLabelText(/DAY 1.*진행 기록/u)
    await user.click(within(firstProgress).getByRole("button", { name: "완료" }))

    expect(screen.getByRole("alert")).toHaveTextContent("진행 기록 저장을 되돌렸는지 확인할 수 없어요")
    expect(screen.queryByRole("button", { name: "진행 상태 다시 저장하기" })).not.toBeInTheDocument()
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it("withholds progress retry when the active-plan storage state cannot be read", async () => {
    const state = stateFixture()
    const onStateChange = vi.fn()
    vi.spyOn(planStore, "savePlanProgressWithLock").mockResolvedValue({
      kind: "rejected",
      code: "PLAN_STORAGE_STATE_UNCERTAIN",
    })
    const user = userEvent.setup()
    render(
      <PlanActiveState
        state={state}
        onStateChange={onStateChange}
        onArchived={vi.fn()}
      />,
    )

    const firstProgress = screen.getByLabelText(/DAY 1.*진행 기록/u)
    await user.click(within(firstProgress).getByRole("button", { name: "완료" }))

    expect(screen.getByRole("alert")).toHaveTextContent("계획 저장 상태를 확인할 수 없어요")
    expect(screen.queryByRole("button", { name: "진행 상태 다시 저장하기" })).not.toBeInTheDocument()
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it("retries a failed next-frame archive without clearing the active plan early", async () => {
    // Given: an active plan exists and archiving cannot first write its history.
    expect(savePlanBetaState(completedStateFixture())).toEqual({ ok: true })
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
    await user.click(screen.getByRole("button", { name: "현재 기준으로 다음 후보 만들기" }))

    // Then: the active plan remains until the same action can be retried successfully.
    expect(screen.getByRole("alert")).toHaveTextContent("지금 계획과 진행 기록은 그대로")
    expect(screen.getByRole("button", { name: "다음 주기 다시 만들기" })).toBeVisible()
    expect(screen.getByRole("heading", { name: /9일 계획/u })).toBeVisible()

    historyWritesBlocked = false
    await user.click(screen.getByRole("button", { name: "다음 주기 다시 만들기" }))

    expect(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("does not offer an archive retry when rollback itself could not restore the active plan", async () => {
    // Given: the storage transaction failed and the store cannot confirm its rollback.
    const onArchived = vi.fn()
    vi.spyOn(planStore, "archiveAndClearActivePlanWithLock").mockResolvedValue({
      kind: "failed",
      code: "PLAN_ARCHIVE_WRITE_FAILED",
      rollbackComplete: false,
    })
    const user = userEvent.setup()
    render(
      <PlanActiveState
        state={completedStateFixture()}
        onStateChange={vi.fn()}
        onArchived={onArchived}
      />,
    )

    // When: the athlete starts a next-frame archive with an unknown rollback result.
    await user.click(screen.getByRole("button", { name: "현재 기준으로 다음 후보 만들기" }))

    // Then: retry is withheld because it could duplicate a partially archived plan.
    expect(screen.getByRole("alert")).toHaveTextContent("저장 상태도 확인하지 못했어요")
    expect(screen.queryByRole("button", { name: "다음 주기 다시 만들기" })).not.toBeInTheDocument()
    expect(onArchived).not.toHaveBeenCalled()
  })

  it("does not offer an archive retry for an invalid stored plan", async () => {
    const onArchived = vi.fn()
    vi.spyOn(planStore, "archiveAndClearActivePlanWithLock").mockResolvedValue({
      kind: "rejected",
      code: "INVALID_STORED_PLAN",
    })
    const user = userEvent.setup()
    render(
      <PlanActiveState
        state={completedStateFixture()}
        onStateChange={vi.fn()}
        onArchived={onArchived}
      />,
    )

    await user.click(screen.getByRole("button", { name: "현재 기준으로 다음 후보 만들기" }))

    expect(screen.getByRole("alert")).toHaveTextContent("저장된 계획을 읽을 수 없어요")
    expect(screen.queryByRole("button", { name: "다음 주기 다시 만들기" })).not.toBeInTheDocument()
    expect(onArchived).not.toHaveBeenCalled()
  })
})

function completedStateFixture(): PlanBetaState {
  const state = stateFixture()
  return {
    ...state,
    progress: state.activePlan.sessions
      .filter((session) => session.role !== "REST")
      .map((session) => ({
        sessionDay: session.day,
        sessionSlot: session.slot,
        state: "COMPLETED" as const,
      })),
  }
}
