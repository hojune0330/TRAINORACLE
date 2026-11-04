import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { webcrypto } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { largeFileJournalFixture } from "../../test/large-file-journal-fixture"
import { accountJournalRecordSchema } from "./account-journal-record-schema"
import { checkAccountJournalDetailSupport, checkAccountJournalLargeFileSupport, accountJournalLargeFileSupported, accountJournalCorrectionMaxBytes, requestAccountDocument } from "./account-journal-api"
import { activeLocalAccount, setActiveLocalAccount } from "./local-journal-ownership"
import { compressFileJson, decompressFileJson, FILE_DOCUMENT_MAX_BYTES, FILE_COMPRESSED_MAX_BYTES, FILE_CORRECTION_MAX_BYTES, jsonBytes } from "./account-file-document-codec"
const owner = "a1111111-1111-4111-8111-111111111111", other = "b2222222-2222-4222-8222-222222222222"
const documentId = "c3333333-3333-4333-8333-333333333333", operationId = "d4444444-4444-4444-8444-444444444444"
const support = { kind: "journal-large-file-support", version: 1, maxDocumentBytes: FILE_DOCUMENT_MAX_BYTES, maxCompressedBytes: FILE_COMPRESSED_MAX_BYTES, maxCorrectionBytes: FILE_CORRECTION_MAX_BYTES }
let document: ReturnType<typeof largeFileJournalFixture>
beforeAll(() => { document = largeFileJournalFixture() })
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); setActiveLocalAccount(null); localStorage.clear(); setActiveLocalAccount(owner) })
afterEach(() => { setActiveLocalAccount(null); localStorage.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
function dependencies() {
  const invoke = vi.fn(async (_name: string, options: { body: { action: string; envelope?: unknown } }) => ({ data: options.body.action === "journalDetailSupport" ? { kind: "journal-detail-support", version: 1 }
    : options.body.action === "journalLargeFileSupport" ? support : { kind: "saved", documentId, operationId, revision: 1 }, error: null }))
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: "synthetic" } }, error: null }) }, functions: { invoke } }
  return { client: async () => client as unknown as SupabaseClient, owner: activeLocalAccount, invoke }
}
describe("bounded large FILE account storage", () => {
  it("uses only an authenticated bounded correction limit and invalidates it when the transport changes", async () => {
    const deps = dependencies()
    deps.invoke.mockImplementation(async () => ({ data: { ...support, maxCorrectionBytes: FILE_DOCUMENT_MAX_BYTES }, error: null }))
    expect(accountJournalCorrectionMaxBytes(owner)).toBe(FILE_CORRECTION_MAX_BYTES)
    expect(await checkAccountJournalLargeFileSupport(owner, () => true, deps)).toBe(true)
    expect(accountJournalCorrectionMaxBytes(owner)).toBe(FILE_DOCUMENT_MAX_BYTES)
    vi.stubEnv("VITE_ACCOUNT_JOURNAL_GATEWAY_URL", "https://company.example/api/account-journal")
    expect(accountJournalLargeFileSupported(owner)).toBe(false)
    expect(accountJournalCorrectionMaxBytes(owner)).toBe(FILE_CORRECTION_MAX_BYTES)
  })
  it("sends a bounded compressed mutation only after distinct current-owner capability", async () => {
    const deps = dependencies()
    expect(await checkAccountJournalDetailSupport(owner, () => true, deps)).toBe(true)
    const request = { action: "save" as const, documentId, operationId, expectedRevision: 0, document, writePurpose: "FILE_OBSERVATION" as const }
    expect(await requestAccountDocument(owner, request, () => true, accountJournalRecordSchema, deps)).toEqual({ ok: false, code: "UPGRADE_REQUIRED" })
    expect(await checkAccountJournalLargeFileSupport(owner, () => true, deps)).toBe(true)
    expect(await requestAccountDocument(owner, request, () => true, accountJournalRecordSchema, deps)).toMatchObject({ ok: true, data: { kind: "saved" } })
    const wire = deps.invoke.mock.calls.at(-1)![1].body
    expect(wire.action).toBe("compressedFileMutation")
    expect(jsonBytes(wire)).toBeLessThan(655_360)
    expect(await decompressFileJson(wire.envelope)).toEqual({ ...request, supportedJournalVersions: [2, 3, 4, 5], supportsExerciseLogV1: true, supportsLargeFileV1: true })
    setActiveLocalAccount(other); setActiveLocalAccount(owner)
    expect(accountJournalLargeFileSupported(owner)).toBe(false)
  })
  it("rejects size lies, expansion past declared bytes, checksum changes and truncation", async () => {
    const encoded = await compressFileJson(document)
    for (const patch of [{ uncompressedBytes: encoded.uncompressedBytes - 1 }, { uncompressedBytes: encoded.uncompressedBytes + 1 },
      { uncompressedBytes: FILE_DOCUMENT_MAX_BYTES + 1 }, { sha256: "0".repeat(64) }, { data: encoded.data.slice(0, -4) }, { unexpected: true }]) {
      await expect(decompressFileJson({ ...encoded, ...patch })).rejects.toThrow("FILE_DOCUMENT_CODEC_INVALID")
    }
    await expect(compressFileJson("x".repeat(FILE_DOCUMENT_MAX_BYTES))).rejects.toThrow("FILE_DOCUMENT_CODEC_INVALID")
  })
  it("rejects incompressible content above the compressed budget even when raw JSON fits", async () => {
    let seed = 123456789
    const hex = Array.from({ length: 600_000 }, () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
      return (seed & 255).toString(16).padStart(2, "0")
    }).join("")
    expect(jsonBytes({ synthetic: hex })).toBeLessThan(FILE_DOCUMENT_MAX_BYTES)
    await expect(compressFileJson({ synthetic: hex })).rejects.toThrow("FILE_DOCUMENT_CODEC_INVALID")
  })
})
