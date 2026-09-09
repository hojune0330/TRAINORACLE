import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PLAN_BETA_STORAGE_KEY } from "../../domain/plan-beta-store"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { accountScopedStorageKeyFor } from "../../domain/account/local-account-scope"
import { connectDeviceTrainingData } from "../../domain/account/device-training-data-connection"
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
    render(<DeviceTrainingDataPanel userId={USER_ID} connectData={async (userId) => ({
      ...connectDeviceTrainingData(userId),
      planStorage: "stored_online",
    })} />)

    expect(screen.getByText(/훈련 계획은 먼저 온라인 계정 보관함에 저장하고/u)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "기기 데이터 확인하기" }))
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(source)

    await user.click(screen.getByRole("button", { name: "온라인 보관 및 연결" }))
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(source)
    expect(screen.getByRole("status")).toHaveTextContent("온라인 계정 보관함에 저장했어요")
  })

  it("explains a conflict and preserves both plans", async () => {
    const user = userEvent.setup()
    const devicePlan = JSON.stringify(stateFixture())
    const accountPlan = JSON.stringify({ ...stateFixture(), generatedAt: "2026-08-25T00:00:00.000Z" })
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, devicePlan)
    window.localStorage.setItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID), accountPlan)
    render(<DeviceTrainingDataPanel userId={USER_ID} />)

    await user.click(screen.getByRole("button", { name: "기기 데이터 확인하기" }))
    await user.click(screen.getByRole("button", { name: "온라인 보관 및 연결" }))

    expect(screen.getByRole("status")).toHaveTextContent("계정에 계획이 있어 기기 계획은 그대로 두었어요")
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(devicePlan)
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(accountPlan)
  })

  it("keeps the original and unlocks the control when the online check throws", async () => {
    const user = userEvent.setup()
    const source = JSON.stringify(stateFixture())
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, source)
    render(<DeviceTrainingDataPanel userId={USER_ID} connectData={async () => { throw new Error("network") }} />)

    await user.click(screen.getByRole("button", { name: "기기 데이터 확인하기" }))
    await user.click(screen.getByRole("button", { name: "온라인 보관 및 연결" }))

    expect(screen.getByRole("status")).toHaveTextContent("기기의 원본은 그대로 두었어요")
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(source)
    expect(screen.getByRole("button", { name: "기기 데이터 확인하기" })).toBeEnabled()
  })

  it.each([
    ["conflict", "자동으로 합치지 않았어요"],
    ["capacity", "보관 공간이 가득 차"],
    ["rejected", "저장 요청을 받아들이지 않았어요"],
    ["review_required", "계획 상태를 다시 확인해야 해요"],
    ["invalid", "저장 형식을 확인해야 해요"],
    ["unavailable", "온라인 계획 보관 기능을 사용할 수 없어요"],
    ["failed", "온라인 저장을 완료하지 못했어요"],
  ] as const)("shows the exact online plan outcome for %s", async (planStorage, expected) => {
    const user = userEvent.setup()
    const source = JSON.stringify(stateFixture())
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, source)
    render(<DeviceTrainingDataPanel userId={USER_ID} connectData={async () => ({
      ok: false,
      plan: "preserved",
      records: "none",
      decorations: "none",
      connectedRecords: 0,
      rollbackComplete: true,
      planStorage,
    })} />)

    await user.click(screen.getByRole("button", { name: "기기 데이터 확인하기" }))
    await user.click(screen.getByRole("button", { name: "온라인 보관 및 연결" }))

    expect(screen.getByRole("status")).toHaveTextContent(expected)
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(source)
  })
})
