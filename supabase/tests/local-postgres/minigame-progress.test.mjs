import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { loadOracleMigrationChain, approveSyntheticOracleStorage, admitOracleStorage } from './oracle-auth-fixture.mjs';

// Disposable single-session PostgreSQL, never a production connection.
// Executes the integrated chain 0001-0062, then 0063 and 0064 unchanged.
const db=new PGlite({extensions:{pgcrypto}});
const owner='a1111111-1111-4111-8111-111111111111', sessionId=randomUUID(), key=Buffer.alloc(32,61);
const payload={version:1,algorithm:'AES-GCM',keyId:'fixture',iv:Buffer.alloc(12).toString('base64'),ciphertext:Buffer.alloc(16).toString('base64')};
const metadata={kind:'MINIGAME_PROGRESS',occurrenceId:null,journalDate:null,eligible:false};
async function submit(body={},action='commit') {
  const raw=JSON.stringify({domain:'trainoracle.account-journal.gateway.v1',ownerId:owner,action,expiresAt:Math.floor(Date.now()/1000)+90,...body});
  const signature=createHmac('sha256',key).update(raw).digest('hex');
  return (await db.query('select public.mutate_account_journal_attested($1,$2,$3) result',[raw,signature,'fixture'])).rows[0].result;
}
before(async()=>{
  await loadOracleMigrationChain(db);
  await db.exec('reset role');
  for(const file of ['0063_lounge_identity_deletion_outbox.sql','0064_minigame_progress_account_storage.sql'])
    await db.exec(readFileSync(new URL(`../../migrations/${file}`,import.meta.url),'utf8'));
  await db.query("insert into auth.users(id,created_at,email_confirmed_at,encrypted_password) values($1,'2020-01-01',clock_timestamp(),null)",[owner]);
  await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval '1 hour')",[sessionId,owner]);
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC','AUTH_OAUTH')");
  await db.query('insert into public.account_journal_gateway_keys(key_id,secret) values($1,$2)',['fixture',key]);
  await approveSyntheticOracleStorage(db);
  await admitOracleStorage(db,owner,sessionId);
},{timeout:180000});
after(()=>db.close());

test('0064 adds the game-progress capability and kind without loosening existing rules',async()=>{
  assert.deepEqual(await submit({},'minigameProgressSupport'),{kind:'minigame-progress-support',version:1});
  // Previously installed capabilities are kept.
  assert.deepEqual(await submit({},'runningProfileSupport'),{kind:'running-profile-support',version:1});
  assert.deepEqual(await submit({},'oracleV2RestartSupport'),{kind:'oracle-v2-restart-support',version:1});
  const request={documentId:randomUUID(),operationId:randomUUID(),expectedRevision:0,encryptedPayload:payload,metadata};
  const first=await submit(request); assert.equal(first.kind,'saved'); assert.equal(first.revision,1);
  assert.deepEqual(await submit(request),first);
  assert.equal((await submit({...request,operationId:randomUUID()})).kind,'conflict');
  assert.equal((await submit({...request,operationId:randomUUID(),expectedRevision:1})).revision,2);
  // Game progress can never become reward-eligible or carry journal facts.
  await assert.rejects(()=>submit({...request,documentId:randomUUID(),operationId:randomUUID(),metadata:{...metadata,eligible:true}}),error=>error.code==='22023');
  await assert.rejects(()=>submit({...request,documentId:randomUUID(),operationId:randomUUID(),metadata:{...metadata,journalDate:'2026-10-08'}}),error=>error.code==='22023');
  // The kind of an existing document cannot be switched.
  await assert.rejects(()=>submit({...request,operationId:randomUUID(),expectedRevision:2,metadata:{...metadata,kind:'DECORATIONS'}}),error=>error.code==='22023');
  // Unknown kinds are still refused.
  await assert.rejects(()=>submit({...request,documentId:randomUUID(),operationId:randomUUID(),metadata:{...metadata,kind:'MINIGAME_POINTS'}}),error=>error.code==='22023');
  const deleted=await submit({documentId:request.documentId,operationId:randomUUID(),expectedRevision:2},'delete');
  assert.equal(deleted.kind,'deleted');
});
test('the reward summary ignores game progress',async()=>{
  const summary=(await db.query('select public.account_reward_summary() summary')).rows[0].summary;
  assert.equal(summary.journalDays,0);
});
