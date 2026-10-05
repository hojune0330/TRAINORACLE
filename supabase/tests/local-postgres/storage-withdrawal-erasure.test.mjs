import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
const db=new PGlite({extensions:{pgcrypto}}), migrations=new URL('../../migrations/',import.meta.url);
const A='a1111111-1111-4111-8111-111111111111', B='b2222222-2222-4222-8222-222222222222';
const C='c3333333-3333-4333-8333-333333333333', D='d4444444-4444-4444-8444-444444444444';
const E='e5555555-5555-4555-8555-555555555555', F='f6666666-6666-4666-8666-666666666666';
const envelope={version:1,algorithm:'AES-GCM',keyId:'synthetic',iv:Buffer.alloc(12).toString('base64'),ciphertext:Buffer.alloc(16).toString('base64')};
const hash='sha256:'+'a'.repeat(64);
const value=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value;
const owner=async(sql,args=[])=>{await db.exec('reset role');return db.query(sql,args);};
const count=async(table,user=A,column='user_id')=>(await owner(`select count(*)::int n from public.${table} where ${column}=$1`,[user])).rows[0].n;
async function login(user=A,revision=1) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('request.headers',$3,false)",[user,JSON.stringify({
    sub:user,role:'authenticated',session_id:user,exp:4102444800,amr:[{method:'otp',timestamp:1790000000}],
  }),JSON.stringify({'x-trainoracle-storage-revision':String(revision)})]);
  await db.exec('set role authenticated');
}
const consent=(revision,health=true,text=true,user=A)=>value('select public.set_account_storage_consent($1,$1,$2,$3,$4,$5) value',[user,revision,'2026-10-05',health,text]);
const document=(user=A,id=D)=>owner('insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values($1,$2,1,$3)',[user,id,envelope]);
const scoped=['journal_entries','encrypted_private_notes','saved_training_plans','account_journal_documents','account_journal_operations','account_journal_history',
  'account_plan_collection_parts','account_plan_collection_indexes','account_plan_collection_receipts','account_plan_collection_staging',
  'external_activity_inbox','external_daily_observations','public_plan_share_cards','public_oracle_comparison_snapshots',
  'plan_proposals','plan_safety_snapshots','plan_versions','athlete_active_plans','plan_activation_receipts','account_journal_identity','account_journal_finalization_events'];
const ownerColumn=t=>['plan_proposals','plan_safety_snapshots','plan_versions','athlete_active_plans','plan_activation_receipts'].includes(t)?'athlete_id':'user_id';
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,encrypted_password text,created_at timestamptz,
      updated_at timestamptz,email_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for(const file of readdirSync(migrations).filter(n=>/^\d{4}_.+\.sql$/.test(n)&&n<'0058').sort()) await db.exec(readFileSync(new URL(file,migrations),'utf8'));
  await owner("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','AUTH_PASSWORDLESS','ACCOUNT_JOURNAL_V2','DEVICE_INTEGRATION')");
  await owner("insert into public.account_storage_operation_reviews values('2026-10-05','synthetic-only-proof',clock_timestamp(),true)");
  for(const id of [A,B,C]) {
    await owner('insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())',[id]);
    await owner('insert into auth.sessions(id,user_id) values($1,$1)',[id]);await login(id);
    assert.equal(await value('select public.claim_beta_seat($1,$1,$2::date,$3,$3) value',[id,'1990-01-01','2026-10-05']),'ADMITTED_NEW');
  }
  await login();await consent(0);await document();await login();await consent(1,false,false);
  assert.equal(await count('account_journal_documents'),1,'0057 regression fixture must actually retain the withdrawn payload');
  let sql=readFileSync(new URL('0058_storage_withdrawal_erasure.sql',migrations),'utf8');
  const mutations={
    'erase-body':["'account_journal_history','account_journal_documents',","'account_journal_history',"],
    'regrant-replay':['and c.revision::text=request_revision','and true'],
    'context-forgery':["x.backend_pid=pg_backend_pid() and x.transaction_id=txid_current()","true"],
    'workout-epoch':["or link.connection_epoch is distinct from (item->>'connectionEpoch')::uuid\n      or public.account_storage_subject_allowed", "or false\n      or public.account_storage_subject_allowed"],
  };
  if(process.env.STORAGE_ERASURE_MUTATION) {
    const defect=mutations[process.env.STORAGE_ERASURE_MUTATION];assert.ok(defect&&sql.includes(defect[0]));sql=sql.replace(...defect);
  }
  await owner('select 1');await db.exec(sql);
},{timeout:60000});
after(()=>db.close());
test('0058 fulfils a prior 0057 withdrawal instead of leaving its ciphertext indefinitely',async()=>{
  assert.equal(await count('account_journal_documents'),0);
  await login();const receipt=await value('select public.get_account_storage_consent($1) value',[A]);
  assert.ok(receipt.liveErasedAt);assert.equal(receipt.backupStatus,'PENDING');assert.equal(receipt.revision,2);
});
test('a failed purpose erase rolls back withdrawal, receipt and all earlier deletes',async()=>{
  await login();await consent(2);await login(A,3);await document();
  await owner(`create function public.synthetic_erase_failure() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC_ERASE_FAILURE';end$$`);
  await owner('create trigger synthetic_erase_failure before delete on public.account_journal_documents for each row execute function public.synthetic_erase_failure()');
  await login(A,3);await assert.rejects(consent(3,false,false),/SYNTHETIC_ERASE_FAILURE/);
  const receipt=await value('select public.get_account_storage_consent($1) value',[A]);assert.equal(receipt.revision,3);assert.equal(receipt.healthStorage,true);
  assert.equal(await count('account_journal_documents'),1);
  assert.equal((await owner('select count(*)::int n from public.account_storage_erasure_receipts where user_id=$1 and consent_revision=4',[A])).rows[0].n,0);
  await owner('drop trigger synthetic_erase_failure on public.account_journal_documents');
});
test('withdrawal erases all mixed purpose stores and preserves the other account and independent ledgers',async()=>{
  await login(B);await consent(0,true,true,B);await document(B);
  await login(A,3);
  // Seed legacy and currently closed-feature rows as an owner-only historical
  // fixture, without disabling triggers or claiming an end-user legacy write.
  await owner("select set_config('request.jwt.claim.sub','',false)");
  await owner("insert into public.journal_entries(user_id,entry_id,saved_at,entry) values($1,'synthetic','synthetic','{}')",[A]);
  await owner("insert into public.encrypted_private_notes values($1,'synthetic',$2,clock_timestamp())",[A,envelope]);
  await owner("insert into public.saved_training_plans(user_id,plan_id,plan_payload) values($1,'synthetic-plan-id-0001','{}')",[A]);
  await owner("insert into public.account_journal_history values($1,$2,1,$3,statement_timestamp(),statement_timestamp()+interval '720 hours','trash')",[A,D,envelope]);
  await owner(`insert into public.account_journal_operations(user_id,operation_id,document_id,expected_revision,proposed_encrypted_payload,payload_fingerprint,result)
    values($1,$2,$2,0,$3,decode('aa','hex'),'{"kind":"conflict"}')`,[A,D,envelope]);
  await owner("insert into public.account_plan_collection_parts values($1,'PLAN_SNAPSHOT',$2,$2,$2,$3,'{}')",[A,hash,envelope]);
  assert.equal(await count('account_plan_collection_staging'),1,'part staging trigger produces the scoped sidecar');
  await owner("insert into public.account_plan_collection_indexes values($1,1,$2,'{}',$3)",[A,hash,envelope]);
  await owner("insert into public.account_plan_collection_receipts values($1,$2,'synthetic','{}','{}')",[A,D]);
  await owner("insert into public.external_provider_connections(id,user_id,provider,provider_user_id,scopes,consent_version,connection_epoch) values($1,$2,'COROS','synthetic',array['DAILY_READ'],'synthetic',$3)",[E,A,F]);
  await owner("insert into public.external_activity_inbox(user_id,connection_id,connection_epoch,provider,provider_record_id,activity_start,sport_code,payload_digest) values($1,$2,$4,'COROS','synthetic',clock_timestamp(),'RUN',$3)",[A,E,'a'.repeat(64),F]);
  await owner("insert into public.external_daily_observations(user_id,connection_id,connection_epoch,provider_day,content_digest,encrypted_payload) values($1,$2,$3,'2026-10-05',$4,$5)",[A,E,F,'a'.repeat(64),envelope]);
  await owner("insert into public.public_plan_share_cards(user_id,plan_id,share_slug,card_payload) values($1,'synthetic','synthetic000000','{}')",[A]);
  await owner('insert into public.public_oracle_comparison_snapshots(user_id,snapshot_payload) values($1,$2)',[A,{schemaVersion:1,sharedFields:['RECENT_DISTANCE'],record:null,recent8WeekDistanceKm:1,structuredSessionCount:null,energySessionCounts:[]}]);
  await owner("insert into public.plan_safety_snapshots(id,athlete_id,state,valid_until,pipeline_ref) values($1,$2,'CURRENT',clock_timestamp()+interval '1 day','synthetic')",[D,A]);
  await owner("insert into public.plan_proposals(id,athlete_id,proposed_by,active_plan_id,proposed_plan_id,proposal_payload,status,safety_snapshot_id) values($1,$2,$2,'synthetic','synthetic','{}','DRAFT',$1)",[D,A]);
  await owner("insert into public.plan_versions(id,athlete_id,revision,source_proposal_id,plan_payload,activated_by) values($1,$2,1,$1,'{}',$2)",[D,A]);
  await owner('insert into public.athlete_active_plans values($1,$2,1,clock_timestamp())',[A,D]);
  await owner('insert into public.plan_activation_receipts(id,athlete_id,proposal_id,plan_version_id,active_revision,activated_by,warning_review_reason) values($1,$2,$1,$1,1,$2,$3)',[D,A,'synthetic warning review']);
  await owner("insert into public.account_journal_identity values($1,$2,'JOURNAL','synthetic','2026-10-05',false,true)",[A,D]);
  await owner("insert into public.account_journal_finalization_events(user_id,document_id,journal_date,eligible) values($1,$2,'2026-10-05',false)",[A,D]);
  await owner("insert into public.account_decoration_purchases values($1,'synthetic',1)",[A]);
  await owner("insert into public.account_reward_days values($1,'2026-10-05','VISIT')",[A]);
  for(const table of scoped) assert.equal(await count(table,A,ownerColumn(table)),1,`${table} has a positive fixture`);
  await login(A,3);const receipt=await consent(3,false,true);assert.ok(receipt.liveErasedAt);assert.equal(receipt.backupStatus,'PENDING');
  for(const table of scoped) assert.equal(await count(table,A,ownerColumn(table)),0,`${table} purpose erasure`);
  assert.equal(await count('account_journal_documents',B),1);
  for(const table of ['user_private_profiles','account_decoration_purchases','account_reward_days']) assert.equal(await count(table),1);
  assert.equal((await owner('select count(*)::int n from auth.users where id=$1',[A])).rows[0].n,1);
  assert.equal((await owner('select count(*)::int n from public.account_storage_erasure_context')).rows[0].n,0);
});
test('withdrawn manual data rights return an empty result without requiring new consent',async()=>{
  await owner('update public.account_storage_operation_reviews set approved=false');await login(A,4);
  const page=await value("select public.read_account_data_rights_page($1,$1,'journal','') value",[A]);assert.deepEqual(page.items,[]);
  await assert.rejects(value("select public.read_account_data_rights_page($1,$2,'journal','') value",[B,A]),/IDENTITY_REQUIRED/);
  await owner('update public.account_storage_operation_reviews set approved=true');
});
test('a never-stored old revision cannot create a fresh document after regrant; new consent revision can',async()=>{
  await login(A,4);await consent(4);await login(A,3);
  await assert.rejects(document(A,C),/STORAGE_CONSENT_REVISION_CHANGED/);
  await owner("select set_config('request.headers','{}',false)");await assert.rejects(document(A,C),/STORAGE_CONSENT_REVISION_CHANGED/);
  await login(A,5);await document(A,C);assert.equal(await count('account_journal_documents'),1);
});
test('provider revocation invalidates delayed deliveries even after regrant and relinking',async()=>{
  const item={ownerId:A,connectionId:E,connectionEpoch:F,providerDay:'2026-10-05',contentDigest:'b'.repeat(64),payload:envelope};
  assert.equal((await owner('select connection_status from public.external_provider_connections where id=$1',[E])).rows[0].connection_status,'REVOKED');
  await owner("update public.external_provider_connections set connection_status='ACTIVE',revoked_at=null where id=$1",[E]);
  await assert.rejects(owner('select public.ingest_coros_daily_envelopes($1)',[[item]]),/DAILY_CONNECTION_UNAVAILABLE/);
  const epoch=(await owner('select connection_epoch from public.external_provider_connections where id=$1',[E])).rows[0].connection_epoch;
  assert.equal((await owner('select public.ingest_coros_daily_envelopes($1) value',[[{...item,connectionEpoch:epoch}]])).rows[0].value.inserted,1);
});
test('private erasure context cannot be forged by GUCs or API roles and immutable updates stay blocked',async()=>{
  await login(B);
  for(const table of ['account_storage_erasure_context','account_storage_erasure_receipts']) await assert.rejects(db.query(`select * from public.${table}`),/permission denied/);
  await assert.rejects(value('select public.erase_withdrawn_account_storage($1,1) value',[A]),/permission denied/);
  await assert.rejects(value('select public.account_storage_erasure_authorized($1) value',[A]),/permission denied/);
  await owner("select set_config('request.jwt.claim.sub','',false)");
  await owner("insert into public.plan_proposals(id,athlete_id,proposed_by,active_plan_id,proposed_plan_id,proposal_payload,status) values($1,$2,$2,'synthetic','synthetic','{}','DRAFT')",[D,B]);
  await owner("insert into public.plan_versions(id,athlete_id,revision,source_proposal_id,plan_payload,activated_by) values($1,$2,1,$1,'{}',$2)",[D,B]);
  await owner("select set_config('trainoracle.retention_cleanup','AUTHORIZED',false),set_config('trainoracle.storage_erasure','AUTHORIZED',false)");
  await assert.rejects(owner('delete from public.plan_versions where athlete_id=$1',[B]),/IMMUTABLE_PLAN_VERSION/);
  await assert.rejects(owner("update public.plan_versions set plan_payload='{}' where athlete_id=$1",[B]),/IMMUTABLE_PLAN_VERSION/);
  // A fabricated context from a different backend/transaction is not authorization.
  await login(C);await consent(0,false,false,C);
  await owner('update public.account_storage_erasure_receipts set live_erased_at=null where user_id=$1',[C]);
  await owner('insert into public.account_storage_erasure_context values(-1,-1,$1,1)',[C]);
  assert.equal((await owner('select public.account_storage_erasure_authorized($1) value',[C])).rows[0].value,false);
  await owner('delete from public.account_storage_erasure_context');
  await owner('update public.account_storage_erasure_receipts set live_erased_at=clock_timestamp() where user_id=$1',[C]);
  await owner("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
  await owner('delete from public.plan_versions where athlete_id=$1',[B]);
  assert.equal(await count('plan_versions',B,'athlete_id'),0,'existing service-only retention DELETE remains available');
});
test('a workout job pinned before withdrawal cannot relink; a fresh generation succeeds and stays idempotent',async()=>{
  const item={ownerId:A,connectionId:E,connectionEpoch:F,providerUserId:'synthetic',providerRecordId:'synthetic-new',
    activityStart:'2026-10-05T01:00:00Z',sportCode:'RUN',payloadDigest:'b'.repeat(64)};
  const ingest=async i=>(await owner('select public.ingest_coros_activity_batch($1) value',[[i]])).rows[0].value;
  assert.deepEqual(await ingest(item),{accepted:0,duplicates:0,rejected:1});
  const epoch=(await owner('select connection_epoch from public.external_provider_connections where id=$1',[E])).rows[0].connection_epoch;
  await assert.rejects(owner("insert into public.external_activity_inbox(user_id,connection_id,connection_epoch,provider,provider_record_id,activity_start,sport_code,payload_digest) values($1,$2,$3,'COROS','direct-old',clock_timestamp(),'RUN',$4)",[A,E,F,'a'.repeat(64)]),/STORAGE_PROVIDER_CONNECTION_CHANGED/);
  assert.deepEqual(await ingest({...item,connectionEpoch:epoch,ownerId:B}),{accepted:0,duplicates:0,rejected:1});
  assert.deepEqual(await ingest({...item,connectionEpoch:epoch}),{accepted:1,duplicates:0,rejected:0});
  assert.deepEqual(await ingest({...item,connectionEpoch:epoch}),{accepted:0,duplicates:1,rejected:0});
});
test('account deletion atomically erases purpose data, has no 30-day hold and is idempotent',async()=>{
  await login(A,5);const first=await value('select public.request_account_deletion($1) value',[A]);
  assert.equal(await count('account_journal_documents'),0);assert.equal(await count('external_daily_observations'),0);
  await login(A,6);const receipt=await value('select public.get_account_storage_consent($1) value',[A]);assert.equal(receipt.revision,6);assert.ok(receipt.liveErasedAt);
  assert.deepEqual(await value('select public.request_account_deletion($1) value',[A]),first);
  assert.equal((await value('select public.get_account_storage_consent($1) value',[A])).revision,6);
  const request=(await owner('select * from public.account_deletion_requests where user_id=$1',[A])).rows[0];assert.deepEqual(request.delete_by,request.requested_at);
  await login(A,6);await assert.rejects(consent(6),/ADMISSION_REQUIRED/);
  await assert.rejects(db.query('update public.user_private_profiles set deletion_requested_at=null,delete_by=null where user_id=$1',[A]),/permission denied/);
  await assert.rejects(db.query("update public.user_private_profiles set delete_by=clock_timestamp()+interval '1 year' where user_id=$1",[A]),/permission denied/);
  await login(C);assert.ok(await value('select public.request_account_deletion($1) value',[C]));
  assert.ok((await value('select public.get_account_storage_consent($1) value',[C])).liveErasedAt,'no prior consent is not a deletion exception');
});
