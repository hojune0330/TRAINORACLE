import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AdjustedPlanApplyReview } from "./AdjustedPlanApplyReview"
import { adjustedPlanSelectionFixture } from "../../domain/adjusted-plan-selection.test-fixtures"
import { activePlanBetaStorageKey } from "../../domain/plan-beta-store"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
import type { PlanMutationLockManager } from "../../domain/plan-mutation-lock"
const locks: PlanMutationLockManager = { request: async (_n, _o, callback) => callback({}) }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
function setup() {
  const { request, review } = adjustedPlanSelectionFixture()
  return { request, readReview: () => review, isCurrentDraft: () => true, locks,
    onSaved: vi.fn(), onCancel: vi.fn() }
}
it("saves the exact reviewed plan only after the final explicit button", async () => {
  const props = setup()
  render(<AdjustedPlanApplyReview {...props} />)
  expect(screen.getByText(/400m당 약/)).toBeVisible()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(props.onSaved).toHaveBeenCalledOnce()
  const saved = JSON.parse(localStorage.getItem(activePlanBetaStorageKey())!)
  expect(saved.selection.activePlan.sessions.some((session: {prescription: {kind: string}}) => session.prescription.kind === "ADJUSTED_METHOD")).toBe(true)
})
it("cancels without any active-plan write", () => {
  const props = setup()
  render(<AdjustedPlanApplyReview {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "돌아가기" }))
  expect(props.onCancel).toHaveBeenCalledOnce()
  expect(props.onSaved).not.toHaveBeenCalled()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})
it("rejects a stale draft while keeping the preview available", async () => {
  const props = setup()
  let current = true
  render(<AdjustedPlanApplyReview {...props} isCurrentDraft={() => current} />)
  current = false
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(screen.getByRole("alert")).toHaveTextContent("계획을 적용하지 않았어요")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  expect(props.onSaved).not.toHaveBeenCalled()
})
it("cancels an in-flight request before the storage lock is granted", async () => {
  const props = setup()
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const delayed: PlanMutationLockManager = { request: async (_n, _o, callback) => { await pending; return callback({}) } }
  render(<AdjustedPlanApplyReview {...props} locks={delayed} />)
  fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" }))
  fireEvent.click(screen.getByRole("button", { name: "돌아가기" }))
  await act(async () => { release(); await pending })
  expect(props.onSaved).not.toHaveBeenCalled()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})
