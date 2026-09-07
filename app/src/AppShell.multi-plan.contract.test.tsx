import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AppShell, type AppShellMultiPlanRuntime } from "./AppShell"

const { planProps } = vi.hoisted(() => ({ planProps: vi.fn() }))
vi.mock("./DeferredMobileScreens", () => ({ DeferredMobileScreens: {
  PlanProposalInbox: () => null,
  PlanBeta: (props: AppShellMultiPlanRuntime) => { planProps(props); return <h1>계획 연결 검수</h1> },
} }))
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); planProps.mockClear() })
afterEach(cleanup)

it.each([false, true])("forwards only explicitly supplied plan services through real shell navigation: %s", supplied => {
  const resolver = vi.fn(() => null), readEvidence = vi.fn(() => [])
  render(<AppShell multiPlanRuntime={supplied ? {
    multiAdjustmentResolverV3: resolver, readMultiAdjustedEvidenceV3: readEvidence,
  } : undefined} />)
  fireEvent.click(screen.getByRole("button", { name: "계획" }))
  expect(screen.getByRole("heading", { name: "계획 연결 검수" })).toBeTruthy()
  const forwarded = planProps.mock.calls.at(-1)![0]
  expect(forwarded.multiAdjustmentResolverV3).toBe(supplied ? resolver : undefined)
  expect(forwarded.readMultiAdjustedEvidenceV3).toBe(supplied ? readEvidence : undefined)
  expect(resolver).not.toHaveBeenCalled()
  expect(readEvidence).not.toHaveBeenCalled()
  expect(typeof forwarded.onWritePlannedSessionLog).toBe("function")
})
