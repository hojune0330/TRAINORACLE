import test from 'node:test'
import assert from 'node:assert/strict'
import { encryptCorosDaily, createCorosDailyStorage, createCorosDailyRepository } from '../functions/_shared/coros-daily-storage.mjs'
import { normalizeCorosDaily } from '../functions/_shared/coros-daily.mjs'
const link={ownerId:'a1111111-1111-4111-8111-111111111111',connectionId:'c3333333-3333-4333-8333-333333333333',connectionEpoch:'e5555555-5555-4555-8555-555555555555',providerUserId:'synthetic',status:'ACTIVE',scopes:['DAILY_READ']}
const [row]=normalizeCorosDaily({batchDailyList:[{openId:'synthetic',dailyList:[{happenDay:20260912,step:12}]}]})
const keys=async()=>({keyId:'test-only',encryptionKey:await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']),digestKey:await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256',length:256},false,['sign'])})
test('daily encryption uses random IVs but stable scoped keyed identity',async()=>{
  const material=await keys(), a=await encryptCorosDaily(row,link,material), b=await encryptCorosDaily(row,link,material)
  assert.equal(a.contentDigest,b.contentDigest)
  assert.notEqual(a.payload.ciphertext,b.payload.ciphertext)
  assert.notEqual(a.payload.iv,b.payload.iv)
  await assert.rejects(encryptCorosDaily({...row,memo:'not permitted'},link,material),/INVALID_DAILY_FIELDS/)
  await assert.rejects(encryptCorosDaily({...row,sleepDurationSeconds:123},link,material),/INVALID_DAILY_FIELDS/)
  assert.ok(!JSON.stringify(a).includes('synthetic'))
  const moved=await encryptCorosDaily(row,{...link,connectionEpoch:link.ownerId},material)
  assert.notEqual(a.contentDigest,moved.contentDigest)
  const aad=new TextEncoder().encode(JSON.stringify(['trainoracle.coros-daily.v1',link.ownerId,link.connectionId,link.connectionEpoch,row.providerDay]))
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(a.payload.iv),c=>c.charCodeAt(0)),additionalData:aad},material.encryptionKey,Uint8Array.from(atob(a.payload.ciphertext),c=>c.charCodeAt(0)))
  assert.equal(JSON.parse(new TextDecoder().decode(plain)).steps,12)
  await assert.rejects(crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(a.payload.iv),c=>c.charCodeAt(0)),additionalData:new Uint8Array([1])},material.encryptionKey,Uint8Array.from(atob(a.payload.ciphertext),c=>c.charCodeAt(0))))
})

test('repository uses fixed HTTPS server and never returns failed provider bodies',async()=>{
  const calls=[]
  const repo=createCorosDailyRepository({supabaseUrl:'https://synthetic.supabase.co',serviceRoleKey:'synthetic-server-key',fetchImpl:async(url,init)=>{
    calls.push({url:String(url),init})
    return Response.json(calls.length===1?[{id:link.connectionId,user_id:link.ownerId,connection_epoch:link.connectionEpoch,connection_status:'ACTIVE',scopes:['DAILY_READ']}]:{committed:true,processed:1,inserted:1,duplicates:0})
  }})
  assert.deepEqual(await repo.resolveConnection('synthetic'),link)
  assert.equal((await repo.commitBatch([await encryptCorosDaily(row,link,await keys())])).processed,1)
  assert.ok(!calls[0].url.includes('synthetic-server-key'))
  assert.equal(calls[0].init.redirect,'error')
  assert.equal(calls[0].init.headers.authorization,'Bearer synthetic-server-key')
  assert.ok(!calls[1].init.body.includes('"steps"'))
  assert.throws(()=>createCorosDailyRepository({supabaseUrl:'http://evil.example',serviceRoleKey:'synthetic-server-key'}))
  const failed=createCorosDailyRepository({supabaseUrl:'https://synthetic.supabase.co',serviceRoleKey:'synthetic-server-key',fetchImpl:async()=>new Response('private response',{status:500})})
  await assert.rejects(failed.resolveConnection('synthetic'),/^Error: DAILY_STORAGE_UNAVAILABLE$/)
})
test('no partial commit when a later user is disconnected or consent is absent',async()=>{
  let commits=0
  const storage=createCorosDailyStorage({keyMaterial:await keys(),resolveConnection:id=>id==='synthetic'?link:null,commitBatch:()=>{commits++}})
  await assert.rejects(storage([row,{...row,providerUserId:'unlinked'}]))
  assert.equal(commits,0)
  const denied=createCorosDailyStorage({keyMaterial:await keys(),resolveConnection:()=>({...link,scopes:[]}),commitBatch:()=>{commits++}})
  await assert.rejects(denied([row]))
  assert.equal(commits,0)
})

test('repository rejects ambiguous connections and malformed commit receipts',async()=>{
  const config={supabaseUrl:'https://synthetic.supabase.co',serviceRoleKey:'synthetic-server-key'}
  const ambiguous=createCorosDailyRepository({...config,fetchImpl:async()=>Response.json([{},{}])})
  await assert.rejects(ambiguous.resolveConnection('synthetic'),/DAILY_CONNECTION_UNAVAILABLE/)
  for (const receipt of [{committed:true,processed:1,inserted:2,duplicates:0},{committed:true,processed:1,inserted:-1,duplicates:2},{committed:false,processed:1,inserted:1,duplicates:0}]) {
    const repo=createCorosDailyRepository({...config,fetchImpl:async()=>Response.json(receipt)})
    await assert.rejects(repo.commitBatch([{}]),/DAILY_STORAGE_UNAVAILABLE/)
  }
  const timeout=createCorosDailyRepository({...config,fetchImpl:async()=>{throw new DOMException('synthetic','TimeoutError')}})
  await assert.rejects(timeout.resolveConnection('synthetic'),/^Error: DAILY_STORAGE_UNAVAILABLE$/)
})
