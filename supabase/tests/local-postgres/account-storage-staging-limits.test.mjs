import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Disposable local SQL rehearsal. No URL, credentials, real users, or network.
const db = new PGlite({ extensions: { pgcrypto } });
const migrations = new URL('../../migrations/', import.meta.url);
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
const LEGACY = 'c3333333-3333-4333-8333-333333333333';
const D = 'd4444444-4444-4444-8444-444444444444';
const signingKey = Buffer.alloc(32, 71);
const envelope = { version: 1, algorithm: 'AES-GCM', keyId: 'fixture',
  iv: Buffer.alloc(12).toString('base64'), ciphertext: Buffer.alloc(16).toString('base64') };
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const hash = (value, scope='trainoracle.account-plan.v1') =>
  `sha256:${createHash('sha256').update(`${scope}\0${canonical(value)}`).digest('hex')}`;
const partHash = value => hash(value, 'trainoracle.account-plan-collection.v1');
const queryValue = async (sql,args=[]) => (await db.query(sql,args)).rows[0]?.value;
const admin = async (sql,args=[]) => { await db.exec('reset role'); return db.query(sql,args); };
async function login(owner=A) {
  await db.exec('reset role; set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [owner, JSON.stringify({sub:owner,role:'authenticated'})]);
}
function signed(action, body, owner=A) {
  const request_text = JSON.stringify({domain:'trainoracle.account-journal.gateway.v1',
    ownerId:owner, action, expiresAt:Math.floor(Date.now()/1000)+90, ...body});
  return [request_text, createHmac('sha256',signingKey).update(request_text).digest('hex'), 'fixture'];
}
const mutate = (action, body, owner=A) =>
  queryValue('select public.mutate_account_plan_collection_attested($1,$2,$3) value',signed(action,body,owner));
function parts(seed) {
  const planId=hash({plan:seed});
  const snapshotId=partHash({kind:'PLAN_SNAPSHOT',planId});
  const progressId=partHash({progress:seed});
  const snapshot={partId:snapshotId,partKind:'PLAN_SNAPSHOT',planId,
    contentHash:partHash({body:seed}),payload:envelope,
    metadata:{snapshotId:null,updatedAt:null,archivedAt:null}};
  const progress={partId:progressId,partKind:'PLAN_PROGRESS',planId,
    contentHash:partHash({body:`progress-${seed}`}),payload:envelope,
    metadata:{snapshotId,updatedAt:'2026-01-01T00:00:00.000Z',archivedAt:null}};
  return {snapshot,progress,ref:{planId,snapshotId,snapshotHash:snapshot.contentHash,
    progressId,progressHash:progress.contentHash}};
}
function commitRequest(part) {
  const index={version:1,kind:'PLAN_COLLECTION',documentFingerprint:hash({synthetic:'index'}),
    currentPlanId:part.ref.planId,plans:[part.ref]};
  const operationId=randomUUID();
  const requestDoc={ownerId:A,operationId,expectedRevision:0,
    previousIndexFingerprint:null,previousCurrentPlanId:null,index,legacy:null};
  return {operationId,expectedRevision:0,previousIndexFingerprint:null,
    previousCurrentPlanId:null,index,indexFingerprint:hash(index),
    requestFingerprint:hash(requestDoc),payload:envelope,legacy:null};
}
async function insertConflict(owner=A, payload=envelope, kind='conflict') {
  return admin(`insert into public.account_journal_operations
    (user_id,operation_id,document_id,expected_revision,proposed_encrypted_payload,result)
    values($1,$2,$3,0,$4::jsonb,$5::jsonb)`,
    [owner,randomUUID(),D,JSON.stringify(payload),JSON.stringify({kind})]);
}
async function insertPart(owner, number, payload=envelope) {
  const id=`sha256:${number.toString(16).padStart(64,'0')}`;
  await admin(`insert into public.account_plan_collection_parts
    (user_id,part_kind,part_id,plan_id,content_hash,payload,metadata)
    values($1,'PLAN_SNAPSHOT',$2,$2,$2,$3::jsonb,$4::jsonb)`,
    [owner,id,JSON.stringify(payload),JSON.stringify({snapshotId:null,updatedAt:null,archivedAt:null})]);
  return id;
}

before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,
      updated_at timestamptz,email_confirmed_at timestamptz,deleted_at timestamptz,
      is_anonymous boolean,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),
      not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for (const file of readdirSync(migrations).filter(name=>/^\d+_.+\.sql$/.test(name)&&name<'0048').sort()) {
    if (file.startsWith('0047_')) {
      // An already-recorded arbitrary version survives the additive 0047 migration.
      await db.query("insert into auth.users(id,created_at) values($1,'2020-01-01')",[LEGACY]);
      await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
        values($1,'1990-01-01','x','x',clock_timestamp())`,[LEGACY]);
      await db.query('insert into public.beta_enrollments(user_id) values($1)',[LEGACY]);
    }
    let sql=readFileSync(new URL(file,migrations),'utf8');
    if (file.startsWith('0046_') && process.env.STORAGE_LIMIT_MUTATION) {
      const defects={
        'conflict-count':['existing_count >= 100','false'],
        'staging-reap':['perform public.reap_expired_account_plan_staging(new.user_id);','perform 1;'],
      };
      const change=defects[process.env.STORAGE_LIMIT_MUTATION];
      assert.ok(change && sql.includes(change[0]),'defect probe must alter the applied migration');
      sql=sql.replace(...change);
    }
    await db.exec(sql);
  }
  for (const owner of [A,B]) {
    await db.query("insert into auth.users(id,created_at) values($1,'2020-01-01')",[owner]);
    await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
      values($1,'1990-01-01','2026-08-26','2026-08-26',clock_timestamp())`,[owner]);
    await db.query('insert into public.beta_enrollments(user_id) values($1)',[owner]);
  }
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC')");
  await db.query('insert into public.account_journal_gateway_keys(key_id,secret) values($1,$2)',['fixture',signingKey]);
},{timeout:120000});
beforeEach(async()=>{
  await db.exec(`reset role;
    delete from public.account_plan_collection_receipts;
    delete from public.account_plan_collection_indexes;
    delete from public.account_plan_collection_parts;
    delete from public.account_journal_operations;`);
  await login();
});
after(()=>db.close());

test('0047 accepts current legal versions, rejects new x, and blocks an old x profile',async()=>{
  assert.equal(await queryValue('select public.account_network_access_allowed($1) value',[A]),true);
  await assert.rejects(admin(`update public.user_private_profiles
    set privacy_policy_version='x',terms_of_service_version='x' where user_id=$1`,[A]),
  error=>error.code==='22023');
  await login(LEGACY);
  assert.equal(await queryValue('select public.account_network_access_allowed($1) value',[LEGACY]),false);
});

test('accepted conflict ciphertext and receipts remain; a 101st conflict is rejected per owner',async()=>{
  for (let n=0;n<100;n++) await insertConflict();
  assert.equal((await admin("select count(*)::int value from public.account_journal_operations where user_id=$1 and result->>'kind'='conflict'",[A])).rows[0].value,100);
  await assert.rejects(insertConflict(), error=>error.code==='PZ001');
  await insertConflict(B);
  await insertConflict(A,envelope,'saved');
  assert.equal((await admin('select count(*)::int value from public.account_journal_operations where user_id=$1',[A])).rows[0].value,101);
});

test('conflict byte ceiling rejects before the 100-operation count ceiling',async()=>{
  const large={...envelope,ciphertext:Buffer.alloc(1048576).toString('base64')};
  let accepted=0;
  for (;accepted<100;accepted++) {
    try { await insertConflict(A,large); }
    catch (error) { assert.equal(error.code,'PZ001'); break; }
  }
  assert.ok(accepted>0 && accepted<100);
  const size=(await admin(`select coalesce(sum(octet_length(proposed_encrypted_payload::text)),0)::bigint value
    from public.account_journal_operations where user_id=$1`,[A])).rows[0].value;
  assert.ok(Number(size)<=52428800 && Number(size)+Buffer.byteLength(JSON.stringify(large))>52428800);
  assert.equal((await admin('select count(*)::int value from public.account_journal_operations where user_id=$1',[A])).rows[0].value,accepted);
},{timeout:120000});

test('new staging is bounded by count per owner and a new upload reclaims expired quota',async()=>{
  for (let n=1;n<=256;n++) await insertPart(A,n);
  await assert.rejects(insertPart(A,257),error=>error.code==='PZ002');
  await insertPart(B,257);
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_staging where user_id=$1',[A])).rows[0].value,256);
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_parts where user_id=$1',[A])).rows[0].value,256);
  await admin(`update public.account_plan_collection_staging
    set staged_at=now()-interval '8 days',expires_at=now()-interval '1 day'
    where user_id=$1`,[A]);
  await insertPart(A,258);
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_staging where user_id=$1',[A])).rows[0].value,1);
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_parts where user_id=$1',[A])).rows[0].value,1);
});

test('staging byte ceiling rejects new data below the count ceiling',async()=>{
  for (let n=1;n<=128;n++) await insertPart(A,n);
  const measured=(await admin(`select s.staged_bytes value from public.account_plan_collection_staging s
    where s.user_id=$1 and s.part_id=$2`,[A,`sha256:${'1'.padStart(64,'0')}`])).rows[0].value;
  assert.ok(measured>0 && measured<1048576);
  // Synthetic full-size ciphertext accounting; the trigger computes this field for real inserts.
  await admin('update public.account_plan_collection_staging set staged_bytes=1048576 where user_id=$1',[A]);
  await assert.rejects(insertPart(A,129),error=>error.code==='PZ002');
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_staging where user_id=$1',[A])).rows[0].value,128);
});

test('expired uncommitted parts cannot commit, can restage with same ID, and become durable on commit',async()=>{
  const part=parts('retry');
  assert.equal((await mutate('planStage',part.snapshot)).kind,'staged');
  assert.equal((await mutate('planStage',part.progress)).kind,'staged');
  await admin(`update public.account_plan_collection_staging
    set staged_at=now()-interval '8 days',
      expires_at=now()-interval '1 day'
    where user_id=$1 and part_kind='PLAN_PROGRESS' and part_id=$2`,[A,part.progress.partId]);
  await login();
  assert.equal(await queryValue('select public.read_account_plan_collection_part($1,$2) value',
    ['PLAN_PROGRESS',part.progress.partId]),null);
  await assert.rejects(mutate('planCommit',commitRequest(part)),error=>error.code==='PZ003');
  await assert.rejects(mutate('planStage',{...part.progress,contentHash:partHash({changed:true})}),
    error=>error.code==='22023');
  assert.equal((await mutate('planStage',part.progress)).kind,'staged');
  const result=await mutate('planCommit',commitRequest(part));
  assert.equal(result.kind,'committed');
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_staging where user_id=$1',[A])).rows[0].value,0);
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_parts where user_id=$1',[A])).rows[0].value,2);
  const sweep=await queryValue('select public.run_account_plan_staging_retention_batch() value');
  assert.equal(sweep.stagedPartsPurged,0);
  await login();
  assert.ok(await queryValue('select public.read_account_plan_collection_part($1,$2) value',
    ['PLAN_PROGRESS',part.progress.partId]));
});

test('automatic expiry cleanup preserves an indexed part and its commit receipt',async()=>{
  const part=parts('durable');
  await mutate('planStage',part.snapshot);
  await mutate('planStage',part.progress);
  const request=commitRequest(part);
  assert.equal((await mutate('planCommit',request)).kind,'committed');
  await admin(`insert into public.account_plan_collection_staging
    (user_id,part_kind,part_id,staged_at,expires_at,staged_bytes)
    values($1,'PLAN_SNAPSHOT',$2,now()-interval '8 days',now()-interval '1 day',100)`,
    [A,part.snapshot.partId]);
  await mutate('planStage',parts('next').snapshot);
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_staging where user_id=$1 and part_id=$2',[A,part.snapshot.partId])).rows[0].value,0);
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_parts where user_id=$1 and part_id=$2',[A,part.snapshot.partId])).rows[0].value,1);
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_receipts where user_id=$1 and operation_id=$2',[A,request.operationId])).rows[0].value,1);
});

test('operator-only cleanup deletes only expired new staging and preserves earlier untracked parts',async()=>{
  const oldId=`sha256:${'e'.repeat(64)}`;
  await insertPart(A,900);
  await admin('delete from public.account_plan_collection_staging where user_id=$1',[A]);
  await admin(`insert into public.account_plan_collection_parts
    (user_id,part_kind,part_id,plan_id,content_hash,payload,metadata)
    values($1,'PLAN_SNAPSHOT',$2,$2,$2,$3::jsonb,$4::jsonb)`,
    [A,oldId,JSON.stringify(envelope),JSON.stringify({snapshotId:null,updatedAt:null,archivedAt:null})]);
  await admin('delete from public.account_plan_collection_staging where user_id=$1 and part_id=$2',[A,oldId]);
  const expiredId=await insertPart(A,901);
  await admin(`update public.account_plan_collection_staging
    set staged_at=now()-interval '8 days',expires_at=now()-interval '1 day'
    where user_id=$1 and part_id=$2`,[A,expiredId]);
  await login();
  await assert.rejects(queryValue('select public.run_account_plan_staging_retention_batch() value'),e=>e.code==='42501');
  const sweep=(await admin('select public.run_account_plan_staging_retention_batch() value')).rows[0].value;
  assert.equal(sweep.stagedPartsPurged,1);
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_parts where user_id=$1',[A])).rows[0].value,2);
  assert.equal((await admin('select count(*)::int value from public.account_plan_collection_parts where user_id=$1 and part_id=$2',[A,expiredId])).rows[0].value,0);
});
