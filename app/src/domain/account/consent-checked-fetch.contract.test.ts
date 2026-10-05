import { describe, expect, it, vi } from "vitest"
import { createConsentCheckedFetch } from "./consent-checked-fetch"
import { holdStorageTransmission, releaseStorageTransmissionHold } from "./storage-transmission-hold"
import { createClient } from "@supabase/supabase-js"
import { requestAccountDocument } from "./account-journal-api"
import { accountRunningProfileDocumentSchema } from "./account-running-profile-schema"
import { accountOracleCompatibleDocumentSchema, emptyOracleV2Document, type AccountOracleCompatibleDocument } from "./account-oracle-v2-schema"
const A="a1111111-1111-4111-8111-111111111111"
const B="b2222222-2222-4222-8222-222222222222"
const origin="https://synthetic.supabase.co"
const authorization=`Bearer x.${btoa(JSON.stringify({sub:A,session_id:B})).replace(/\+/gu,"-").replace(/\//gu,"_").replace(/=+$/u,"")}.x`
const receipt={userId:A,purposeVersion:"2026-10-05",healthStorage:true,journalTextStorage:true,operationsReady:true}
const init={method:"POST",headers:{Authorization:authorization,apikey:"synthetic-public"},body:'{"private":"synthetic-health"}'}
describe("consent body transport boundary",()=>{
  it("does not send an in-flight body's stale positive receipt after withdrawal is selected",async()=>{
    let resolve!: (value:Response)=>void
    const pending=new Promise<Response>(done=>{resolve=done})
    const transport=vi.fn<typeof fetch>().mockReturnValueOnce(pending)
    const request=createConsentCheckedFetch(origin,transport)(origin+"/functions/v1/account-journal",init)
    expect(transport).toHaveBeenCalledTimes(1)
    holdStorageTransmission(A)
    try {
      resolve(new Response(JSON.stringify(receipt)))
      expect((await request).status).toBe(403)
      expect(transport).toHaveBeenCalledTimes(1)
    } finally { releaseStorageTransmissionHold(A) }
  })
  it("keeps an unconfirmed withdrawal locally paused despite an old positive server receipt",async()=>{
    const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(receipt)))
    holdStorageTransmission(A)
    try {
      expect((await createConsentCheckedFetch(origin,transport)(origin+"/functions/v1/account-journal",init)).status).toBe(403)
      expect(transport).not.toHaveBeenCalled()
    } finally { releaseStorageTransmissionHold(A) }
  })
  it.each([
    {...receipt,healthStorage:false}, {...receipt,journalTextStorage:false},
    {...receipt,operationsReady:false}, {...receipt,userId:B},
    {...receipt,purposeVersion:"2026-08-26"}, null,
  ])("does not transmit the sensitive body for denied or mismatched receipt %j",async(value)=>{
    const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(value),{status:200}))
    const response=await createConsentCheckedFetch(origin,transport)(origin+"/functions/v1/account-journal",init)
    expect(response.status).toBe(403)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({expected_user_id_input:A}))
  })
  it("pins the exact checked token and checks every retry after withdrawal",async()=>{
    const transport=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(receipt)))
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response(JSON.stringify({...receipt,healthStorage:false})))
    const fetcher=createConsentCheckedFetch(origin,transport)
    expect((await fetcher(origin+"/rest/v1/journal_entries",init)).status).toBe(200)
    expect(new Headers(transport.mock.calls[1]?.[1]?.headers).get("Authorization")).toBe(authorization)
    expect((await fetcher(origin+"/rest/v1/journal_entries",init)).status).toBe(403)
    expect(transport).toHaveBeenCalledTimes(3)
  })
  it.each(["/auth/v1/token","/rest/v1/rpc/request_account_deletion","/rest/v1/rpc/set_account_storage_consent",
    "/functions/v1/account-data-rights","/rest/v1/rpc/read_account_data_rights_page"])("leaves explicit identity, withdrawal, deletion and rights routes reachable: %s",async(path)=>{
    const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"))
    await createConsentCheckedFetch(origin,transport)(origin+path,init)
    expect(transport).toHaveBeenCalledExactlyOnceWith(origin+path,init)
  })
  it("does not transmit a body when the fresh check fails",async()=>{
    const transport=vi.fn<typeof fetch>().mockRejectedValue(new Error("synthetic failure"))
    expect((await createConsentCheckedFetch(origin,transport)(origin+"/rest/v1/journal_entries",init)).status).toBe(403)
    expect(transport).toHaveBeenCalledTimes(1)
  })
})

const comparisonPath = origin + "/functions/v1/oracle-profile-comparison"
const comparisonInit = (body: unknown): RequestInit => ({ ...init, body: JSON.stringify(body) })

describe("Oracle purpose consent and identity-only withdrawal", () => {
  it.each(["createInvite", "acceptInvite", "invitationStatus", "consent", "allowExternal", "compare", "export", "status"])("checks consent before transmitting %s", async action => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ...receipt, healthStorage: false })))
    expect((await createConsentCheckedFetch(origin, transport)(comparisonPath, comparisonInit({ action, comparisonId: B }))).status).toBe(403)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0]?.[0]).toBe(origin + "/rest/v1/rpc/get_account_storage_consent")
    expect(transport.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ expected_user_id_input: A }))
  })

  it("permits a consented comparison and checks every retry, including failed checks", async () => {
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(receipt)))
      .mockResolvedValueOnce(new Response("{}"))
      .mockRejectedValueOnce(new Error("offline"))
    const fetcher = createConsentCheckedFetch(origin, transport)
    const request = comparisonInit({ action: "compare", comparisonId: B })
    expect((await fetcher(comparisonPath, request)).status).toBe(200)
    expect(new Headers(transport.mock.calls[1]?.[1]?.headers).get("Authorization")).toBe(authorization)
    expect((await fetcher(comparisonPath, request)).status).toBe(403)
    expect(transport).toHaveBeenCalledTimes(3)
  })

  it("stops comparison when withdrawal is selected during the consent check", async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => {
      holdStorageTransmission(A)
      return new Response(JSON.stringify(receipt))
    })
    try {
      expect((await createConsentCheckedFetch(origin, transport)(comparisonPath, comparisonInit({ action: "compare", comparisonId: B }))).status).toBe(403)
      expect(transport).toHaveBeenCalledTimes(1)
    } finally { releaseStorageTransmissionHold(A) }
  })

  it.each(["revoke", "revokeExternal"])("allows only server identity-checked %s even while storage is held", async action => {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("true")).mockResolvedValueOnce(new Response("{}"))
    holdStorageTransmission(A)
    try {
      const request = comparisonInit({ action, comparisonId: B })
      expect((await createConsentCheckedFetch(origin, transport)(comparisonPath, request)).status).toBe(200)
      expect(transport).toHaveBeenCalledTimes(2)
      expect(transport.mock.calls[0]?.[0]).toBe(origin + "/rest/v1/rpc/account_data_rights_identity")
      expect(transport.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ expected_user_id_input: A, expected_session_id_input: B }))
      expect(transport.mock.calls[1]?.[1]?.body).toBe(request.body)
      for (const call of transport.mock.calls) expect(new Headers(call[1]?.headers).get("Authorization")).toBe(authorization)
      // A successful comparison withdrawal must not release the storage hold.
      expect((await createConsentCheckedFetch(origin, transport)(comparisonPath, comparisonInit({ action: "compare", comparisonId: B }))).status).toBe(403)
      expect(transport).toHaveBeenCalledTimes(2)
    } finally { releaseStorageTransmissionHold(A) }
  })

  it.each([false, null, { ok: true }])("does not send withdrawal on an unproven identity receipt %j", async value => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(value)))
    expect((await createConsentCheckedFetch(origin, transport)(comparisonPath, comparisonInit({ action: "revoke", comparisonId: B }))).status).toBe(403)
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it("does not send withdrawal on identity server failure", async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))
    expect((await createConsentCheckedFetch(origin, transport)(comparisonPath, comparisonInit({ action: "revoke", comparisonId: B }))).status).toBe(403)
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it.each([
    { action: "revoke", comparisonId: B, document: { private: "synthetic" } },
    { action: "revokeExternal", comparisonId: B, fields: ["STRUCTURE_1"] },
    { action: "revoke", comparisonId: "invalid" },
    { action: "compare", comparisonId: B },
  ])("does not exempt any extra body or non-withdrawal command: %j", async body => {
    const transport = vi.fn<typeof fetch>()
    holdStorageTransmission(A)
    try {
      expect((await createConsentCheckedFetch(origin, transport)(comparisonPath, comparisonInit(body))).status).toBe(403)
      expect(transport).not.toHaveBeenCalled()
    } finally { releaseStorageTransmissionHold(A) }
  })

  it("pins the identifier-only body and destination across the identity check", async () => {
    const url = new URL(comparisonPath)
    const request = comparisonInit({ action: "revoke", comparisonId: B })
    const originalBody = request.body
    const transport = vi.fn<typeof fetch>().mockImplementationOnce(async () => {
      request.body = JSON.stringify({ action: "consent", private: "synthetic" })
      url.pathname = "/functions/v1/account-journal"
      return new Response("true")
    }).mockResolvedValueOnce(new Response("{}"))
    expect((await createConsentCheckedFetch(origin, transport)(url, request)).status).toBe(200)
    expect(transport.mock.calls[1]?.[0]).toBe(comparisonPath)
    expect(transport.mock.calls[1]?.[1]?.body).toBe(originalBody)
  })

  it("honors an aborted Request signal before transmitting a comparison", async () => {
    const controller = new AbortController()
    controller.abort()
    const transport = vi.fn<typeof fetch>()
    const request = new Request(comparisonPath, { ...comparisonInit({ action: "compare", comparisonId: B }), signal: controller.signal })
    expect((await createConsentCheckedFetch(origin, transport)(request)).status).toBe(403)
    expect(transport).not.toHaveBeenCalled()
  })
})

describe("actual SDK Oracle document transmission", () => {
  const documents: AccountOracleCompatibleDocument[] = [
    { version: 3, state: "ACCOUNT_STATE", kind: "RUNNING_PROFILE", data: {
      version: "RUNNING_PROFILE_V1", answeredAt: "2026-10-05T00:00:00.000Z", answers: { motives: ["health"] },
    } },
    emptyOracleV2Document(),
  ]
  it.each([1, 2])("keeps V%i save on the consent-checked journal route with the real SDK", async version => {
    const document = documents[version - 1]!
    const schema = version === 1 ? accountRunningProfileDocumentSchema : accountOracleCompatibleDocumentSchema
    const request = { action: "save" as const, documentId: B, operationId: A, expectedRevision: 0, document }
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...receipt, healthStorage: false })))
      .mockResolvedValueOnce(new Response(JSON.stringify(receipt)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ kind: "saved", documentId: B, operationId: A, revision: 1 }), { headers: { "Content-Type": "application/json" } }))
    const client = createClient(origin, "synthetic-public", {
      global: { fetch: createConsentCheckedFetch(origin, transport) },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `oracle-transport-v${version}` },
    })
    vi.spyOn(client.auth, "getSession").mockResolvedValue({ data: { session: { user: { id: A }, access_token: authorization.slice(7) } }, error: null } as never)
    const dependencies = { client: async () => client, owner: () => A }
    expect(await requestAccountDocument(A, request, () => true, schema, dependencies)).toEqual({ ok: false, code: "ACCESS_DENIED" })
    expect(transport).toHaveBeenCalledTimes(1)
    expect(await requestAccountDocument(A, request, () => true, schema, dependencies)).toMatchObject({ ok: true, data: { kind: "saved" } })
    expect(transport).toHaveBeenCalledTimes(3)
    expect(transport.mock.calls[2]?.[0]).toBe(origin + "/functions/v1/account-journal")
    expect(JSON.parse(transport.mock.calls[2]?.[1]?.body as string)).toEqual(request)
  })
})
