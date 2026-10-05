import { describe, expect, it, vi } from "vitest"
import { createConsentCheckedFetch } from "./consent-checked-fetch"
import { holdStorageTransmission, releaseStorageTransmissionHold } from "./storage-transmission-hold"
const A="a1111111-1111-4111-8111-111111111111"
const B="b2222222-2222-4222-8222-222222222222"
const origin="https://synthetic.supabase.co"
const authorization=`Bearer x.${btoa(JSON.stringify({sub:A}))}.x`
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
