import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID, createHmac, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { importJournalAttestor, createAccountJournalHandler, importJournalKeyring, validateAccountJournalDocument } from '../../functions/_shared/account-journal-handler.mjs';

// PostgreSQL + pgcrypto, not a SQL string matcher. One session queues operations;
// Promise.all is NOT evidence of inter-session advisory-lock behavior.
const db = new PGlite({ extensions: { pgcrypto } });
const migrations = new URL('../../migrations/', import.meta.url);
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
const secret = Buffer.alloc(32, 71); // Synthetic disposable fixture only.
const attest = await importJournalAttestor(JSON.stringify({ keyId:'fixture',key:secret.toString('base64') }));
const cipher = (byte=0) => ({ version:1,algorithm:'AES-GCM',keyId:'synthetic',
  iv:Buffer.alloc(12,byte).toString('base64'),ciphertext:Buffer.alloc(16,byte).toString('base64') });
const draft = {kind:'DRAFT',occurrenceId:null,journalDate:null,eligible:false};
const occurrence = `sha256:${'a'.repeat(64)}`;
let today;
const journal = (extra={}) => ({kind:'JOURNAL',occurrenceId:occurrence,journalDate:today,eligible:true,awardAllowed:true,...extra});
const input = (extra={}) => ({documentId:randomUUID(),operationId:randomUUID(),expectedRevision:0,encryptedPayload:cipher(),metadata:draft,...extra});
const rpc = async (name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) result`,args)).rows[0].result;
const submit = value => rpc('mutate_account_journal_attested',[value.request_text,value.signature,value.key_id]);
const mutate = async (body,action='commit',owner=A) => submit(await attest(owner,action,body));
const denied = (fn,code='42501') => assert.rejects(fn,e=>e.code===code);
async function login(id=A) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [id,JSON.stringify({sub:id,role:'authenticated'})]);
}
async function admin(sql,args=[]) { await db.exec('reset role;'); return db.query(sql,args); }
let preservedBefore, preservedAfter;
before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for(const file of readdirSync(migrations).filter(n=>/^\d+_.+\.sql$/.test(n)&&n<'0035').sort())
    await db.exec(readFileSync(new URL(file,migrations),'utf8'));
  for(const owner of [A,B]) {
    await db.query("insert into auth.users(id,created_at) values($1,'2020-01-01')",[owner]);
    await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
      values($1,'1990-01-01','fixture','fixture',clock_timestamp())`,[owner]);
    await db.query('insert into public.beta_enrollments(user_id) values($1)',[owner]);
  }
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC');");
  await login();
  await rpc('commit_account_journal_document',[randomUUID(),randomUUID(),0,JSON.stringify(cipher())]);
  await admin("insert into public.journal_entries(user_id,entry_id,saved_at,entry) values($1,'legacy','fixture','{}')",[A]);
  const snapshot = async()=>Object.fromEntries(await Promise.all(['account_journal_documents','account_journal_operations','journal_entries','service_feature_controls']
    .map(async table=>[table,(await db.query(`select * from public.${table}`)).rows.map(({trusted_metadata,...row})=>row)])));
  preservedBefore=await snapshot();
  let sql=readFileSync(new URL('0035_account_journal_gateway_cutover.sql',migrations),'utf8');
  if(process.env.CUTOVER_MUTATION==='signature') sql=sql.replace("or extensions.hmac(convert_to(request_text,'UTF8'), signing_key, 'sha256')\n    <> decode(signature,'hex')",'');
  if(process.env.CUTOVER_MUTATION==='uniqueness') sql=sql.replace('create unique index account_journal_occurrence_unique','create index account_journal_occurrence_unique');
  await db.exec(sql);
  preservedAfter=await snapshot();
  // Model the platform's normal table DML grants; RLS/triggers must do the work.
  await db.exec('grant select,insert,update,delete on public.journal_entries,public.journal_tombstones to authenticated');
  await db.query('insert into public.account_journal_gateway_keys(key_id,secret) values($1,$2)',['fixture',secret]);
  today=(await db.query("select ((clock_timestamp() at time zone 'Asia/Seoul')::date)::text as today")).rows[0].today;
},{timeout:60000});
beforeEach(async()=>{
  await db.exec(`reset role; truncate public.account_journal_history,public.account_journal_operations,public.account_journal_documents,
    public.account_journal_identity,public.account_journal_finalization_events,public.account_journal_cutovers,
    public.account_reward_days,public.account_decoration_purchases,public.account_decoration_legacy_grants;
    update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC');`);
  await login();
});
after(()=>db.close());

test('0035 preserves existing ciphertext, receipts, legacy rows and feature values',()=>assert.deepEqual(preservedAfter,preservedBefore));
test('one-time unverified legacy import preserves ownership without credit; expansion and restore cannot bypass purchases',async()=>{
  const metadata={kind:'DECORATIONS',occurrenceId:null,journalDate:null,eligible:false,
    purchases:[{itemId:'legacy-item',cost:20}],spentPoints:20,legacyInitialGrant:true};
  const first=input({metadata});
  assert.equal((await mutate(first)).kind,'saved');
  assert.equal((await mutate(first)).kind,'saved');
  assert.deepEqual(Object.fromEntries(Object.entries(await rpc('account_reward_summary')).filter(([key])=>['points','spentPoints','availablePoints','legacySpentPoints'].includes(key))),
    {points:0,spentPoints:0,availablePoints:0,legacySpentPoints:20});
  await denied(()=>db.query('select * from public.account_decoration_legacy_grants'));
  const {legacyInitialGrant,...ordinary}=metadata;
  const edit={...first,operationId:randomUUID(),expectedRevision:1,metadata:ordinary};
  assert.equal((await mutate(edit)).kind,'saved');
  await denied(()=>mutate({...edit,operationId:randomUUID(),expectedRevision:2,
    metadata:{...metadata,purchases:[...metadata.purchases,{itemId:'free-expansion',cost:3}],spentPoints:23}}),'22023');
  const purchase={...edit,operationId:randomUUID(),expectedRevision:2,
    metadata:{...ordinary,purchases:[...ordinary.purchases,{itemId:'new-item',cost:3}],spentPoints:23}};
  await denied(()=>mutate(purchase),'P0001');
  await mutate(input({metadata:journal({occurrenceId:null})}));
  assert.equal((await mutate(purchase)).kind,'saved');
  assert.equal((await rpc('account_reward_summary')).availablePoints,1);
  await denied(()=>mutate({documentId:first.documentId,operationId:randomUUID(),expectedRevision:3,sourceRevision:1,metadata:ordinary},'restore'),'22023');
  await denied(()=>mutate({...purchase,operationId:randomUUID(),expectedRevision:3,
    metadata:{...purchase.metadata,purchases:[{itemId:'new-item',cost:3}]}}),'22023');
  await login(B);
  assert.equal((await rpc('account_reward_summary')).legacySpentPoints,0);
  await denied(()=>mutate(input({metadata:{...ordinary}}),'commit',B),'P0001');
  await admin('select * from public.account_decoration_legacy_grants');
  const grant=(await db.query('select * from public.account_decoration_legacy_grants')).rows[0];
  assert.equal(grant.provenance,'LEGACY_INITIAL_GRANT');
  assert.equal(grant.verification,'UNVERIFIED_LEGACY');
  assert.deepEqual(grant.items,metadata.purchases);
});
test('legacy grant denies new accounts, expired window, duplicate IDs and oversized claims without mutation',async()=>{
  const metadata={kind:'DECORATIONS',occurrenceId:null,journalDate:null,eligible:false,
    purchases:[{itemId:'legacy',cost:20}],spentPoints:20,legacyInitialGrant:true};
  await admin("update auth.users set created_at=clock_timestamp()+interval '1 day' where id=$1",[A]);await login();
  try { await denied(()=>mutate(input({metadata}))); }
  finally { await admin("update auth.users set created_at='2020-01-01' where id=$1",[A]);await login(); }
  const window=(await admin('select * from public.account_decoration_legacy_window')).rows[0];
  await admin("update public.account_decoration_legacy_window set cutover_at=clock_timestamp()-interval '31 days', expires_at=clock_timestamp()-interval '1 day'");await login();
  try { await denied(()=>mutate(input({metadata}))); }
  finally { await admin('update public.account_decoration_legacy_window set cutover_at=$1,expires_at=$2',[window.cutover_at,window.expires_at]);await login(); }
  await denied(()=>mutate(input({metadata:{...metadata,purchases:[...metadata.purchases,...metadata.purchases]}})));
  await denied(()=>mutate(input({metadata:{...metadata,purchases:Array.from({length:129},(_,i)=>({itemId:`item-${i}`,cost:1}))}})));
  assert.equal((await db.query('select * from public.account_journal_documents')).rows.length,0);
  assert.equal((await rpc('account_reward_summary')).points,0);
});
test('unattested RPCs and private lifecycle helpers remain inaccessible',async()=>{
  const i=input();
  for(const role of ['authenticated','anon','service_role']) {
    await db.exec(`reset role;set role ${role};`);
    await denied(()=>rpc('commit_account_journal_document',[i.documentId,i.operationId,0,JSON.stringify(i.encryptedPayload)]));
    await denied(()=>rpc('delete_account_journal_document',[i.documentId,i.operationId,0]));
    await denied(()=>rpc('restore_account_journal_document',[i.documentId,i.operationId,0,1]));
    await denied(()=>rpc('mutate_account_journal_lifecycle',[i.documentId,i.operationId,0,JSON.stringify(i.encryptedPayload),'commit',null]));
    await denied(()=>db.query('select * from public.account_journal_gateway_keys'));
    await denied(()=>db.query('insert into public.account_reward_days values($1,current_date,\'JOURNAL\')',[A]));
  }
});
test('real HMAC rejects omitted metadata, changed ciphertext, foreign owner, expiry and bogus signature',async()=>{
  const i=input(); const signed=await attest(A,'commit',i);
  await denied(()=>submit({...signed,signature:'0'.repeat(64)}));
  for(const edit of [x=>({...x,ownerId:B}),x=>({...x,metadata:undefined}),x=>({...x,encryptedPayload:cipher(2)})]) {
    await denied(()=>submit({...signed,request_text:JSON.stringify(edit(JSON.parse(signed.request_text)))}));
  }
  await denied(()=>submit({...signed,key_id:'missing'}));
  const expired=JSON.stringify({...JSON.parse(signed.request_text),expiresAt:1});
  await denied(()=>submit({...signed,request_text:expired,signature:createHmac('sha256',secret).update(expired).digest('hex')}));
  await login(B); await denied(()=>submit(signed));
  await login(); assert.equal((await submit(signed)).kind,'saved');
});
test('planned occurrence uniqueness rolls back ciphertext, receipt and reward on duplicate; other owner isolated',async()=>{
  const first=input({metadata:journal()}); await mutate(first);
  const second=input({metadata:journal()}); await denied(()=>mutate(second),'23505');
  assert.equal((await db.query('select * from public.account_journal_documents')).rows.length,1);
  assert.equal((await db.query('select * from public.account_journal_operations')).rows.length,1);
  assert.equal((await rpc('account_reward_summary')).points,4);
  await login(B); assert.equal((await mutate(second,'commit',B)).kind,'saved');
  assert.equal((await db.query('select * from public.account_journal_documents')).rows.length,1);
});
test('delete frees visible occurrence; restore conflicts atomically; repeated restore never credits',async()=>{
  const first=input({metadata:journal()}); await mutate(first);
  await mutate({documentId:first.documentId,operationId:randomUUID(),expectedRevision:1},'delete');
  const second=input({metadata:journal()}); await mutate(second);
  const restore={documentId:first.documentId,operationId:randomUUID(),expectedRevision:2,sourceRevision:1,metadata:journal()};
  await denied(()=>mutate(restore,'restore'),'23505');
  await mutate({documentId:second.documentId,operationId:randomUUID(),expectedRevision:1},'delete');
  assert.equal((await mutate(restore,'restore')).revision,3);
  assert.equal((await mutate(restore,'restore')).revision,3);
  assert.equal((await rpc('account_reward_summary')).points,4);
});
test('same operation retries and late replay cannot reactivate a deleted occurrence',async()=>{
  const first=input({metadata:journal()}); const saved=await mutate(first);
  assert.deepEqual(await mutate(first),saved);
  await mutate({documentId:first.documentId,operationId:randomUUID(),expectedRevision:1},'delete');
  assert.deepEqual(await mutate(first),saved);
  assert.equal((await mutate(input({metadata:journal()}))).kind,'saved');
});
test('queued same-occurrence writes have one winner; PGlite does not test multiple sessions',async()=>{
  const results=await Promise.allSettled([mutate(input({metadata:journal()})),mutate(input({metadata:journal()}))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'23505');
});
test('only today eligible nonmigration saves credit once per day; visit is explicit once per server day',async()=>{
  for(const metadata of [draft,journal({eligible:false}),journal({journalDate:'2020-01-01'}),journal({awardAllowed:false})])
    await mutate(input({metadata:{...metadata,occurrenceId:null}}));
  assert.equal((await rpc('account_reward_summary')).points,0);
  await mutate(input({metadata:journal({occurrenceId:null})}));
  await mutate(input({metadata:journal({occurrenceId:null})}));
  assert.equal((await rpc('record_account_reward_visit')).awardedPoints,1);
  assert.equal((await rpc('record_account_reward_visit')).awardedPoints,0);
  assert.equal((await rpc('account_reward_summary')).points,5);
  await login(B); assert.equal((await rpc('account_reward_summary')).points,0);
});
test('purchase debit and cipher CAS are atomic, retries do not double debit, client spent cannot mint credit',async()=>{
  await mutate(input({metadata:journal({occurrenceId:null})}));
  const meta={...draft,kind:'DECORATIONS',purchases:[{itemId:'synthetic-item',cost:3}],spentPoints:3};
  const state=input({metadata:meta}); await mutate(state); await mutate(state);
  assert.equal((await rpc('account_reward_summary')).availablePoints,1);
  const more={...state,operationId:randomUUID(),expectedRevision:1,encryptedPayload:cipher(1),
    metadata:{...meta,purchases:[...meta.purchases,{itemId:'another',cost:3}],spentPoints:6}};
  await denied(()=>mutate(more),'P0001');
  assert.equal((await db.query('select revision from public.account_journal_documents where document_id=$1',[state.documentId])).rows[0].revision,1);
  assert.equal((await rpc('account_reward_summary')).spentPoints,3);
  await denied(()=>mutate({...more,metadata:{...meta,spentPoints:0}}),'22023');
});
test('legacy insert/update/delete and tombstones blocked ON and sticky after accepted cutover',async()=>{
  await admin("update public.service_feature_controls set enabled=false where feature_key='ACCOUNT_JOURNAL_V2'");await login(B);
  const id=randomUUID();
  await db.query("insert into public.journal_entries(user_id,entry_id,saved_at,entry) values($1,$2,'fixture','{}')",[B,id]);
  await db.query('delete from public.journal_entries where user_id=$1 and entry_id=$2',[B,id]);
  await admin("update public.service_feature_controls set enabled=true where feature_key='ACCOUNT_JOURNAL_V2'");await login();
  const calls=[()=>db.query("insert into public.journal_entries(user_id,entry_id,saved_at,entry) values($1,'new','fixture','{}')",[A]),
    ()=>db.query("update public.journal_entries set saved_at='changed' where user_id=$1",[A]),
    ()=>db.query('delete from public.journal_entries where user_id=$1',[A]),
    ()=>db.query("insert into public.journal_tombstones(user_id,entry_id,deleted_at) values($1,'new','fixture')",[A])];
  for(const call of calls) await denied(call);
  await denied(()=>db.exec('truncate public.journal_entries'));
  await denied(()=>db.exec('truncate public.journal_tombstones'));
  await mutate(input());
  await admin("update public.service_feature_controls set enabled=false where feature_key='ACCOUNT_JOURNAL_V2'"); await login();
  for(const call of calls) await denied(call);
  await denied(()=>rpc('account_reward_summary'));
});
test('migration-era unknown identities block new journals until metadata reconciliation',async()=>{
  await admin('insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values($1,$2,1,$3)',[A,randomUUID(),JSON.stringify(cipher())]);
  await login(); await denied(()=>mutate(input({metadata:journal()})));
});

test('eligibility outbox failure rolls back finalized ciphertext, operation and earned day',async()=>{
  await admin('alter table public.account_journal_finalization_events add constraint synthetic_failure check (not eligible)');
  await login();
  try {
    await denied(()=>mutate(input({metadata:journal()})),'23514');
    assert.equal((await db.query('select * from public.account_journal_documents')).rows.length,0);
    assert.equal((await db.query('select * from public.account_journal_operations')).rows.length,0);
    assert.equal((await rpc('account_reward_summary')).points,0);
  } finally { await admin('alter table public.account_journal_finalization_events drop constraint synthetic_failure');await login(); }
});

test('missing or disabled signing key and owner gates deny attested readiness without writes',async()=>{
  assert.deepEqual(await mutate({},'status'),{kind:'ready'});
  await admin("update public.account_journal_gateway_keys set enabled=false where key_id='fixture'");await login();
  try { await denied(()=>mutate({},'status')); }
  finally { await admin("update public.account_journal_gateway_keys set enabled=true where key_id='fixture'");await login(); }
  for(const gate of ['ACCOUNT','ACCOUNT_JOURNAL_V2']) {
    await admin('update public.service_feature_controls set enabled=false where feature_key=$1',[gate]);await login();
    await denied(()=>mutate({},'status'));
    await admin('update public.service_feature_controls set enabled=true where feature_key=$1',[gate]);await login();
  }
  assert.equal((await db.query('select * from public.account_journal_documents')).rows.length,0);
});

test('real handler + 0035: gateway derived rewards, migration suppression, ciphertext and semantic retry',async()=>{
  const {build}=createRequire(new URL('../../../app/package.json',import.meta.url))('esbuild');
  const output=await build({stdin:{contents:'export { createEmptyDecorationState } from "./src/domain/decoration-schema.ts"; export { DECORATION_CATALOG } from "./src/domain/decoration-catalog.ts"; export { canonicalJsonFingerprint } from "../impl/src/plan-generator/candidate-identity.ts";',
    resolveDir:fileURLToPath(new URL('../../../app/',import.meta.url)),loader:'ts'},bundle:true,write:false,platform:'neutral',format:'esm',minify:true});
  const fixtures=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
  const material=await importJournalKeyring(JSON.stringify({activeKeyId:'fixture',keys:{fixture:Buffer.alloc(32,81).toString('base64')}}));
  const rows=async(sql,args)=>(await db.query(sql,args)).rows.map(row=>({...row,
    ...(row.deleted_at instanceof Date?{deleted_at:row.deleted_at.toISOString()}:{})}));
  const repo={
    enabled:async()=>true,
    operation:async(owner,id)=>(await rows('select * from public.account_journal_operations where user_id=$1 and operation_id=$2',[owner,id]))[0]??null,
    read:async(owner,id)=>(await rows('select * from public.account_journal_documents where user_id=$1 and document_id=$2',[owner,id]))[0]??null,
    commit:body=>mutate(body),delete:body=>mutate(body,'delete'),restore:body=>mutate(body,'restore'),
    history:id=>rpc('list_account_journal_history',[id]),
    rewardSummary:()=>rpc('account_reward_summary'),visit:()=>rpc('record_account_reward_visit'),
  };
  const handler=createAccountJournalHandler({authenticate:async()=>({ownerId:A,repo}),getMaterial:async()=>material,validateDocument:validateAccountJournalDocument});
  const send=async body=>{
    const response=await handler(new Request('https://synthetic.test/account-journal',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify(body)}));
    return {status:response.status,body:await response.json()};
  };
  const linkFacts={planVersionId:occurrence,candidateFingerprint:occurrence,sessionContentFingerprint:occurrence,
    plannedDate:today,sessionDay:1,sessionSlot:'AM',plannedRole:'REST',plannedEnergyIntent:'RECOVERY_INTENT'};
  const plannedSessionLink={...linkFacts,schemaVersion:1,plannedSessionId:fixtures.canonicalJsonFingerprint('trainoracle.planned-session.v1',linkFacts),
    linkSource:'ATHLETE_SELECTED_FROM_PLAN',linkedAt:new Date().toISOString()};
  const document=(id)=>({version:2,state:'FINALIZED',kind:'JOURNAL',entry:{id,kind:'post-session',date:today,
    savedAt:new Date().toISOString(),syncState:'local',system:'rest',title:'',distanceKm:'',durationMin:'',avgPace:'',rpe:0,
    memo:'Synthetic private text',memoPurpose:'PRIVATE_SELF_ONLY',plannedSessionLink}});
  const docId=id=>{
    const bytes=createHash('sha256').update(JSON.stringify(['trainoracle.journal.record.v1',A,id])).digest();
    bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
    const h=bytes.subarray(0,16).toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  };
  const migration={action:'save',documentId:docId('migration'),operationId:randomUUID(),expectedRevision:0,document:document('migration'),writePurpose:'MIGRATION'};
  assert.equal((await send(migration)).status,200);
  assert.equal((await send(migration)).status,200);
  const {writePurpose,...ordinaryReplay}=migration;
  assert.equal((await send(ordinaryReplay)).body.error,'OPERATION_REUSED');
  assert.equal((await send({...ordinaryReplay,operationId:randomUUID(),expectedRevision:1})).status,200);
  assert.equal((await rpc('account_reward_summary')).points,0,'migration origin remains suppressed after normal edits');
  const duplicate={...ordinaryReplay,documentId:docId('duplicate'),operationId:randomUUID(),document:document('duplicate')};
  assert.equal((await send(duplicate)).status,409,'actual validated same planned occurrence is unique');
  assert.equal((await rpc('account_reward_summary')).points,0,'duplicate of migrated occurrence cannot earn');
  assert.equal((await send({action:'delete',documentId:migration.documentId,operationId:randomUUID(),expectedRevision:2})).status,200);
  assert.equal((await send({action:'restore',documentId:migration.documentId,operationId:randomUUID(),expectedRevision:3,sourceRevision:2})).status,200);
  assert.equal((await rpc('account_reward_summary')).points,0,'restored today planned journal cannot earn');
  const fresh={...ordinaryReplay,documentId:docId('fresh'),operationId:randomUUID(),document:document('fresh')};
  delete fresh.document.entry.plannedSessionLink;
  assert.equal((await send({...fresh,metadata:{eligible:true}})).status,400,'client cannot supply metadata');
  assert.equal((await send(fresh)).status,200);
  assert.equal((await send(fresh)).status,200);
  assert.equal((await send({action:'rewardSummary'})).body.points,4);
  assert.equal((await send({action:'visit',today:'1900-01-01'})).status,400);
  assert.equal((await send({action:'visit'})).body.awardedPoints,1);
  assert.equal((await send({action:'visit'})).body.awardedPoints,0);
  const stored=await repo.read(A,fresh.documentId);
  assert.ok(!JSON.stringify(stored).includes('Synthetic private text'));
  assert.equal((await send({action:'read',documentId:fresh.documentId})).body.document.entry.memo,'Synthetic private text');
  const state=structuredClone(fixtures.createEmptyDecorationState());
  const paid=fixtures.DECORATION_CATALOG.find(item=>item.cost>0);
  state.ownedItemIds.push(paid.id);state.spentPoints=paid.cost;
  const bytes=createHash('sha256').update(JSON.stringify(['trainoracle.account.decorations.v1',A])).digest();
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const hex=bytes.subarray(0,16).toString('hex');
  const decorationId=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  const legacy={action:'save',documentId:decorationId,operationId:randomUUID(),expectedRevision:0,writePurpose:'MIGRATION',
    document:{version:3,state:'ACCOUNT_STATE',kind:'DECORATIONS',data:state}};
  const creditBefore=(await send({action:'rewardSummary'})).body;
  assert.equal((await send(legacy)).status,200,'actual catalog-valid encrypted legacy import succeeds');
  assert.equal((await send(legacy)).status,200);
  const {writePurpose:legacyPurpose,...withoutPurpose}=legacy;
  assert.equal((await send(withoutPurpose)).body.error,'OPERATION_REUSED');
  assert.deepEqual((await send({action:'read',documentId:decorationId})).body.document,legacy.document);
  const creditAfter=(await send({action:'rewardSummary'})).body;
  assert.equal(creditAfter.points,creditBefore.points);
  assert.equal(creditAfter.spentPoints,creditBefore.spentPoints);
  assert.equal(creditAfter.availablePoints,creditBefore.availablePoints);
  assert.equal(creditAfter.legacySpentPoints,paid.cost);
});
