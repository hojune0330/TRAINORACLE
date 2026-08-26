import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PLAN_BETA_STORAGE_KEY } from "../../domain/plan-beta-store"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { accountScopedStorageKeyFor } from "../../domain/account/local-account-scope"
import { DeviceTrainingDataPanel } from "./DeviceTrainingDataPanel"

const USER_ID = "athlete-a"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  setActiveLocalAccount(USER_ID)
})

afterEach(() => {
  cleanup()
  setActiveLocalAccount(null)
})

describe("device training data connection panel", () => {
  it("requires two clear taps before it changes device ownership", async () => {
    const user = userEvent.setup()
    const source = JSON.stringify(stateFixture())
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, source)
    render(<DeviceTrainingDataPanel userId={USER_ID} />)

    expect(screen.getByText(/자동으로 계정에 넣지 않았어요/u)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "기기 데이터 확인하기" }))
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(source)

    await user.click(screen.getByRole("button", { name: "이 계정에 연결" }))
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(source)
    expect(screen.getByRole("status")).toHaveTextContent("기기 훈련 계획을 연결했어요")
  })

  it("explains a conflict and preserves both plans", async () => {
    const user = userEvent.setup()
    const devicePlan = JSON.stringify(stateFixture())
    const accountPlan = JSON.stringify({ ...stateFixture(), generatedAt: "2026-08-25T00:00:00.000Z" })
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, devicePlan)
    window.localStorage.setItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID), accountPlan)
    render(<DeviceTrainingDataPanel userId={USER_ID} />)

    await user.click(screen.getByRole("button", { name: "기기 데이터 확인하기" }))
    await user.click(screen.getByRole("button", { name: "이 계정에 연결" }))

    expect(screen.getByRole("status")).toHaveTextContent("계정에 계획이 있어 기기 계획은 그대로 두었어요")
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(devicePlan)
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(accountPlan)
  })
})
