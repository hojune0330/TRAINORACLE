import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Disposable single-session PostgreSQL, never a production connection.
const db=new PGlite({extensions:{pgcrypto}}), root=new URL('../../migrations/',import.meta.url);
const owner='a1111111-1111-4111-8111-111111111111', key=Buffer.alloc(32,59);
const payload={version:1,algorithm:'AES-GCM',keyId:'fixture',iv:Buffer.alloc(12).toString('base64'),ciphertext:Buffer.alloc(16).toString('base64')};
async function submit(body={},action='commit') {
  const raw=JSON.stringify({domain:'trainoracle.account-journal.gateway.v1',ownerId:owner,action,expiresAt:Math.floor(Date.now()/1000)+90,...body});
  const signature=createHmac('sha256',key).update(raw).digest('hex');
  return (await db.query('select public.mutate_account_journal_attested($1,$2,$3) result',[raw,signature,'fixture'])).rows[0].result;
}
before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for(const file of readdirSync(root).filter(name=>/^\d+_.+\.sql$/.test(name)&&name<'0060'&&!/^(0038|0039|0041|0042|005[1-6])_/.test(name)).sort()) {
    await db.exec(readFileSync(new URL(file,root),'utf8'));
  }
  await db.query("insert into auth.users(id,created_at) values($1,'2020-01-01')",[owner]);
  await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
    values($1,'1990-01-01','2026-08-26','2026-08-26',clock_timestamp())`,[owner]);
  await db.query('insert into public.beta_enrollments(user_id) values($1)',[owner]);
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC')");
  await db.query('insert into public.account_journal_gateway_keys(key_id,secret) values($1,$2)',['fixture',key]);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[owner,JSON.stringify({sub:owner,role:'authenticated'})]);
},{timeout:120000});
after(()=>db.close());
test('running profile SQL support, encrypted-state CAS and no reward eligibility',async()=>{
  assert.deepEqual(await submit({},'runningProfileSupport'),{kind:'running-profile-support',version:1});
  assert.deepEqual(await submit({},'oracleV2Support'),{kind:'oracle-v2-support',version:2});
  assert.deepEqual(await submit({},'oracleV2RestartSupport'),{kind:'oracle-v2-restart-support',version:1});
  const request={documentId:randomUUID(),operationId:randomUUID(),expectedRevision:0,encryptedPayload:payload,
    metadata:{kind:'RUNNING_PROFILE',occurrenceId:null,journalDate:null,eligible:false}};
  const first=await submit(request); assert.equal(first.kind,'saved'); assert.equal(first.revision,1);
  assert.deepEqual(await submit(request),first);
  assert.equal((await submit({...request,operationId:randomUUID()})).kind,'conflict');
  await assert.rejects(()=>submit({...request,documentId:randomUUID(),operationId:randomUUID(),metadata:{...request.metadata,eligible:true}}),error=>error.code==='22023');
});
test('explicit attested profile restart preserves ordinary tombstone protection and CAS receipts',async()=>{
  const documentId=randomUUID(), metadata={kind:'RUNNING_PROFILE',occurrenceId:null,journalDate:null,eligible:false};
  await submit({documentId,operationId:randomUUID(),expectedRevision:0,encryptedPayload:payload,metadata});
  const deleted=await submit({documentId,operationId:randomUUID(),expectedRevision:1},'delete');
  assert.equal(deleted.kind,'deleted');assert.equal(deleted.revision,2);
  assert.equal((await submit({documentId,operationId:randomUUID(),expectedRevision:2,encryptedPayload:payload,metadata})).kind,'conflict');
  const request={documentId,operationId:randomUUID(),expectedRevision:2,encryptedPayload:payload,metadata};
  const restarted=await submit(request,'restartOracleV2');assert.equal(restarted.kind,'saved');assert.equal(restarted.revision,3);
  assert.deepEqual(await submit(request,'restartOracleV2'),restarted);
  await assert.rejects(()=>submit(request),error=>error.code==='22023');
  assert.equal((await submit({...request,operationId:randomUUID()},'restartOracleV2')).kind,'conflict');
  assert.equal((await submit({...request,operationId:randomUUID(),expectedRevision:3})).revision,4);
  await assert.rejects(()=>submit({...request,documentId:randomUUID(),operationId:randomUUID(),expectedRevision:0},'restartOracleV2'),error=>error.code==='22023');
  const other=randomUUID(), otherMetadata={kind:'DRAFT',occurrenceId:null,journalDate:null,eligible:false};
  await submit({documentId:other,operationId:randomUUID(),expectedRevision:0,encryptedPayload:payload,metadata:otherMetadata});
  await assert.rejects(()=>submit({...request,documentId:other,operationId:randomUUID(),expectedRevision:1,metadata:otherMetadata},'restartOracleV2'),error=>error.code==='22023');
  await assert.rejects(()=>db.query("select public.mutate_account_journal_lifecycle($1,$2,2,$3,'restartOracleV2',null)",[documentId,randomUUID(),payload]),error=>error.code==='42501');
});
test('anonymous callers cannot access profile capability',async()=>{
  await db.exec('reset role; set role anon');
  await assert.rejects(()=>submit({},'runningProfileSupport'),error=>error.code==='42501');
  await assert.rejects(()=>submit({},'oracleV2Support'),error=>error.code==='42501');
  await assert.rejects(()=>submit({},'oracleV2RestartSupport'),error=>error.code==='42501');
});
