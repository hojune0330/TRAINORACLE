import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { loadOracleMigrationChain, setOracleAuth, approveSyntheticOracleStorage, admitOracleStorage } from './oracle-auth-fixture.mjs';

// Local PostgreSQL engine + the complete integrated 0001..0062 chain. This is
// neither a production migration nor native multi-session concurrency evidence.
const db=new PGlite({extensions:{pgcrypto}});
const owner='a1111111-1111-4111-8111-111111111111',other='b2222222-2222-4222-8222-222222222222';
const sessions=new Map([[owner,randomUUID()],[other,randomUUID()]]),key=Buffer.alloc(32,62);
const payload={version:1,algorithm:'AES-GCM',keyId:'synthetic',iv:Buffer.alloc(12).toString('base64'),ciphertext:Buffer.alloc(16).toString('base64')};
const metadata=(kind,extra={})=>({kind,occurrenceId:null,journalDate:null,eligible:false,...extra});
const input=(kind,extra={})=>({documentId:randomUUID(),operationId:randomUUID(),expectedRevision:0,encryptedPayload:payload,metadata:metadata(kind),...extra});
const part=(kind='GOAL_PROGRAM_BODY',char='a')=>input(kind,{metadata:metadata(kind,{goalProgramPartId:`sha256:${char.repeat(64)}`})});
const reference=value=>({documentId:value.documentId,kind:value.metadata.kind,partId:value.metadata.goalProgramPartId});
async function submit(body={},action='commit',actor=owner) {
  const raw=JSON.stringify({domain:'trainoracle.account-journal.gateway.v1',ownerId:actor,action,expiresAt:Math.floor(Date.now()/1000)+90,...body});
  const signature=createHmac('sha256',key).update(raw).digest('hex');
  return (await db.query('select public.mutate_account_journal_attested($1,$2,$3) result',[raw,signature,'synthetic'])).rows[0].result;
}
const denied=(work,code='22023')=>assert.rejects(work,error=>error.code===code);
before(async()=>{
  await loadOracleMigrationChain(db);
  for(const actor of [owner,other]) {
    await db.query("insert into auth.users(id,created_at,email_confirmed_at,encrypted_password) values($1,'2020-01-01',clock_timestamp(),null)",[actor]);
    await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval '1 hour')",[sessions.get(actor),actor]);
  }
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC','AUTH_OAUTH')");
  await db.query('insert into public.account_journal_gateway_keys(key_id,secret) values($1,$2)',['synthetic',key]);
  await approveSyntheticOracleStorage(db);
  for(const actor of [owner,other]) await admitOracleStorage(db,actor,sessions.get(actor));
  await db.exec('reset role');
  const before=(await db.query('select * from public.service_feature_controls order by feature_key')).rows;
  await db.exec(readFileSync(new URL('../../operations/goal-program-account-storage.sql',import.meta.url),'utf8'));
  const after=(await db.query('select * from public.service_feature_controls order by feature_key')).rows;
  assert.deepEqual(after,before,'SQL proposal must not activate any feature');
  await setOracleAuth(db,owner,sessions.get(owner));
},{timeout:120000});
after(()=>db.close());

test('additive attested support keeps existing storage admission and draft CAS intact',async()=>{
  assert.deepEqual(await submit({},'goalProgramSupport'),{kind:'goal-program-support',version:1});
  const legacy=input('DRAFT');
  const first=await submit(legacy);assert.equal(first.kind,'saved');assert.equal(first.revision,1);
  assert.deepEqual(await submit(legacy),first);
  assert.equal((await submit({...legacy,operationId:randomUUID()})).kind,'conflict');
});

test('immutable encrypted parts, receipts and verified manifest CAS share the existing owner boundary',async()=>{
  const body=part(),progress=part('GOAL_PROGRAM_PROGRESS','b');
  const index=input('GOAL_PROGRAM_INDEX',{metadata:metadata('GOAL_PROGRAM_INDEX',{goalProgramParts:[reference(body),reference(progress)]})});
  await denied(()=>submit(index));
  assert.equal((await submit(body)).revision,1);assert.equal((await submit(progress)).revision,1);
  const first=await submit(index);assert.equal(first.revision,1);assert.deepEqual(await submit(index),first);
  assert.equal((await submit({...index,operationId:randomUUID()})).kind,'conflict');
  assert.equal((await submit({...index,operationId:randomUUID(),expectedRevision:1})).revision,2);
  await denied(()=>submit({...body,operationId:randomUUID(),expectedRevision:1}));
  for(const action of ['delete','restore']) await denied(()=>submit({documentId:body.documentId,operationId:randomUUID(),expectedRevision:1,
    ...(action==='restore'?{sourceRevision:1}:{})},action));
  for(const action of ['delete','restore']) await denied(()=>submit({documentId:index.documentId,operationId:randomUUID(),expectedRevision:2,
    ...(action==='restore'?{sourceRevision:1}:{})},action));
});

test('references cannot borrow another owner, wrong identity, altered hash, duplicate or null fields',async()=>{
  const foreign=part('GOAL_PROGRAM_BODY','c');
  await setOracleAuth(db,other,sessions.get(other));await submit(foreign,'commit',other);
  await setOracleAuth(db,owner,sessions.get(owner));
  const local=part('GOAL_PROGRAM_BODY','d');await submit(local);
  const good=reference(local);
  for(const refs of [[reference(foreign)],[{...good,kind:'GOAL_PROGRAM_PROGRESS'}],[{...good,partId:`sha256:${'e'.repeat(64)}`}],
    [good,good],[{...good,partId:null}],[{...good,kind:null}],[{...good,documentId:null}]]) {
    await denied(()=>submit(input('GOAL_PROGRAM_INDEX',{metadata:metadata('GOAL_PROGRAM_INDEX',{goalProgramParts:refs})})));
  }
  await denied(()=>db.query('select public.verify_account_goal_program_parts($1,$2)',[owner,JSON.stringify({goalProgramParts:[good]})]),'42501');
});

test('monthly metadata cannot leak into legacy kinds or bypass purpose consent/auth gates',async()=>{
  await denied(()=>submit(input('DRAFT',{metadata:metadata('DRAFT',{goalProgramParts:[]})})));
  await denied(()=>submit(input('GOAL_PROGRAM_BODY',{metadata:metadata('GOAL_PROGRAM_BODY',{goalProgramPartId:`sha256:${'a'.repeat(64)}`,goalProgramParts:[]})})));
  try {
    await setOracleAuth(db,owner,sessions.get(owner),{amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]});
    await denied(()=>submit({},'goalProgramSupport'),'42501');
    await denied(()=>submit(part()),'42501');
  } finally { await setOracleAuth(db,owner,sessions.get(owner)) }
  try {
    await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-trainoracle-storage-revision':'0'})]);
    await denied(()=>submit(part()),'42501');
  } finally { await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-trainoracle-storage-revision':'1'})]) }
});
