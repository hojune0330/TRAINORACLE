import {beforeEach,describe,expect,it,vi} from "vitest"
const {client}=vi.hoisted(()=>({client:{auth:{getSession:vi.fn(),getClaims:vi.fn(),getUser:vi.fn()},functions:{invoke:vi.fn()}}}))
vi.mock("./supabase-client",()=>({supabase:async()=>client}))
import { exportAccountDataRights } from "./account-data-rights"
const A="a1111111-1111-4111-8111-111111111111",B="b2222222-2222-4222-8222-222222222222"
const token="synthetic-session-token-longer-than-thirty-two-characters"
beforeEach(()=>{
  client.auth.getSession.mockResolvedValue({data:{session:{user:{id:A},access_token:token}},error:null})
  client.auth.getClaims.mockResolvedValue({data:{claims:{sub:A,session_id:A}},error:null})
  client.auth.getUser.mockResolvedValue({data:{user:{id:A}},error:null})
  client.functions.invoke.mockResolvedValue({data:{ownerId:A,collection:"journal",items:[{cursor:"a",record:{user_id:A,document:{synthetic:"private"}}}],nextCursor:null},error:null})
})
describe("manual existing-data export",()=>{
  it("requests only identifiers and never saves or automatically restores the returned data",async()=>{
    const result=await exportAccountDataRights(A,"journal",()=>true)
    expect(result.ok).toBe(true)
    expect(client.functions.invoke).toHaveBeenCalledExactlyOnceWith("account-data-rights",{
      body:{expectedUserId:A,expectedSessionId:A,collection:"journal",cursor:""},
      headers:{Authorization:`Bearer ${token}`},
    })
    if(result.ok) expect(JSON.parse(result.text).records).toHaveLength(1)
  })
  it("rejects cross-account rows and does not return a downloadable partial result",async()=>{
    client.functions.invoke.mockResolvedValue({data:{ownerId:A,collection:"journal",items:[{cursor:"a",record:{user_id:B}}],nextCursor:null},error:null})
    expect((await exportAccountDataRights(A,"journal",()=>true)).ok).toBe(false)
  })
  it("discards the result when the browser session changes before download",async()=>{
    client.auth.getSession.mockResolvedValueOnce({data:{session:{user:{id:A},access_token:token}},error:null})
      .mockResolvedValueOnce({data:{session:{user:{id:B},access_token:token}},error:null})
    expect((await exportAccountDataRights(A,"journal",()=>true)).ok).toBe(false)
  })
  it("does not request data after the panel owner changes",async()=>{
    expect((await exportAccountDataRights(A,"journal",()=>false)).ok).toBe(false)
    expect(client.functions.invoke).not.toHaveBeenCalled()
  })
})
