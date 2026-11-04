import { webcrypto } from "node:crypto"
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest"
import { largeFileJournalFixture } from "../../test/large-file-journal-fixture"
import { buildFileObservation, prepareLegacyFileDetailUpgrade } from "../import/file-observation"
import { accountJournalRecordSchema, correctAccountJournalImportedObservation, type AccountJournalRecord } from "./account-journal-record-schema"
import type { AccountJournalDraftView } from "./account-journal-draft-buffer"
import { decompressFileJson, FILE_COMPRESSED_MAX_BYTES, FILE_CORRECTION_MAX_BYTES, FILE_DOCUMENT_MAX_BYTES, jsonBytes } from "./account-file-document-codec"
import { activeLocalAccount, setActiveLocalAccount } from "./local-journal-ownership"
import { accountJournalLargeFileSupported } from "./account-journal-api"
import { pinStorageOperationRevision, rememberStorageConsentRevision } from "./storage-consent-revision"

const mocks = vi.hoisted(() => ({ view: null as unknown, ack: vi.fn(), reject: vi.fn(), queue: vi.fn(), client: null as unknown }))
vi.mock("./supabase-client", () => ({ supabase: async () => mocks.client }))
vi.mock("./config", () => ({ accountConfig: () => ({ url: "https://project.example", anonKey: "sb_publishable_synthetic" }) }))
vi.mock("./account-journal-draft-buffer", async importOriginal => ({
  ...await importOriginal<typeof import("./account-journal-draft-buffer")>(),
  createAccountDocumentBuffer: () => ({ read: async () => mocks.view, list: async () => [mocks.view],
    ack: mocks.ack, reject: mocks.reject, queue: mocks.queue, close: () => {} }),
}))
vi.mock("./account-journal-projection", () => ({ putAccountJournalProjection: vi.fn(), confirmAccountJournalProjection: vi.fn(),
  markAccountJournalFullListConfirmed: vi.fn(), removeAccountJournalProjection: vi.fn(), resetAccountJournalProjection: vi.fn(),
  setAccountJournalProjectionStatus: vi.fn(), suppressAccountJournalLocalCopy: vi.fn(),
  markCurrentConfirmedAccountJournalProjection: vi.fn(), currentConfirmedAccountJournalRevision: vi.fn() }))

import { accountJournalDocumentId, disposeAccountJournalRecords, retryAccountJournalFileObservation } from "./account-journal-record-service"

const owner = "a1111111-1111-4111-8111-111111111111"
const operationId = "d4444444-4444-4444-8444-444444444444"
const gateway = "https://company.example/api/account-journal"
const token = `synthetic.${Buffer.from(JSON.stringify({ sub: owner, session_id: "e5555555-5555-4555-8555-555555555555" })).toString("base64url")}.signature`
let original: AccountJournalRecord, proposal: AccountJournalRecord
let documentId: string
let supportAvailable: boolean
let calls: { body: Record<string, unknown>; revision: string | null }[]
const view = () => mocks.view as AccountJournalDraftView<AccountJournalRecord>

beforeAll(() => {
  // 7,200 synthetic points exceed the Edge correction budget without requiring
  // an unrelated performance benchmark in this retry regression.
  const rich = largeFileJournalFixture(7200)
  if (rich.entry.kind !== "post-session" || !rich.entry.fileObservation) throw new Error("SYNTHETIC_FILE_REQUIRED")
  const { schemaVersion, source, sourceObservationKey, contentRevisionFingerprint, completeness,
    detail, sourceIdentityFingerprint, ...input } = rich.entry.fileObservation
  const summary = buildFileObservation({ ...input, parserVersion: "legacy-parser-v1" })
  original = accountJournalRecordSchema.parse({ ...rich, version: 3, entry: { ...rich.entry, fileObservation: summary } })
  const replacement = prepareLegacyFileDetailUpgrade(summary, rich.entry.fileObservation)!
  proposal = correctAccountJournalImportedObservation(original, summary.contentRevisionFingerprint, replacement, ["detail"])!
  expect(proposal).not.toBeNull()
  expect(jsonBytes(replacement)).toBeGreaterThan(FILE_CORRECTION_MAX_BYTES)
  expect(jsonBytes(original)).toBeLessThan(600_000)
})

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto)
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, callback: () => unknown) => callback() } })
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
  vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
  vi.stubEnv("VITE_ACCOUNT_JOURNAL_GATEWAY_URL", gateway)
  disposeAccountJournalRecords(); setActiveLocalAccount(null); localStorage.clear(); setActiveLocalAccount(owner)
  vi.clearAllMocks()
  documentId = await accountJournalDocumentId(owner, original.entry.id)
  if (original.entry.kind !== "post-session" || proposal.entry.kind !== "post-session") throw new Error("SYNTHETIC_FILE_REQUIRED")
  mocks.view = { ownerId: owner, documentId, serverRevision: 1, localSequence: 2, acknowledgedSequence: 1, state: "PENDING",
    draft: proposal, remoteDraft: null, blocked: null,
    pending: { operationId, expectedRevision: 1, sequence: 2, draft: proposal, originalDraft: original,
      mutation: { action: "correctImportedObservation", previousContentRevisionFingerprint: original.entry.fileObservation!.contentRevisionFingerprint,
        replacementObservation: proposal.entry.fileObservation!, confirmedChangedFields: ["detail"] } },
  } satisfies AccountJournalDraftView<AccountJournalRecord>
  mocks.ack.mockImplementation(async (_owner: string, _document: string, operation: string, revision: number) => {
    expect(operation).toBe(operationId)
    mocks.view = { ...view(), serverRevision: revision, acknowledgedSequence: 2, state: "DRAFT_ACKNOWLEDGED", pending: null }
    return true
  })
  mocks.reject.mockImplementation(async (_owner: string, _document: string, _operation: string,
    rejection: NonNullable<AccountJournalDraftView<AccountJournalRecord>["pending"]>["rejection"]) => {
    mocks.view = { ...view(), pending: { ...view().pending!, rejection } }
    return true
  })
  mocks.client = { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: token } }, error: null }) } }
  rememberStorageConsentRevision(owner, 7)
  pinStorageOperationRevision(owner, operationId)
  supportAvailable = true; calls = []
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    if (String(url) === "https://project.example/rest/v1/rpc/get_account_storage_consent") {
      expect(body).toEqual({ expected_user_id_input: owner })
      return Response.json({ userId: owner, revision: 7, purposeVersion: "2026-10-05", healthStorage: true, journalTextStorage: true, operationsReady: true })
    }
    expect(String(url)).toBe(gateway)
    calls.push({ body, revision: new Headers(init?.headers).get("x-trainoracle-storage-revision") })
    if (body.action === "journalDetailSupport") return Response.json({ kind: "journal-detail-support", version: 1 })
    if (body.action === "journalLargeFileSupport") return supportAvailable
      ? Response.json({ kind: "journal-large-file-support", version: 1, maxDocumentBytes: FILE_DOCUMENT_MAX_BYTES,
        maxCompressedBytes: FILE_COMPRESSED_MAX_BYTES, maxCorrectionBytes: FILE_DOCUMENT_MAX_BYTES })
      : Response.json({ error: "UNAVAILABLE" }, { status: 503 })
    expect(body.action).toBe("compressedFileMutation")
    return Response.json({ kind: "saved", documentId, operationId, revision: 2 })
  }))
})

afterEach(() => { disposeAccountJournalRecords(); setActiveLocalAccount(null); localStorage.clear(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it("renegotiates a reloaded large correction despite a small V3 server base, then sends its exact pending identity", async () => {
  const pending = structuredClone(view().pending!)
  expect(accountJournalLargeFileSupported(owner)).toBe(false)
  expect(await retryAccountJournalFileObservation(original.entry.id)).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(calls.map(call => call.body.action)).toEqual(["journalDetailSupport", "journalLargeFileSupport", "compressedFileMutation"])
  const sent = await decompressFileJson(calls.at(-1)!.body.envelope)
  expect(sent).toEqual({ ...pending.mutation, documentId, operationId, expectedRevision: 1,
    supportedJournalVersions: [2, 3, 4, 5], supportsExerciseLogV1: true, supportsLargeFileV1: true })
  expect(calls.every(call => call.revision === "7")).toBe(true)
  expect(view()).toMatchObject({ state: "DRAFT_ACKNOWLEDGED", serverRevision: 2, pending: null })
  expect(mocks.queue).not.toHaveBeenCalled()
  expect(mocks.reject).not.toHaveBeenCalled()
})

it("keeps the immutable correction after an unavailable probe and retries without replacing its operation", async () => {
  const pending = structuredClone(view().pending!)
  supportAvailable = false
  expect(await retryAccountJournalFileObservation(original.entry.id)).toEqual({ ok: true, storage: "PENDING" })
  expect(view().pending).toEqual(pending)
  expect(calls.some(call => call.body.action === "compressedFileMutation")).toBe(false)
  expect(mocks.reject).not.toHaveBeenCalled()
  expect(mocks.ack).not.toHaveBeenCalled()
  supportAvailable = true
  expect(await retryAccountJournalFileObservation(original.entry.id)).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(calls.filter(call => call.body.action === "compressedFileMutation")).toHaveLength(1)
  expect(mocks.queue).not.toHaveBeenCalled()
  expect(activeLocalAccount()).toBe(owner)
})
