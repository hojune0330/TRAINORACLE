import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanBeta } from "./PlanBeta"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function generatePlanCandidates(): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /800m.*1500m/u }))
  await user.click(screen.getByRole("button", { name: /고등부/u }))
  await user.click(screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }))
  await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
  await user.click(screen.getByRole("button", { name: /날마다 달라요/u }))
  await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
}

describe("plan candidate save retry", () => {
  it("offers a direct retry when the selected plan cannot be stored", async () => {
    // Given: a generated candidate and a storage write that fails once.
    render(<PlanBeta />)
    await generatePlanCandidates()
    const realSetItem = Storage.prototype.setItem
    let planWriteCount = 0
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1") {
        planWriteCount += 1
        if (planWriteCount === 1) throw new Error("QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })

    // When: the athlete selects the first candidate.
    const [choice] = screen.getAllByRole("button", { name: /선택하기/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")
    await userEvent.setup().click(choice)

    // Then: the failure is explained with a direct retry action.
    expect(screen.getByRole("alert")).toHaveTextContent("계획을 이 기기에 저장하지 못했어요")
    expect(screen.getByRole("button", { name: "계획 다시 저장하기" })).toBeVisible()
  })

  it("stores the selected plan when the direct retry succeeds", async () => {
    // Given: the first write fails and the next write is available.
    render(<PlanBeta />)
    await generatePlanCandidates()
    const realSetItem = Storage.prototype.setItem
    let planWriteCount = 0
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1") {
        planWriteCount += 1
        if (planWriteCount === 1) throw new Error("QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })
    const [choice] = screen.getAllByRole("button", { name: /선택하기/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")
    await userEvent.setup().click(choice)

    // When: the athlete uses the direct retry action.
    await userEvent.setup().click(screen.getByRole("button", { name: "계획 다시 저장하기" }))

    // Then: the local snapshot exists and the active plan is shown.
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).not.toBeNull()
    expect(screen.getByRole("heading", { name: /9일 계획/u })).toBeVisible()
  })

  it("stores one plan when an athlete taps a candidate twice quickly", async () => {
    // Given: a visible plan candidate and a real local storage implementation.
    render(<PlanBeta />)
    await generatePlanCandidates()
    const realSetItem = Storage.prototype.setItem
    let activePlanWrites = 0
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1") activePlanWrites += 1
      return realSetItem.call(this, key, value)
    })
    const [choice] = screen.getAllByRole("button", { name: /선택하기/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")

    // When: the athlete double-taps the same choice.
    await userEvent.setup().dblClick(choice)

    // Then: one active plan is stored and the candidate screen is gone.
    expect(activePlanWrites).toBe(1)
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).not.toBeNull()
    expect(screen.getByRole("heading", { name: /9일 계획/u })).toBeVisible()
  })

  it("keeps a generated candidate unsaved when its start date is cleared", async () => {
    // Given: the athlete has reached the choice screen.
    render(<PlanBeta />)
    await generatePlanCandidates()
    const date = screen.getByLabelText("계획 시작 날짜")

    // When: the previously valid date is cleared just before selection.
    await userEvent.setup().clear(date)

    // Then: selection is disabled and no active plan is written.
    expect(screen.getByRole("alert")).toHaveTextContent("실제 날짜를 고른 뒤 계획을 선택해 주세요.")
    for (const choice of screen.getAllByRole("button", { name: /선택하기/u })) {
      expect(choice).toBeDisabled()
    }
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })

  it("shows retry when local storage silently ignores a selected plan", async () => {
    // Given: the storage API accepts the call but does not retain the active plan.
    render(<PlanBeta />)
    await generatePlanCandidates()
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "trainoracle.plan-beta.v1") return
      return realSetItem.call(this, key, value)
    })
    const [choice] = screen.getAllByRole("button", { name: /선택하기/u })
    if (choice === undefined) throw new Error("Expected a generated plan choice")

    // When: the athlete chooses the candidate.
    await userEvent.setup().click(choice)

    // Then: the app does not claim that the plan was saved.
    expect(screen.getByRole("alert")).toHaveTextContent("계획을 이 기기에 저장하지 못했어요")
    expect(screen.getByRole("button", { name: "계획 다시 저장하기" })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })
})
