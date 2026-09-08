import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash, createHmac, createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Actual local PostgreSQL/pgcrypto execution, not a SQL text/schema mock.
// PGlite has ONE session: race tests exercise both serialized outcomes and the
// acquired advisory lock, NOT inter-session waiting or network/PostgREST behavior.
// No URL, environment secrets, key files, network or production credentials.
const db = new PGlite({ extensions: { pgcrypto } });
const migrations = new URL('../../migrations/', import.meta.url);
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
const signingKey = Buffer.alloc(32, 71);
const encryptionKey = Buffer.alloc(32, 83);
const domain = 'trainoracle.account-journal.gateway.v1';
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const hash = (value, scope='trainoracle.account-plan.v1') =>
  `sha256:${createHash('sha256').update(`${scope}\0${canonical(value)}`).digest('hex')}`;
const partHash = value => hash(value, 'trainoracle.account-plan-collection.v1');
function legacyId(owner=A) {
  const bytes = createHash('sha256').update(JSON.stringify(['trainoracle.account.plan.v1',owner])).digest();
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = bytes.subarray(0,16).toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function encrypt(value, owner=A) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',encryptionKey,iv);
  cipher.setAAD(Buffer.from(`synthetic-plan-fixture:${owner}`));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final(),cipher.getAuthTag()]);
  return {version:1,algorithm:'AES-GCM',keyId:'disposable-fixture',iv:iv.toString('base64'),ciphertext:bytes.toString('base64')};
}
// Personal body is intentionally synthetic, not a valid executable prescription.
// The SQL boundary cannot decrypt/validate it; gateway codec tests own that gate.
function plan(seed='first', {updatedAt='2026-01-01T00:00:00.000Z',archivedAt=null,progress=[]}={}) {
  const planId = hash({synthetic:seed}), snapshotId = partHash({kind:'PLAN_SNAPSHOT',planId});
  const snapshot = {version:1,kind:'PLAN_SNAPSHOT',id:snapshotId,planId,snapshot:{synthetic:seed}};
  const revision = {version:1,kind:'PLAN_PROGRESS',planId,snapshotId,progress,updatedAt,archivedAt};
  const mutable = {...revision,id:partHash(revision)};
  const stage = part => ({partId:part.id,partKind:part.kind,planId,contentHash:partHash(part),payload:encrypt(part),
    metadata:part.kind==='PLAN_SNAPSHOT' ? {snapshotId:null,updatedAt:null,archivedAt:null} : {snapshotId,updatedAt,archivedAt}});
  return {planId,snapshot:stage(snapshot),progress:stage(mutable),
    ref:{planId,snapshotId,snapshotHash:partHash(snapshot),progressId:mutable.id,progressHash:partHash(mutable)}};
}
const index = (plans=[],currentPlanId=null) => ({version:1,kind:'PLAN_COLLECTION',
  documentFingerprint:partHash({synthetic:plans.map(p=>p.ref),currentPlanId}),currentPlanId,plans:plans.map(p=>p.ref)});
function commit(idx, previous=null, overrides={}) {
  const request = {ownerId:A,operationId:randomUUID(),expectedRevision:previous?.revision??0,
    previousIndexFingerprint:previous?.index_fingerprint??null,
    previousCurrentPlanId:previous?.index_document.currentPlanId??null,index:idx,legacy:null,...overrides};
  const {ownerId,...body} = request;
  return {...body,indexFingerprint:hash(idx),requestFingerprint:hash(request),payload:encrypt(idx,ownerId)};
}
function signed(action, body, owner=A, extra={}) {
  const request_text=JSON.stringify({domain,ownerId:owner,action,expiresAt:Math.floor(Date.now()/1000)+90,...body,...extra});
  return {request_text,signature:createHmac('sha256',signingKey).update(request_text).digest('hex'),key_id:'fixture'};
}
const rpc = async (name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) result`,args)).rows[0].result;
const submit = ({request_text,signature,key_id}) => rpc('mutate_account_plan_collection_attested',[request_text,signature,key_id]);
const mutate = (action,body,owner=A) => submit(signed(action,body,owner));
const stage = async p => { await mutate('planStage',p.snapshot); await mutate('planStage',p.progress); };
const readIndex = () => rpc('read_account_plan_collection_index');
const readPart = part => rpc('read_account_plan_collection_part',[part.partKind,part.partId]);
const readReceipt = op => rpc('read_account_plan_collection_receipt',[op]);
const denied = (fn,code='22023') => assert.rejects(fn,error=>error.code===code);
async function login(owner=A,role='authenticated') {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [owner,JSON.stringify({sub:owner,role})]);
}
async function admin(sql,args=[]) { await db.exec('reset role;'); return db.query(sql,args); }
async function oldWrite({owner=A,documentId=legacyId(owner),expectedRevision=0,kind='PLAN',operationId=randomUUID()}={}) {
  const attested=signed('commit',{documentId,operationId,expectedRevision,encryptedPayload:encrypt({synthetic:'old-plan'},owner),
    metadata:{kind,occurrenceId:null,journalDate:null,eligible:false}},owner);
  return rpc('mutate_account_journal_attested',[attested.request_text,attested.signature,attested.key_id]);
}
let preservedBefore, preservedAfter;
before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for (const file of readdirSync(migrations).filter(n=>/^\d+_.+\.sql$/.test(n)&&n<'0037').sort())
    await db.exec(readFileSync(new URL(file,migrations),'utf8'));
  for (const owner of [A,B]) {
    await db.query("insert into auth.users(id,created_at) values($1,'2020-01-01')",[owner]);
    await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
      values($1,'1990-01-01','fixture','fixture',clock_timestamp())`,[owner]);
    await db.query('insert into public.beta_enrollments(user_id) values($1)',[owner]);
  }
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC')");
  await db.query('insert into public.account_journal_gateway_keys(key_id,secret) values($1,$2)',['fixture',signingKey]);
  await login(); await oldWrite();
  await db.exec('reset role;');
  const snapshot = async()=>{
    const result={};
    for (const table of ['account_journal_documents','account_journal_operations','account_journal_identity','service_feature_controls'])
      result[table]=(await db.query(`select * from public.${table}`)).rows;
    return result;
  };
  preservedBefore=await snapshot();
  let sql=readFileSync(new URL('0037_account_plan_collection.sql',migrations),'utf8');
  // Optional throwaway in-memory defect injection, never edits the migration.
  if (process.env.PLAN_COLLECTION_MUTATION==='signature') sql=sql.replace(
    "or extensions.hmac(convert_to(request_text,'UTF8'),signing_key,'sha256')\n    <> decode(signature,'hex')",'');
  if (process.env.PLAN_COLLECTION_MUTATION==='history') sql=sql.replace(
    "jsonb_array_elements(coalesce(current_index.index_document->'plans','[]'::jsonb))", "jsonb_array_elements('[]'::jsonb)");
  await db.exec(sql);
  preservedAfter=await snapshot();
},{timeout:60000});
beforeEach(async()=>{
  await db.exec(`reset role;
    truncate public.account_plan_collection_receipts,public.account_plan_collection_indexes,public.account_plan_collection_parts,
      public.account_journal_history,public.account_journal_operations,public.account_journal_documents,
      public.account_journal_identity,public.account_journal_finalization_events,public.account_journal_cutovers;
    update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC');
    update public.account_journal_gateway_keys set enabled=true;`);
  await login();
});
after(()=>db.close());

test('0037 preserves source ciphertext, identity, old receipts and feature values',()=>assert.deepEqual(preservedAfter,preservedBefore));
test('real HMAC rejects unsigned, tampered, cross-owner, disabled-key and expired requests',async()=>{
  const body=plan().snapshot, valid=signed('planStage',body);
  await denied(()=>submit({...valid,signature:null}),'42501');
  await denied(()=>submit({...valid,signature:'0'.repeat(64)}),'42501');
  await denied(()=>submit({...valid,key_id:'missing'}),'42501');
  await denied(()=>submit({...valid,request_text:JSON.stringify({...JSON.parse(valid.request_text),payload:encrypt({changed:true})})}),'42501');
  await denied(()=>submit(signed('planStage',body,A,{expiresAt:1})),'42501');
  await denied(()=>submit(signed('planStage',body,A,{expiresAt:Math.floor(Date.now()/1000)+1000})),'42501');
  await login(B); await denied(()=>submit(valid),'42501');
  await admin('update public.account_journal_gateway_keys set enabled=false'); await login();
  await denied(()=>submit(valid),'42501');
  await admin('update public.account_journal_gateway_keys set enabled=true'); await login();
  assert.equal((await submit(valid)).kind,'staged');
});
test('all API roles denied direct CRUD and private helpers, only authenticated RPCs granted',async()=>{
  const p=plan(); await stage(p);
  for (const role of ['anon','authenticated','service_role']) {
    await login(A,role);
    for (const table of ['account_plan_collection_parts','account_plan_collection_indexes','account_plan_collection_receipts']) {
      for (const sql of [`select * from public.${table}`,`delete from public.${table}`,
        `update public.${table} set user_id=user_id`,`insert into public.${table}(user_id) values('${A}')`,
        `truncate public.${table}`]) await denied(()=>db.exec(sql),'42501');
    }
    await denied(()=>rpc('account_plan_legacy_id',[A]),'42501');
    if (role!=='authenticated') {
      await denied(()=>readIndex(),'42501');
      await denied(()=>readPart(p.snapshot),'42501');
      await denied(()=>readReceipt(randomUUID()),'42501');
      await denied(()=>mutate('planStage',p.snapshot),'42501');
    }
  }
  await login(''); await denied(()=>readIndex(),'42501');
  const config=(await admin(`select p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'read_account_plan_collection_%' or p.proname='mutate_account_plan_collection_attested')`)).rows;
  assert.equal(config.length,4);
  for (const row of config) { assert.equal(row.prosecdef,true); assert.deepEqual(row.proconfig,['search_path=pg_catalog']); }
});
test('feature OFF and withdrawn consent gate every read, stage and commit',async()=>{
  const p=plan(); await stage(p); const body=commit(index([p],p.planId)); await mutate('planCommit',body);
  for (const feature of ['ACCOUNT','ACCOUNT_JOURNAL_V2']) {
    await admin('update public.service_feature_controls set enabled=false where feature_key=$1',[feature]); await login();
    for (const fn of [readIndex,()=>readPart(p.snapshot),()=>readReceipt(body.operationId),
      ()=>mutate('planStage',p.snapshot),()=>mutate('planCommit',body)]) await denied(fn,'42501');
    await admin('update public.service_feature_controls set enabled=true where feature_key=$1',[feature]); await login();
  }
  await admin('update public.user_private_profiles set legal_consented_at=null,privacy_policy_version=null,terms_of_service_version=null where user_id=$1',[A]); await login();
  try { await denied(()=>readIndex(),'42501'); await denied(()=>mutate('planStage',p.snapshot),'42501'); }
  finally { await admin("update public.user_private_profiles set legal_consented_at=clock_timestamp(),privacy_policy_version='fixture',terms_of_service_version='fixture' where user_id=$1",[A]); await login(); }
});
test('staged immutable parts confer no pointer; same plaintext re-encryption never overwrites',async()=>{
  const p=plan();
  assert.equal(await readIndex(),null); assert.equal(await readPart(p.snapshot),null);
  await stage(p); assert.equal(await readIndex(),null);
  assert.deepEqual(await readPart(p.snapshot),{part_kind:p.snapshot.partKind,part_id:p.snapshot.partId,
    plan_id:p.planId,content_hash:p.snapshot.contentHash,payload:p.snapshot.payload,metadata:p.snapshot.metadata});
  await mutate('planStage',{...p.snapshot,payload:encrypt({same:'attested-body'})});
  assert.deepEqual((await readPart(p.snapshot)).payload,p.snapshot.payload);
  await denied(()=>mutate('planStage',{...p.snapshot,contentHash:hash('different')}));
  await denied(()=>mutate('planStage',{...p.progress,metadata:{...p.progress.metadata,updatedAt:'2026-01-02T00:00:00.000Z'}}));
  await login(B); assert.equal(await readPart(p.snapshot),null);
  await mutate('planStage',{...p.snapshot,contentHash:hash('owner-b')},B);
  await login(); assert.equal((await readPart(p.snapshot)).content_hash,p.snapshot.contentHash);
});
test('exact keys, JSON types, deterministic snapshot refs, time ordering and physical byte bound enforced in SQL',async()=>{
  const p=plan();
  for (const edit of [x=>({...x,extra:'plaintext'}),x=>({...x,partId:hash('wrong')}),x=>({...x,planId:null}),
    x=>({...x,contentHash:4}),x=>({...x,metadata:{...x.metadata,extra:true}}),
    x=>({...x,metadata:{snapshotId:null,updatedAt:null}}),x=>({...x,payload:{...x.payload,plaintext:'no'}}),
    x=>({...x,payload:{...x.payload,ciphertext:Buffer.alloc(500017).toString('base64')}})])
    await denied(()=>mutate('planStage',edit(p.snapshot)));
  for (const meta of [{...p.progress.metadata,snapshotId:hash('wrong')},{...p.progress.metadata,updatedAt:null},
    {...p.progress.metadata,updatedAt:'2026-02-30T00:00:00.000Z'},
    {...p.progress.metadata,updatedAt:'2099-01-01T00:00:00.000Z'},
    {...p.progress.metadata,archivedAt:'2025-01-01T00:00:00.000Z'}])
    await denied(()=>mutate('planStage',{...p.progress,metadata:meta}));
  assert.equal(await readPart(p.snapshot),null);
  await stage(p);
  assert.equal((await mutate('planCommit',commit(index([p],p.planId)))).kind,'committed');
});
test('atomic index and exact receipt; same operation replay succeeds with stale CAS and fresh ciphertext',async()=>{
  const p=plan(); await stage(p); const first=commit(index([p],p.planId));
  const result=await mutate('planCommit',first);
  assert.deepEqual(result,{kind:'committed',receipt:{ownerId:A,operationId:first.operationId,revision:1,
    indexFingerprint:first.indexFingerprint,requestFingerprint:first.requestFingerprint}});
  assert.deepEqual(await readReceipt(first.operationId),result.receipt);
  const current=await readIndex();
  assert.deepEqual(current,{revision:1,index_fingerprint:first.indexFingerprint,index_document:first.index,payload:first.payload});
  const second=commit(first.index,current); assert.equal((await mutate('planCommit',second)).receipt.revision,2);
  assert.deepEqual(await mutate('planCommit',{...first,payload:encrypt(first.index)}),result);
  assert.equal((await readIndex()).revision,2);
  const latest=await readIndex();
  await denied(()=>mutate('planCommit',commit(first.index,latest,{operationId:first.operationId})));
  await login(B); assert.equal(await readIndex(),null); assert.equal(await readReceipt(first.operationId),null);
});
test('CAS independently binds revision, previous fingerprint and previous current pointer',async()=>{
  const p=plan(); await stage(p); await mutate('planCommit',commit(index([p],p.planId)));
  const previous=await readIndex();
  for (const changes of [{expectedRevision:0},{previousIndexFingerprint:hash('other')},{previousCurrentPlanId:null}]) {
    const body=commit(previous.index_document,previous,changes);
    assert.deepEqual(await mutate('planCommit',body),{kind:'conflict'});
    assert.equal(await readReceipt(body.operationId),null);
    assert.deepEqual(await readIndex(),previous);
  }
});
test('missing, foreign-owner, wrong-kind, wrong-hash and cross-plan refs cannot commit',async()=>{
  const p=plan(), other=plan('other');
  await denied(()=>mutate('planCommit',commit(index([p],p.planId))));
  await login(B); await mutate('planStage',p.snapshot,B); await mutate('planStage',p.progress,B); await login();
  await denied(()=>mutate('planCommit',commit(index([p],p.planId))));
  await stage(p); await stage(other);
  for (const change of [{snapshotHash:hash('bad')},{progressHash:hash('bad')},{snapshotId:p.ref.progressId},
    {progressId:other.ref.progressId,progressHash:other.ref.progressHash},
    {snapshotId:other.ref.snapshotId,snapshotHash:other.ref.snapshotHash}]) {
    const idx=index([p],p.planId); idx.plans=[{...p.ref,...change}];
    await denied(()=>mutate('planCommit',commit(idx)));
  }
  assert.equal(await readIndex(),null);
});
test('index exact keys, 100 history bound, duplicate plans, hash and numeric bounds enforced by actual SQL',async()=>{
  const p=plan(); await stage(p);
  for (const idx of [{...index(),personalBody:'forbidden'},{...index(),plans:null},
    {...index(),plans:Array(101).fill(p.ref)},index([p,p]),{...index([p]),currentPlanId:hash('missing')},
    {...index(),plans:[{...p.ref,body:'forbidden'}]},{...index(),version:'1'},
    {...index(),plans:[{...p.ref,progressHash:null}]}])
    await denied(()=>mutate('planCommit',commit(idx)));
  const valid=commit(index([p],p.planId));
  for (const changes of [{extra:true},{expectedRevision:null},{expectedRevision:'0'},{expectedRevision:9007199254740990},
    {operationId:null},{indexFingerprint:hash('bad')},{requestFingerprint:hash('bad')},
    {previousIndexFingerprint:7},{legacy:{}},{legacy:{documentId:randomUUID(),revision:1,fingerprint:hash('source')}}])
    await denied(()=>mutate('planCommit',{...valid,...changes}));
  assert.equal(await readIndex(),null);
});
test('dropped history and snapshot replacement reject even fully rehashed signed requests',async()=>{
  const p=plan(), other=plan('other'); await stage(p); await stage(other);
  await mutate('planCommit',commit(index([p,other],p.planId))); const previous=await readIndex();
  await denied(()=>mutate('planCommit',commit(index([p],p.planId),previous)));
  const changed=index([p,other],p.planId); changed.plans[1]={...other.ref,snapshotHash:hash('replacement')};
  await denied(()=>mutate('planCommit',commit(changed,previous)));
  assert.deepEqual(await readIndex(),previous);
});
test('new pointer must archive prior current; archived progression and resurrection stay immutable',async()=>{
  const p=plan(), other=plan('other'); await stage(p); await stage(other);
  await mutate('planCommit',commit(index([p,other],p.planId))); const previous=await readIndex();
  await denied(()=>mutate('planCommit',commit(index([p,other],other.planId),previous)));
  await denied(()=>mutate('planCommit',commit(index([p,other],null),previous)));
  const archived=plan('first',{archivedAt:'2026-01-02T00:00:00.000Z'}); await stage(archived);
  assert.equal((await mutate('planCommit',commit(index([archived,other],other.planId),previous))).kind,'committed');
  const current=await readIndex();
  const changed=plan('first',{archivedAt:'2026-01-03T00:00:00.000Z',progress:[{synthetic:'mutation'}]}); await stage(changed);
  await denied(()=>mutate('planCommit',commit(index([changed,other],other.planId),current)));
  await denied(()=>mutate('planCommit',commit(index([p,other],other.planId),current)));
  await denied(()=>mutate('planCommit',commit(index([archived,other],p.planId),current)));
  assert.deepEqual(await readIndex(),current);
});
test('progress update advances without rewriting snapshots and cannot rewind updatedAt',async()=>{
  const p=plan('first',{updatedAt:'2026-01-02T00:00:00.000Z'}); await stage(p);
  await mutate('planCommit',commit(index([p],p.planId))); const previous=await readIndex();
  const old=plan(); await stage(old);
  await denied(()=>mutate('planCommit',commit(index([old],old.planId),previous)));
  const newer=plan('first',{updatedAt:'2026-01-03T00:00:00.000Z',progress:[{synthetic:'done'}]}); await stage(newer);
  assert.equal((await mutate('planCommit',commit(index([newer],newer.planId),previous))).receipt.revision,2);
  assert.deepEqual((await readPart(newer.snapshot)).payload,p.snapshot.payload);
});
test('legacy requires empty collection, fixed owner source, live exact revision and preserves source',async()=>{
  const p=plan(); await stage(p); const idx=index([p],p.planId);
  const legacy={documentId:legacyId(),revision:1,fingerprint:hash('synthetic-source')};
  assert.deepEqual(await mutate('planCommit',commit(idx,null,{legacy})),{kind:'conflict'});
  await oldWrite();
  const source=(await admin('select * from public.account_journal_documents where user_id=$1',[A])).rows; await login();
  assert.deepEqual(await mutate('planCommit',commit(idx)),{kind:'conflict'});
  assert.deepEqual(await mutate('planCommit',commit(idx,null,{legacy:{...legacy,revision:2}})),{kind:'conflict'});
  const body=commit(idx,null,{legacy}); assert.equal((await mutate('planCommit',body)).kind,'committed');
  const current=await readIndex();
  assert.deepEqual(await mutate('planCommit',commit(idx,current,{legacy})),{kind:'conflict'});
  assert.deepEqual((await admin('select * from public.account_journal_documents where user_id=$1',[A])).rows,source);
  await login(); assert.equal((await mutate('planCommit',body)).receipt.revision,1);
});
test('deleted legacy source never migrates or silently becomes an empty collection',async()=>{
  await oldWrite();
  const deletion=signed('delete',{documentId:legacyId(),operationId:randomUUID(),expectedRevision:1});
  await rpc('mutate_account_journal_attested',[deletion.request_text,deletion.signature,deletion.key_id]);
  const p=plan(); await stage(p);
  const legacy={documentId:legacyId(),revision:2,fingerprint:hash('source')};
  assert.deepEqual(await mutate('planCommit',commit(index([p]),null,{legacy})),{kind:'conflict'});
  assert.deepEqual(await mutate('planCommit',commit(index())),{kind:'conflict'});
});
test('serialized legacy race: old writer first invalidates source CAS; collection first blocks old writer',async()=>{
  await oldWrite(); const p=plan(); await stage(p);
  const body=commit(index([p],p.planId),null,{legacy:{documentId:legacyId(),revision:1,fingerprint:hash('source')}});
  assert.equal((await oldWrite({expectedRevision:1})).revision,2);
  assert.deepEqual(await mutate('planCommit',body),{kind:'conflict'});
  assert.equal(await readReceipt(body.operationId),null);
  const fresh=commit(body.index,null,{legacy:{...body.legacy,revision:2}});
  await mutate('planCommit',fresh);
  await denied(()=>oldWrite({expectedRevision:2}),'42501');
  const source=(await admin('select revision from public.account_journal_documents where user_id=$1',[A])).rows[0];
  assert.equal(source.revision,2);
});
test('new users block fixed-ID PLAN and new alternate PLAN identity writers after empty collection creation',async()=>{
  await mutate('planCommit',commit(index()));
  await denied(()=>oldWrite(),'42501');
  await denied(()=>oldWrite({kind:'DRAFT'}),'42501');
  await denied(()=>oldWrite({documentId:randomUUID()}),'42501');
  assert.equal((await oldWrite({documentId:randomUUID(),kind:'DRAFT'})).kind,'saved');
  const rows=(await admin('select document_id from public.account_journal_documents where user_id=$1',[A])).rows;
  assert.equal(rows.length,1);
  await admin("update public.service_feature_controls set enabled=false where feature_key='ACCOUNT_JOURNAL_V2'");
  await denied(()=>db.query('insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values($1,$2,1,$3)',
    [A,legacyId(),JSON.stringify(encrypt({synthetic:true}))]),'42501');
});
test('receipt write failure rolls back the newly written index; staged parts survive and exact retry commits',async()=>{
  const p=plan(); await stage(p); const body=commit(index([p],p.planId));
  await admin(`create function public.fixture_receipt_failure() returns trigger language plpgsql as $$
    begin raise exception 'SYNTHETIC_RECEIPT_FAILURE' using errcode='P0001'; end; $$`);
  await admin('create trigger fixture_receipt_failure before insert on public.account_plan_collection_receipts for each row execute function public.fixture_receipt_failure()');
  await login();
  try {
    await denied(()=>mutate('planCommit',body),'P0001');
    assert.equal(await readIndex(),null); assert.equal(await readReceipt(body.operationId),null);
    assert.ok(await readPart(p.snapshot));
  } finally {
    await admin('drop trigger fixture_receipt_failure on public.account_plan_collection_receipts');
    await admin('drop function public.fixture_receipt_failure()'); await login();
  }
  assert.equal((await mutate('planCommit',body)).receipt.revision,1);
});
test('explicit transaction rollback undoes stage, index and receipt together; owner lock is held to transaction end',async()=>{
  const p=plan(), body=commit(index([p],p.planId));
  await db.exec('begin');
  try {
    await stage(p); await mutate('planCommit',body);
    const locks=(await db.query(`select granted,mode from pg_locks where locktype='advisory' and pid=pg_backend_pid()
      and classid::bigint=((hashtextextended('account_journal_v2:' || $1,0)>>32)&4294967295)
      and objid::bigint=(hashtextextended('account_journal_v2:' || $1,0)&4294967295) and objsubid=1`,[A])).rows;
    assert.ok(locks.some(row=>row.granted&&row.mode==='ExclusiveLock'));
    assert.equal((await readIndex()).revision,1);
  } finally { await db.exec('rollback'); }
  assert.equal(await readIndex(),null); assert.equal(await readPart(p.snapshot),null); assert.equal(await readReceipt(body.operationId),null);
  assert.equal((await db.query("select count(*)::int n from pg_locks where locktype='advisory' and pid=pg_backend_pid()")).rows[0].n,0);
});
test('existing alternate PLAN identity cannot update/delete after cutover; auth deletion still cascades owner-only',async()=>{
  const alternate=randomUUID(); await oldWrite({documentId:alternate}); await oldWrite();
  await mutate('planCommit',commit(index(),null,{legacy:{documentId:legacyId(),revision:1,fingerprint:hash('source')}}));
  await denied(()=>oldWrite({documentId:alternate,expectedRevision:1}),'42501');
  await admin('select 1');
  await denied(()=>db.query('delete from public.account_journal_documents where user_id=$1 and document_id=$2',[A,alternate]),'42501');
  await denied(()=>db.query("update public.account_journal_identity set document_kind='DRAFT' where user_id=$1 and document_id=$2",[A,alternate]),'42501');
  await login(B);
  const b=commit(index(),null,{ownerId:B}); await mutate('planCommit',b,B);
  // Roll back the disposable account deletion so later tests retain their fixture.
  await admin('begin');
  try {
    await db.query('delete from auth.users where id=$1',[A]);
    for (const table of ['account_plan_collection_indexes','account_plan_collection_parts','account_plan_collection_receipts']) {
      assert.equal((await db.query(`select count(*)::int n from public.${table} where user_id=$1`,[A])).rows[0].n,0);
    }
    assert.equal((await db.query('select count(*)::int n from public.account_plan_collection_indexes where user_id=$1',[B])).rows[0].n,1);
  } finally { await db.exec('rollback'); await login(); }
});
