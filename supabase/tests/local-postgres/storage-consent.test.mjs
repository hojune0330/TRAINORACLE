import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
const db=new PGlite({extensions:{pgcrypto}});
const migrations=new URL('../../migrations/',import.meta.url);
const A='a1111111-1111-4111-8111-111111111111', B='b2222222-2222-4222-8222-222222222222';
const D='d4444444-4444-4444-8444-444444444444';
const VERSION='2026-10-05';
const envelope={version:1,algorithm:'AES-GCM',keyId:'synthetic',iv:Buffer.alloc(12).toString('base64'),ciphertext:Buffer.alloc(16).toString('base64')};
const value=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value;
const owner=async(sql,args=[])=>{await db.exec('reset role');return db.query(sql,args);};
async function login(user=A) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({
    sub:user,role:'authenticated',session_id:user,exp:4102444800,amr:[{method:'otp',timestamp:1790000000}],
  })]);
  await db.exec('set role authenticated');
}
const consent=(revision,health=true,text=true,user=A,version=VERSION,session=A)=>value(
  'select public.set_account_storage_consent($1,$2,$3,$4,$5,$6) value',[user,session,revision,version,health,text]);
const status=()=>value('select public.get_account_storage_consent($1) value',[A]);
const allowed=()=>value('select public.account_network_access_allowed($1) value',[A]);
const insert=()=>owner('insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values($1,$2,1,$3)',[A,D,envelope]);
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,encrypted_password text,
      created_at timestamptz,updated_at timestamptz,email_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for(const file of readdirSync(migrations).filter(name=>/^\d{4}_.+\.sql$/.test(name)&&name<'0058').sort()) {
    let sql=readFileSync(new URL(file,migrations),'utf8');
    if(file.startsWith('0057_') && process.env.STORAGE_CONSENT_MUTATION) {
      const defects={
        'write-gate':['if public.account_storage_subject_allowed(owner_id) is distinct from true then','if false then'],
        'stale-grant':['if coalesce(actual_revision,0) <> expected_revision_input then','if false then'],
        'rights-owner':['auth.uid() is distinct from expected_user_id_input','false'],
      };
      const replacement=defects[process.env.STORAGE_CONSENT_MUTATION];
      assert.ok(replacement && sql.includes(replacement[0]),'mutation must change executed synthetic SQL');
      sql=sql.replace(...replacement);
    }
    await db.exec(sql);
  }
  await owner("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','AUTH_PASSWORDLESS','ACCOUNT_JOURNAL_V2')");
  for(const id of [A,B]) {
    await owner('insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())',[id]);
    await owner('insert into auth.sessions(id,user_id) values($1,$1)',[id]);
    await login(id);
    assert.equal(await value('select public.claim_beta_seat($1,$1,$2::date,$3,$3) value',[id,'1990-01-01',VERSION]),'ADMITTED_NEW');
  }
},{timeout:60000});
after(()=>db.close());
test('signup does not imply either purpose; operations facts cannot be approved by a client',async()=>{
  await login();
  assert.deepEqual(await status(),{userId:A,revision:0,purposeVersion:VERSION,healthStorage:false,journalTextStorage:false,decidedAt:null,operationsReady:false});
  assert.equal(await allowed(),false);
  await assert.rejects(consent(0),/STORAGE_OPERATIONS_REVIEW_REQUIRED/);
  await assert.rejects(db.query("insert into public.account_storage_operation_reviews values($1,'synthetic-proof',clock_timestamp(),true)",[VERSION]),/permission denied/);
  await owner("insert into public.account_storage_operation_reviews values($1,'synthetic-local-proof-only',clock_timestamp(),true)",[VERSION]);
});
test('cross-account, wrong session, old purpose version and client consent table writes are rejected',async()=>{
  await login();
  await assert.rejects(consent(0,true,true,B),/IDENTITY_REQUIRED/);
  await assert.rejects(consent(0,true,true,A,VERSION,B),/IDENTITY_REQUIRED/);
  await assert.rejects(consent(0,true,true,A,'2026-08-26'),/VERSION_REQUIRED/);
  await assert.rejects(db.query('select * from public.account_storage_consents'),/permission denied/);
  await assert.rejects(value('select public.get_account_storage_consent($1) value',[B]),/IDENTITY_REQUIRED/);
});
test('one optional purpose does not authorize a combined document; both purposes authorize it',async()=>{
  await login(); await consent(0,true,false);
  assert.equal(await allowed(),false);
  await assert.rejects(insert(),/STORAGE_CONSENT_REQUIRED/);
  await login(); await consent(1);
  assert.equal(await allowed(),true);
  await insert();
  await owner(`insert into public.account_journal_operations
    (user_id,operation_id,document_id,expected_revision,proposed_encrypted_payload,payload_fingerprint,result)
    values($1,$2,$2,0,$3,decode('aa','hex'),'{"kind":"conflict"}')`,[A,D,envelope]);
});
test('withdrawal stops old-token writes and stale grant retries without deleting stored records',async()=>{
  await login(); await consent(2,false,false);
  assert.equal(await allowed(),false);
  await assert.rejects(consent(2),/STORAGE_CONSENT_CHANGED/);
  await assert.rejects(owner('update public.account_journal_documents set revision=2 where user_id=$1',[A]),/STORAGE_CONSENT_REQUIRED/);
  await login();
  assert.equal((await db.query('select * from public.account_journal_documents')).rows.length,0);
  assert.equal((await owner('select count(*)::int count from public.account_journal_documents where user_id=$1',[A])).rows[0].count,1);
});
test('retention erasure still works after withdrawal, but cannot replace content',async()=>{
  await owner('update public.account_journal_operations set proposed_encrypted_payload=null where user_id=$1',[A]);
  await assert.rejects(owner('update public.account_journal_operations set proposed_encrypted_payload=$2 where user_id=$1',[A,envelope]),/STORAGE_CONSENT_REQUIRED/);
});
test('manual session-bound data-rights read survives withdrawal and closed operations without new consent',async()=>{
  await owner('update public.account_storage_operation_reviews set approved=false');
  await login();
  const page=await value("select public.read_account_data_rights_page($1,$1,'journal','') value",[A]);
  assert.equal(page.ownerId,A); assert.equal(page.items.length,1);
  assert.equal(page.items[0].record.document_id,D);
  await assert.rejects(value("select public.read_account_data_rights_page($1,$2,'journal','') value",[B,A]),/IDENTITY_REQUIRED/);
  await assert.rejects(value("select public.read_account_data_rights_page($1,$2,'journal','') value",[A,B]),/IDENTITY_REQUIRED/);
  await assert.rejects(value("select public.read_account_data_rights_page($1,$1,'auth.users','') value",[A]),/INVALID_DATA_RIGHTS_COLLECTION/);
  await assert.rejects(consent(3),/OPERATIONS_REVIEW_REQUIRED/);
});
test('revoked sessions cannot consent or export and deletion is reachable after withdrawal',async()=>{
  await owner('update auth.sessions set not_after=clock_timestamp()-interval \'1 second\' where id=$1',[A]);
  await login();
  await assert.rejects(consent(3,false,false),/IDENTITY_REQUIRED/);
  await assert.rejects(value("select public.read_account_data_rights_page($1,$1,'journal','') value",[A]),/IDENTITY_REQUIRED/);
  await owner('update auth.sessions set not_after=null where id=$1',[A]);
  await login();
  assert.ok(await value('select public.request_account_deletion($1) value',[A]));
  assert.equal(await allowed(),false);
});
test('closing operations blocks old direct data reads and public subjects while keeping explicit rights reads',async()=>{
  await owner('update public.account_storage_operation_reviews set approved=true');
  await owner("update public.service_feature_controls set enabled=true where feature_key='PUBLIC_PROFILE'");
  await login(B); await consent(0,true,true,B,VERSION,B);
  await owner('insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values($1,$2,1,$3)',[B,D,envelope]);
  await owner("insert into public.public_athlete_profiles(user_id,handle,display_name,is_public) values($1,'synthetic','Synthetic',true)",[B]);
  await login(B);
  assert.equal(await value('select public.account_network_access_allowed($1) value',[B]),true);
  assert.equal(await value('select public.account_subject_public_data_allowed($1) value',[B]),true);
  assert.equal((await db.query('select * from public.account_journal_documents')).rows.length,1);
  await owner('update public.account_storage_operation_reviews set approved=false');
  await login(B);
  assert.equal(await value('select public.account_network_access_allowed($1) value',[B]),false);
  assert.equal(await value('select public.account_subject_public_data_allowed($1) value',[B]),false);
  assert.equal((await db.query('select * from public.account_journal_documents')).rows.length,0);
  assert.equal((await value("select public.read_account_data_rights_page($1,$1,'journal','') value",[B])).items.length,1);
});
test('deletion serializes with writers and revokes consent; final owner gate rejects a post-deletion write',async()=>{
  await owner('update public.account_storage_operation_reviews set approved=true');
  await login(B);
  const requested=await value('select public.request_account_deletion($1) value',[B]);
  const receipt=await value('select public.get_account_storage_consent($1) value',[B]);
  assert.equal(receipt.healthStorage,false);assert.equal(receipt.journalTextStorage,false);assert.equal(receipt.revision,2);
  assert.deepEqual(await value('select public.request_account_deletion($1) value',[B]),requested);
  await assert.rejects(consent(1,true,true,B,VERSION,B),/ADMISSION_REQUIRED/);
  await assert.rejects(owner('update public.account_journal_documents set revision=2 where user_id=$1',[B]),/STORAGE_CONSENT_REQUIRED/);
  // Metadata-only storage check: real multi-connection scheduling is a separate native-PG release gate.
  const source=(await owner("select pg_get_functiondef('public.request_account_deletion(uuid)'::regprocedure) value")).rows[0].value;
  assert.ok(source.indexOf('pg_advisory_xact_lock')<source.indexOf('insert into public.account_deletion_requests'));
  assert.ok(source.includes("'account_journal_v2:' || actor::text"));
  await login(B);
  assert.equal((await value("select public.read_account_data_rights_page($1,$1,'journal','') value",[B])).items.length,1);
});
