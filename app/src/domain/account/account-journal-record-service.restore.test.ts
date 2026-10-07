import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AccountJournalRequest } from "./account-journal-api"
import type { AccountJournalRecord } from "./account-journal-record-schema"
import { waitingJournal } from "../../test/progressive-journal-fixture"

const mocks = vi.hoisted(() => ({ owner: "a1111111-1111-4111-8111-111111111111", send: vi.fn(),
  changed: () => {}, view: null as unknown, read: vi.fn(), importRemote: vi.fn(), close: vi.fn() }))
vi.mock("./account-journal-api", () => ({ accountJournalPreviewEnabled: () => true, requestAccountDocument: (...args: unknown[]) => mocks.send(...args) }))
vi.mock("./local-journal-ownership", () => ({ activeLocalAccount: () => mocks.owner,
  onLocalJournalScopeChange: (callback: () => void) => { mocks.changed = callback; return () => {} } }))
vi.mock("./account-journal-draft-buffer", () => ({ createAccountDocumentBuffer: () => ({ read: mocks.read, importRemote: mocks.importRemote, close: mocks.close }) }))
vi.mock("./account-journal-projection", () => ({ putAccountJournalProjection: vi.fn(), confirmAccountJournalProjection: vi.fn(),
  markAccountJournalFullListConfirmed: vi.fn(), removeAccountJournalProjection: vi.fn(), resetAccountJournalProjection: vi.fn(),
  setAccountJournalProjectionStatus: vi.fn(), suppressAccountJournalLocalCopy: vi.fn(),
  markCurrentConfirmedAccountJournalProjection: vi.fn(), currentConfirmedAccountJournalRevision: vi.fn() }))

import { accountJournalDocumentId, disposeAccountJournalRecords, restoreAccountJournalVersion, restoreAccountJournalVersionResult } from "./account-journal-record-service"

let documentId: string
let remoteRevision: number
let record: AccountJournalRecord
let restoreResult: unknown
let historyAvailable: boolean
let historySourceRevision: number
const restoreCalls = () => mocks.send.mock.calls.map(call => call[1] as AccountJournalRequest).filter(call => call.action === "restore")
beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto)
  // Match the native two-argument Web Locks overload used by this service.
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, callback: () => unknown) => callback() } })
  disposeAccountJournalRecords()
  vi.clearAllMocks()
  localStorage.clear()
  mocks.owner = "a1111111-1111-4111-8111-111111111111"
  record = { version: 2, kind: "JOURNAL", state: "FINALIZED", entry: waitingJournal() }
  documentId = await accountJournalDocumentId(mocks.owner, record.entry.id)
  remoteRevision = 2; restoreResult = null; historyAvailable = true; historySourceRevision = 1
  mocks.view = null
  mocks.read.mockImplementation(async () => mocks.view)
  mocks.importRemote.mockImplementation(async (_owner: string, _documentId: string, document: AccountJournalRecord, revision: number) => {
    mocks.view = { documentId, draft: document, serverRevision: revision, localSequence: 1, state: "DRAFT_ACKNOWLEDGED" }
    return "IMPORTED"
  })
  mocks.send.mockImplementation(async (_owner: string, request: AccountJournalRequest) => {
    if (request.action === "read") return { ok: true, data: { kind: "document", documentId, revision: remoteRevision, document: record } }
    if (request.action === "history") return { ok: true, data: { kind: "history", documentId, versions: historyAvailable ? [{
      revision: historySourceRevision, document: record, replacedAt: "2026-09-08T00:00:00Z", expiresAt: "2026-10-08T00:00:00Z", reason: "replaced",
    }] : [] } }
    if (request.action === "restore") {
      if (restoreResult) {
        const result = restoreResult as { ok: boolean; data?: Record<string, unknown> }
        return result.data ? { ...result, data: { ...result.data, operationId: request.operationId } } : result
      }
      remoteRevision = request.expectedRevision + 1
      return { ok: true, data: { kind: "restored", documentId, revision: remoteRevision, operationId: request.operationId, sourceRevision: request.sourceRevision } }
    }
    throw Error("Unexpected request")
  })
})
afterEach(() => { disposeAccountJournalRecords(); vi.unstubAllGlobals(); localStorage.clear() })

describe("journal restore result and immutable source lifecycle", () => {
  it("confirms a normal restore only after its new current document is reconciled", async () => {
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: true })
    expect(restoreCalls()).toHaveLength(1)
    expect(restoreCalls()[0]).toMatchObject({ sourceRevision: 1, expectedRevision: 2 })
    expect(mocks.importRemote.mock.calls.map(call => call[3])).toEqual([2, 3])
  })
  it("preserves the existing successful boolean restore contract", async () => {
    expect(await restoreAccountJournalVersion(documentId, 1, 2)).toBe(true)
  })
  it("does not mutate or retry a historical source missing from a fresh history response", async () => {
    historyAvailable = false
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: false, code: "SOURCE_UNAVAILABLE" })
    const calls = mocks.send.mock.calls.length
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: false, code: "SOURCE_UNAVAILABLE" })
    expect(mocks.send).toHaveBeenCalledTimes(calls)
    expect(restoreCalls()).toHaveLength(0)
    expect(mocks.view).toMatchObject({ draft: record, serverRevision: 2 })
  })
  it.each(["receipt", "preflight"])("closes only the unavailable selected source after a %s rejection", async kind => {
    restoreResult = kind === "receipt" ? { ok: true, data: { kind: "source_unavailable", documentId, currentRevision: 2, sourceRevision: 1 } }
      : { ok: false, code: "SOURCE_UNAVAILABLE" }
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: false, code: "SOURCE_UNAVAILABLE" })
    expect(await restoreAccountJournalVersion(documentId, 1, 2)).toBe(false)
    expect(restoreCalls()).toHaveLength(1)
    expect(mocks.view).toMatchObject({ draft: record, serverRevision: 2 })
    expect(mocks.close).not.toHaveBeenCalled()
  })
  it("does not block another available historical revision of the same current document", async () => {
    restoreResult = { ok: false, code: "SOURCE_UNAVAILABLE" }
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: false, code: "SOURCE_UNAVAILABLE" })
    restoreResult = null; remoteRevision = 3; historySourceRevision = 2
    expect(await restoreAccountJournalVersionResult(documentId, 2, 3)).toEqual({ ok: true })
    expect(restoreCalls().map(request => request.action === "restore" && request.sourceRevision)).toEqual([1, 2])
  })
  it("requires review of a changed current revision before sending any restore", async () => {
    remoteRevision = 3
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: false, code: "REMOTE_CHANGED" })
    expect(restoreCalls()).toHaveLength(0)
  })
  it.each(["REMOTE_CHANGED", "CONFLICT"])("keeps %s distinct from a missing source after restore rejection", async expected => {
    restoreResult = expected === "REMOTE_CHANGED" ? { ok: true, data: { kind: "conflict", documentId, currentRevision: 3 } }
      : { ok: false, code: "CONFLICT" }
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: false, code: expected })
    expect(restoreCalls()).toHaveLength(1)
  })
  it("retries an uncertain request with the identical operation ID and confirms the eventual result", async () => {
    restoreResult = { ok: false, code: "UNAVAILABLE" }
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: false, code: "FAILED" })
    restoreResult = null
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: true })
    const requests = restoreCalls()
    expect(requests).toHaveLength(2)
    expect(requests[0]).toEqual(requests[1])
  })
  it("does not restore across a pending local edit", async () => {
    mocks.view = { state: "DRAFT_PENDING", draft: record }
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: false, code: "FAILED" })
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it("ignores a terminal source response after account scope changes", async () => {
    const send = mocks.send.getMockImplementation()!
    mocks.send.mockImplementation(async (...args: unknown[]) => {
      if ((args[1] as AccountJournalRequest).action === "restore") {
        mocks.owner = "different-owner"; mocks.changed()
        return { ok: false, code: "SOURCE_UNAVAILABLE" }
      }
      return send(...args)
    })
    expect(await restoreAccountJournalVersionResult(documentId, 1, 2)).toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(mocks.importRemote).toHaveBeenCalledTimes(1)
  })
})
