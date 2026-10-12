import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { webcrypto } from "node:crypto"
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js"
import { accountJournalPreviewEnabled, requestAccountJournal, requestAccountDocument, checkAccountJournalBodyPartSupport,
  accountBodyPartMetadataSupported } from "./account-journal-api"
import { setActiveLocalAccount } from "./local-journal-ownership"
import { accountJournalRecordSchema, type AccountJournalRecord } from "./account-journal-record-schema"
import { waitingJournal } from "../../test/progressive-journal-fixture"
import { buildFileObservation } from "../import/file-observation"
import { rememberStorageConsentRevision, pinStorageOperationRevision } from "./storage-consent-revision"
import { accountOracleCompatibleDocumentSchema, emptyOracleV2Document } from "./account-oracle-v2-schema"
import { ACCOUNT_DELETION_BOUNDARY_PREFIX, closeAccountDeletionBoundary } from "./account-deletion-boundary"
import { createConsentCheckedFetch, LOCAL_COLLECTION_SEND_GUARD_HEADER, registerCollectionSendGuard } from "./consent-checked-fetch"
import { accountGoalProgramDocumentSchema, splitAccountGoalProgramCollection } from "./account-goal-program-schema"
import { syntheticGoalProgram } from "./account-goal-program.test-fixtures"
import { todayISO } from "../journal-store"
import { ACCOUNT_NETWORK_DEADLINE_MS } from "./account-network-deadline"

const ownerId = "a1111111-1111-4111-8111-111111111111"
const documentId = "b2222222-2222-4222-8222-222222222222"
const operationId = "c3333333-3333-4333-8333-333333333333"
const otherOwnerId = "d4444444-4444-4444-8444-444444444444"
const accessToken = "synthetic-token-A"
const draft = { version: 1 as const, state: "DRAFT" as const, visibility: "PRIVATE" as const,
  date: "2026-09-08", title: "Synthetic", body: "Synthetic draft" }
const request = { action: "save" as const, documentId, operationId, expectedRevision: 0, document: draft }
function dependencies(data: unknown, error: unknown = null) {
  const invoke = vi.fn().mockResolvedValue({ data, error })
  const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: ownerId }, access_token: accessToken } }, error: null }) },
    functions: { invoke } }
  return { client: vi.fn().mockResolvedValue(client as unknown as SupabaseClient), owner: () => ownerId, invoke, auth: client.auth }
}

describe("private body capability owner binding", () => {
  afterEach(() => { setActiveLocalAccount(null); localStorage.clear() })
  it("sends no v4 write before verified support and revokes capability on A-B-A", async () => {
    localStorage.clear(); setActiveLocalAccount(ownerId)
    const document: AccountJournalRecord = { version: 4, kind: "JOURNAL", state: "FINALIZED",
      entry: { ...waitingJournal(), painCheckStatus: "SIGNAL_REPORTED" as const,
        fieldProvenance: { ...waitingJournal().fieldProvenance, painParts: { provenance: "EXPLICIT" as const } },
        bodyPartMetadata: { schemaVersion: 1 as const, observations: [{
          id: "other_11111111-1111-4111-8111-111111111111" as const, labelSnapshot: "Synthetic private", severity: 4 as const,
        }] } } }
    const save = { action: "save" as const, documentId, operationId, expectedRevision: 0, document }
    const before = dependencies({ kind: "saved", documentId, operationId, revision: 1 })
    expect(await requestAccountDocument(ownerId, save, () => true, accountJournalRecordSchema, before)).toEqual({ ok: false, code: "UPGRADE_REQUIRED" })
    expect(before.invoke).not.toHaveBeenCalled()
    expect(await checkAccountJournalBodyPartSupport(ownerId, () => true,
      dependencies({ kind: "ready" }))).toBe(false)
    expect(accountBodyPartMetadataSupported(ownerId)).toBe(false)
    expect(await checkAccountJournalBodyPartSupport(ownerId, () => true,
      dependencies({ kind: "journal-body-part-support", version: 1 }))).toBe(true)
    const after = dependencies({ kind: "saved", documentId, operationId, revision: 1 })
    expect(await requestAccountDocument(ownerId, save, () => true, accountJournalRecordSchema, after)).toMatchObject({ ok: true })
    expect(after.invoke.mock.calls[0]?.[1].body.supportedJournalVersions).toEqual([2, 3, 4])
    setActiveLocalAccount(otherOwnerId); setActiveLocalAccount(ownerId)
    expect(accountBodyPartMetadataSupported(ownerId)).toBe(false)
  })
  it("does not accept a late support reply after the owning scope changes", async () => {
    localStorage.clear(); setActiveLocalAccount(ownerId)
    const deps = dependencies(null)
    let finish!: (result: unknown) => void
    deps.invoke.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const result = checkAccountJournalBodyPartSupport(ownerId, () => true, deps)
    await vi.waitFor(() => expect(deps.invoke).toHaveBeenCalled())
    setActiveLocalAccount(otherOwnerId); setActiveLocalAccount(ownerId)
    finish({ data: { kind: "journal-body-part-support", version: 1 }, error: null })
    expect(await result).toBe(false)
    expect(accountBodyPartMetadataSupported(ownerId)).toBe(false)
  })
})

it("unpinned retries cannot borrow a regrant while explicitly pinned new operations retain their revision",async()=>{
  localStorage.clear()
  try {
    rememberStorageConsentRevision(ownerId,3)
    const old=dependencies({kind:"saved",documentId,operationId,revision:1})
    await requestAccountJournal(ownerId,request,()=>true,old)
    expect(old.invoke.mock.calls[0]?.[1].headers["x-trainoracle-storage-revision"]).toBe("0")
    const freshId="e5555555-5555-4555-8555-555555555555"
    pinStorageOperationRevision(ownerId,freshId)
    const fresh=dependencies({kind:"saved",documentId,operationId:freshId,revision:1})
    await requestAccountJournal(ownerId,{...request,operationId:freshId},()=>true,fresh)
    expect(fresh.invoke.mock.calls[0]?.[1].headers["x-trainoracle-storage-revision"]).toBe("3")
  } finally { localStorage.clear() }
})
it("keeps V1 and V2 support distinct, advertises V2 reads and fails closed on mismatched responses", async () => {
  const request = { action: "oracleV2Support", supportedRunningProfileVersions: [1, 2] } as const
  const call = { ...request, supportedRunningProfileVersions: [1, 2] as (1 | 2)[] }
  for (const response of [{ kind: "running-profile-support", version: 1 }, { kind: "oracle-v2-support", version: 1 }, { kind: "ready" }]) {
    expect(await requestAccountDocument(ownerId, call, () => true, accountOracleCompatibleDocumentSchema, dependencies(response)))
      .toEqual({ ok: false, code: "INVALID_RESPONSE" })
  }
  expect(await requestAccountDocument(ownerId, call, () => true, accountOracleCompatibleDocumentSchema,
    dependencies({ kind: "oracle-v2-support", version: 2 }))).toEqual({ ok: true, data: { kind: "oracle-v2-support", version: 2 } })
  const document = emptyOracleV2Document()
  const deps = dependencies({ kind: "document", documentId, revision: 1, document })
  expect(await requestAccountDocument(ownerId, { action: "read", documentId, supportedRunningProfileVersions: [1, 2] },
    () => true, accountOracleCompatibleDocumentSchema, deps)).toMatchObject({ ok: true, data: { document } })
  expect(deps.invoke.mock.calls[0]![1].body.supportedRunningProfileVersions).toEqual([1, 2])
})
it("validates the separate restart capability and exact restart receipt without weakening CAS", async () => {
  const probe = { action: "oracleV2RestartSupport" } as const
  const capability = { kind: "oracle-v2-restart-support", version: 1 }
  const schema = accountOracleCompatibleDocumentSchema
  expect(await requestAccountDocument(ownerId, probe, () => true, schema, dependencies(capability)))
    .toEqual({ ok: true, data: capability })
  expect(await requestAccountDocument(ownerId, probe, () => true, schema, dependencies({ kind: "oracle-v2-support", version: 2 })))
    .toEqual({ ok: false, code: "INVALID_RESPONSE" })
  const restart = { action: "restartOracleV2", documentId, operationId, expectedRevision: 3, confirmation: "START_NEW_ORACLE_V2" } as const
  const receipt = { kind: "saved", documentId, operationId, revision: 4 }
  expect(await requestAccountDocument(ownerId, restart, () => true, schema, dependencies(receipt)))
    .toEqual({ ok: true, data: receipt })
  for (const change of [{ revision: 3 }, { revision: 5 }, { documentId: otherOwnerId }, { operationId: otherOwnerId }]) {
    expect(await requestAccountDocument(ownerId, restart, () => true, schema, dependencies({ ...receipt, ...change })))
      .toEqual({ ok: false, code: "INVALID_RESPONSE" })
  }
  const conflict = { kind: "conflict", documentId, operationId, currentRevision: 4 }
  expect(await requestAccountDocument(ownerId, restart, () => true, schema,
    dependencies(null, { context: new Response(JSON.stringify(conflict), { status: 409 }) }))).toEqual({ ok: true, data: conflict })
})

describe("account record compatibility API", () => {
  const document: AccountJournalRecord = { version: 2, state: "FINALIZED", kind: "JOURNAL", entry: waitingJournal() }
  const calls = [
    { request: { action: "status" as const }, response: { kind: "ready" } },
    { request: { action: "list" as const, collection: "JOURNAL" as const }, response: { kind: "list", documents: [], nextCursor: null } },
    { request: { action: "read" as const, documentId }, response: { kind: "document", documentId, revision: 1, document } },
    { request: { action: "history" as const, documentId, collection: "JOURNAL" as const }, response: { kind: "history", documentId, versions: [] } },
    { request: { action: "delete" as const, documentId, operationId, expectedRevision: 1 }, response: { kind: "deleted", documentId, operationId, revision: 2 } },
    { request: { action: "restore" as const, documentId, operationId, expectedRevision: 1, sourceRevision: 1 }, response: { kind: "restored", documentId, operationId, revision: 2, sourceRevision: 1 } },
    { request: { action: "save" as const, documentId, operationId, expectedRevision: 0, document }, response: { kind: "saved", documentId, operationId, revision: 1 } },
  ]
  it.each(calls)("advertises [2,3] without changing V2 for $request.action", async ({ request, response }) => {
    const deps = dependencies(response)
    expect(await requestAccountDocument(ownerId, request, () => true, accountJournalRecordSchema, deps))
      .toEqual({ ok: true, data: response })
    expect(deps.invoke).toHaveBeenCalledWith("account-journal", {
      body: { ...request, supportedJournalVersions: [2, 3], supportsExerciseLogV1: true }, headers: { Authorization: `Bearer ${accessToken}`, "x-trainoracle-storage-revision": "0" },
      signal: expect.any(AbortSignal),
    })
    expect(document.version).toBe(2)
  })
  it.each(calls)("keeps upgrade failure explicit for $request.action", async ({ request }) => {
    expect(await requestAccountDocument(ownerId, request, () => true, accountJournalRecordSchema,
      dependencies(null, { context: new Response(JSON.stringify({ error: "UPGRADE_REQUIRED" }), { status: 426 }) })))
      .toEqual({ ok: false, code: "UPGRADE_REQUIRED" })
  })
  it.each([
    [409, "FILE_EVIDENCE_DISABLED"], [422, "INVALID_FILE_OBSERVATION"], [409, "FILE_OBSERVATION_CONFLICT"],
    [409, "COMPARISON_ORIGINAL_UNAVAILABLE"], [422, "INVALID_COMPARISON_RELATION"], [409, "COMPARISON_CAPACITY_EXCEEDED"],
  ] as const)("preserves terminal file error %s %s", async (status, code) => {
    expect(await requestAccountDocument(ownerId, { ...request, document, writePurpose: "FILE_OBSERVATION" },
      () => true, accountJournalRecordSchema,
      dependencies(null, { context: new Response(JSON.stringify({ error: code }), { status }) })))
      .toEqual({ ok: false, code })
  })
  it("keeps a conflict-storage quota rejection terminal instead of retrying it as an outage", async () => {
    expect(await requestAccountDocument(ownerId, { ...request, document }, () => true, accountJournalRecordSchema,
      dependencies(null, { context: new Response(JSON.stringify({ error: "CONFLICT_STORAGE_LIMIT_REACHED" }), { status: 507 }) })))
      .toEqual({ ok: false, code: "CONFLICT_STORAGE_LIMIT_REACHED" })
    expect(await requestAccountDocument(ownerId, { action: "restore", documentId, operationId, expectedRevision: 1, sourceRevision: 1 },
      () => true, accountJournalRecordSchema,
      dependencies(null, { context: new Response(JSON.stringify({ error: "CONFLICT_STORAGE_LIMIT_REACHED" }), { status: 507 }) })))
      .toEqual({ ok: false, code: "CONFLICT_STORAGE_LIMIT_REACHED" })
    expect(await requestAccountDocument(ownerId, { ...request, document }, () => true, accountJournalRecordSchema,
      dependencies(null, { context: new Response(JSON.stringify({ error: "OTHER" }), { status: 507 }) })))
      .toEqual({ ok: false, code: "UNAVAILABLE" })
  })
  it("checks the active owner again after asynchronous error decoding", async () => {
    let active = true
    const context = new Response(null, { status: 422 })
    vi.spyOn(context, "clone").mockReturnValue({ json: async () => {
      active = false
      return { error: "INVALID_FILE_OBSERVATION" }
    } } as Response)
    expect(await requestAccountDocument(ownerId, { ...request, document }, () => active, accountJournalRecordSchema,
      dependencies(null, { context }))).toEqual({ ok: false, code: "STALE_RESPONSE" })
  })
  it("sends the dedicated correction without a client entry and validates its exact receipt", async () => {
    const replacementObservation = buildFileObservation({
      format: "csv", sourceProfile: "CSV_COLUMNS_V1", parserVersion: "csv-v1", sourceActivityId: null,
      date: "2026-09-02", startedAt: null, timeZone: null, sport: "RUNNING", distanceMeters: 5000,
      durationSeconds: 1800, durationMeaning: "SOURCE_DEFINED", laps: [], confirmation: { sport: null, durationMeaning: null },
    })
    const correction = { action: "correctImportedObservation" as const, documentId, operationId, expectedRevision: 1,
      previousContentRevisionFingerprint: replacementObservation.contentRevisionFingerprint,
      replacementObservation, confirmedChangedFields: ["distanceMeters"] }
    const receipt = { kind: "saved", documentId, operationId, revision: 2 }
    const deps = dependencies(receipt)
    expect(await requestAccountDocument(ownerId, correction, () => true, accountJournalRecordSchema, deps)).toEqual({ ok: true, data: receipt })
    expect(deps.invoke).toHaveBeenCalledWith("account-journal", { body: { ...correction, supportedJournalVersions: [2, 3], supportsExerciseLogV1: true },
      headers: { Authorization: `Bearer ${accessToken}`, "x-trainoracle-storage-revision": "0" }, signal: expect.any(AbortSignal) })
    expect(await requestAccountDocument(ownerId, correction, () => true, accountJournalRecordSchema,
      dependencies({ ...receipt, revision: 3 }))).toEqual({ ok: false, code: "INVALID_RESPONSE" })
    const conflict = { kind: "conflict", documentId, operationId, currentRevision: 2 }
    expect(await requestAccountDocument(ownerId, correction, () => true, accountJournalRecordSchema,
      dependencies(null, { context: new Response(JSON.stringify(conflict), { status: 409 }) }))).toEqual({ ok: true, data: conflict })
  })
  it("sends comparison release without a client snapshot and binds receipt capability, revision and nonce", async () => {
    const release = { action: "releaseComparisonRelation" as const, documentId, operationId, expectedRevision: 2,
      relationId: otherOwnerId, releasedAt: "2026-09-02T00:00:00Z" }
    const receipt = { kind: "saved", documentId, operationId, revision: 3 }
    const deps = dependencies(receipt)
    expect(await requestAccountDocument(ownerId, release, () => true, accountJournalRecordSchema, deps)).toEqual({ ok: true, data: receipt })
    expect(deps.invoke).toHaveBeenCalledWith("account-journal", { body: { ...release, supportedJournalVersions: [2, 3], supportsExerciseLogV1: true },
      headers: { Authorization: `Bearer ${accessToken}`, "x-trainoracle-storage-revision": "0" }, signal: expect.any(AbortSignal) })
    for (const changed of [{ revision: 4 }, { operationId: otherOwnerId }, { documentId: otherOwnerId }]) {
      expect(await requestAccountDocument(ownerId, release, () => true, accountJournalRecordSchema,
        dependencies({ ...receipt, ...changed }))).toEqual({ ok: false, code: "INVALID_RESPONSE" })
    }
    for (const [status, code] of [[409, "COMPARISON_ORIGINAL_UNAVAILABLE"], [422, "INVALID_COMPARISON_RELATION"], [409, "COMPARISON_CAPACITY_EXCEEDED"]] as const) {
      expect(await requestAccountDocument(ownerId, release, () => true, accountJournalRecordSchema,
        dependencies(null, { context: new Response(JSON.stringify({ error: code }), { status }) }))).toEqual({ ok: false, code })
    }
  })
})
describe("account journal restore source availability", () => {
  const restore = { action: "restore", documentId, operationId, expectedRevision: 2, sourceRevision: 1 } as const
  const receipt = { kind: "source_unavailable", documentId, operationId, currentRevision: 2, sourceRevision: 1 }
  const unavailable = (data: unknown) => dependencies(null, { context: new Response(JSON.stringify(data), { status: 409 }) })
  it("keeps an exact unavailable-source receipt distinct from a version conflict", async () => {
    expect(await requestAccountJournal(ownerId, restore, () => true, unavailable(receipt))).toEqual({ ok: true, data: receipt })
    expect(await requestAccountJournal(ownerId, restore, () => true, unavailable({ error: "SOURCE_UNAVAILABLE" })))
      .toEqual({ ok: false, code: "SOURCE_UNAVAILABLE" })
    const conflict = { kind: "conflict", documentId, operationId, currentRevision: 3 }
    expect(await requestAccountJournal(ownerId, restore, () => true, unavailable(conflict))).toEqual({ ok: true, data: conflict })
  })
  it.each([{ documentId: otherOwnerId }, { operationId: otherOwnerId }, { sourceRevision: 2 },
    { currentRevision: 3 }, { sourceRevision: 0 }, { unexpected: true }])("rejects a mismatched unavailable-source receipt %j", async change => {
    expect(await requestAccountJournal(ownerId, restore, () => true, unavailable({ ...receipt, ...change })))
      .toEqual({ ok: false, code: "INVALID_RESPONSE" })
  })
  it("does not accept restore-source failures for save or delete", async () => {
    for (const call of [request, { action: "delete", documentId, operationId, expectedRevision: 2 } as const]) {
      expect(await requestAccountJournal(ownerId, call, () => true, unavailable(receipt)))
        .toEqual({ ok: false, code: "INVALID_RESPONSE" })
      expect(await requestAccountJournal(ownerId, call, () => true, unavailable({ error: "SOURCE_UNAVAILABLE" })))
        .toEqual({ ok: false, code: "INVALID_RESPONSE" })
    }
    expect(await requestAccountJournal(ownerId, restore, () => true, unavailable({ error: "SOURCE_UNAVAILABLE", documentId: otherOwnerId })))
      .toEqual({ ok: false, code: "INVALID_RESPONSE" })
  })
  it("does not turn a late previous-account source failure into a current terminal result", async () => {
    let active = true
    const context = new Response(null, { status: 409 })
    vi.spyOn(context, "clone").mockReturnValue({ json: async () => { active = false; return receipt } } as Response)
    expect(await requestAccountJournal(ownerId, restore, () => active, dependencies(null, { context })))
      .toEqual({ ok: false, code: "STALE_RESPONSE" })
  })
})
describe("account journal deleted owner boundary", () => {
  it("holds an unreadable deletion notice without claiming deletion or initializing the client", async () => {
    const unreadableOwner = "e5555555-5555-4555-8555-555555555553"
    const read = Storage.prototype.getItem
    const unavailable = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === ACCOUNT_DELETION_BOUNDARY_PREFIX + unreadableOwner) throw new Error("synthetic storage unavailable")
      return read.call(this, key)
    })
    const deps = dependencies(null)
    try {
      expect(await requestAccountJournal(unreadableOwner, request, () => true, { ...deps, owner: () => unreadableOwner }))
        .toEqual({ ok: false, code: "UNAVAILABLE" })
      expect(deps.client).not.toHaveBeenCalled()
      expect(deps.auth.getSession).not.toHaveBeenCalled()
      expect(deps.invoke).not.toHaveBeenCalled()
    } finally { unavailable.mockRestore() }
  })
  it.each(["client", "auth", "response"] as const)(
    "holds a notice that becomes unreadable during %s and permits an explicit later normal retry", async phase => {
      const unreadableOwner = "e5555555-5555-4555-8555-55555555555" + ({ client: "4", auth: "5", response: "6" }[phase])
      const read = Storage.prototype.getItem
      let unreadable = false
      const unavailable = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
        if (unreadable && key === ACCOUNT_DELETION_BOUNDARY_PREFIX + unreadableOwner) {
          // A one-check outage also must not be reclassified as a stale owner.
          unreadable = false
          throw new Error("synthetic storage unavailable")
        }
        return read.call(this, key)
      })
      const saved = { kind: "saved", documentId, operationId, revision: 1 }
      const deps = dependencies(saved)
      const session = { data: { session: { user: { id: unreadableOwner }, access_token: accessToken } }, error: null }
      deps.client.mockImplementation(async () => {
        if (phase === "client") unreadable = true
        return { auth: deps.auth, functions: { invoke: deps.invoke } } as unknown as SupabaseClient
      })
      deps.auth.getSession.mockImplementation(async () => {
        if (phase === "auth") unreadable = true
        return session
      })
      deps.invoke.mockImplementation(async () => {
        if (phase === "response") unreadable = true
        return { data: saved, error: null }
      })
      try {
        const bound = { ...deps, owner: () => unreadableOwner }
        expect(await requestAccountJournal(unreadableOwner, request, () => true, bound))
          .toEqual({ ok: false, code: "UNAVAILABLE" })
        expect(deps.invoke).toHaveBeenCalledTimes(phase === "response" ? 1 : 0)
        unavailable.mockRestore()
        deps.client.mockResolvedValue({ auth: deps.auth, functions: { invoke: deps.invoke } } as unknown as SupabaseClient)
        deps.auth.getSession.mockResolvedValue(session)
        deps.invoke.mockResolvedValue({ data: saved, error: null })
        expect(await requestAccountJournal(unreadableOwner, request, () => true, bound))
          .toEqual({ ok: true, data: saved })
      } finally { unavailable.mockRestore() }
    },
  )
  it("rejects a deleted owner before client or auth initialization", async () => {
    const deletedOwner = "e5555555-5555-4555-8555-555555555551"
    closeAccountDeletionBoundary(deletedOwner, "2026-10-07T00:00:00.000Z")
    const deps = dependencies(null)
    expect(await requestAccountJournal(deletedOwner, request, () => true, { ...deps, owner: () => deletedOwner }))
      .toEqual({ ok: false, code: "ACCOUNT_DELETION_REQUESTED" })
    expect(deps.client).not.toHaveBeenCalled()
  })
  it("stops an in-flight request immediately on deletion and ignores a late successful receipt", async () => {
    const deletedOwner = "e5555555-5555-4555-8555-555555555552"
    const deps = dependencies(null)
    deps.auth.getSession.mockResolvedValue({ data: { session: { user: { id: deletedOwner }, access_token: accessToken } }, error: null })
    let complete!: (value: unknown) => void
    deps.invoke.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const result = requestAccountJournal(deletedOwner, request, () => true, { ...deps, owner: () => deletedOwner })
    await vi.waitFor(() => expect(deps.invoke).toHaveBeenCalledTimes(1))
    const signal = deps.invoke.mock.calls[0]![1].signal as AbortSignal
    closeAccountDeletionBoundary(deletedOwner, "2026-10-07T00:00:00.000Z")
    expect(await result).toEqual({ ok: false, code: "ACCOUNT_DELETION_REQUESTED" })
    expect(signal.aborted).toBe(true)
    complete({ data: { kind: "saved", documentId, operationId, revision: 1 }, error: null })
    await Promise.resolve()
    expect(await requestAccountJournal(ownerId, request, () => true,
      dependencies({ kind: "saved", documentId, operationId, revision: 1 })))
      .toEqual({ ok: true, data: { kind: "saved", documentId, operationId, revision: 1 } })
  })
})
describe("additive calendar capability API", () => {
  it.each([400, 404, 501])("classifies older capability HTTP %s without weakening data failures", async status => {
    const missing = () => dependencies(null, { context: new Response(null, { status }) })
    expect(await requestAccountJournal(ownerId, { action: "calendarDecorationSupport" }, () => true, missing()))
      .toEqual({ ok: false, code: "CALENDAR_DECORATION_UNSUPPORTED" })
    expect(await requestAccountJournal(ownerId, { action: "list" }, () => true, missing()))
      .toEqual({ ok: false, code: "UNAVAILABLE" })
    expect(await requestAccountJournal(ownerId, { action: "read", documentId }, () => true, missing()))
      .toEqual({ ok: false, code: status === 404 ? "NOT_FOUND" : "UNAVAILABLE" })
  })
  it.each([[401, "AUTH_REQUIRED"], [403, "ACCESS_DENIED"], [426, "UPGRADE_REQUIRED"], [503, "UNAVAILABLE"]] as const)(
    "preserves capability auth and outage semantics for HTTP %s", async (status, code) => {
      expect(await requestAccountJournal(ownerId, { action: "calendarDecorationSupport" }, () => true,
        dependencies(null, { context: new Response(null, { status }) }))).toEqual({ ok: false, code })
    },
  )
  it("requires exact support version and never reports an offline or stale owner as unsupported", async () => {
    const response = { kind: "calendar-decoration-support", version: 1 }
    expect(await requestAccountJournal(ownerId, { action: "calendarDecorationSupport" }, () => true, dependencies(response)))
      .toEqual({ ok: true, data: response })
    expect(await requestAccountJournal(ownerId, { action: "calendarDecorationSupport" }, () => true, dependencies({ ...response, version: 2 })))
      .toEqual({ ok: false, code: "INVALID_RESPONSE" })
    expect(await requestAccountJournal(ownerId, { action: "calendarDecorationSupport" }, () => true, dependencies(null, new Error("offline"))))
      .toEqual({ ok: false, code: "UNAVAILABLE" })
    const stale = dependencies(null, { context: new Response(null, { status: 400 }) })
    stale.invoke.mockImplementation(async () => ({ data: null, error: stale.owner() === ownerId ? { context: new Response(null, { status: 400 }) } : null }))
    expect(await requestAccountJournal(ownerId, { action: "calendarDecorationSupport" }, () => false, stale))
      .toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(stale.invoke).not.toHaveBeenCalled()
  })
})
describe("account draft API", () => {
  it.each(["PLANNED_SESSION_ALREADY_RECORDED", "INSUFFICIENT_POINTS", "OPERATION_REPLAY_UNAVAILABLE"] as const)(
    "preserves controlled rejection %s without inventing a revision", async error => {
      expect(await requestAccountJournal(ownerId, request, () => true,
        dependencies(null, { context: new Response(JSON.stringify({ error }), { status: 409 }) })))
        .toEqual({ ok: false, code: error })
    },
  )
  it("is hidden unless explicitly enabled and not killed", () => {
    expect(accountJournalPreviewEnabled({})).toBe(false)
    expect(accountJournalPreviewEnabled({ VITE_FEATURE_ACCOUNT_JOURNAL: "true" })).toBe(true)
    expect(accountJournalPreviewEnabled({ VITE_FEATURE_ACCOUNT_JOURNAL: "true", VITE_KILL_ACCOUNT_JOURNAL: "true" })).toBe(false)
  })
  it("accepts only matching server receipt", async () => {
    const deps = dependencies({ kind: "saved", documentId, operationId, revision: 1 })
    expect((await requestAccountJournal(ownerId, request, () => true, deps)).ok).toBe(true)
    expect(deps.invoke).toHaveBeenCalledWith("account-journal", {
      body: request, headers: { Authorization: `Bearer ${accessToken}`, "x-trainoracle-storage-revision": "0" },
      signal: expect.any(AbortSignal),
    })
  })
  it.each([
    { kind: "saved", documentId, operationId, revision: 2 },
    { kind: "saved", documentId: ownerId, operationId, revision: 1 },
    { kind: "ready" }, { kind: "list", documents: [], nextCursor: null },
  ])("rejects unrelated success response %j", async data => {
    expect(await requestAccountJournal(ownerId, request, () => true, dependencies(data)))
      .toEqual({ ok: false, code: "INVALID_RESPONSE" })
  })
  it("does not contact server for previous account", async () => {
    const deps = dependencies(null)
    expect((await requestAccountJournal(ownerId, request, () => false, deps)).ok).toBe(false)
    expect(deps.client).not.toHaveBeenCalled()
  })
  it("ignores response when account changed while sending", async () => {
    let active = true
    const deps = dependencies(null)
    deps.invoke.mockImplementation(async () => { active = false; return { data: { kind: "saved", documentId, operationId, revision: 1 }, error: null } })
    expect(await requestAccountJournal(ownerId, request, () => active, deps)).toEqual({ ok: false, code: "STALE_RESPONSE" })
  })
  it("does not send after missing authentication", async () => {
    const deps = dependencies(null)
    deps.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    expect(await requestAccountJournal(ownerId, request, () => true, deps)).toEqual({ ok: false, code: "AUTH_REQUIRED" })
    expect(deps.invoke).not.toHaveBeenCalled()
  })
  it.each([undefined, null, "", " ", 123, {}, " token", "token ", "two tokens", "token\r\nother", "token\n", "token\u0000", "token\u00e9"])(
    "does not send a missing or malformed bearer token (%j)", async token => {
      const deps = dependencies(null)
      deps.auth.getSession.mockResolvedValue({ data: { session: { user: { id: ownerId }, access_token: token } }, error: null })
      expect(await requestAccountJournal(ownerId, request, () => true, deps)).toEqual({ ok: false, code: "AUTH_REQUIRED" })
      expect(deps.invoke).not.toHaveBeenCalled()
    },
  )
  it.each([
    { data: { session: { user: { id: otherOwnerId }, access_token: "synthetic-token-B" } }, error: null },
    { data: { session: { user: { id: ownerId }, access_token: accessToken } }, error: new Error("Synthetic auth failure") },
  ])("does not send for mismatched or failed authentication", async session => {
    const deps = dependencies(null)
    deps.auth.getSession.mockResolvedValue(session)
    expect(await requestAccountJournal(ownerId, request, () => true, deps)).toEqual({ ok: false, code: "AUTH_REQUIRED" })
    expect(deps.invoke).not.toHaveBeenCalled()
  })
  it("does not invoke if the owner changes during the initial session check", async () => {
    let owner = ownerId
    const deps = dependencies(null)
    deps.auth.getSession.mockImplementation(async () => {
      owner = otherOwnerId
      return { data: { session: { user: { id: ownerId }, access_token: accessToken } }, error: null }
    })
    expect(await requestAccountJournal(ownerId, request, () => true, { ...deps, owner: () => owner }))
      .toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(deps.invoke).not.toHaveBeenCalled()
  })
  it("does not render failed list as an empty account", async () => {
    expect(await requestAccountJournal(ownerId, { action: "list" }, () => true,
      dependencies(null, { context: new Response(null, { status: 503 }) })))
      .toEqual({ ok: false, code: "UNAVAILABLE" })
  })
  it("uses NOT_FOUND only for a missing individual document, never failed listing or auth", async () => {
    const missing = () => dependencies(null, { context: new Response(null, { status: 404 }) })
    expect(await requestAccountJournal(ownerId, { action: "read", documentId }, () => true, missing()))
      .toEqual({ ok: false, code: "NOT_FOUND" })
    expect(await requestAccountJournal(ownerId, { action: "list" }, () => true, missing()))
      .toEqual({ ok: false, code: "UNAVAILABLE" })
    expect(await requestAccountJournal(ownerId, { action: "read", documentId }, () => true,
      dependencies(null, { context: new Response(null, { status: 401 }) })))
      .toEqual({ ok: false, code: "AUTH_REQUIRED" })
  })
  it("preserves a validated HTTP 409 conflict receipt", async () => {
    const receipt = { kind: "conflict", documentId, operationId, currentRevision: 2 }
    expect(await requestAccountJournal(ownerId, request, () => true,
      dependencies(null, { context: new Response(JSON.stringify(receipt), { status: 409 }) })))
      .toEqual({ ok: true, data: receipt })
  })
  it("does not invent a conflict revision for operation reuse", async () => {
    expect(await requestAccountJournal(ownerId, request, () => true,
      dependencies(null, { context: new Response(JSON.stringify({ error: "OPERATION_REUSED" }), { status: 409 }) })))
      .toEqual({ ok: false, code: "CONFLICT" })
  })
})

describe("goal index request-local final send review", () => {
  const origin = "https://synthetic.supabase.co"
  const token = `x.${btoa(JSON.stringify({ sub: ownerId, session_id: documentId })).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "")}.x`
  const consent = { userId: ownerId, revision: 1, purposeVersion: "2026-10-05", healthStorage: true, journalTextStorage: true, operationsReady: true }
  const index = splitAccountGoalProgramCollection(syntheticGoalProgram(), { version: 1, entries: [] }).index
  const save = { ...request, document: index }
  const response = { kind: "saved", documentId, operationId, revision: 1 }
  const fresh = () => "2026-10-11" >= todayISO()
  const expire = () => vi.setSystemTime(new Date(2026, 9, 12, 0, 1))
  beforeEach(() => {
    localStorage.clear(); vi.stubGlobal("crypto", webcrypto)
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 11, 23, 59))
    rememberStorageConsentRevision(ownerId, 1); pinStorageOperationRevision(ownerId, operationId)
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear() })
  async function sdkFor(transport: typeof fetch, name: string) {
    const sdk = createClient(origin, "synthetic-public", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `goal-index-review-${name}` },
      global: { fetch: createConsentCheckedFetch(origin, transport) },
    })
    await sdk.auth.initialize()
    vi.spyOn(sdk.auth, "getSession").mockResolvedValue({ data: { session: { user: { id: ownerId }, access_token: token } as Session }, error: null })
    // Supabase's getter creates a FunctionsClient each time; observe one real
    // instance while keeping its invoke/auth/fetch implementation unchanged.
    const functions = sdk.functions
    vi.spyOn(sdk, "functions", "get").mockReturnValue(functions)
    return sdk
  }
  it.each(["client", "auth"])("does not invoke a new goal index after its %s await expires", async boundary => {
    const deps = dependencies(response)
    if (boundary === "client") deps.client.mockImplementation(async () => { expire(); return { auth: deps.auth, functions: { invoke: deps.invoke } } as unknown as SupabaseClient })
    else deps.auth.getSession.mockImplementation(async () => { expire(); return { data: { session: { user: { id: ownerId }, access_token: accessToken } }, error: null } })
    expect(await requestAccountDocument(ownerId, save, fresh, accountGoalProgramDocumentSchema, deps)).toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(deps.invoke).not.toHaveBeenCalled()
  })
  it("the real SDK cannot send after its second auth read expires the start date", async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async url => new Response(JSON.stringify(String(url).endsWith("/rpc/get_account_storage_consent") ? consent : response), { headers: { "Content-Type": "application/json" } }))
    const sdk = await sdkFor(transport, "sdk-auth")
    vi.mocked(sdk.auth.getSession).mockResolvedValueOnce({ data: { session: { user: { id: ownerId }, access_token: token } as Session }, error: null })
      .mockImplementation(async () => { expire(); return { data: { session: { user: { id: ownerId }, access_token: token } as Session }, error: null } })
    expect(await requestAccountDocument(ownerId, save, fresh, accountGoalProgramDocumentSchema, { client: async () => sdk, owner: () => ownerId })).toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(transport).not.toHaveBeenCalled()
  })
  it.each(["consent", "json"])("the real SDK blocks an expired goal index after its %s await without blocking a read", async boundary => {
    let release!: () => void, reached!: () => void, waiting = true
    const held = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { reached = resolve })
    const transport = vi.fn<typeof fetch>(async (url, options) => {
      expect(new Headers(options?.headers).has(LOCAL_COLLECTION_SEND_GUARD_HEADER)).toBe(false)
      if (String(url).endsWith("/rpc/get_account_storage_consent")) {
        if (waiting) {
          waiting = false
          if (boundary === "consent") { reached(); await held; return new Response(JSON.stringify(consent)) }
          const checked = new Response(JSON.stringify(consent))
          vi.spyOn(checked, "json").mockImplementation(async () => { reached(); await held; return consent })
          return checked
        }
        return new Response(JSON.stringify(consent))
      }
      const body = JSON.parse(String(options?.body))
      return new Response(JSON.stringify(body.action === "read" ? { kind: "document", documentId, revision: 1, document: index } : response), { headers: { "Content-Type": "application/json" } })
    })
    const sdk = await sdkFor(transport, boundary), deps = { client: async () => sdk, owner: () => ownerId }
    const sending = requestAccountDocument(ownerId, save, fresh, accountGoalProgramDocumentSchema, deps)
    await started
    const read = requestAccountDocument(ownerId, { action: "read", documentId }, () => true, accountGoalProgramDocumentSchema, deps)
    expire(); release()
    expect(await sending).toEqual({ ok: false, code: "STALE_RESPONSE" })
    expect(await read).toMatchObject({ ok: true, data: { kind: "document", document: index } })
    const dataCalls = transport.mock.calls.filter(([url]) => String(url).endsWith("/functions/v1/account-journal"))
    expect(dataCalls).toHaveLength(1)
    expect(JSON.parse(String(dataCalls[0]?.[1]?.body))).toEqual({ action: "read", documentId })
  })
  it("keeps the exact index and same-operation receipt recovery with no internal marker on the wire", async () => {
    let revision = 0
    const receipts = new Map<string, typeof response>(), wire: unknown[] = []
    const transport = vi.fn<typeof fetch>(async (url, options) => {
      expect(new Headers(options?.headers).has(LOCAL_COLLECTION_SEND_GUARD_HEADER)).toBe(false)
      if (String(url).endsWith("/rpc/get_account_storage_consent")) return new Response(JSON.stringify(consent))
      const body = JSON.parse(String(options?.body)); wire.push(body)
      const prior = receipts.get(body.operationId)
      if (prior) return new Response(JSON.stringify(prior), { headers: { "Content-Type": "application/json" } })
      expect(body.expectedRevision).toBe(revision)
      revision += 1; receipts.set(body.operationId, response)
      return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json" } })
    })
    const sdk = await sdkFor(transport, "receipt"), deps = { client: async () => sdk, owner: () => ownerId }
    const invoked = vi.spyOn(sdk.functions, "invoke")
    expect(await requestAccountDocument(ownerId, save, fresh, accountGoalProgramDocumentSchema, deps)).toEqual({ ok: true, data: response })
    const marker = new Headers(invoked.mock.calls[0]?.[1]?.headers).get(LOCAL_COLLECTION_SEND_GUARD_HEADER)
    expect(marker).toBeTruthy()
    const count = transport.mock.calls.length
    expect((await createConsentCheckedFetch(origin, transport)(origin + "/functions/v1/account-journal", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, [LOCAL_COLLECTION_SEND_GUARD_HEADER]: marker! }, body: JSON.stringify(save),
    })).status).toBe(403)
    expect(transport).toHaveBeenCalledTimes(count)
    expire()
    // The service permits this owner-only retry only after exact remote bytes/revision prove a prior commit.
    expect(await requestAccountDocument(ownerId, save, () => true, accountGoalProgramDocumentSchema, deps)).toEqual({ ok: true, data: response })
    expect(revision).toBe(1); expect(wire).toEqual([save, save])
  })
  it.each(["abort", "deadline"])("releases an interrupted goal guard before a late consent response (%s)", async boundary => {
    let release!: () => void, reached!: () => void
    const held = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { reached = resolve })
    const transport = vi.fn<typeof fetch>(async (_url, options) => {
      expect(new Headers(options?.headers).has(LOCAL_COLLECTION_SEND_GUARD_HEADER)).toBe(false)
      reached(); await held; return new Response(JSON.stringify(consent))
    })
    const sdk = await sdkFor(transport, boundary), controller = new AbortController()
    const invoked = vi.spyOn(sdk.functions, "invoke")
    if (boundary === "deadline") vi.useFakeTimers()
    const sending = requestAccountDocument(ownerId, save, () => true, accountGoalProgramDocumentSchema,
      { client: async () => sdk, owner: () => ownerId }, { signal: controller.signal })
    try {
      await started
      expect(new Headers(invoked.mock.calls[0]?.[1]?.headers).get(LOCAL_COLLECTION_SEND_GUARD_HEADER)).toBeTruthy()
      if (boundary === "abort") controller.abort()
      else await vi.advanceTimersByTimeAsync(ACCOUNT_NETWORK_DEADLINE_MS)
      expect(await sending).toEqual({ ok: false, code: boundary === "abort" ? "STALE_RESPONSE" : "UNAVAILABLE" })
      const registrations: ReturnType<typeof registerCollectionSendGuard>[] = []
      try {
        // The SDK is still waiting; all request-local capacity must already be reclaimed.
        for (let i = 0; i < 128; i++) registrations.push(registerCollectionSendGuard(() => true))
      } finally { registrations.forEach(registration => registration.release()) }
      release(); await Promise.resolve(); await Promise.resolve()
      expect(transport).toHaveBeenCalledTimes(1)
    } finally { controller.abort(); release?.(); await sending }
  })
})

describe("account journal actual SDK authorization race", () => {
  const cases = [
    { request, response: { kind: "saved", documentId, operationId, revision: 1 } },
    { request: { action: "status" as const }, response: { kind: "ready" } },
    { request: { action: "list" as const }, response: { kind: "list", documents: [], nextCursor: null } },
    { request: { action: "read" as const, documentId }, response: { kind: "document", documentId, revision: 1, document: draft } },
    { request: { action: "history" as const, documentId }, response: { kind: "history", documentId, versions: [] } },
    { request: { action: "delete" as const, documentId, operationId, expectedRevision: 0 },
      response: { kind: "deleted", documentId, operationId, revision: 1 } },
    { request: { action: "restore" as const, documentId, operationId, expectedRevision: 1, sourceRevision: 1 },
      response: { kind: "restored", documentId, operationId, revision: 2, sourceRevision: 1 } },
    { request: { action: "restartOracleV2" as const, documentId, operationId, expectedRevision: 1, confirmation: "START_NEW_ORACLE_V2" as const },
      response: { kind: "saved", documentId, operationId, revision: 2 } },
  ]
  describe.each([false, true])("local owner change observed: %s", localOwnerChanged => {
    it.each(cases)("pins account A for $request.action when the SDK rereads account B", async ({ request, response }) => {
      let owner = ownerId
      const wire: { authorization: string | null; body: unknown }[] = []
      // Keep functions.invoke and fetchWithAuth real; replace only auth results and final I/O.
      const transport = vi.fn<typeof fetch>(async (input, init) => {
        expect(String(input)).toBe("https://synthetic.invalid/functions/v1/account-journal")
        wire.push({ authorization: new Headers(init?.headers).get("Authorization"), body: JSON.parse(String(init?.body)) })
        return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json" } })
      })
      const client = createClient("https://synthetic.invalid", "synthetic-anon-key", {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
          storageKey: `synthetic-journal-race-${localOwnerChanged}-${request.action}` },
        global: { fetch: transport },
      })
      await client.auth.initialize()
      const session = (id: string, token: string) => ({ data: { session: { user: { id }, access_token: token } as Session }, error: null })
      const getSession = vi.spyOn(client.auth, "getSession")
        .mockResolvedValueOnce(session(ownerId, accessToken))
        .mockImplementation(async () => {
          if (localOwnerChanged) owner = otherOwnerId
          return session(otherOwnerId, "synthetic-token-B")
        })
      const result = await requestAccountJournal(ownerId, request, () => true, { client: async () => client, owner: () => owner })
      expect(getSession).toHaveBeenCalledTimes(2)
      expect(transport).toHaveBeenCalledTimes(1)
      expect(wire).toEqual([{ authorization: `Bearer ${accessToken}`, body: request }])
      expect(result).toEqual(localOwnerChanged ? { ok: false, code: "STALE_RESPONSE" } : { ok: true, data: response })
    })
  })
})
