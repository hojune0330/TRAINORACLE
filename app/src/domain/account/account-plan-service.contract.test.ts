import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createAccountPlanService, accountPlanDocumentId } from "./account-plan-service"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { accountPlanEntry, accountPlanFingerprint, emptyAccountPlanDocument, type AccountPlanDocument } from "./account-plan-document-schema"
import type { AccountJournalDraftBuffer, AccountJournalDraftView } from "./account-journal-draft-buffer"
import type { DraftTransport } from "./account-journal-sync"
import type { AccountJournalRequest, AccountJournalResult } from "./account-journal-api"

const owner = "11111111-1111-4111-8111-111111111111"
// Protocol double only; actual encryption/reopen behavior belongs to the browser buffer harness.
function memoryBuffer() {
  let view: AccountJournalDraftView<AccountPlanDocument> | null = null
  const buffer = {
    read: async () => structuredClone(view),
    saveDraft: async (_owner: string, documentId: string, draft: AccountPlanDocument, sequence: number) => {
      if ((view?.localSequence ?? 0) !== sequence) throw Error("Local CAS")
      view = { ownerId: owner, documentId, serverRevision: view?.serverRevision ?? 0,
        localSequence: sequence + 1, acknowledgedSequence: view?.acknowledgedSequence ?? 0,
        state: "LOCAL_CHANGES", draft: structuredClone(draft), pending: view?.pending ?? null, blocked: null, remoteDraft: null }
    },
    queue: async (_owner: string, _id: string, operationId: string) => {
      if (!view || view.pending) throw Error("Queue")
      view.pending = { operationId, expectedRevision: view.serverRevision, sequence: view.localSequence, draft: structuredClone(view.draft) }
      view.state = "PENDING"
    },
    ack: async (_owner: string, _id: string, operationId: string, revision: number) => {
      if (!view || view.pending?.operationId !== operationId) return false
      view.serverRevision = revision; view.acknowledgedSequence = view.pending.sequence; view.pending = null
      view.state = view.localSequence === view.acknowledgedSequence ? "DRAFT_ACKNOWLEDGED" : "LOCAL_CHANGES"
      return true
    },
    conflict: async (_owner: string, _id: string, operationId: string, revision: number) => {
      if (!view) return false
      view.blocked = { kind: "RECEIPT", operationId, currentRevision: revision }; view.state = "CONFLICT"; return true
    },
    importRemote: async (_owner: string, documentId: string, draft: AccountPlanDocument, revision: number) => {
      if (view && view.state !== "DRAFT_ACKNOWLEDGED") {
        if (view.serverRevision === revision) return "UNCHANGED" as const
        view.blocked = { kind: "REMOTE", operationId: null, currentRevision: revision }; view.remoteDraft = structuredClone(draft)
        view.state = "CONFLICT"; return "CONFLICT" as const
      }
      view = { ownerId: owner, documentId, serverRevision: revision, localSequence: 1, acknowledgedSequence: 1,
        state: "DRAFT_ACKNOWLEDGED", draft: structuredClone(draft), pending: null, blocked: null, remoteDraft: null }
      return "IMPORTED" as const
    },
    close: vi.fn(),
  } as unknown as AccountJournalDraftBuffer<AccountPlanDocument>
  return { buffer, view: () => view }
}
function server() {
  let document: AccountPlanDocument | null = null, revision = 0, loseResponse = false
  const receipts = new Map<string, { revision: number; body: string }>()
  const send: DraftTransport<AccountPlanDocument> = vi.fn(async (request: AccountJournalRequest<AccountPlanDocument>): Promise<AccountJournalResult<AccountPlanDocument>> => {
    if (request.action === "read") return document ? { ok: true, data: { kind: "document", documentId: request.documentId, revision, document: structuredClone(document) } }
      : { ok: false, code: "NOT_FOUND" }
    if (request.action !== "save") return { ok: false, code: "UNAVAILABLE" }
    const receipt = receipts.get(request.operationId)
    if (receipt) {
      expect(JSON.stringify(request)).toBe(receipt.body)
      return { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision: receipt.revision } }
    }
    if (request.expectedRevision !== revision) return { ok: true, data: { kind: "conflict", documentId: request.documentId,
      operationId: request.operationId, currentRevision: revision } }
    revision += 1; document = structuredClone(request.document)
    receipts.set(request.operationId, { revision, body: JSON.stringify(request) })
    if (loseResponse) { loseResponse = false; return { ok: false, code: "UNAVAILABLE" } }
    return { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision } }
  })
  return { send, document: () => document, revision: () => revision, loseNext: () => { loseResponse = true } }
}
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it("uses deterministic owner-isolated fixed pointer IDs", async () => {
  expect(await accountPlanDocumentId(owner)).toBe(await accountPlanDocumentId(owner))
  expect(await accountPlanDocumentId(owner)).not.toBe(await accountPlanDocumentId("22222222-2222-4222-8222-222222222222"))
})

it("select, progress and archive all reach server CAS; a fresh device reads the confirmed pointer", async () => {
  const remote = server(), local = memoryBuffer()
  const service = createAccountPlanService({ ownerId: owner, isCurrent: () => true, buffer: local.buffer, send: remote.send })
  expect(await service.hydrate()).toBe(true)
  const packet = accountPlanPacketFixture(3)
  expect(await service.mutate({ kind: "SELECT", packet, confirmsSelection: true, freshReview: () => true }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(remote.revision()).toBe(1)
  const device = createAccountPlanService({ ownerId: owner, isCurrent: () => true, buffer: memoryBuffer().buffer, send: remote.send })
  await device.hydrate()
  expect(device.snapshot().currentPlan).toMatchObject({ kind: "read_only", executionAuthority: "NONE", packet })
  const progressPacket = structuredClone(packet)
  Reflect.set(progressPacket.state, "progress", [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }])
  expect(await service.mutate({ kind: "PROGRESS", packet: progressPacket }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(remote.revision()).toBe(2)
  expect(remote.document()!.data.plans[0]!.progress).toHaveLength(1)
  expect(await service.mutate({ kind: "ARCHIVE", planId: service.snapshot().currentPlan!.planId }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(remote.revision()).toBe(3)
  await device.hydrate()
  expect(device.snapshot().currentPlan).toBeNull()
  expect(remote.document()!.data.plans[0]!.archivedAt).not.toBeNull()
  expect(localStorage.length).toBe(0)
})

it("preserves a pending selection after response loss and replays identical operation bytes on hydration", async () => {
  const remote = server(), local = memoryBuffer()
  const s = createAccountPlanService({ ownerId: owner, isCurrent: () => true, buffer: local.buffer, send: remote.send })
  await s.hydrate(); remote.loseNext()
  const packet = accountPlanPacketFixture(3)
  expect(await s.mutate({ kind: "SELECT", packet, confirmsSelection: true, freshReview: () => true }, s.snapshot().fingerprint!)).toBe("PENDING")
  expect(s.snapshot().currentPlan).toBeNull()
  const pending = structuredClone(local.view()!.pending)
  expect(pending).not.toBeNull()
  expect(await s.hydrate()).toBe(true)
  expect(remote.revision()).toBe(1)
  expect(s.snapshot().currentPlan).toMatchObject({ kind: "read_only" })
  expect(local.view()!.pending).toBeNull()
})

it("retains both revisions when two devices update the same pointer", async () => {
  const remote = server(), one = memoryBuffer(), two = memoryBuffer()
  const a = createAccountPlanService({ ownerId: owner, isCurrent: () => true, buffer: one.buffer, send: remote.send })
  const b = createAccountPlanService({ ownerId: owner, isCurrent: () => true, buffer: two.buffer, send: remote.send })
  await a.hydrate(); await b.hydrate()
  const packet = accountPlanPacketFixture(3), command = { kind: "SELECT" as const, packet, confirmsSelection: true as const, freshReview: () => true }
  expect(await a.mutate(command, a.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(await b.mutate(command, b.snapshot().fingerprint!)).toBe("CONFLICT")
  expect(two.view()!.draft.data.currentPlanId).not.toBeNull()
  expect(two.view()!.pending).not.toBeNull()
  expect(remote.revision()).toBe(1)
  expect(b.snapshot().currentPlan).toBeNull()
})

it("never promotes historical save, stale safety or offline selection to current", async () => {
  const remote = server(), local = memoryBuffer()
  let online = true
  const s = createAccountPlanService({ ownerId: owner, isCurrent: () => true, buffer: local.buffer, send: remote.send, online: () => online })
  await s.hydrate()
  const packet = accountPlanPacketFixture(3)
  expect(await s.mutate({ kind: "SAVE_HISTORY", packet }, s.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(s.snapshot().currentPlan).toBeNull()
  const command = { kind: "SELECT" as const, packet, confirmsSelection: true as const, freshReview: () => false }
  expect(await s.mutate(command, s.snapshot().fingerprint!)).toBe("REVIEW_REQUIRED")
  online = false
  expect(await s.mutate({ ...command, freshReview: () => true }, s.snapshot().fingerprint!)).toBe("REVIEW_REQUIRED")
  expect(remote.revision()).toBe(1)
})

it("stores V2 only as history and never promotes it to the current plan", async () => {
  const remote = server(), local = memoryBuffer()
  const service = createAccountPlanService({ ownerId: owner, isCurrent: () => true, buffer: local.buffer, send: remote.send })
  await service.hydrate()
  const packet = accountPlanPacketFixture(2)
  expect(await service.mutate({ kind: "SAVE_HISTORY", packet }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(service.snapshot().currentPlan).toBeNull()
  expect(service.snapshot().document?.data.plans[0]?.archivedAt).not.toBeNull()
  expect(await service.mutate({ kind: "SELECT", packet, confirmsSelection: true, freshReview: () => true },
    service.snapshot().fingerprint!)).toBe("REVIEW_REQUIRED")
  expect(remote.document()?.data.currentPlanId).toBeNull()
})

it("does not retry an unsent pointer change without a new review", async () => {
  const remote = server(), local = memoryBuffer()
  let fail = true
  const send: DraftTransport<AccountPlanDocument> = request => request.action === "save" && fail
    ? Promise.resolve({ ok: false, code: "UNAVAILABLE" }) : remote.send(request)
  const s = createAccountPlanService({ ownerId: owner, isCurrent: () => true, buffer: local.buffer, send })
  await s.hydrate()
  expect(await s.mutate({ kind: "SELECT", packet: accountPlanPacketFixture(3), confirmsSelection: true, freshReview: () => true }, s.snapshot().fingerprint!)).toBe("PENDING")
  fail = false
  expect(await s.retry()).toBe("PENDING")
  expect(remote.revision()).toBe(0)
  expect(await s.retry(() => true)).toBe("ACCOUNT")
})

it("isolates late responses after owner change and refuses unknown baselines", async () => {
  const remote = server(), local = memoryBuffer()
  let current = true
  const send: DraftTransport<AccountPlanDocument> = async request => { const r = await remote.send(request); current = false; return r }
  const s = createAccountPlanService({ ownerId: owner, isCurrent: () => current, buffer: local.buffer, send })
  expect(await s.hydrate()).toBe(false)
  expect(s.snapshot()).toMatchObject({ status: "IDLE", document: null, currentPlan: null })
  expect(await s.mutate({ kind: "SAVE_HISTORY", packet: accountPlanPacketFixture(3) }, accountPlanFingerprint(emptyAccountPlanDocument()))).toBe("FAILED")
  expect(local.view()).toBeNull()
})

it("treats authentication/query failure as failure, never an empty account", async () => {
  const local = memoryBuffer()
  const s = createAccountPlanService({ ownerId: owner, isCurrent: () => true, buffer: local.buffer,
    send: async () => ({ ok: false, code: "UNAVAILABLE" }) })
  expect(await s.hydrate()).toBe(false)
  expect(s.snapshot()).toMatchObject({ status: "FAILED", document: null })
  expect(local.view()).toBeNull()
})

it("rejects a save made from a stale rendered version", async () => {
  const remote = server(), s = createAccountPlanService({ ownerId: owner, isCurrent: () => true, buffer: memoryBuffer().buffer, send: remote.send })
  await s.hydrate()
  const stale = s.snapshot().fingerprint!, packet = accountPlanPacketFixture(3)
  await s.mutate({ kind: "SAVE_HISTORY", packet }, stale)
  expect(await s.mutate({ kind: "ARCHIVE", planId: accountPlanEntry(packet).planId }, stale)).toBe("STALE")
  expect(remote.revision()).toBe(1)
})
