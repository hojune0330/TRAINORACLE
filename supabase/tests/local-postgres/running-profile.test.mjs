import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { loadOracleMigrationChain, setOracleAuth, approveSyntheticOracleStorage, admitOracleStorage } from './oracle-auth-fixture.mjs';

// Disposable single-session PostgreSQL, never a production connection.
const db=new PGlite({extensions:{pgcrypto}});
const owner='a1111111-1111-4111-8111-111111111111', sessionId=randomUUID(), key=Buffer.alloc(32,59);
const payload={version:1,algorithm:'AES-GCM',keyId:'fixture',iv:Buffer.alloc(12).toString('base64'),ciphertext:Buffer.alloc(16).toString('base64')};
async function submit(body={},action='commit') {
  const raw=JSON.stringify({domain:'trainoracle.account-journal.gateway.v1',ownerId:owner,action,expiresAt:Math.floor(Date.now()/1000)+90,...body});
  const signature=createHmac('sha256',key).update(raw).digest('hex');
  return (await db.query('select public.mutate_account_journal_attested($1,$2,$3) result',[raw,signature,'fixture'])).rows[0].result;
}
before(async()=>{
  await loadOracleMigrationChain(db);
  await db.query("insert into auth.users(id,created_at,email_confirmed_at,encrypted_password) values($1,'2020-01-01',clock_timestamp(),null)",[owner]);
  await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval '1 hour')",[sessionId,owner]);
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC','AUTH_OAUTH')");
  await db.query('insert into public.account_journal_gateway_keys(key_id,secret) values($1,$2)',['fixture',key]);
  await approveSyntheticOracleStorage(db);
  await admitOracleStorage(db,owner,sessionId);
},{timeout:120000});
after(()=>db.close());
test('running profile SQL support, encrypted-state CAS and no reward eligibility',async()=>{
  assert.equal((await db.query('select public.get_current_account_admission_status($1) status',[owner])).rows[0].status,'ADMITTED');
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
test('unsupported AMR, missing session and password-bearing identities cannot save profiles',async()=>{
  const request={documentId:randomUUID(),operationId:randomUUID(),expectedRevision:0,encryptedPayload:payload,
    metadata:{kind:'RUNNING_PROFILE',occurrenceId:null,journalDate:null,eligible:false}};
  try {
    for(const patch of [{amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]},
      {amr:undefined},{session_id:randomUUID()}]) {
      await setOracleAuth(db,owner,sessionId,patch);
      await assert.rejects(()=>submit({},'oracleV2Support'),error=>error.code==='42501');
      await assert.rejects(()=>submit(request),error=>error.code==='42501');
    }
    await db.exec('reset role');
    await db.query("update auth.users set encrypted_password='synthetic-not-a-real-password-hash' where id=$1",[owner]);
    await setOracleAuth(db,owner,sessionId);
    await assert.rejects(()=>submit(request),error=>error.code==='42501');
  } finally {
    await db.exec('reset role');
    await db.query('update auth.users set encrypted_password=null where id=$1',[owner]);
    await setOracleAuth(db,owner,sessionId);
  }
  // The same operation can now succeed: all rejected attempts left CAS state untouched.
  assert.equal((await submit(request)).revision,1);
});

test('OAuth switch denies capability while OFF and restores access when explicitly ON',async()=>{
  try {
    await db.exec("reset role;update public.service_feature_controls set enabled=false where feature_key='AUTH_OAUTH'");
    await setOracleAuth(db,owner,sessionId);
    await assert.rejects(()=>submit({},'oracleV2Support'),error=>error.code==='42501');
  } finally {
    await db.exec("reset role;update public.service_feature_controls set enabled=true where feature_key='AUTH_OAUTH'");
    await setOracleAuth(db,owner,sessionId);
  }
  assert.deepEqual(await submit({},'oracleV2Support'),{kind:'oracle-v2-support',version:2});
});

test('anonymous callers cannot access profile capability',async()=>{
  await db.exec('reset role; set role anon');
  await assert.rejects(()=>submit({},'runningProfileSupport'),error=>error.code==='42501');
  await assert.rejects(()=>submit({},'oracleV2Support'),error=>error.code==='42501');
  await assert.rejects(()=>submit({},'oracleV2RestartSupport'),error=>error.code==='42501');
});
