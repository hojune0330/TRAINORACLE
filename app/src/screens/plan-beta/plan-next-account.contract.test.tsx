import React from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PlanBeta } from "../PlanBeta"
import { ACCOUNT_PLAN_EVENT } from "../../domain/account/account-plan-service"
import { createAccountPlanCollectionService } from "../../domain/account/account-plan-collection-service"
import { collectionServer, collectionMemoryBuffers, COLLECTION_OWNER } from "../../domain/account/account-plan-collection.test-support"
import { accountPlanEntry, emptyAccountPlanDocument, materializeAccountPlan } from "../../domain/account/account-plan-document-schema"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { planBetaStateV3Schema } from "../../domain/plan-beta-schema"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { createInitialPeriodizationContext } from "../../domain/periodization-lineage"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { saveSelectedPlanCandidate } from "./plan-selection"
import { readOriginalPlanAdaptationContext } from "../../domain/plan-adaptation-ui-context"
import { resolveCurrentCycleContext } from "../../domain/plan-current-cycle-context"
import { resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../../domain/account/account-journal-projection"

const runtime = vi.hoisted(() => ({ service: null as ReturnType<typeof createAccountPlanCollectionService> | null }))
vi.setConfig({ testTimeout: 20_000 })
vi.mock("../../domain/account/account-plan-service", async original => ({
  ...await original<typeof import("../../domain/account/account-plan-service")>(),
  accountPlansEnabled: () => true, accountPlanService: () => runtime.service,
}))
vi.mock("../../domain/account/plan-cloud-backup", () => ({
  planCloudBackupEnabled: () => false, archivePlanOnServer: async () => {},
  backupActivePlanToServer: async () => ({ kind: "unavailable" }),
  loadLatestPlanFromServer: async () => ({ kind: "unavailable" }),
}))
vi.mock("../../domain/account/supabase-client", () => ({ supabase: async () => null }))
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(COLLECTION_OWNER)
  resetAccountJournalProjection(COLLECTION_OWNER)
  setAccountJournalProjectionStatus(COLLECTION_OWNER, "READY")
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-01T03:00:00.000Z"))
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Synthetic test forbids network") }))
})
afterEach(() => { cleanup(); runtime.service?.close(); runtime.service = null; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); resetAccountJournalProjection(null); setActiveLocalAccount(null) })

async function fixture() {
  const original = stateFixture()
  const base = planBetaStateV3Schema.parse({ ...original,
    periodization: createInitialPeriodizationContext(original.activePlan.candidateId, original.generatedAt),
    progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] })
  const entry = accountPlanEntry({ state: base, evidence: null }), document = emptyAccountPlanDocument()
  document.data.plans.push(entry); document.data.currentPlanId = entry.planId
  const server = collectionServer(document), stores = collectionMemoryBuffers()
  const service = createAccountPlanCollectionService({ ownerId: COLLECTION_OWNER, isCurrent: () => true,
    client: server.client, buffers: stores.dependencies, legacyBuffer: stores.legacy.buffer,
    runExclusive: async run => run(), yieldTask: async () => {}, online: () => true })
  runtime.service = service
  expect(await service.hydrate()).toBe(true)
  const generated = generatePlanFromDraft(base.intake, "NO_KNOWN_RISK", undefined, undefined, undefined, base)
  if (generated.kind !== "generated") throw Error(`Generation failed: ${JSON.stringify(generated)}`)
  const select = () => saveSelectedPlanCandidate({ candidateId: generated.generated.candidates[0].candidateId, startDate: "2026-10-01" },
    generated.generated, generated.gate, generated.intake, generated.athleteEvidence, () => true, base, generated.cycleDraft)
  return { base, entry, server, service, select }
}

it("selects the next frame through one account transaction and retains the exact predecessor", async () => {
  const { base, entry, server, service, select } = await fixture()
  const localBefore = Object.entries(localStorage)
  expect(server.commits).toHaveLength(0)
  expect((await select()).kind).toBe("saved")
  expect(server.commits).toHaveLength(1)
  expect(await service.loadHistory()).toBe(true)
  const document = service.snapshot().confirmedDocument!
  const previous = document.data.plans.find(plan => plan.planId === entry.planId)!
  expect(previous.archivedAt).not.toBeNull()
  expect(materializeAccountPlan(previous).state).toEqual(base)
  const current = service.snapshot().currentPlan!
  expect(current.kind).toBe("read_only")
  if (current.kind !== "read_only" || current.packet.state.version !== 3) throw Error("Missing current plan")
  expect(current.packet.state.periodization).toMatchObject({ programLineageId: base.periodization!.programLineageId, frameOrdinal: 2 })
  // Only this operation's body-free consent pin may be added; no plan or other
  // local content may be copied as a side effect of selecting an account plan.
  const commit = server.commits[0]
  if (!commit) throw Error("Missing account commit")
  const consentPinKey = `trainoracle.storage-consent-revision.v1:${COLLECTION_OWNER}:${commit.operationId}`
  expect(Object.entries(localStorage)).toEqual([...localBefore, [consentPinKey, "0"]])
})

it("reads an exact historical account pair without selecting or copying its unrelated sibling", async () => {
  const { base, server, service, select } = await fixture()
  expect((await select()).kind).toBe("saved")
  expect(await service.loadHistory()).toBe(true)
  const current = service.snapshot().currentPlan!
  if (current.kind !== "read_only" || current.packet.evidence !== null || current.packet.state.version !== 3) throw Error("Missing saved V3")
  const original = current.packet.state
  expect(await service.mutate({ kind: "ARCHIVE", planId: current.planId }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  const before = server.commits.length
  expect(readOriginalPlanAdaptationContext(original)).toEqual(current.packet.context)
  expect(resolveCurrentCycleContext(original, { kind: "loaded", plans: [] }, readOriginalPlanAdaptationContext))
    .toMatchObject({ kind: "current", origin: { kind: "verified", originalContext: current.packet.context } })
  expect(readOriginalPlanAdaptationContext(base)).toBeNull()
  expect(readOriginalPlanAdaptationContext({ ...original, generatedAt: "2026-09-01T03:00:00.000Z" })).toBeNull()
  expect(server.commits).toHaveLength(before)
  service.close()
  expect(readOriginalPlanAdaptationContext(original)).toBeNull()
})

it("keeps the confirmed predecessor after a lost account response and recovers without a second commit", async () => {
  const { entry, server, service, select } = await fixture()
  server.loseResponse()
  expect(await select()).toMatchObject({ kind: "rejected", code: "ACCOUNT_PLAN_PENDING" })
  expect(service.snapshot().currentPlan?.planId).toBe(entry.planId)
  expect(server.commits).toHaveLength(1)
  expect(await service.retry()).toBe("ACCOUNT")
  expect(server.commits).toHaveLength(1)
  expect(service.snapshot().currentPlan?.planId).not.toBe(entry.planId)
  expect(await service.loadHistory()).toBe(true)
  expect(service.snapshot().confirmedDocument!.data.plans).toHaveLength(2)
})

it.each([false, true])("leaves the pending next-plan screen when the server receipt confirms the new current plan (reopen: %s)", async reopen => {
  const { entry, server, service } = await fixture()
  render(<PlanBeta />)
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" }))
  await user.click(await screen.findByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ }))
  server.loseResponse()
  await user.click(await screen.findByRole("button", { name: "이 일정으로 시작" }))
  await waitFor(() => expect(service.snapshot().status).toBe("PENDING"))
  expect(screen.getByRole("button", { name: "현재 계획으로 돌아가기" })).toBeInTheDocument()
  expect(service.snapshot().currentPlan?.planId).toBe(entry.planId)
  if (reopen) {
    await user.click(screen.getByRole("button", { name: "현재 계획으로 돌아가기" }))
    await user.click(screen.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" }))
    await screen.findByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ })
  }
  await act(async () => {
    expect(await service.retry()).toBe("ACCOUNT")
    window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT))
  })
  await waitFor(() => expect(screen.queryByRole("button", { name: "현재 계획으로 돌아가기" })).not.toBeInTheDocument())
  expect(screen.queryByRole("button", { name: "이 일정으로 시작" })).not.toBeInTheDocument()
  expect(service.snapshot().currentPlan?.planId).not.toBe(entry.planId)
  expect(server.commits).toHaveLength(1)
})
