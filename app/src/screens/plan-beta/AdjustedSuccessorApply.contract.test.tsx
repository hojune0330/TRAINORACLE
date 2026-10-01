import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { AdjustedPlanApplyReview } from "./AdjustedPlanApplyReview"
import { adjustedSuccessorFixture } from "../../domain/adjusted-plan-successor.test-fixtures"
import { readPlanBetaStateFromStorage, activePlanBetaStorageKey } from "../../domain/plan-beta-store"
import { readAdjustedOriginalPlans } from "../../domain/adjusted-plan-archive"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
import { PlanBeta } from "../PlanBeta"
import { loadAthleteRecords } from "../../domain/athlete-records"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

it("V4 schedule opens the real next-flow resolver, rebinds detail and saves only after environment confirmation", async () => {
  const { input, old, retained } = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
  const resolver = vi.fn(() => ({ seed: input.request, readReview: input.readReview, locks: input.locks }))
  render(<PlanBeta readAdjustedEvidence={() => retained} adjustmentResolver={resolver} />)
  fireEvent.click(screen.getByRole("button", { name: "다음 주기 준비" }))
  fireEvent.click(screen.getByRole("radio", { name: "알고 있는 통증이나 이상이 없어요" }))
  fireEvent.change(screen.getByLabelText("추천 페이스에 사용할 경기 기록"), { target: { value: loadAthleteRecords()[0]!.id } })
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 비교하기" }))
  fireEvent.click(screen.getAllByRole("button", { name: /구성 확인$/u })[0]!)
  expect(resolver).toHaveBeenCalledOnce()
  expect(screen.getByRole("heading", { name: "이 구성으로 다음 계획을 저장할까요?" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "이 구성으로 계획 저장" })).toBeDisabled()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  fireEvent.click(screen.getByRole("checkbox", { name: "다음 날짜에도 이 훈련에 필요한 장소와 시간을 확보했어요" }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeInTheDocument()
  expect(readPlanBetaStateFromStorage(retained)).toMatchObject({ kind: "adjusted_loaded", state: { selection: { periodization: { frameOrdinal: 2 } } } })
}, 20000)

it("changing cycle evidence props invalidates the opened confirmation", async () => {
  const { input, old } = await adjustedSuccessorFixture(date => vi.setSystemTime(date)), saved = vi.fn()
  const view = render(<AdjustedPlanApplyReview {...input} onSaved={saved} onCancel={vi.fn()} />)
  view.rerender(<AdjustedPlanApplyReview {...input} cycleDraft={{ version: 1, sourceFingerprint: "changed" }} onSaved={saved} onCancel={vi.fn()} />)
  fireEvent.click(screen.getByRole("checkbox", { name: "다음 날짜에도 이 훈련에 필요한 장소와 시간을 확보했어요" }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(saved).not.toHaveBeenCalled()
  expect(screen.getByRole("alert")).toBeInTheDocument()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
}, 20000)

it("final confirmation archives and advances using the actual successor store", async () => {
  const { input, old, retained } = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
  const saved = vi.fn()
  render(<AdjustedPlanApplyReview {...input} onSaved={saved} onCancel={vi.fn()} />)
  expect(screen.getByRole("heading", { name: "이 구성으로 다음 계획을 저장할까요?" })).toBeTruthy()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(screen.getByRole("button", { name: "이 구성으로 계획 저장" }).hasAttribute("disabled")).toBe(true)
  fireEvent.click(screen.getByRole("checkbox", { name: "다음 날짜에도 이 훈련에 필요한 장소와 시간을 확보했어요" }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(saved).toHaveBeenCalledTimes(1)
  expect(readPlanBetaStateFromStorage(retained)).toMatchObject({ kind: "adjusted_loaded",
    state: { selection: { periodization: { frameOrdinal: 2 }, continuation: { predecessorFingerprint: old.state.contentFingerprint } } } })
  expect(readAdjustedOriginalPlans(retained)).toMatchObject({ kind: "loaded", entries: [{ state: old.state }] })
})

it("cancel keeps the prior plan and changing predecessor props rejects the opened review", async () => {
  const { input, old } = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
  const saved = vi.fn()
  const cancel = vi.fn()
  const view = render(<AdjustedPlanApplyReview {...input} onSaved={saved} onCancel={cancel} />)
  fireEvent.click(screen.getByRole("button", { name: "돌아가기" }))
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  view.unmount()
  const next = render(<AdjustedPlanApplyReview {...input} onSaved={saved} onCancel={cancel} />)
  next.rerender(<AdjustedPlanApplyReview {...input} expectedPredecessorFingerprint="changed" onSaved={saved} onCancel={cancel} />)
  fireEvent.click(screen.getByRole("checkbox", { name: "다음 날짜에도 이 훈련에 필요한 장소와 시간을 확보했어요" }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(saved).not.toHaveBeenCalled()
  expect(screen.getByRole("alert").textContent).toContain("적용하지 않았어요")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
})
