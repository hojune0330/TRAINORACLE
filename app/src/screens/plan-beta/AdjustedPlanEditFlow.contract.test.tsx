import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AdjustedPlanEditFlow } from "./AdjustedPlanEditFlow"
import { adjustedPlanSelectionFixture } from "../../domain/adjusted-plan-selection.test-fixtures"
import { activePlanBetaStorageKey } from "../../domain/plan-beta-store"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
import type { PlanMutationLockManager } from "../../domain/plan-mutation-lock"
const locks: PlanMutationLockManager = { request: async (_n, _o, callback) => callback({}) }
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY)
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", "") } })
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open") } })
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.useRealTimers()
  for (const [key, descriptor] of [["showModal", show], ["close", close]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  }
})
function setup() {
  const { request, review } = adjustedPlanSelectionFixture()
  return { seed: request, readReview: () => review, isCurrentDraft: () => true, locks, onSaved: vi.fn(), onCancel: vi.fn() }
}
async function stage() {
  fireEvent.click(screen.getAllByRole("radio").at(-1)!)
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "적용" })) })
}
it("runs the real editor through final confirmation to actual active storage", async () => {
  const props = setup()
  render(<AdjustedPlanEditFlow {...props} />)
  await stage()
  expect(screen.getByRole("heading", { name: "변경한 훈련을 계획에 적용할까요?" })).toBeVisible()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  expect(screen.getByText(/400m당 약/)).toBeVisible()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(props.onSaved).toHaveBeenCalledOnce()
  const saved = JSON.parse(localStorage.getItem(activePlanBetaStorageKey())!)
  const adjusted = saved.selection.activePlan.sessions.find((session: {prescription: {kind: string}}) => session.prescription.kind === "ADJUSTED_METHOD")
  expect(adjusted.prescription.snapshot.receipt.afterTotals.qualityDistanceM).toBe(800)
})
it("cancels after editing without saving a plan", async () => {
  const props = setup()
  render(<AdjustedPlanEditFlow {...props} />)
  await stage()
  fireEvent.click(screen.getByRole("button", { name: "돌아가기" }))
  expect(props.onCancel).toHaveBeenCalledOnce()
  expect(props.onSaved).not.toHaveBeenCalled()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})
it("rejects a changed plan context between editing and final selection", async () => {
  const props = setup()
  let current = true
  render(<AdjustedPlanEditFlow {...props} isCurrentDraft={() => current} />)
  await stage(); current = false
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(screen.getByRole("alert")).toHaveTextContent("계획을 적용하지 않았어요")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})
