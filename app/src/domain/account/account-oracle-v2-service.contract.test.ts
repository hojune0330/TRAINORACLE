import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createOracleV2Service, oracleV2EditToken } from "./account-oracle-v2-service"
import { emptyOracleV2Document, type AccountOracleCompatibleDocument as Document } from "./account-oracle-v2-schema"
import type { AccountRunningProfileDocument } from "./account-running-profile-schema"
import { makeOracleProfileRevision, saveOracleProfileReading } from "../oracle-profile-snapshot"
import type { AccountJournalConflictBuffer, AccountJournalDraftView } from "./account-journal-draft-buffer"
import type { AccountJournalRequest, AccountJournalResult } from "./account-journal-api"

const OWNER = "a1111111-1111-4111-8111-111111111111"
const legacy: AccountRunningProfileDocument = { version: 3, state: "ACCOUNT_STATE", kind: "RUNNING_PROFILE", data: {
  version: "RUNNING_PROFILE_V1", answeredAt: "2026-10-04T00:00:00.000Z", answers: { intensity: ["hard"] },
} }
const answers = { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 } as const
const doc = (revision = 1) => {
  const value = emptyOracleV2Document()
  value.data.current = makeOracleProfileRevision({ revision, answeredAt: "2026-10-04T00:00:00.000Z", answers })
  return value
}

// Protocol double. The separate browser test covers the actual encrypted IndexedDB implementation.
function fixture() {
  let local: AccountJournalDraftView<Document> | null = null
  let legacyLocal: AccountJournalDraftView<AccountRunningProfileDocument> | null = null
  let remote: { revision: number; document: Document | null } | null = null
  let owner = true, offline = false, supported = true, lostAck = false
  const receipts = new Map<string, AccountJournalResult<Document>>()
  const archives: Document[] = []
  const buffer = {
    close: vi.fn(), read: async () => structuredClone(local),
    saveDraft: async (ownerId: string, documentId: string, draft: Document, sequence: number, writePurpose?: "MIGRATION") => {
      if ((local?.localSequence ?? 0) !== sequence) throw Error("CAS")
      local = { ownerId, documentId, draft: structuredClone(draft), serverRevision: local?.serverRevision ?? 0,
        localSequence: sequence + 1, acknowledgedSequence: local?.acknowledgedSequence ?? 0,
        state: "LOCAL_CHANGES", pending: null, blocked: null, remoteDraft: null, writePurpose }
    },
    queue: async (_o: string, _d: string, operationId: string) => {
      local!.pending = { operationId, expectedRevision: local!.serverRevision, sequence: local!.localSequence,
        draft: structuredClone(local!.draft), writePurpose: local!.writePurpose }
      local!.state = "PENDING"
    },
    ack: async (_o: string, _d: string, operationId: string, revision: number) => {
      if (local?.pending?.operationId !== operationId) return false
      local.acknowledgedSequence = local.pending.sequence; local.serverRevision = revision
      local.pending = null; local.state = "DRAFT_ACKNOWLEDGED"; return true
    },
    conflict: async (_o: string, _d: string, operationId: string, currentRevision: number) => {
      local!.blocked = { kind: "RECEIPT", operationId, currentRevision }; local!.state = "CONFLICT"; return true
    },
    captureConflict: async (_o: string, _d: string, document: Document | null, revision: number) => {
      if (!local?.blocked) throw Error("Conflict must first be registered")
      local!.blocked = { kind: "REMOTE", operationId: null, currentRevision: revision }
      local!.remoteDraft = document; local!.state = "CONFLICT"
    },
    resolveConflict: async (_o: string, _d: string, choice: string, revision: number) => {
      archives.push(structuredClone(local!.draft))
      if (choice === "REMOTE") local!.draft = structuredClone(local!.remoteDraft!)
      local!.serverRevision = revision; local!.pending = null; local!.blocked = null
      if (choice === "DELETE") local!.resolvedDeletion = revision
      local!.state = choice === "LOCAL" ? "LOCAL_CHANGES" : "DRAFT_ACKNOWLEDGED"
    },
    acceptCleanDeletion: async (_o: string, _d: string, revision: number) => { local!.resolvedDeletion = revision; local!.serverRevision = revision },
    importRemote: async (ownerId: string, documentId: string, draft: Document, serverRevision: number) => {
      if (local && local.state !== "DRAFT_ACKNOWLEDGED") {
        local.blocked = { kind: "REMOTE", operationId: null, currentRevision: serverRevision }
        local.remoteDraft = structuredClone(draft); local.state = "CONFLICT"; return "CONFLICT"
      }
      const sequence = (local?.localSequence ?? 0) + 1
      local = { ownerId, documentId, draft: structuredClone(draft), serverRevision, localSequence: sequence, acknowledgedSequence: sequence,
        state: "DRAFT_ACKNOWLEDGED", blocked: null, pending: null, remoteDraft: null }; return "IMPORTED"
    },
  } as unknown as AccountJournalConflictBuffer<Document>
  const legacyBuffer = { read: vi.fn(async () => structuredClone(legacyLocal)), close: vi.fn() }
  const send = vi.fn(async (request: AccountJournalRequest<Document>): Promise<AccountJournalResult<Document>> => {
    expect(request.supportedRunningProfileVersions).toEqual([1, 2])
    if (offline) return { ok: false, code: "UNAVAILABLE" }
    if (request.action === "oracleV2Support") return supported
      ? { ok: true, data: { kind: "oracle-v2-support", version: 2 } } : { ok: false, code: "UPGRADE_REQUIRED" }
    if (request.action === "oracleV2RestartSupport") return supported
      ? { ok: true, data: { kind: "oracle-v2-restart-support", version: 1 } } : { ok: false, code: "UPGRADE_REQUIRED" }
    if (request.action === "restartOracleV2") {
      if (receipts.has(request.operationId)) return receipts.get(request.operationId)!
      if (!remote || remote.revision !== request.expectedRevision) return { ok: true, data: {
        kind: "conflict", documentId: request.documentId, operationId: request.operationId, currentRevision: remote?.revision ?? 0 } }
      if (remote.document?.data.version === "RUNNING_PROFILE_V2" && remote.document.data.status !== "DELETED") return { ok: false, code: "CONFLICT" }
      remote = { revision: remote.revision + 1, document: emptyOracleV2Document() }
      const receipt = { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision: remote.revision } } as const
      receipts.set(request.operationId, receipt)
      return lostAck ? { ok: false, code: "UNAVAILABLE" } : receipt
    }
    if (request.action === "read") return !remote ? { ok: false, code: "NOT_FOUND" } : remote.document
      ? { ok: true, data: { kind: "document", documentId: request.documentId, revision: remote.revision, document: structuredClone(remote.document) } }
      : { ok: true, data: { kind: "deleted", documentId: request.documentId, revision: remote.revision } }
    if (request.action !== "save") throw Error("Unexpected action")
    if (receipts.has(request.operationId)) return receipts.get(request.operationId)!
    if (request.expectedRevision !== (remote?.revision ?? 0)) return { ok: true, data: {
      kind: "conflict", documentId: request.documentId, operationId: request.operationId, currentRevision: remote!.revision } }
    remote = { revision: request.expectedRevision + 1, document: structuredClone(request.document) }
    const ack = { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision: remote.revision } } as const
    receipts.set(request.operationId, ack)
    return lostAck ? { ok: false, code: "UNAVAILABLE" } : ack
  })
  const changed = vi.fn()
  const make = () => createOracleV2Service(OWNER, changed, { buffer, legacyBuffer, send, isOwner: () => owner, exclusive: work => work() })
  const service = make()
  return { service, make, send, changed, buffer, archives, local: () => local, remote: () => remote,
    token: () => oracleV2EditToken(service.snapshot()), setRemote: (next: typeof remote) => { remote = next },
    pendingLegacy: () => { legacyLocal = { ...local!, state: "LOCAL_CHANGES", draft: legacy, pending: null, remoteDraft: null, resolvedDeletion: null } },
    legacyLocal: () => legacyLocal, switchOwner: () => { owner = false },
    offline: (value: boolean) => { offline = value }, supported: (value: boolean) => { supported = value }, lostAck: (value: boolean) => { lostAck = value },
    writes: () => send.mock.calls.map(([request]) => request).filter(request => request.action === "save") }
}
beforeEach(() => vi.stubGlobal("crypto", webcrypto))
afterEach(() => vi.unstubAllGlobals())

it("persists each answer locally and reloads without automatically submitting unfinished answers", async () => {
  const f = fixture(); await f.service.hydrate()
  expect(await f.service.saveDraft({ STRUCTURE_1: 5 }, f.token())).toBe(true)
  expect(f.service.snapshot().status).toBe("PENDING")
  expect(await f.service.saveDraft(answers, f.token())).toBe(true)
  expect(f.service.snapshot().draftDocument?.data.current?.revision).toBe(1)
  expect(f.service.snapshot().document).toBeNull()
  const next = f.make(); await next.hydrate()
  expect(next.snapshot().draftDocument?.data.current?.answers).toEqual(answers)
  expect(next.snapshot().document).toBeNull()
  expect(next.snapshot().draftState).toBe("EDITING")
  expect(await next.retry()).toBe(false)
  expect(f.writes()).toHaveLength(0)
  expect(await next.save(next.snapshot().draftDocument, oracleV2EditToken(next.snapshot()))).toBe(true)
  expect(next.snapshot().status).toBe("READY")
  expect(next.snapshot().revision).toBe(1)
})

it("saves character and reading snapshots and preserves them across reconnect and revision edits", async () => {
  const f = fixture(); await f.service.hydrate()
  const one = doc(); one.data.current!.selectedCharacter = "STRUCTURE"
  one.data.readings = [saveOracleProfileReading(one.data.current!, "2026-10-04T01:00:00.000Z")]
  expect(await f.service.save(one, f.token())).toBe(true)
  const next = f.make(); await next.hydrate()
  expect(next.snapshot().document).toEqual(one)
  expect(await next.save({ STRUCTURE_1: 1 }, oracleV2EditToken(next.snapshot()))).toBe(true)
  expect(next.snapshot().document?.data.current?.revision).toBe(2)
  expect(next.snapshot().document?.data.current?.selectedCharacter).toBeNull()
  expect(next.snapshot().document?.data.readings).toEqual(one.data.readings)
})

it("commits autosaved answers with a validated character without requiring caller revision arithmetic", async () => {
  const f = fixture(); await f.service.hydrate()
  await f.service.saveDraft({ STRUCTURE_1: 5 }, f.token())
  await f.service.saveDraft(answers, f.token())
  expect(await f.service.commitAnswers(answers, "CHALLENGE", f.token())).toBe(false)
  expect(f.writes()).toHaveLength(0)
  expect(await f.service.commitAnswers(answers, "STRUCTURE", f.token())).toBe(true)
  expect(f.service.snapshot().document?.data.current).toMatchObject({ revision: 1, selectedCharacter: "STRUCTURE", answers })
  expect(await f.service.commitAnswers(answers, null, f.token())).toBe(true)
  expect(f.service.snapshot().document?.data.current).toMatchObject({ revision: 2, selectedCharacter: null })
})

it("requires explicit V1 migration, preserves answers and timestamps, and never scores them", async () => {
  const f = fixture(); f.setRemote({ revision: 7, document: legacy }); await f.service.hydrate()
  expect(f.service.snapshot().status).toBe("MIGRATION_REQUIRED")
  expect(f.service.snapshot().legacyDocument).toEqual(legacy)
  expect(await f.service.save(answers, f.token())).toBe(false)
  expect(await f.service.migrateV1(f.token())).toBe(true)
  expect(f.service.snapshot().document?.data).toMatchObject({ legacyAnswers: legacy.data.answers,
    legacyAnsweredAt: legacy.data.answeredAt, current: null, readings: [] })
  expect(f.writes()[0]).toMatchObject({ writePurpose: "MIGRATION", expectedRevision: 7 })
})

it("never clears or silently converts an unsent V1 draft", async () => {
  const f = fixture(); f.setRemote({ revision: 1, document: legacy }); await f.service.hydrate(); f.pendingLegacy()
  const previous = structuredClone(f.legacyLocal())
  expect(await f.service.migrateV1(f.token())).toBe(false)
  expect(f.service.snapshot().status).toBe("LEGACY_DRAFT")
  expect(f.legacyLocal()).toEqual(previous); expect(f.writes()).toHaveLength(0)
})

it("rechecks V1 draft preservation even when submitting an already autosaved V2 document", async () => {
  const f = fixture(); await f.service.hydrate(); await f.service.saveDraft(answers, f.token()); f.pendingLegacy()
  expect(await f.service.save(f.service.snapshot().draftDocument, f.token())).toBe(false)
  expect(f.service.snapshot().status).toBe("LEGACY_DRAFT")
  expect(f.writes()).toHaveLength(0)
})

it("fails closed on missing or mismatched support and never interprets failures as empty", async () => {
  const f = fixture(); f.supported(false)
  expect(await f.service.hydrate()).toBe(false)
  expect(f.service.snapshot().status).toBe("FAILED")
  expect(await f.service.saveDraft(answers, f.token())).toBe(false)
  f.supported(true); await f.service.hydrate(); await f.service.saveDraft(answers, f.token()); f.supported(false)
  expect(await f.service.save(f.service.snapshot().draftDocument, f.token())).toBe(false)
  expect(f.local()?.draft).not.toBeNull(); expect(f.writes()).toHaveLength(0)
})

it("permits encrypted drafts while offline but cannot claim account save success", async () => {
  const f = fixture(); await f.service.hydrate(); f.offline(true)
  expect(await f.service.saveDraft(answers, f.token())).toBe(true)
  expect(await f.service.commitAnswers(answers, null, f.token())).toBe(false)
  expect(f.service.snapshot().draftState).toBe("SUBMITTING")
  expect(f.service.snapshot().status).toBe("PENDING")
  f.offline(false); expect(await f.service.retry()).toBe(true)
})

it("replays lost receipts exactly and refuses edits until the pending operation is acknowledged", async () => {
  const f = fixture(); await f.service.hydrate(); f.lostAck(true)
  expect(await f.service.save(answers, f.token())).toBe(false)
  expect(await f.service.saveDraft({ STRUCTURE_1: 1 }, f.token())).toBe(false)
  expect(f.service.snapshot().error).toBe("RETRY_REQUIRED")
  f.lostAck(false); const next = f.make(); await next.hydrate()
  expect(next.snapshot().status).toBe("READY")
  expect(f.writes()).toHaveLength(2); expect(f.writes()[0]).toEqual(f.writes()[1])
})

it("rejects stale edit tokens and cross-tab local sequences", async () => {
  const f = fixture(); await f.service.hydrate(); const token = f.token()
  expect(await f.service.saveDraft(answers, token)).toBe(true)
  expect(await f.service.saveDraft({}, token)).toBe(false)
  const next = f.make(); await next.hydrate()
  await f.service.saveDraft({ STRUCTURE_1: 1 }, f.token())
  expect(await next.saveDraft({}, oracleV2EditToken(next.snapshot()))).toBe(false)
  expect(next.snapshot().status).toBe("CONFLICT")
})

it("keeps conflicts for review and rechecks the remote before accepting it", async () => {
  const f = fixture(); await f.service.hydrate(); await f.service.saveDraft(answers, f.token())
  f.setRemote({ revision: 1, document: doc() }); await f.service.retry(); await f.service.hydrate()
  const review = f.service.snapshot(); expect(review.status).toBe("CONFLICT")
  f.setRemote({ revision: 2, document: doc(2) })
  expect(await f.service.resolve(review, "REMOTE")).toBe(false)
  expect(await f.service.resolve(f.service.snapshot(), "REMOTE")).toBe(true)
  expect(f.service.snapshot().revision).toBe(2); expect(f.archives).toHaveLength(1)
})

it("deletes current, legacy and derived material together without implicit resurrection", async () => {
  const f = fixture(); f.setRemote({ revision: 1, document: doc() }); await f.service.hydrate()
  expect(await f.service.deleteProfile(f.token())).toBe(true)
  expect(f.service.snapshot().status).toBe("DELETED")
  expect(f.service.snapshot().document?.data).toEqual({ version: "RUNNING_PROFILE_V2", status: "DELETED",
    legacyAnswers: {}, legacyAnsweredAt: null, current: null, readings: [] })
  expect(await f.service.save(answers, f.token())).toBe(false)
  const next = f.make(); await next.hydrate(); expect(next.snapshot().status).toBe("DELETED")
})

it("resolves an unsubmitted LOCAL conflict as an editing draft without submitting it", async () => {
  const f = fixture(); f.setRemote({ revision: 1, document: doc() }); await f.service.hydrate()
  await f.service.saveDraft({ STRUCTURE_1: 1 }, f.token())
  const competing = doc(2)
  competing.data.readings = [saveOracleProfileReading(doc().data.current!, "2026-10-04T01:00:00.000Z")]
  f.setRemote({ revision: 2, document: competing }); await f.service.hydrate()
  expect(await f.service.resolve(f.service.snapshot(), "LOCAL")).toBe(true)
  expect(f.service.snapshot().draftDocument?.data.current).toMatchObject({ revision: 3, answers: { STRUCTURE_1: 1 } })
  expect(f.service.snapshot().document?.data.current?.revision).toBe(2)
  expect(f.service.snapshot().draftState).toBe("EDITING")
  expect(f.writes()).toHaveLength(0)
  expect(f.service.snapshot().document?.data.readings).toEqual(competing.data.readings)
  expect(f.archives).toHaveLength(1)
})

it("keeps the completed result separate while editing an already-complete axis across reopen", async () => {
  const f = fixture(); f.setRemote({ revision: 1, document: doc() }); await f.service.hydrate()
  await f.service.saveDraft({ ...answers, STRUCTURE_1: 1 }, f.token())
  expect(f.service.snapshot().document).toEqual(doc())
  expect(f.service.snapshot().confirmedDocument).toEqual(doc())
  expect(f.service.snapshot().draftDocument?.data.current?.answers.STRUCTURE_1).toBe(1)
  const next = f.make(); await next.hydrate()
  expect(next.snapshot().document).toEqual(doc())
  expect(next.snapshot().confirmedDocument).toEqual(doc())
  expect(next.snapshot().draftState).toBe("EDITING")
  expect(await next.retry()).toBe(false)
  expect(f.writes()).toHaveLength(0)
})

it("persists offline completion intent separately from editing and replays it on reconnect", async () => {
  const f = fixture(); await f.service.hydrate(); await f.service.saveDraft(answers, f.token()); f.offline(true)
  expect(await f.service.commitAnswers(answers, "STRUCTURE", f.token())).toBe(false)
  const pending = f.service.snapshot()
  expect(pending.document?.data.current?.selectedCharacter).toBe("STRUCTURE")
  expect(pending.confirmedDocument).toBeNull()
  expect(pending.draftState).toBe("SUBMITTING")
  f.offline(false); const next = f.make(); await next.hydrate()
  expect(next.snapshot().status).toBe("READY")
  expect(next.snapshot().confirmedDocument?.data.current?.selectedCharacter).toBe("STRUCTURE")
  expect(next.snapshot().draftState).toBeNull()
  expect(f.writes()).toHaveLength(1)
})

it("submitted LOCAL conflicts still rebase and save the reviewed completed result", async () => {
  const f = fixture(); f.setRemote({ revision: 1, document: doc() }); await f.service.hydrate()
  f.setRemote({ revision: 2, document: doc(2) })
  expect(await f.service.commitAnswers({ STRUCTURE_1: 1 }, null, f.token())).toBe(false)
  await f.service.hydrate()
  expect(await f.service.resolve(f.service.snapshot(), "LOCAL")).toBe(true)
  expect(f.service.snapshot().status).toBe("READY")
  expect(f.service.snapshot().confirmedDocument?.data.current).toMatchObject({ revision: 3, answers: { STRUCTURE_1: 1 } })
})

it("cannot restore losing answers after a remote deletion", async () => {
  const f = fixture(); await f.service.hydrate(); await f.service.saveDraft(answers, f.token())
  f.setRemote({ revision: 1, document: null }); await f.service.hydrate()
  expect(await f.service.resolve(f.service.snapshot(), "LOCAL")).toBe(false)
  expect(await f.service.resolve(f.service.snapshot(), "REMOTE")).toBe(true)
  expect(f.service.snapshot().status).toBe("DELETED")
})

it("rejects historical fabrication and invalid revision changes before writes", async () => {
  const f = fixture(); f.setRemote({ revision: 1, document: doc() }); await f.service.hydrate()
  const changed = doc(); changed.data.current!.answers = {}
  expect(await f.service.save(changed, f.token())).toBe(false)
  expect(f.writes()).toHaveLength(0)
})

it("isolates owners and ignores delayed responses after close", async () => {
  const f = fixture(); await f.service.hydrate(); f.switchOwner(); f.changed.mockClear()
  expect(await f.service.saveDraft(answers, f.token())).toBe(false)
  expect(f.changed).not.toHaveBeenCalled(); expect(f.local()).toBeNull()
  const g = fixture(); let release!: () => void
  const original = g.send.getMockImplementation()!
  g.send.mockImplementation(async request => { if (request.action === "read") await new Promise<void>(r => { release = r }); return original(request) })
  const loading = g.service.hydrate(); await vi.waitFor(() => expect(release).toBeTypeOf("function"))
  g.service.close(); g.changed.mockClear(); release(); await loading
  expect(g.changed).not.toHaveBeenCalled(); expect(g.local()).toBeNull()
})

it("saves context on an unscored document and preserves it exactly through scored updates", async () => {
  const f = fixture(); await f.service.hydrate()
  const contextual = emptyOracleV2Document()
  contextual.data.context = { version: "ORACLE_CONTEXT_V1", answeredAt: "2026-10-04T00:00:00.000Z",
    answers: { movementForm: "INTERVAL" }, conditions: { places: ["TRACK"] } }
  expect(await f.service.saveDraft(contextual, f.token())).toBe(true)
  expect(f.service.snapshot().draftDocument?.data.current).toBeNull()
  expect(f.service.snapshot().document).toBeNull()
  expect(await f.service.save(contextual, f.token())).toBe(true)
  expect(f.service.snapshot().document?.data.current).toBeNull()
  expect(await f.service.commitAnswers(answers, "STRUCTURE", f.token())).toBe(true)
  expect(f.service.snapshot().document?.data.context).toEqual(contextual.data.context)
  const updated = structuredClone(f.service.snapshot().document!)
  const current = structuredClone(updated.data.current)
  updated.data.context!.answers.company = "TOGETHER"
  expect(await f.service.save(updated, f.token())).toBe(true)
  expect(f.service.snapshot().document?.data.current).toEqual(current)
  expect(f.service.snapshot().document?.data.readings).toEqual([])
  expect(await f.service.deleteProfile(f.token())).toBe(true)
  expect(f.service.snapshot().document?.data.context).toBeUndefined()
})

it.each([false, true])("preserves the reviewed local context when rebasing a conflicting draft (scored=%s)", async scored => {
  const f = fixture(); await f.service.hydrate()
  const local = scored ? doc() : emptyOracleV2Document()
  local.data.context = { version: "ORACLE_CONTEXT_V1", answeredAt: "2026-10-04T00:00:00.000Z",
    answers: { company: "ALONE" }, conditions: { places: ["TRACK"] } }
  expect(await f.service.saveDraft(local, f.token())).toBe(true)
  const remote = doc()
  remote.data.context = { ...local.data.context, answers: { company: "TOGETHER" } }
  remote.data.current!.selectedCharacter = "STRUCTURE"
  f.setRemote({ revision: 1, document: remote }); await f.service.hydrate()
  expect(await f.service.resolve(f.service.snapshot(), "LOCAL")).toBe(true)
  expect(f.service.snapshot().draftDocument?.data.context).toEqual(local.data.context)
  expect(f.service.snapshot().confirmedDocument).toEqual(remote)
  expect(f.service.snapshot().draftDocument?.data.current?.revision).toBe(scored ? 2 : 1)
  if (!scored) expect(f.service.snapshot().draftDocument?.data.current).toEqual(remote.data.current)
  expect(f.writes()).toHaveLength(0)
  expect(await f.service.save(f.service.snapshot().draftDocument, f.token())).toBe(true)
  expect(f.service.snapshot().confirmedDocument?.data.context).toEqual(local.data.context)
})

it("requires explicit confirmation to restart deleted profiles and replays a lost restart receipt", async () => {
  const f = fixture(); f.setRemote({ revision: 1, document: doc() }); await f.service.hydrate()
  expect(await f.service.restartProfile(f.token(), "START_NEW_ORACLE_V2")).toBe(false)
  await f.service.deleteProfile(f.token())
  expect(await f.service.restartProfile(f.token(), "wrong" as "START_NEW_ORACLE_V2")).toBe(false)
  expect(await f.service.save(answers, f.token())).toBe(false)
  f.lostAck(true)
  expect(await f.service.restartProfile(f.token(), "START_NEW_ORACLE_V2")).toBe(false)
  f.lostAck(false)
  expect(await f.service.restartProfile(f.token(), "START_NEW_ORACLE_V2")).toBe(true)
  expect(f.service.snapshot().document).toEqual(emptyOracleV2Document())
  const requests = f.send.mock.calls.map(([request]) => request).filter(r => r.action === "restartOracleV2")
  expect(requests).toHaveLength(2); expect(requests[0]).toEqual(requests[1])
  expect(await f.service.commitAnswers(answers, null, f.token())).toBe(true)
  expect(f.service.snapshot().document?.data.current?.revision).toBe(1)
})

it("can explicitly restart an observed SQL tombstone but never overwrite a newer document", async () => {
  const f = fixture(); f.setRemote({ revision: 8, document: null }); await f.service.hydrate()
  expect(await f.service.restartProfile(f.token(), "START_NEW_ORACLE_V2")).toBe(true)
  expect(f.service.snapshot().revision).toBe(9)
  const g = fixture(); g.setRemote({ revision: 8, document: null }); await g.service.hydrate()
  g.setRemote({ revision: 9, document: doc() })
  expect(await g.service.restartProfile(g.token(), "START_NEW_ORACLE_V2")).toBe(false)
  expect(g.remote()?.document).toEqual(doc())
})
