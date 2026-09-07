import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { AdjustedPlanApplyReview } from "./AdjustedPlanApplyReview"
import { adjustedSuccessorFixture } from "../../domain/adjusted-plan-successor.test-fixtures"
import { readPlanBetaStateFromStorage, activePlanBetaStorageKey } from "../../domain/plan-beta-store"
import { readAdjustedOriginalPlans } from "../../domain/adjusted-plan-archive"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

it("final confirmation archives and advances using the actual successor store", async () => {
  const { input, old, retained } = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
  const saved = vi.fn()
  render(<AdjustedPlanApplyReview {...input} onSaved={saved} onCancel={vi.fn()} />)
  expect(screen.getByRole("heading", { name: "이 구성으로 다음 계획을 저장할까요?" })).toBeTruthy()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
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
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(saved).not.toHaveBeenCalled()
  expect(screen.getByRole("alert").textContent).toContain("적용하지 않았어요")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
})
