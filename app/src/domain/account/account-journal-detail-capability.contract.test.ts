import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { accountJournalDetailSupported, checkAccountJournalDetailSupport, requestAccountDocument } from "./account-journal-api"
import { activeLocalAccount, setActiveLocalAccount } from "./local-journal-ownership"
import { accountJournalRecordSchema, parseAccountJournalRecord, type AccountJournalRecord } from "./account-journal-record-schema"
import { waitingJournal } from "../../test/progressive-journal-fixture"
import { buildFileObservation, toFileObservationSummary } from "../import/file-observation"
import { ACCOUNT_DOCUMENT_MAX_BYTES, ACCOUNT_REQUEST_MAX_BYTES, accountDocumentFits } from "./account-document-capacity"

const owner = "a1111111-1111-4111-8111-111111111111"
const other = "d4444444-4444-4444-8444-444444444444"
const documentId = "b2222222-2222-4222-8222-222222222222"
const operationId = "c3333333-3333-4333-8333-333333333333"
const capability = { kind: "journal-detail-support", version: 1 }
const receipt = { kind: "saved", documentId, operationId, revision: 1 }

function dependencies(data: unknown, error: unknown = null) {
  const invoke = vi.fn().mockResolvedValue({ data, error })
  const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: owner }, access_token: "synthetic-owner-token" } }, error: null }) }, functions: { invoke } }
  return { client: vi.fn().mockResolvedValue(client as unknown as SupabaseClient), owner: activeLocalAccount, invoke }
}

function detailRecord(): AccountJournalRecord {
  const observation = buildFileObservation({ format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "synthetic-detail-v1", sourceActivityId: "2026-09-02T01:00:00Z",
    date: "2026-09-02", startedAt: "2026-09-02T01:00:00Z", timeZone: "UTC", sport: "RUNNING", distanceMeters: 400, durationSeconds: 120, durationMeaning: "SOURCE_DEFINED",
    laps: [{ sourceIndex: 0, distanceMeters: 400, durationSeconds: 120, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" }],
    confirmation: { sport: null, durationMeaning: null }, detail: { schemaVersion: 1,
      source: { originProvider: "GARMIN", evidence: "FILE_METADATA", manufacturer: "GARMIN", product: "synthetic", namespace: null },
      summary: [], samples: [{ sourceIndex: 0, timestamp: "2026-09-02T01:00:00Z", segmentIndex: 0, lapIndex: null, position: null, metrics: { heartRateBpm: 145 } }], laps: [], events: [] } })
  const base = waitingJournal()
  return { version: 5, state: "FINALIZED", kind: "JOURNAL", entry: waitingJournal({
    ...toFileObservationSummary(observation), objectiveDataState: "CONFIRMED", memoPurpose: "ANALYZABLE_TRAINING_NOTE", fileObservation: observation,
    fieldProvenance: { ...base.fieldProvenance,
      distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "import:tcx" },
      durationMin: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "import:tcx" } },
  }) }
}
function save(document = detailRecord()) { return { action: "save" as const, documentId, operationId, expectedRevision: 0, document } }
const call = (request: ReturnType<typeof save>, deps: ReturnType<typeof dependencies>) => requestAccountDocument(owner, request, () => true, accountJournalRecordSchema, deps)

beforeEach(() => { setActiveLocalAccount(null); localStorage.clear(); setActiveLocalAccount(owner) })
afterEach(() => { setActiveLocalAccount(null); localStorage.clear() })

describe("account detailed-file capability", () => {
  it("keeps a valid V5 document intact and sends no write until exact support is verified", async () => {
    const document = detailRecord(), deps = dependencies(receipt)
    expect(parseAccountJournalRecord(document)).toEqual(document)
    const before = JSON.stringify(document)
    expect(await call(save(document), deps)).toEqual({ ok: false, code: "UPGRADE_REQUIRED" })
    expect(deps.invoke).not.toHaveBeenCalled()
    expect(JSON.stringify(document)).toBe(before)
    expect(accountJournalDetailSupported(owner)).toBe(false)
    const probe = dependencies(capability)
    expect(await checkAccountJournalDetailSupport(owner, () => true, probe)).toBe(true)
    expect(probe.invoke.mock.calls[0]![1].body.action).toBe("journalDetailSupport")
    expect(await call(save(document), deps)).toEqual({ ok: true, data: receipt })
    expect(deps.invoke.mock.calls[0]![1].body).toEqual({ ...save(document), supportedJournalVersions: [2, 3, 4, 5], supportsExerciseLogV1: true })
    expect(deps.invoke.mock.calls[0]![1].body.document.entry.fileObservation.detail.samples[0].metrics.heartRateBpm).toBe(145)
  })

  it.each([
    { kind: "ready" }, { kind: "journal-detail-support", version: 2 },
    { kind: "journal-body-part-support", version: 1 }, { ...capability, unexpected: true },
  ])("does not promote a mismatched capability response %j", async response => {
    expect(await checkAccountJournalDetailSupport(owner, () => true, dependencies(response))).toBe(false)
    const deps = dependencies(receipt)
    expect(await call(save(), deps)).toEqual({ ok: false, code: "UPGRADE_REQUIRED" })
    expect(deps.invoke).not.toHaveBeenCalled()
    const legacy: AccountJournalRecord = { version: 2, state: "FINALIZED", kind: "JOURNAL", entry: waitingJournal() }
    expect(await call(save(legacy), deps)).toMatchObject({ ok: true })
    expect(deps.invoke.mock.calls[0]![1].body.supportedJournalVersions).toEqual([2, 3])
  })

  it.each([400, 404, 426, 501])("keeps unsupported HTTP %i retryable without authorizing detail writes", async status => {
    const deps = dependencies(null, { context: new Response(JSON.stringify({ error: "UNSUPPORTED" }), { status }) })
    expect(await checkAccountJournalDetailSupport(owner, () => true, deps)).toBe(false)
    expect(accountJournalDetailSupported(owner)).toBe(false)
    expect(await checkAccountJournalDetailSupport(owner, () => true, dependencies(capability))).toBe(true)
  })

  it("discards a late A response after A-B-A and requires a fresh A probe", async () => {
    const deps = dependencies(null)
    let resolve!: (value: unknown) => void
    deps.invoke.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = checkAccountJournalDetailSupport(owner, () => true, deps)
    await vi.waitFor(() => expect(deps.invoke).toHaveBeenCalledOnce())
    setActiveLocalAccount(other); setActiveLocalAccount(owner)
    resolve({ data: capability, error: null })
    expect(await pending).toBe(false)
    expect(accountJournalDetailSupported(owner)).toBe(false)
    expect(await checkAccountJournalDetailSupport(owner, () => true, dependencies(capability))).toBe(true)
  })

  it("discards a late response after the caller becomes obsolete while the owner stays the same", async () => {
    const deps = dependencies(null)
    let current = true, resolve!: (value: unknown) => void
    deps.invoke.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = checkAccountJournalDetailSupport(owner, () => current, deps)
    await vi.waitFor(() => expect(deps.invoke).toHaveBeenCalledOnce())
    current = false; resolve({ data: capability, error: null })
    expect(await pending).toBe(false)
    expect(accountJournalDetailSupported(owner)).toBe(false)
  })

  it("does not reuse cached support for an already obsolete caller", async () => {
    expect(await checkAccountJournalDetailSupport(owner, () => true, dependencies(capability))).toBe(true)
    const deps = dependencies(capability)
    expect(await checkAccountJournalDetailSupport(owner, () => false, deps)).toBe(false)
    expect(deps.invoke).not.toHaveBeenCalled()
  })

  it("retries a V5 read once after a supported upgrade probe and preserves the complete detail", async () => {
    const document = detailRecord(), deps = dependencies(null)
    deps.invoke.mockResolvedValueOnce({ data: null, error: { context: new Response("{}", { status: 426 }) } })
      .mockResolvedValueOnce({ data: capability, error: null })
      .mockResolvedValueOnce({ data: { kind: "document", documentId, revision: 1, document }, error: null })
    const result = await requestAccountDocument(owner, { action: "read", documentId }, () => true, accountJournalRecordSchema, deps)
    expect(result).toEqual({ ok: true, data: { kind: "document", documentId, revision: 1, document } })
    expect(deps.invoke.mock.calls.map(call => call[1].body.action)).toEqual(["read", "journalDetailSupport", "read"])
    expect(deps.invoke.mock.calls[2]![1].body.supportedJournalVersions).toEqual([2, 3, 4, 5])
  })

  it("measures the exact document limit in UTF-8 bytes, including JSON quotes", () => {
    const korean = "한".repeat(Math.floor((ACCOUNT_DOCUMENT_MAX_BYTES - 2) / 3))
    const exact = korean + "x".repeat(ACCOUNT_DOCUMENT_MAX_BYTES - new TextEncoder().encode(JSON.stringify(korean)).byteLength)
    expect(new TextEncoder().encode(JSON.stringify(exact)).byteLength).toBe(ACCOUNT_DOCUMENT_MAX_BYTES)
    expect(exact.length).toBeLessThan(ACCOUNT_DOCUMENT_MAX_BYTES / 2)
    expect(accountDocumentFits(exact)).toBe(true)
    expect(accountDocumentFits(exact + "x")).toBe(false)
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic
    expect(accountDocumentFits(cyclic)).toBe(false)
  })

  it("rejects a large Unicode request without sending or truncating the source document", async () => {
    expect(await checkAccountJournalDetailSupport(owner, () => true, dependencies(capability))).toBe(true)
    const base = detailRecord()
    if (base.entry.kind !== "post-session") throw new Error("INVALID_SYNTHETIC_FIXTURE")
    const document: AccountJournalRecord = { ...base, entry: { ...base.entry, memo: "한".repeat(Math.ceil(ACCOUNT_REQUEST_MAX_BYTES / 3)) } }
    const request = save(document), before = JSON.stringify(document), deps = dependencies(receipt)
    expect(JSON.stringify(request).length).toBeLessThan(ACCOUNT_REQUEST_MAX_BYTES)
    expect(new TextEncoder().encode(JSON.stringify(request)).byteLength).toBeGreaterThan(ACCOUNT_REQUEST_MAX_BYTES)
    expect(await call(request, deps)).toEqual({ ok: false, code: "DOCUMENT_CAPACITY_EXCEEDED" })
    expect(deps.invoke).not.toHaveBeenCalled()
    expect(JSON.stringify(document)).toBe(before)
  })

  it("keeps a server-side 413 as a terminal capacity result instead of retrying a write", async () => {
    expect(await checkAccountJournalDetailSupport(owner, () => true, dependencies(capability))).toBe(true)
    const deps = dependencies(null, { context: new Response("{}", { status: 413 }) })
    expect(await call(save(), deps)).toEqual({ ok: false, code: "DOCUMENT_CAPACITY_EXCEEDED" })
    expect(deps.invoke).toHaveBeenCalledOnce()
  })
})
