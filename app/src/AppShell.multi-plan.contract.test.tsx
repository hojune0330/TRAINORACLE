import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"
import App from "./App"
import { PlanBeta } from "./screens/PlanBeta"
import { stateFixture } from "./domain/plan-beta-store.test-fixture"
import { savePlanBetaState } from "./domain/plan-beta-store"

const { planProps, planMode } = vi.hoisted(() => ({ planProps: vi.fn(), planMode: { actual: false } }))
vi.mock("./DeferredMobileScreens", () => ({ DeferredMobileScreens: {
  PlanProposalInbox: () => null,
  PlanBeta: (props: React.ComponentProps<typeof PlanBeta>) => {
    planProps(props)
    return planMode.actual ? <PlanBeta {...props} /> : <h1>계획 연결 검수</h1>
  },
} }))
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); planProps.mockClear(); planMode.actual = false })
afterEach(cleanup)

it.each([false, true].flatMap(supplied => [App, AppShell].map(Component => ({ supplied, Component }))))("forwards only explicitly supplied plan services through application navigation: $supplied $Component.name", ({ supplied, Component }) => {
  const resolver = vi.fn(() => null), readEvidence = vi.fn(() => [])
  render(<Component multiPlanRuntime={supplied ? {
    multiAdjustmentResolverV3: resolver, readMultiAdjustedEvidenceV3: readEvidence,
  } : undefined} />)
  // A home without a plan does not read calendar evidence. Forwarding itself
  // must not invoke either service.
  expect(readEvidence).not.toHaveBeenCalled()
  expect(resolver).not.toHaveBeenCalled()
  readEvidence.mockClear()
  fireEvent.click(screen.getByRole("button", { name: "훈련" }))
  expect(screen.getByRole("heading", { name: "계획 연결 검수" })).toBeTruthy()
  const forwarded = planProps.mock.calls.at(-1)![0]
  expect(forwarded.multiAdjustmentResolverV3).toBe(supplied ? resolver : undefined)
  expect(forwarded.readMultiAdjustedEvidenceV3).toBe(supplied ? readEvidence : undefined)
  expect(resolver).not.toHaveBeenCalled()
  expect(readEvidence).not.toHaveBeenCalled()
  expect(typeof forwarded.onWritePlannedSessionLog).toBe("function")
})

it("queries the supplied evidence reader when the actual next-training plan screen opens", () => {
  const state = stateFixture(), today = new Date()
  const startDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-")
  expect(savePlanBetaState({ ...state, intake: { ...state.intake, startDate } }).ok).toBe(true)
  const resolver = vi.fn(() => null), readEvidence = vi.fn(() => [])
  planMode.actual = true
  render(<AppShell multiPlanRuntime={{ multiAdjustmentResolverV3: resolver, readMultiAdjustedEvidenceV3: readEvidence }} />)
  const nextTraining = screen.getByRole("button", { name: /^다음 훈련 ·/u })
  expect(readEvidence).not.toHaveBeenCalled()
  fireEvent.click(nextTraining)
  expect(planProps.mock.calls.at(-1)![0].returnToSession).toMatchObject({ plannedDate: startDate, sessionDay: 1, sessionSlot: "AM" })
  expect(readEvidence).toHaveBeenCalled()
  expect(resolver).not.toHaveBeenCalled()
})
