import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import type { PlanBetaStateV3 } from "../../domain/plan-beta-schema"
import { ActivePlanSessionEditor } from "./ActivePlanSessionEditor"

afterEach(cleanup)

it("stages a real catalog choice without writing, while retaining unstarted and preview gates", () => {
  const source = stateFixture() as PlanBetaStateV3
  const state = { ...source, intake: { ...source.intake, startDate: "2026-10-02" } }
  const onPrepare = vi.fn(), onApply = vi.fn()
  render(<ActivePlanSessionEditor state={state} entriesReady intent="workout" contextKey="real-picker"
    sourceOptions={[{ address: { day: 1, slot: "AM" }, date: "2026-10-02", role: "EASY", actions: ["CATALOG"], swapTargets: [] }]}
    onRetryEntries={vi.fn()} onPrepare={onPrepare} onApply={onApply} onClose={vi.fn()} onApplied={vi.fn()} records={[]} />)
  expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }))
  fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "P-BASE-C" } })
  expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeEnabled()
  fireEvent.click(screen.getByRole("button", { name: "이 구성으로 바꾸기" }))
  expect(screen.getByRole("button", { name: "변경안 미리보기" })).toBeEnabled()
  expect(onPrepare).not.toHaveBeenCalled()
  expect(onApply).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }))
  expect(screen.getByRole("button", { name: "변경안 미리보기" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
})
