import React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { stateFixture } from "../domain/plan-beta-store.test-fixture"
import * as flow from "../domain/plan-beta-flow"
import { PlanBeta } from "./PlanBeta"
import type { PlanIntake } from "./plan-beta/PlanIntake"
import type { PlanCandidates } from "./plan-beta/PlanCandidates"
import type { PlanActiveState } from "./plan-beta/PlanActiveState"

vi.mock("../domain/plan-beta-store", async importOriginal => ({
  ...await importOriginal<typeof import("../domain/plan-beta-store")>(),
  loadPlanBetaState: () => null,
  loadPreviousIntake: () => ({ ...stateFixture().intake, trainingTimePreference: "EVENING" }),
}))
vi.mock("./plan-beta/plan-selection", () => ({
  saveSelectedPlanCandidate: async () => ({ kind: "saved", state: stateFixture() }),
}))
// Child stubs isolate the parent lifecycle; production persistence has separate round-trip tests.
vi.mock("./plan-beta/PlanIntake", () => ({ PlanIntake: (props: React.ComponentProps<typeof PlanIntake>) => <>
  <button onClick={() => props.onSafety("NO_KNOWN_RISK")}>상태 확인</button>
  <button onClick={() => props.onRaceDate?.(undefined)}>계획 생성</button>
</> }))
vi.mock("./plan-beta/PlanCandidates", () => ({ PlanCandidates: (props: React.ComponentProps<typeof PlanCandidates>) => <>
  <button onClick={() => props.onChangeSessionTarget?.({ day: 2, slot: "PM" })}>오후 MAIN 선택</button>
  <button onClick={() => props.onSelect({ candidateId: props.generated.candidates[0].candidateId, startDate: "2026-09-05" })}>저장</button>
</> }))
vi.mock("./plan-beta/PlanActiveState", () => ({ PlanActiveState: (props: React.ComponentProps<typeof PlanActiveState>) =>
  <button onClick={() => props.onArchived({ ...stateFixture().intake, trainingTimePreference: "MORNING" })}>다음 계획</button>,
}))

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it("does not carry a prior PM target into a newly archived morning plan", async () => {
  const generated = vi.spyOn(flow, "generatePlanFromDraft")
  render(<PlanBeta />)
  fireEvent.click(screen.getByRole("button", { name: "상태 확인" }))
  fireEvent.click(screen.getByRole("button", { name: "계획 생성" }))
  fireEvent.click(screen.getByRole("button", { name: "오후 MAIN 선택" }))
  expect(generated.mock.calls.at(-1)?.[3]).toEqual({ day: 2, slot: "PM" })
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "다음 계획" })).toBeInTheDocument())
  fireEvent.click(screen.getByRole("button", { name: "다음 계획" }))
  fireEvent.click(screen.getByRole("button", { name: "상태 확인" }))
  fireEvent.click(screen.getByRole("button", { name: "계획 생성" }))
  expect(generated.mock.calls.at(-1)?.[0].trainingTimePreference).toBe("MORNING")
  expect(generated.mock.calls.at(-1)?.[3]).toBeUndefined()
})
