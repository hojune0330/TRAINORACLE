import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { loadOracleMigrationChain, approveSyntheticOracleStorage, admitOracleStorage, setOracleAuth, ORACLE_STORAGE_VERSION } from './oracle-auth-fixture.mjs';

const db = new PGlite({extensions:{pgcrypto}});
const adult = {id:randomUUID(), session:randomUUID()};
const minor = {id:randomUUID(), session:randomUUID()};
const key = Buffer.alloc(32, 93);
const encryptedPayload = {version:1,algorithm:'AES-GCM',keyId:'fixture',iv:Buffer.alloc(12).toString('base64'),ciphertext:Buffer.alloc(16).toString('base64')};
const metadata = {kind:'RUN_BTI_PROFILE',occurrenceId:null,journalDate:null,eligible:false};

function documentId(owner) {
  const bytes = createHash('sha256').update(JSON.stringify(['trainoracle.account.run-bti-profile.v1',owner.id])).digest();
  bytes[6] = bytes[6] & 15 | 80;
  bytes[8] = bytes[8] & 63 | 128;
  return bytes.subarray(0,16).toString('hex').replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
}
async function submit(owner,action,body={}) {
  const raw = JSON.stringify({domain:'trainoracle.account-journal.gateway.v1',ownerId:owner.id,
    action,expiresAt:Math.floor(Date.now()/1000)+90,...body});
  const signature = createHmac('sha256',key).update(raw).digest('hex');
  return (await db.query('select public.mutate_account_journal_attested($1,$2,$3) result',[raw,signature,'fixture'])).rows[0].result;
}
const write = (owner,revision,patch={}) => submit(owner,'commit',{documentId:documentId(owner),operationId:randomUUID(),
  expectedRevision:revision,encryptedPayload,metadata,runBtiAnsweredAt:new Date().toISOString(),...patch});
const fails = (code,fn) => assert.rejects(fn, error => error.code === code);
before(async () => {
  await loadOracleMigrationChain(db);
  await db.exec('reset role');
  for (const name of ['0063_lounge_identity_deletion_outbox.sql','0064_minigame_progress_account_storage.sql',
    '0065_lounge_grant_auth_channel_recheck.sql']) {
    await db.exec(readFileSync(new URL('../../migrations/'+name, import.meta.url),'utf8'));
  }
  await db.exec(readFileSync(new URL('../../operations/goal-program-account-storage.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../../migrations/20261122000000_run_bti_account_storage.sql',import.meta.url),'utf8'));
  for (const owner of [adult,minor]) {
    await db.query("insert into auth.users(id,created_at,email_confirmed_at,encrypted_password) values($1,'2020-01-01',clock_timestamp(),null)",[owner.id]);
    await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval '1 hour')",[owner.session,owner.id]);
  }
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC','AUTH_OAUTH')");
  await db.query("insert into public.account_journal_gateway_keys(key_id,secret) values('fixture',$1)",[key]);
  await approveSyntheticOracleStorage(db);
  const younger = (await db.query("select (((clock_timestamp() at time zone 'Asia/Seoul')::date-interval '18 years')::date)::text birth")).rows[0].birth;
  await admitOracleStorage(db,minor.id,minor.session,younger);
  await admitOracleStorage(db,adult.id,adult.session);
},{timeout:180000});
after(() => db.close());

test('only the admitted adult owner may connect answers made after the nineteenth birthday in Korea',async () => {
  await setOracleAuth(db,minor.id,minor.session);
  assert.deepEqual(await submit(minor,'runBtiProfileSupport'),{kind:'run-bti-profile-support',version:1,eligible:false});
  await fails('42501',()=>write(minor,0));
  await fails('42501',()=>submit(adult,'runBtiProfileSupport'));
  await setOracleAuth(db,adult.id,adult.session);
  assert.deepEqual(await submit(adult,'runBtiProfileSupport'),{kind:'run-bti-profile-support',version:1,eligible:true});
  assert.deepEqual(await submit(adult,'goalProgramSupport'),{kind:'goal-program-support',version:1});
  await fails('22023',()=>write(adult,0,{metadata:{...metadata,kind:'UNRECOGNIZED_KIND'}}));
  await fails('42501',()=>write(adult,0,{runBtiAnsweredAt:'2008-12-31T14:59:59.999Z'}));
  await fails('22023',()=>write(adult,0,{runBtiAnsweredAt:'2099-12-31T15:00:00.000Z'}));
  await fails('22023',()=>write(adult,0,{runBtiAnsweredAt:undefined}));
  await fails('22023',()=>write(adult,0,{documentId:documentId(minor)}));
  await fails('22023',()=>write(adult,0,{metadata:{...metadata,eligible:true}}));
  assert.equal((await write(adult,0,{runBtiAnsweredAt:'2008-12-31T15:00:00.000Z'})).revision,1);
  assert.equal((await write(adult,0)).kind,'conflict');
  assert.equal((await write(adult,1)).revision,2);
  assert.equal((await submit(adult,'delete',{documentId:documentId(adult),operationId:randomUUID(),expectedRevision:2})).kind,'deleted');
  await fails('22023',()=>submit(adult,'restore',{documentId:documentId(adult),operationId:randomUUID(),expectedRevision:3,sourceRevision:2,metadata}));
  const fresh = await write(adult,3);
  assert.equal(fresh.kind,'saved');
  assert.equal(fresh.revision,4);
  assert.equal((await db.query('select public.account_reward_summary() summary')).rows[0].summary.journalDays,0);
  await db.query('select public.set_account_storage_consent($1,$2,1,$3,false,false)',[adult.id,adult.session,ORACLE_STORAGE_VERSION]);
  await fails('42501',()=>write(adult,4));
});
