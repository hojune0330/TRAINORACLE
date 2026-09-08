import React from "react"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ owner: "A" as string | null, listeners: new Set<() => void>(),
  journal: vi.fn(), decoration: vi.fn(), plan: vi.fn(), rewards: vi.fn(),
  disposeJournal: vi.fn(), disposeDecoration: vi.fn(), disposePlan: vi.fn(), disposeRewards: vi.fn(), visit: vi.fn() }))
vi.mock("./local-journal-ownership", () => ({ activeLocalAccount: () => state.owner,
  onLocalJournalScopeChange: (listener: () => void) => { state.listeners.add(listener); return () => state.listeners.delete(listener) } }))
vi.mock("./account-journal-record-service", () => ({ accountJournalRecordsEnabled: () => state.owner !== null,
  hydrateAccountJournalRecords: state.journal, disposeAccountJournalRecords: state.disposeJournal }))
vi.mock("./account-decoration-service", () => ({ hydrateAccountDecorations: state.decoration, disposeAccountDecorations: state.disposeDecoration }))
vi.mock("./account-plan-service", () => ({ accountPlanService: () => state.owner ? { hydrate: state.plan } : null, disposeAccountPlans: state.disposePlan }))
vi.mock("./account-reward-service", () => ({ hydrateAccountRewards: state.rewards, disposeAccountRewards: state.disposeRewards,
  recordAccountDailyVisit: state.visit }))
import { useAccountJournalRuntime } from "./useAccountJournalRuntime"
function Harness({ enabled = true }) { useAccountJournalRuntime(enabled); return <span>runtime</span> }
beforeEach(() => { state.owner = "A"; state.listeners.clear(); vi.clearAllMocks() })
afterEach(cleanup)

it("hydrates every account projection on opening and reconnect, without awarding a visit", () => {
  const page = render(<Harness />)
  for (const read of [state.journal, state.decoration, state.plan, state.rewards]) expect(read).toHaveBeenCalledTimes(1)
  act(() => window.dispatchEvent(new Event("online")))
  for (const read of [state.journal, state.decoration, state.plan, state.rewards]) expect(read).toHaveBeenCalledTimes(2)
  expect(state.visit).not.toHaveBeenCalled()
  page.unmount()
  act(() => window.dispatchEvent(new Event("online")))
  expect(state.plan).toHaveBeenCalledTimes(2)
  expect(state.listeners.size).toBe(0)
})

it("disposes all projections on each owner transition including A-B-A and logout", () => {
  render(<Harness />)
  for (const owner of ["B", "A", null]) act(() => {
    state.owner = owner
    for (const listener of [...state.listeners]) listener()
  })
  for (const dispose of [state.disposeJournal, state.disposeDecoration, state.disposePlan, state.disposeRewards])
    expect(dispose).toHaveBeenCalledTimes(3)
  for (const read of [state.journal, state.decoration, state.plan, state.rewards]) expect(read).toHaveBeenCalledTimes(3)
  expect(state.visit).not.toHaveBeenCalled()
})
