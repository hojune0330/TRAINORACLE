import { webcrypto } from "node:crypto"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { captureAccountPlanWrite } from "./account-plan-domain"
import { stateFixture } from "../plan-beta-store.test-fixture"
import * as projection from "./account-journal-projection"
import { accountJournalDocumentId } from "./account-journal-record-service"
import { accountPlanEntry } from "./account-plan-document-schema"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { createAccountPlanService } from "./account-plan-service"
import { collectionMemoryBuffers } from "./account-plan-collection.test-support"

const OWNER = "11111111-1111-4111-8111-111111111111"
const runtime = vi.hoisted(() => ({ service: null as unknown, owner: "11111111-1111-4111-8111-111111111111" }))
vi.mock("./account-plan-service", async original => ({
  ...await original<typeof import("./account-plan-service")>(),
  accountPlansEnabled: () => true, accountPlanService: () => runtime.service,
}))
vi.mock("./local-journal-ownership", async original => ({
  ...await original<typeof import("./local-journal-ownership")>(), activeLocalAccount: () => runtime.owner,
}))
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto); runtime.owner = OWNER
  projection.resetAccountJournalProjection(OWNER)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); runtime.service = null; projection.resetAccountJournalProjection(null) })
function service(collection = true) {
  const mutate = vi.fn(async (..._args: unknown[]) => "ACCOUNT")
  runtime.service = { snapshot: () => ({ status: "EMPTY", fingerprint: "baseline", currentPlan: null }), mutate,
    ...(collection ? { loadHistory: async () => true } : {}) }
  return mutate
}

it("sends a confirmed empty journal guard but rejects an incomplete null projection", async () => {
  const mutate = service(), write = captureAccountPlanWrite("active")!
  expect(projection.currentConfirmedAccountJournalVersions()).toBeNull()
  expect(await write.save(stateFixture(), [], () => true)).toBe("ACCOUNT_PLAN_REVIEW_REQUIRED")
  expect(mutate).not.toHaveBeenCalled()
  projection.setAccountJournalProjectionStatus(OWNER, "READY")
  expect(projection.currentConfirmedAccountJournalVersions()).toEqual([])
  expect(await write.save(stateFixture(), [], () => true)).toBeNull()
  expect(mutate.mock.calls[0]![0]).toMatchObject({ kind: "SELECT", journalGuard: [] })
})

it("requires the collection before passing a guarded SELECT to a legacy service", async () => {
  const mutate = service(false)
  projection.setAccountJournalProjectionStatus(OWNER, "READY")
  expect(await captureAccountPlanWrite("active")!.save(stateFixture(), [], () => true)).toBe("ACCOUNT_PLAN_REVIEW_REQUIRED")
  expect(mutate).not.toHaveBeenCalled()
  expect(await captureAccountPlanWrite("active")!.save(stateFixture(), [])).toBeNull()
  expect(mutate.mock.calls[0]![0]).toMatchObject({ kind: "PROGRESS" })
})

it("hashes confirmed entry IDs into an owner-scoped sorted revision guard", async () => {
  const mutate = service(), versions = [{ entryId: "synthetic-b", revision: 4 }, { entryId: "synthetic-a", revision: 2 }]
  vi.spyOn(projection, "currentConfirmedAccountJournalVersions").mockReturnValue(versions)
  const expected = (await Promise.all(versions.map(async row => ({ documentId: await accountJournalDocumentId(OWNER, row.entryId), revision: row.revision }))))
    .sort((a, b) => a.documentId.localeCompare(b.documentId))
  expect(await captureAccountPlanWrite("active")!.save(stateFixture(), [], () => true)).toBeNull()
  expect(mutate.mock.calls[0]![0]).toMatchObject({ journalGuard: expected })
})

it("does not save after confirmed revisions change during asynchronous ID hashing", async () => {
  const mutate = service()
  vi.spyOn(projection, "currentConfirmedAccountJournalVersions")
    .mockReturnValueOnce([{ entryId: "synthetic-a", revision: 1 }]).mockReturnValue([{ entryId: "synthetic-a", revision: 2 }])
  expect(await captureAccountPlanWrite("active")!.save(stateFixture(), [], () => true)).toBe("ACCOUNT_PLAN_REVIEW_REQUIRED")
  expect(mutate).not.toHaveBeenCalled()
})

function archiveService() {
  const packet = accountPlanPacketFixture(3), entry = accountPlanEntry(packet)
  const mutate = vi.fn(async (..._args: unknown[]) => "ACCOUNT")
  runtime.service = { snapshot: () => ({ status: "READY", fingerprint: "baseline",
    currentPlan: { kind: "read_only", planId: entry.planId, packet } }), mutate }
  return { mutate, planId: entry.planId }
}

it("passes the archive review through the domain and binds it to the captured account and service", async () => {
  const { mutate, planId } = archiveService(), write = captureAccountPlanWrite("active")!
  let reviewCurrent = true
  expect(await write.archive(() => reviewCurrent)).toBeNull()
  const command = mutate.mock.calls[0]![0] as { kind: string; planId: string; freshReview: () => boolean }
  expect(command).toMatchObject({ kind: "ARCHIVE", planId })
  expect(command.freshReview()).toBe(true)
  reviewCurrent = false
  expect(command.freshReview()).toBe(false)
  reviewCurrent = true
  runtime.owner = "22222222-2222-4222-8222-222222222222"
  expect(command.freshReview()).toBe(false)
  runtime.owner = OWNER
  runtime.service = null
  expect(command.freshReview()).toBe(false)
})

it("keeps ordinary account archiving available without adding a selection review", async () => {
  const { mutate, planId } = archiveService()
  expect(await captureAccountPlanWrite("active")!.archive()).toBeNull()
  expect(mutate.mock.calls[0]![0]).toEqual({ kind: "ARCHIVE", planId })
})

it("rejects an archive after the captured owner changes before mutation", async () => {
  const { mutate } = archiveService(), write = captureAccountPlanWrite("active")!
  runtime.owner = "22222222-2222-4222-8222-222222222222"
  expect(await write.archive(() => true)).toBe("ACCOUNT_PLAN_STALE")
  expect(mutate).not.toHaveBeenCalled()
})

it("legacy writers reject reviewed archives before any buffer or transport work", async () => {
  const stores = collectionMemoryBuffers(), send = vi.fn()
  const legacy = createAccountPlanService({ ownerId: OWNER, isCurrent: () => true, buffer: stores.legacy.buffer, send })
  expect(await legacy.mutate({ kind: "ARCHIVE", planId: accountPlanEntry(accountPlanPacketFixture(3)).planId,
    freshReview: () => true }, "baseline")).toBe("REVIEW_REQUIRED")
  expect(stores.legacy.buffer.read).not.toHaveBeenCalled()
  expect(stores.legacy.writes).toHaveLength(0)
  expect(stores.legacy.buffer.queue).not.toHaveBeenCalled()
  expect(send).not.toHaveBeenCalled()
  legacy.close()
})
