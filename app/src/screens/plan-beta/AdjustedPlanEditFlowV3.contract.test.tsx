import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AdjustedPlanEditFlowV3 } from "./AdjustedPlanEditFlowV3"
import { adjustedPlanSelectionV3Fixture } from "../../domain/adjusted-plan-selection-v3.test-fixtures"
import { activePlanBetaStorageKey } from "../../domain/plan-beta-store"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
import type { PlanMutationLockManager } from "../../domain/plan-mutation-lock"
const locks: PlanMutationLockManager = { request: async (_n, _o, callback) => callback({}) }
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY)
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", "") } })
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open") } })
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.useRealTimers()
  for (const [key, descriptor] of [["showModal", show], ["close", close]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  }
})
function setup() {
  const { request, policy, retained } = adjustedPlanSelectionV3Fixture()
  return { seed: request, readReview: () => ({ source: request.preparation.source,
    explanation: request.preparation.explanation, policies: [policy], retained: [retained] }),
    isCurrentDraft: () => true, locks, onSaved: vi.fn(), onCancel: vi.fn() }
}
async function stage() {
  fireEvent.click(screen.getAllByRole("radio").at(-1)!)
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "변경안 적용" })) })
}
it("stages the actual V3 editor without saving, then persists only after final confirmation", async () => {
  const props = setup()
  render(<AdjustedPlanEditFlowV3 {...props} />)
  await stage()
  expect(screen.getByRole("heading", { name: "이 훈련 구성으로 계획을 저장할까요?" })).toBeVisible()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(props.onSaved).toHaveBeenCalledOnce()
  expect(JSON.parse(localStorage.getItem(activePlanBetaStorageKey())!).version).toBe(5)
})
it("cancels the staged V3 plan without changing active storage", async () => {
  const props = setup()
  render(<AdjustedPlanEditFlowV3 {...props} />)
  await stage()
  fireEvent.click(screen.getByRole("button", { name: "후보로 돌아가기" }))
  expect(props.onCancel).toHaveBeenCalledOnce()
  expect(props.onSaved).not.toHaveBeenCalled()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})
it("rejects a stale outer candidate after staging", async () => {
  const props = setup(); let current = true
  render(<AdjustedPlanEditFlowV3 {...props} isCurrentDraft={() => current} />)
  await stage(); current = false
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(props.onSaved).not.toHaveBeenCalled()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  expect(screen.getByRole("alert")).toBeVisible()
})
