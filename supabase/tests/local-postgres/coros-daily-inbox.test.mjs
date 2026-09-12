import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { createCorosDailyHandler } from '../../functions/_shared/coros-daily-handler.mjs'
import { createCorosDailyStorage } from '../../functions/_shared/coros-daily-storage.mjs'

const db = new PGlite()
after(() => db.close())
const A='a1111111-1111-4111-8111-111111111111', B='b2222222-2222-4222-8222-222222222222'
const C='c3333333-3333-4333-8333-333333333333', E='e5555555-5555-4555-8555-555555555555'
const payload={algorithm:'AES-GCM',version:1,keyId:'synthetic',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AAAAAAAAAAAAAAAAAAAAAAAA'}
const item=(extra={})=>({ownerId:A,connectionId:C,connectionEpoch:E,providerDay:'2026-09-12',contentDigest:'a'.repeat(64),payload,...extra})
const ingest=async rows=>(await db.query('select public.ingest_coros_daily_envelopes($1::jsonb) result',[JSON.stringify(rows)])).rows[0].result

test('encrypted daily database ownership, replay, revocation and all-or-nothing receipt', async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function public.service_feature_enabled(text) returns boolean language sql as $$ select true $$;
    create table public.external_provider_connections(id uuid primary key,user_id uuid references auth.users(id),provider text,
      connection_status text,scopes text[],revoked_at timestamptz);
    insert into auth.users values('${A}'),('${B}');
    insert into public.external_provider_connections values('${C}','${A}','COROS','ACTIVE',array['DAILY_READ'],null);`)
  await db.exec(readFileSync(new URL('../../migrations/0038_coros_daily_encrypted_inbox.sql',import.meta.url),'utf8'))
  await db.query('update public.external_provider_connections set connection_epoch=$1',[E])
  assert.equal((await ingest([item()])).inserted,1)
  assert.equal((await ingest([item()])).duplicates,1)
  assert.equal((await ingest([item({contentDigest:'b'.repeat(64)})])).inserted,1)
  for (const scopes of [[null],['OTHER',null],[]]) {
    await db.query('update public.external_provider_connections set scopes=$1 where id=$2',[scopes,C])
    await assert.rejects(ingest([item({contentDigest:'d'.repeat(64)})]),/DAILY_CONNECTION_UNAVAILABLE/)
    assert.equal((await db.query('select count(*)::int n from public.external_daily_observations')).rows[0].n,2)
  }
  await db.query('update public.external_provider_connections set scopes=$1 where id=$2',[['DAILY_READ'],C])
  await assert.rejects(ingest([item({ownerId:B})]),/DAILY_CONNECTION_UNAVAILABLE/)
  await assert.rejects(ingest([item({connectionEpoch:C})]),/DAILY_CONNECTION_UNAVAILABLE/)
  await assert.rejects(ingest([item({contentDigest:'c'.repeat(64)}),item({ownerId:B})]))
  assert.equal((await db.query('select count(*)::int n from public.external_daily_observations')).rows[0].n,2)
  await assert.rejects(ingest([item({payload:{...payload,memo:'forbidden'}})]))
  await db.exec('set role authenticated')
  await assert.rejects(db.query('select * from public.external_daily_observations'),/permission denied/)
  await assert.rejects(ingest([item()]),/permission denied/)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A])
  assert.equal((await db.query('select public.disconnect_coros_connection() result')).rows[0].result,true)
  await db.exec('reset role')
  await assert.rejects(ingest([item()]),/DAILY_CONNECTION_UNAVAILABLE/)
  assert.equal((await db.query('select count(*)::int n from public.external_daily_observations')).rows[0].n,2)
})

test('synthetic HTTP to encryption to real SQL preserves idempotence and fails after disconnect', async () => {
  await db.query("update public.external_provider_connections set connection_status='ACTIVE',revoked_at=null,connection_epoch=$1 where id=$2",[E,C])
  const keyMaterial={keyId:'synthetic-only',encryptionKey:await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt']),digestKey:await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256',length:256},false,['sign'])}
  const storage=createCorosDailyStorage({keyMaterial,resolveConnection:async providerUserId=>{
    if(providerUserId!=='synthetic') return null
    const {rows}=await db.query('select * from public.external_provider_connections where id=$1',[C])
    const l=rows[0]
    return {providerUserId,ownerId:l.user_id,connectionId:l.id,connectionEpoch:l.connection_epoch,status:l.connection_status,scopes:l.scopes}
  },commitBatch:ingest})
  // Simulated provider verification, not evidence of a COROS signature implementation.
  const handler=createCorosDailyHandler({verifyRequest:()=>true,ingestAuthorizedBatch:storage})
  const req=()=>new Request('https://example.test/?signature=synthetic&nonce=synthetic&timestamp=1',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({batchDailyList:[{openId:'synthetic',dailyList:[{happenDay:20260911,step:777}]}]})})
  assert.equal((await handler(req())).status,200)
  assert.equal((await handler(req())).status,200)
  const {rows}=await db.query("select * from public.external_daily_observations where provider_day='2026-09-11'")
  assert.equal(rows.length,1)
  assert.ok(!JSON.stringify(rows).includes('777'))
  assert.equal(rows[0].review_state,'PENDING_SOURCE_REVIEW')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A])
  await db.query('select public.disconnect_coros_connection()')
  assert.equal((await handler(req())).status,503)
})
