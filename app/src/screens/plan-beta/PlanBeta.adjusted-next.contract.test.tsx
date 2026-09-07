import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { PlanBeta, type PlanAdjustmentResolver } from "../PlanBeta"
import { adjustedSuccessorFixture } from "../../domain/adjusted-plan-successor.test-fixtures"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage } from "../../domain/plan-beta-store"
import { readAdjustedOriginalPlans } from "../../domain/adjusted-plan-archive"
import { loadAthleteRecords } from "../../domain/athlete-records"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"

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
async function setup(resolverKind: "valid" | "missing" | "mismatch" = "valid") {
  const fixture = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
  const resolver: PlanAdjustmentResolver = () => ({ seed: resolverKind === "mismatch"
    ? { ...fixture.next.request, preparation: { ...fixture.next.request.preparation, startDate: "2026-09-08" } }
    : fixture.next.request, readReview: fixture.input.readReview, locks: fixture.input.locks })
  render(<PlanBeta adjustmentResolver={resolverKind === "missing" ? undefined : resolver}
    readAdjustedEvidence={() => fixture.retained} />)
  fireEvent.click(screen.getByRole("button", { name: "다음 주기 준비" }))
  return fixture
}
function generate() {
  fireEvent.click(screen.getByRole("radio", { name: "알고 있는 통증이나 이상이 없어요" }))
  fireEvent.change(screen.getByLabelText("추천 페이스에 사용할 경기 기록"), { target: { value: loadAthleteRecords()[0]!.id } })
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 비교하기" }))
}
it("uses the mounted schedule, next generation, editor and confirmation to advance the real stored plan", async () => {
  const { old, retained } = await setup()
  expect(screen.getByRole("button", { name: "다음 계획 비교하기" })).toBeDisabled()
  expect(screen.getByLabelText("추천 페이스에 사용할 경기 기록")).toHaveValue("")
  generate()
  expect(screen.getByRole("heading", { name: "다음 계획을 비교해 주세요" })).toBeVisible()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  fireEvent.click(screen.getByRole("button", { name: "시간 조절 계획 조정하기" }))
  fireEvent.click(screen.getAllByRole("radio").at(-1)!)
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "적용" })) })
  expect(screen.getByRole("heading", { name: "이 구성으로 다음 계획을 저장할까요?" })).toBeVisible()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeVisible()
  expect(readPlanBetaStateFromStorage(retained)).toMatchObject({ kind: "adjusted_loaded",
    state: { selection: { periodization: { frameOrdinal: 2 } } } })
  expect(readAdjustedOriginalPlans(retained)).toMatchObject({ kind: "loaded", entries: [{ state: old.state }] })
}, 15000)
it("cancel returns to the actual old schedule without storing or archiving a draft", async () => {
  const { old, retained } = await setup()
  generate()
  fireEvent.click(screen.getByRole("button", { name: "현재 일정으로" }))
  expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeVisible()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(readAdjustedOriginalPlans(retained)).toMatchObject({ kind: "loaded", entries: [] })
})
it("rejects a predecessor changed after the editor's final confirmation opened", async () => {
  await setup()
  generate()
  fireEvent.click(screen.getByRole("button", { name: "시간 조절 계획 조정하기" }))
  fireEvent.click(screen.getAllByRole("radio").at(-1)!)
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "적용" })) })
  localStorage.setItem(activePlanBetaStorageKey(), "{other-writer")
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(screen.getByRole("alert")).toHaveTextContent("적용하지 않았어요")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe("{other-writer")
}, 15000)
it("does not turn absent or mismatched review providers into legacy selection", async () => {
  const { old } = await setup("mismatch")
  generate()
  fireEvent.click(screen.getByRole("button", { name: "시간 조절 계획 조정하기" }))
  expect(screen.getByRole("alert")).toHaveTextContent("검토 근거를 확인하지 못했어요")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
})
it("makes the missing operating connection explicit without changing the old plan", async () => {
  const { old } = await setup("missing")
  generate()
  expect(screen.getByRole("button", { name: "시간 조절 계획 조정하기" })).toBeDisabled()
  expect(screen.getByRole("status")).toHaveTextContent("검토된 구성 연결을 준비 중")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
})
it("rejects current risk and storage changes, and clears an open draft on account change", async () => {
  const { old } = await setup()
  fireEvent.click(screen.getByRole("radio", { name: "통증·이상이 있거나 잘 모르겠어요" }))
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 비교하기" }))
  expect(screen.getByRole("alert")).toBeVisible()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  generate()
  localStorage.setItem(activePlanBetaStorageKey(), "{changed")
  fireEvent.click(screen.getByRole("button", { name: "시간 조절 계획 조정하기" }))
  expect(screen.getByRole("alert")).toHaveTextContent("계획이 이미 바뀌었어요")
  act(() => setActiveLocalAccount("another-account"))
  expect(screen.queryByRole("heading", { name: "다음 계획을 비교해 주세요" })).toBeNull()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})
