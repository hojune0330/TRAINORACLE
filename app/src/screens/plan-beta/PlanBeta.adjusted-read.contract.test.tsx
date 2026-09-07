import React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { PlanBeta } from "../PlanBeta"
import { adjustedPlanSelectionFixture } from "../../domain/adjusted-plan-selection.test-fixtures"
import type { RetainedAdjustedPlanEvidence } from "../../domain/adjusted-plan-selection"
import { saveSelectedAdjustedPlan } from "../../domain/adjusted-plan-store"
import { activePlanBetaStorageKey } from "../../domain/plan-beta-store"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"

const context = vi.hoisted(() => ({ retained: [] as readonly RetainedAdjustedPlanEvidence[] }))
vi.mock("../../domain/plan-beta-store", async importOriginal => {
  const original = await importOriginal<typeof import("../../domain/plan-beta-store")>()
  return { ...original, readPlanBetaStateFromStorage: () => original.readPlanBetaStateFromStorage(context.retained) }
})
vi.mock("../../domain/adjusted-plan-progress", async importOriginal => {
  const original = await importOriginal<typeof import("../../domain/adjusted-plan-progress")>()
  return { ...original, saveAdjustedPlanProgress: (input: Parameters<typeof original.saveAdjustedPlanProgress>[0]) =>
    original.saveAdjustedPlanProgress({ ...input, retained: context.retained,
      locks: { request: async (_n, _o, callback) => callback({}) } }) }
})
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); context.retained = [] })
async function save() {
  const { request, review, retained } = adjustedPlanSelectionFixture()
  context.retained = retained
  const saved = await saveSelectedAdjustedPlan({ request, readReview: () => review, isCurrentDraft: () => true,
    locks: { request: async (_n, _o, callback) => callback({}) } })
  if (saved.kind !== "saved") throw Error(saved.code)
  const session = saved.state.selection.activePlan.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD")!
  return { saved, link: createPlannedSessionLogDraft(saved.state.selection, session, TODAY.toISOString())! }
}
it("reopens a real saved adjustment in PlanBeta and links the exact session to a journal", async () => {
  const { link } = await save()
  const onWrite = vi.fn()
  const before = Object.entries(localStorage)
  render(<PlanBeta returnToSession={link.link} onWritePlannedSessionLog={onWrite} />)
  expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeVisible()
  expect(screen.getByText(/400m당 약/)).toBeVisible()
  expect(screen.queryByText(/두 계획에서 하나/)).toBeNull()
  const sessions = screen.getAllByRole("region", { name: /오전 훈련|오후 훈련/ })
  expect(sessions[0]).toHaveAttribute("aria-label", "오전 훈련")
  fireEvent.click(within(screen.getByRole("region", { name: link.link.sessionSlot === "AM" ? "오전 훈련" : "오후 훈련" }))
    .getByRole("button", { name: "이 훈련 일지 쓰기" }))
  expect(onWrite).toHaveBeenCalledWith(link)
  expect(Object.entries(localStorage)).toEqual(before)
})
it("does not treat unreadable saved plans as an empty intake or delete them", () => {
  localStorage.setItem(activePlanBetaStorageKey(), "{broken")
  render(<PlanBeta />)
  expect(screen.getByRole("alert")).toHaveTextContent("계획을 지우거나 새 계획으로 바꾸지 않았어요")
  fireEvent.click(screen.getByRole("button", { name: "다시 확인" }))
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe("{broken")
})
it("keeps the current intake step when another tab stores unrelated data", () => {
  render(<PlanBeta />)
  fireEvent.click(screen.getByRole("button", { name: /^5000m/ }))
  expect(screen.getByRole("button", { name: /일반부/ })).toBeVisible()
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.previous-intake" })))
  expect(screen.getByRole("button", { name: /일반부/ })).toBeVisible()
  expect(screen.queryByRole("button", { name: /^800m/ })).toBeNull()
})
it("clears the previous account's adjusted numbers immediately on scope change", async () => {
  const { link } = await save()
  render(<PlanBeta returnToSession={link.link} />)
  expect(screen.getByText(/400m당 약/)).toBeVisible()
  act(() => setActiveLocalAccount("another-athlete"))
  expect(screen.queryByText(/400m당 약/)).toBeNull()
})
it("rechecks changed storage instead of retaining a corrupted adjusted view", async () => {
  const { link } = await save()
  render(<PlanBeta returnToSession={link.link} />)
  localStorage.setItem(activePlanBetaStorageKey(), "{broken")
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: activePlanBetaStorageKey() })))
  expect(screen.queryByText(/400m당 약/)).toBeNull()
  expect(screen.getByRole("alert")).toBeVisible()
})
it("rechecks storage on journal click even without a storage event", async () => {
  const { link } = await save()
  const onWrite = vi.fn()
  render(<PlanBeta returnToSession={link.link} onWritePlannedSessionLog={onWrite} />)
  localStorage.setItem(activePlanBetaStorageKey(), "{broken")
  fireEvent.click(screen.getAllByRole("button", { name: "이 훈련 일지 쓰기" })[0]!)
  expect(onWrite).not.toHaveBeenCalled()
  expect(screen.getByRole("alert")).toBeVisible()
})
it("downloads a separate personal plan file only after the explicit download action", async () => {
  const { saved } = await save()
  const descriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL")
  const create = vi.fn(() => "blob:test-plan")
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create })
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
  try {
    render(<PlanBeta readAdjustedEvidence={() => context.retained} />)
    expect(create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("저장과 이용 안내"))
    expect(screen.getByText(/현재 일정으로 자동 적용하지 않아요/)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "개인 보관용 계획 파일 받기" }))
    expect(create).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem(activePlanBetaStorageKey())!).selection).toEqual(saved.state.selection)
  } finally {
    if (descriptor) Object.defineProperty(URL, "createObjectURL", descriptor)
    else Reflect.deleteProperty(URL, "createObjectURL")
  }
})
it("records an explicit outcome from PlanBeta without moving the selected date or changing the prescription", async () => {
  const { link, saved } = await save()
  render(<PlanBeta returnToSession={link.link} />)
  const group = screen.getByRole("group", { name: "오전 진행 기록" })
  const complete = within(group).getByRole("button", { name: "완료" })
  await act(async () => { fireEvent.click(complete) })
  expect(screen.getByText(/400m당 약/)).toBeVisible()
  expect(within(screen.getByRole("group", { name: "오전 진행 기록" })).getByRole("button", { name: "완료" }))
    .toHaveAttribute("aria-pressed", "true")
  const stored = JSON.parse(localStorage.getItem(activePlanBetaStorageKey())!)
  expect(stored.selection).toEqual(saved.state.selection)
  expect(stored.progress).toEqual([{ sessionDay: link.link.sessionDay, sessionSlot: "AM", state: "COMPLETED" }])
})
