import React from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PlanBeta } from "../PlanBeta"
import { ACCOUNT_PLAN_EVENT } from "../../domain/account/account-plan-service"
import { createAccountPlanCollectionService } from "../../domain/account/account-plan-collection-service"
import { collectionServer, collectionMemoryBuffers, COLLECTION_OWNER } from "../../domain/account/account-plan-collection.test-support"
import { accountPlanEntry, emptyAccountPlanDocument } from "../../domain/account/account-plan-document-schema"
import { replacedReplanFixture } from "../../domain/execution-replan-lineage.test-fixture"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import type { JournalEntry } from "../../domain/journal-schema"
import { resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../../domain/account/account-journal-projection"

const runtime = vi.hoisted(() => ({ service: null as ReturnType<typeof createAccountPlanCollectionService> | null, entries: [] as JournalEntry[] }))
vi.mock("../../domain/account/account-plan-service", async original => ({
  ...await original<typeof import("../../domain/account/account-plan-service")>(),
  accountPlansEnabled: () => true, accountPlanService: () => runtime.service,
}))
vi.mock("../../domain/journal-store", async original => ({
  ...await original<typeof import("../../domain/journal-store")>(), loadEntries: () => runtime.entries,
}))
vi.mock("../../domain/account/plan-cloud-backup", () => ({
  planCloudBackupEnabled: () => false, archivePlanOnServer: async () => {},
  backupActivePlanToServer: async () => ({ kind: "unavailable" }), loadLatestPlanFromServer: async () => ({ kind: "unavailable" }),
}))
vi.mock("../../domain/account/supabase-client", () => ({ supabase: async () => null }))
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(COLLECTION_OWNER)
  resetAccountJournalProjection(COLLECTION_OWNER); setAccountJournalProjectionStatus(COLLECTION_OWNER, "READY")
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-10T03:00:00Z"))
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Synthetic test forbids network") }))
})
afterEach(() => { cleanup(); runtime.service?.close(); runtime.service = null; runtime.entries = []
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setActiveLocalAccount(null); resetAccountJournalProjection(null) })

it("real account history progress does not close an open cycle review; actual plan changes still invalidate it", async () => {
  const f = replacedReplanFixture(), state = structuredClone(f.state), document = emptyAccountPlanDocument()
  state.progress = state.activePlan.sessions.map(s => ({ sessionDay: s.day, sessionSlot: s.slot, state: "COMPLETED" }))
  const current = accountPlanEntry({ state, evidence: null })
  document.data.plans = [...f.archivedPlans.map(p => ({ ...accountPlanEntry({ state: p, evidence: null }), archivedAt: new Date().toISOString() })), current]
  document.data.currentPlanId = current.planId
  runtime.entries = [{ ...f.entries[0]!, rpe: 3, activityOutcome: "COMPLETED", planExecutionRelation: "AS_PLANNED",
    fieldProvenance: { rpe: { provenance: "EXPLICIT" } } }]
  const server = collectionServer(document), stores = collectionMemoryBuffers()
  const service = createAccountPlanCollectionService({ ownerId: COLLECTION_OWNER, isCurrent: () => true,
    client: server.client, buffers: stores.dependencies, legacyBuffer: stores.legacy.buffer,
    runExclusive: async run => run(), yieldTask: async () => {}, online: () => true,
    changed: () => window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT)) })
  runtime.service = service
  expect(await service.hydrate()).toBe(true)
  const loadHistory = vi.spyOn(service, "loadHistory")
  render(<PlanBeta />)
  const user = userEvent.setup()
  await waitFor(() => expect(screen.getByRole("button", { name: "이번 주기 기록 확인" })).toBeEnabled())
  await user.click(screen.getByRole("button", { name: "이번 주기 기록 확인" }))
  await waitFor(() => expect(loadHistory).toHaveBeenCalled())
  await act(async () => { expect(await loadHistory.mock.results[0]!.value).toBe(true) })
  expect(service.snapshot().historyLoaded).toBe(true)
  expect(screen.getByRole("heading", { name: "이번 주기 기록 요약" })).toBeVisible()
  expect(screen.getByText("현재 계획에 연결된 훈련 1건")).toBeVisible()
  expect(service.snapshot().currentPlan?.planId).toBe(current.planId)
  expect(server.commits).toHaveLength(0)

  await act(async () => {
    const changed = structuredClone(state)
    changed.progress[0]!.state = "RESTED"
    expect(await service.mutate({ kind: "PROGRESS", packet: { state: changed, evidence: null } }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  })
  expect(screen.queryByRole("heading", { name: "이번 주기 기록 요약" })).toBeNull()
  expect(server.commits).toHaveLength(1)
}, 20_000)
