import { webcrypto } from "node:crypto"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { createRunningProfileService, runningProfileDocumentId, runningProfileEditToken } from "./account-running-profile-service"
import type { AccountRunningProfileDocument as Document } from "./account-running-profile-schema"
import type { AccountJournalConflictBuffer, AccountJournalDraftView } from "./account-journal-draft-buffer"
import type { AccountJournalRequest, AccountJournalResult } from "./account-journal-api"

const OWNER = "a1111111-1111-4111-8111-111111111111"
const doc = (answer = "health"): Document => ({ version: 3, state: "ACCOUNT_STATE", kind: "RUNNING_PROFILE", data: {
  version: "RUNNING_PROFILE_V1", answeredAt: "2026-10-04T00:00:00.000Z", answers: { motives: [answer] },
} })
// Protocol double only. Browser coverage separately exercises the encrypted IndexedDB buffer.
function fixture() {
  let local: AccountJournalDraftView<Document> | null = null
  let remote: { revision: number; document: Document | null } | null = null
  let owner = true, unavailable = false, supported = true, lostAck = false
  const receipts = new Map<string, AccountJournalResult<Document>>()
  const writes: AccountJournalRequest<Document>[] = []
  const buffer = {
    close: vi.fn(), read: async () => structuredClone(local),
    saveDraft: async (ownerId: string, documentId: string, draft: Document, sequence: number) => {
      if ((local?.localSequence ?? 0) !== sequence) throw Error("CAS")
      local = { ownerId, documentId, draft: structuredClone(draft), serverRevision: local?.serverRevision ?? 0,
        localSequence: sequence + 1, acknowledgedSequence: local?.acknowledgedSequence ?? 0,
        state: "LOCAL_CHANGES", pending: null, blocked: null, remoteDraft: null }
    },
    queue: async (_o: string, _d: string, operationId: string) => {
      local!.pending = { operationId, expectedRevision: local!.serverRevision, sequence: local!.localSequence, draft: structuredClone(local!.draft) }
      local!.state = "PENDING"
    },
    ack: async (_o: string, _d: string, operationId: string, revision: number) => {
      if (local?.pending?.operationId !== operationId) return false
      local.acknowledgedSequence = local.pending.sequence; local.serverRevision = revision; local.pending = null; local.state = "DRAFT_ACKNOWLEDGED"; return true
    },
    conflict: async (_o: string, _d: string, operationId: string, currentRevision: number) => {
      local!.blocked = { kind: "RECEIPT", operationId, currentRevision }; local!.state = "CONFLICT"; return true
    },
    captureConflict: async (_o: string, _d: string, draft: Document | null, revision: number) => {
      local!.blocked = { kind: "REMOTE", operationId: null, currentRevision: revision }; local!.state = "CONFLICT"; local!.remoteDraft = draft
    },
    resolveConflict: async (_o: string, _d: string, choice: string, revision: number) => {
      local!.serverRevision = revision; local!.localSequence++; local!.pending = null; local!.blocked = null
      if (choice === "DELETE") local!.resolvedDeletion = revision
      else if (choice === "REMOTE") local!.draft = structuredClone(local!.remoteDraft!)
      local!.state = choice === "LOCAL" ? "LOCAL_CHANGES" : "DRAFT_ACKNOWLEDGED"
    },
    acceptCleanDeletion: async (_o: string, _d: string, revision: number) => { local!.resolvedDeletion = revision; local!.serverRevision = revision },
    importRemote: async (ownerId: string, documentId: string, draft: Document, serverRevision: number) => {
      if (local && local.state !== "DRAFT_ACKNOWLEDGED") return "CONFLICT"
      const sequence = (local?.localSequence ?? 0) + 1
      local = { ownerId, documentId, draft: structuredClone(draft), serverRevision, localSequence: sequence, acknowledgedSequence: sequence,
        state: "DRAFT_ACKNOWLEDGED", blocked: null, pending: null, remoteDraft: null }; return "IMPORTED"
    },
  } as unknown as AccountJournalConflictBuffer<Document>
  const send = vi.fn(async (request: AccountJournalRequest<Document>): Promise<AccountJournalResult<Document>> => {
    if (unavailable) return { ok: false, code: "UNAVAILABLE" }
    if (request.action === "runningProfileSupport") return supported ? { ok: true, data: { kind: "running-profile-support", version: 1 } } : { ok: false, code: "UNAVAILABLE" }
    if (request.action === "read") return !remote ? { ok: false, code: "NOT_FOUND" } : remote.document
      ? { ok: true, data: { kind: "document", documentId: request.documentId, revision: remote.revision, document: structuredClone(remote.document) } }
      : { ok: true, data: { kind: "deleted", documentId: request.documentId, revision: remote.revision } }
    if (request.action !== "save") throw Error("Unexpected action")
    writes.push(structuredClone(request))
    if (receipts.has(request.operationId)) return receipts.get(request.operationId)!
    if (request.expectedRevision !== (remote?.revision ?? 0)) return { ok: true, data: { kind: "conflict", documentId: request.documentId, operationId: request.operationId, currentRevision: remote!.revision } }
    remote = { revision: request.expectedRevision + 1, document: structuredClone(request.document) }
    const ack = { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision: remote.revision } } as const
    receipts.set(request.operationId, ack)
    return lostAck ? { ok: false, code: "UNAVAILABLE" } : ack
  })
  const changed = vi.fn()
  const make = () => createRunningProfileService(OWNER, changed, { buffer, send, isOwner: () => owner, exclusive: work => work() })
  const service = make()
  return { service, make, send, changed, writes, buffer, local: () => local, remote: () => remote,
    setRemote: (next: typeof remote) => { remote = next }, switchOwner: () => { owner = false },
    unavailable: (value: boolean) => { unavailable = value }, supported: (value: boolean) => { supported = value }, lostAck: (value: boolean) => { lostAck = value } }
}
beforeEach(() => vi.stubGlobal("crypto", webcrypto))
afterEach(() => vi.unstubAllGlobals())

it("binds document identity to the authenticated owner", async () => {
  expect(await runningProfileDocumentId(OWNER)).toBe(await runningProfileDocumentId(OWNER))
  expect(await runningProfileDocumentId(OWNER)).not.toBe(await runningProfileDocumentId("b2222222-2222-4222-8222-222222222222"))
})
it("saves only after server support and acknowledgement, then reloads", async () => {
  const f = fixture(); await f.service.hydrate()
  expect(f.service.snapshot().status).toBe("EMPTY")
  expect(await f.service.save({ motives: ["health"] }, runningProfileEditToken(f.service.snapshot()))).toBe(true)
  expect(f.service.snapshot().status).toBe("READY")
  const next = f.make(); await next.hydrate()
  expect(next.snapshot().document?.data.answers).toEqual({ motives: ["health"] })
})
it("does not treat unavailable support or reads as an empty profile", async () => {
  for (const failure of ["unavailable", "supported"] as const) {
    const f = fixture(); f[failure](failure === "unavailable"); await f.service.hydrate()
    expect(f.service.snapshot().status).toBe("FAILED")
    expect(await f.service.save({}, runningProfileEditToken(f.service.snapshot()))).toBe(false)
    expect(f.writes).toHaveLength(0)
  }
})
it("does not present cached acknowledged answers as verified during an unavailable refresh", async () => {
  const f = fixture(); f.setRemote({ revision: 1, document: doc() }); await f.service.hydrate()
  f.changed.mockClear(); f.unavailable(true); await f.service.hydrate()
  expect(f.changed.mock.calls.map(call => call[0].status)).not.toContain("READY")
  expect(f.service.snapshot().document).toEqual(doc())
})
it("replays an immutable operation after a lost acknowledgement", async () => {
  const f = fixture(); await f.service.hydrate(); f.lostAck(true)
  expect(await f.service.save({ motives: ["health"] }, runningProfileEditToken(f.service.snapshot()))).toBe(false)
  expect(f.service.snapshot().status).toBe("PENDING")
  f.lostAck(false); await f.service.hydrate()
  expect(f.service.snapshot().status).toBe("READY")
  expect(f.writes).toHaveLength(2); expect(f.writes[0]).toEqual(f.writes[1])
})
it("rejects a second submission with the old edit token", async () => {
  const f = fixture(); await f.service.hydrate(); const token = runningProfileEditToken(f.service.snapshot())
  expect(await f.service.save({ intensity: ["easy"] }, token)).toBe(true)
  expect(await f.service.save({ intensity: ["hard"] }, token)).toBe(false)
  expect(f.writes).toHaveLength(1)
})
it("keeps a competing edit and asks again when the reviewed remote changes", async () => {
  const f = fixture(); await f.service.hydrate(); f.setRemote({ revision: 1, document: doc("record") })
  expect(await f.service.save({ motives: ["health"] }, runningProfileEditToken(f.service.snapshot()))).toBe(false)
  await f.service.hydrate(); const review = f.service.snapshot()
  expect(review.status).toBe("CONFLICT"); expect(review.remote?.data.answers.motives).toEqual(["record"])
  f.setRemote({ revision: 2, document: doc("friends") })
  expect(await f.service.resolve(review, "LOCAL")).toBe(false)
  expect(f.remote()?.document?.data.answers.motives).toEqual(["friends"])
  expect(await f.service.resolve(f.service.snapshot(), "REMOTE")).toBe(true)
  expect(f.service.snapshot().document?.data.answers.motives).toEqual(["friends"])
})
it("cannot resurrect a remotely deleted document from a losing local edit", async () => {
  const f = fixture(); await f.service.hydrate(); f.setRemote({ revision: 1, document: null })
  await f.service.save({ motives: ["health"] }, runningProfileEditToken(f.service.snapshot())); await f.service.hydrate()
  expect(await f.service.resolve(f.service.snapshot(), "LOCAL")).toBe(false)
  expect(await f.service.resolve(f.service.snapshot(), "REMOTE")).toBe(true)
  expect(f.service.snapshot().status).toBe("DELETED")
})
it("does not publish or write after account change or disposal", async () => {
  const f = fixture(); await f.service.hydrate(); f.changed.mockClear(); f.switchOwner()
  expect(await f.service.save({}, runningProfileEditToken(f.service.snapshot()))).toBe(false)
  expect(await f.service.hydrate()).toBe(false); expect(f.changed).not.toHaveBeenCalled(); expect(f.writes).toHaveLength(0)
  f.service.close(); expect(f.buffer.close).toHaveBeenCalled()
})
it("does not accept a delayed read after disposal", async () => {
  const f = fixture(); let release!: () => void
  const original = f.send.getMockImplementation()!
  f.send.mockImplementation(async request => { if (request.action === "read") await new Promise<void>(r => { release = r }); return original(request) })
  const loading = f.service.hydrate(); await vi.waitFor(() => expect(release).toBeTypeOf("function"))
  f.service.close(); f.changed.mockClear(); release(); await loading
  expect(f.changed).not.toHaveBeenCalled()
})

it("preserves the exact V1 offline draft and never replays it over an upgraded server", async () => {
  const f = fixture(); await f.service.hydrate(); f.lostAck(true)
  await f.service.save({ motives: ["health"] }, runningProfileEditToken(f.service.snapshot()))
  const savedLocal = structuredClone(f.local()), writeCount = f.writes.length
  const original = f.send.getMockImplementation()!
  f.send.mockImplementation(request => request.action === "read"
    ? Promise.resolve({ ok: false, code: "UPGRADE_REQUIRED" }) : original(request))
  expect(await f.service.hydrate()).toBe(false)
  expect(f.service.snapshot().status).toBe("UPGRADE_REQUIRED")
  expect(f.local()).toEqual(savedLocal); expect(f.writes).toHaveLength(writeCount)
  expect(await f.service.save({}, runningProfileEditToken(f.service.snapshot()))).toBe(false)
})
