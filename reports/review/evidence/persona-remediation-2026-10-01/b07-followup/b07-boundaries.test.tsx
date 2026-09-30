import React from "react"
import { act, cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { PlanBeta } from "../../app/src/screens/PlanBeta"
import { generatePlanFromDraft } from "../../app/src/domain/plan-beta-flow"
import { stateFixture } from "../../app/src/domain/plan-beta-store.test-fixture"
import { savePlanBetaState, readPlanBetaStateFromStorage } from "../../app/src/domain/plan-beta-store"
import { planBetaStateV3Schema, planHistoryListSchema } from "../../app/src/domain/plan-beta-schema"
import type { PlanBetaStateV3 } from "../../app/src/domain/plan-beta-schema"
import { planHistorySnapshotContent } from "../../app/src/domain/plan-history-snapshot-content"
import { createInitialPeriodizationContext, advancePeriodizationContext } from "../../app/src/domain/periodization-lineage"
import { saveSelectedPlanCandidate } from "../../app/src/screens/plan-beta/plan-selection"
import * as mutationLock from "../../app/src/domain/plan-mutation-lock"
import { setActiveLocalAccount } from "../../app/src/domain/account/local-journal-ownership"
import { runDraftSafeNavigation } from "../../app/src/domain/unsaved-draft-navigation"
import { createAccountPlanCollectionService } from "../../app/src/domain/account/account-plan-collection-service"
import { collectionServer, collectionMemoryBuffers, COLLECTION_OWNER } from "../../app/src/domain/account/account-plan-collection.test-support"
import { accountPlanEntry, emptyAccountPlanDocument, materializeAccountPlan } from "../../app/src/domain/account/account-plan-document-schema"
import { ACCOUNT_PLAN_EVENT } from "../../app/src/domain/account/account-plan-service"

const runtime = vi.hoisted(() => ({ account: false,
  service: null as ReturnType<typeof createAccountPlanCollectionService> | null }))
vi.mock("../../app/src/domain/account/account-plan-service", async original => ({
  ...await original<typeof import("../../app/src/domain/account/account-plan-service")>(),
  accountPlansEnabled: () => runtime.account, accountPlanService: () => runtime.service,
}))
vi.mock("../../app/src/domain/account/plan-cloud-backup", () => ({
  planCloudBackupEnabled: () => false, archivePlanOnServer: async () => {},
  backupActivePlanToServer: async () => ({ kind: "unavailable" }),
  loadLatestPlanFromServer: async () => ({ kind: "unavailable" }),
}))
vi.mock("../../app/src/domain/account/supabase-client", () => ({ supabase: async () => null }))
// B06 is being repaired by the parent and is deliberately outside this assessment.
vi.mock("../../app/src/screens/plan-beta/PlanAdaptationFlow", () => ({ PlanAdaptationFlow: () => null }))

const NOW = "2026-10-01T03:00:00.000Z"
const ACTIVE = "trainoracle.plan-beta.v1", HISTORY = "trainoracle.plan-beta.history.v1"
const CONTEXT = "trainoracle.plan-adaptation-context.v1", INTAKE = "trainoracle.plan-beta.previous-intake.v1"
const PENDING = "trainoracle.plan-beta.adaptation.v1"
const WORDS = {
  next: "\uD604\uC7AC \uAE30\uC900\uC73C\uB85C \uB2E4\uC74C \uACC4\uD68D\uC548 \uB9CC\uB4E4\uAE30",
  back: "\uD604\uC7AC \uACC4\uD68D\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30",
  safe: /\uD1B5\uC99D\uC740 \uC5C6\uACE0 \uBAB8 \uC0C1\uD0DC\uB294 \uD3C9\uC18C\uC640 \uAC19\uC544\uC694/u,
  select: "\uC774 \uC77C\uC815\uC73C\uB85C \uC2DC\uC791",
}

beforeEach(() => {
  runtime.account = false; runtime.service = null
  setActiveLocalAccount(null); localStorage.clear(); sessionStorage.clear()
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(NOW))
})
afterEach(() => {
  cleanup(); runtime.service?.close(); runtime.service = null; runtime.account = false
  setActiveLocalAccount(null)
  expect(fetch).not.toHaveBeenCalled()
  vi.useRealTimers()
})

function completed(ordinal = 6): PlanBetaStateV3 {
  const original = stateFixture()
  let lineage = createInitialPeriodizationContext(original.activePlan.candidateId, original.generatedAt)!
  for (let n = 1; n < ordinal; n++) lineage = advancePeriodizationContext(lineage,
    new Date(Date.UTC(2026, 7, n)).toISOString())!
  return planBetaStateV3Schema.parse({ ...original, periodization: lineage,
    progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] })
}
function seedHistory() {
  const rows = Array.from({ length: 18 }, (_, i) => planHistorySnapshotContent(completed(i + 1),
    new Date(Date.UTC(2026, 8, 25 - i)).toISOString(), "MANUAL"))
  localStorage.setItem(HISTORY, JSON.stringify(planHistoryListSchema.parse(rows)))
  return rows
}
function allBytes() {
  const read = (store: Storage) => Object.keys(store).sort().map(key => [key, store.getItem(key)])
  return JSON.stringify({ local: read(localStorage), session: read(sessionStorage) })
}
function nextCall(base: PlanBetaStateV3) {
  const result = generatePlanFromDraft(base.intake, "NO_KNOWN_RISK", undefined, undefined, undefined, base)
  if (result.kind !== "generated") throw Error(`Positive generation failed: ${result.kind}`)
  return { generated: result,
    select: () => saveSelectedPlanCandidate({ candidateId: result.generated.candidates[0].candidateId, startDate: "2026-10-01" },
      result.generated, result.gate, result.intake, result.athleteEvidence, () => true, base) }
}
async function openAndPreview() {
  fireEvent.click(screen.getByRole("button", { name: WORDS.next }))
  fireEvent.click(await screen.findByRole("button", { name: WORDS.safe }))
  await screen.findByRole("button", { name: WORDS.select })
}
async function accountFixture() {
  runtime.account = true; setActiveLocalAccount(COLLECTION_OWNER)
  const base = completed(), entry = accountPlanEntry({ state: base, evidence: null })
  const document = emptyAccountPlanDocument()
  document.data.plans.push(entry); document.data.currentPlanId = entry.planId
  const server = collectionServer(document), buffers = collectionMemoryBuffers()
  const service = createAccountPlanCollectionService({ ownerId: COLLECTION_OWNER, isCurrent: () => true,
    client: server.client, buffers: buffers.dependencies, legacyBuffer: buffers.legacy.buffer,
    runExclusive: async run => run(), yieldTask: async () => {}, online: () => true })
  runtime.service = service
  expect(await service.hydrate()).toBe(true)
  return { base, entry, server, service }
}

it("T01_READ_ONLY_open_cancel_leave_reload_preserves_active_and_all_18_originals", async () => {
  seedHistory(); expect(savePlanBetaState(completed()).ok).toBe(true)
  localStorage.setItem(PENDING, "synthetic-old-pending"); sessionStorage.setItem(INTAKE, "synthetic-intake")
  const before = allBytes()
  const view = render(<PlanBeta />)
  await openAndPreview()
  expect(allBytes()).toBe(before)
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  expect(runDraftSafeNavigation(() => { throw Error("Navigation must not run") })).toBe(false)
  expect(allBytes()).toBe(before)
  fireEvent.click(screen.getByRole("button", { name: WORDS.back }))
  expect(allBytes()).toBe(before)
  await openAndPreview()
  confirm.mockReturnValue(true)
  expect(runDraftSafeNavigation(() => view.unmount())).toBe(true)
  render(<PlanBeta />)
  expect(screen.getByRole("button", { name: WORDS.next })).toBeEnabled()
  expect(allBytes()).toBe(before)
})

it("T02_LINEAGE_real_selection_6_to_7_and_18_to_next_macrocycle_1_replay_once", async () => {
  for (const ordinal of [6, 18]) {
    cleanup(); localStorage.clear(); sessionStorage.clear()
    const rows = seedHistory(), base = completed(ordinal)
    expect(savePlanBetaState(base).ok).toBe(true)
    const { select } = nextCall(base)
    const first = await select()
    expect(first.kind).toBe("saved")
    const current = readPlanBetaStateFromStorage()
    expect(current.kind).toBe("loaded")
    if (current.kind !== "loaded" || current.state.version !== 3) throw Error("Missing saved state")
    expect(current.state.periodization).toEqual(advancePeriodizationContext(base.periodization!, NOW))
    const history = planHistoryListSchema.parse(JSON.parse(localStorage.getItem(HISTORY)!))
    expect(history).toHaveLength(18)
    expect(history[0].originalPlan).toEqual(base)
    expect(history.slice(1)).toEqual(rows.slice(0, 17))
    const after = allBytes()
    expect(await select()).toEqual(first)
    expect(allBytes()).toBe(after)
  }
})

it("T03_STALE_predecessor_changed_during_lock_wait_is_not_rebased_or_written", async () => {
  const base = completed(); savePlanBetaState(base)
  const { select } = nextCall(base)
  let unlock!: () => void
  vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({ request: <T,>(_name: string, _options: unknown,
    callback: (lock: object | null) => T | Promise<T>) => new Promise<T>(resolve => { unlock = () => resolve(callback({})) }) })
  const request = select()
  const changed = planBetaStateV3Schema.parse({ ...base, progress: [{ sessionDay: 1, sessionSlot: "AM", state: "SKIPPED" }] })
  expect(savePlanBetaState(changed).ok).toBe(true)
  const before = allBytes()
  unlock()
  expect(await request).toMatchObject({ kind: "rejected", code: "STALE_BASE" })
  expect(allBytes()).toBe(before)
  expect(generatePlanFromDraft(base.intake, "NO_KNOWN_RISK", undefined, undefined, undefined, base))
    .toMatchObject({ kind: "rejected", code: "STALE_BASE" })
})

it("T04_POST_WRITE_ERROR_all_five_keys_restore_even_when_operation_took_effect_before_throw", async () => {
  for (const failedKey of [HISTORY, INTAKE, CONTEXT, ACTIVE, PENDING]) {
    localStorage.clear(); sessionStorage.clear(); seedHistory()
    const base = completed(); savePlanBetaState(base)
    localStorage.setItem(CONTEXT, "synthetic-context-before"); localStorage.setItem(PENDING, "synthetic-pending-before")
    sessionStorage.setItem(INTAKE, "synthetic-intake-before")
    const { select } = nextCall(base), before = allBytes()
    const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem
    let thrown = false
    const afterWrite = (key: string) => { if (key === failedKey && !thrown) { thrown = true; throw Error("POST_WRITE_FAILURE") } }
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      set.call(this, key, value); afterWrite(key)
    })
    const removeSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (key) {
      remove.call(this, key); afterWrite(key)
    })
    expect(await select()).toMatchObject({ kind: "rejected", code: "PLAN_STORAGE_WRITE_FAILED" })
    expect(thrown).toBe(true); expect(allBytes()).toBe(before)
    setSpy.mockRestore(); removeSpy.mockRestore()
    expect((await select()).kind).toBe("saved")
    expect(JSON.parse(localStorage.getItem(HISTORY)!)).toHaveLength(18)
  }
})

it("T05_ROLLBACK_FAILURE_reports_uncertain_instead_of_success_or_safe_retry", async () => {
  const base = completed(); savePlanBetaState(base)
  localStorage.setItem(PENDING, "synthetic-old-pending")
  const { select } = nextCall(base)
  const oldActive = localStorage.getItem(ACTIVE), set = Storage.prototype.setItem, remove = Storage.prototype.removeItem
  let failedForward = false
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (key) {
    remove.call(this, key)
    if (key === PENDING && !failedForward) { failedForward = true; throw Error("LAST_WRITE_FAILED") }
  })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (failedForward && key === ACTIVE && value === oldActive) throw Error("ACTIVE_ROLLBACK_FAILED")
    set.call(this, key, value)
  })
  expect(await select()).toMatchObject({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
  expect(failedForward).toBe(true)
  expect(localStorage.getItem(ACTIVE)).not.toBe(oldActive)
})

it("T06_ACCOUNT_one_SELECT_keeps_old_pointer_until_delayed_protocol_ack", async () => {
  const { base, entry, server, service } = await accountFixture()
  const mutate = vi.spyOn(service, "mutate"), { select } = nextCall(base), before = allBytes()
  const nativeCommit = server.client.commit
  let release!: () => void
  server.client.commit = vi.fn(request => new Promise(resolve => {
    release = () => { void nativeCommit(request).then(resolve) }
  }))
  const pending = select()
  await waitFor(() => expect(release).toBeTypeOf("function"))
  expect(service.snapshot().currentPlan?.planId).toBe(entry.planId)
  expect(server.commits).toHaveLength(0)
  release()
  expect((await pending).kind).toBe("saved")
  expect(mutate.mock.calls.filter(([command]) => command.kind === "SELECT")).toHaveLength(1)
  expect(server.commits).toHaveLength(1)
  expect(allBytes()).toBe(before)
  expect(await service.loadHistory()).toBe(true)
  const old = service.snapshot().confirmedDocument!.data.plans.find(row => row.planId === entry.planId)!
  expect(old.archivedAt).not.toBeNull(); expect(materializeAccountPlan(old).state).toEqual(base)
})

it("T07_ACCOUNT_lost_response_UI_recovers_receipt_without_second_SELECT_or_commit", async () => {
  const { entry, server, service } = await accountFixture()
  const mutate = vi.spyOn(service, "mutate"), before = allBytes()
  render(<PlanBeta />)
  await openAndPreview()
  server.loseResponse()
  fireEvent.click(screen.getByRole("button", { name: WORDS.select }))
  await waitFor(() => expect(service.snapshot().status).toBe("PENDING"))
  expect(service.snapshot().currentPlan?.planId).toBe(entry.planId)
  expect(screen.getByRole("button", { name: WORDS.back })).toBeVisible()
  await act(async () => {
    expect(await service.retry()).toBe("ACCOUNT")
    window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT))
  })
  await waitFor(() => expect(screen.queryByRole("button", { name: WORDS.back })).not.toBeInTheDocument())
  expect(service.snapshot().currentPlan?.planId).not.toBe(entry.planId)
  expect(server.commits).toHaveLength(1)
  expect(mutate.mock.calls.filter(([command]) => command.kind === "SELECT")).toHaveLength(1)
  expect(allBytes()).toBe(before)
})

it("T08_ACCOUNT_pending_cancel_reopen_then_receipt_must_exit_obsolete_draft", async () => {
  const { entry, server, service } = await accountFixture()
  render(<PlanBeta />); await openAndPreview()
  server.loseResponse(); fireEvent.click(screen.getByRole("button", { name: WORDS.select }))
  await waitFor(() => expect(service.snapshot().status).toBe("PENDING"))
  fireEvent.click(screen.getByRole("button", { name: WORDS.back }))
  expect(service.snapshot().currentPlan?.planId).toBe(entry.planId)
  fireEvent.click(screen.getByRole("button", { name: WORDS.next }))
  await screen.findByRole("button", { name: WORDS.safe })
  await act(async () => {
    expect(await service.retry()).toBe("ACCOUNT")
    window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT))
  })
  expect(service.snapshot().currentPlan?.planId).not.toBe(entry.planId)
  expect(server.commits).toHaveLength(1)
  // A confirmed successor must not leave this newly reopened predecessor draft on screen.
  await waitFor(() => expect(screen.queryByRole("button", { name: WORDS.back })).not.toBeInTheDocument())
})
