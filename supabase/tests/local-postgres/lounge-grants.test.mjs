import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Actual 0001-0042 SQL, synthetic Supabase-managed identity only. No network,
// real JWT, personal data or application-policy helper substitutions.
const db=new PGlite({extensions:{pgcrypto}});
const migrations=new URL('../../migrations/',import.meta.url);
const A='a1111111-1111-4111-8111-111111111111',B='b2222222-2222-4222-8222-222222222222';
const SA='a3333333-3333-4333-8333-333333333333',SB='b4444444-4444-4444-8444-444444444444',SA2='a5555555-5555-4555-8555-555555555555';
const approved=subject=>({version:1,subject,eligible:true,code:null});
const denied=code=>({version:1,subject:null,eligible:false,code});
const owner=async(sql,params=[])=>{await db.exec('reset role');return db.query(sql,params);};
const ownerExec=async sql=>{await db.exec('reset role');return db.exec(sql);};
async function claims(patch={},role='authenticated'){
  await db.exec(`reset role; set role ${role}`);
  const value={sub:A,role,session_id:SA,exp:Math.floor(Date.now()/1000)+3600,...patch};
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[value.sub || '',JSON.stringify(value)]);
}
async function issue(patch={}){
  await claims(patch);
  const value=(await db.query('select public.issue_lounge_grant() v')).rows[0].v;
  assert.equal(JSON.stringify(Object.keys(value).sort()),JSON.stringify(['expiresAt','grant','version']));
  assert.equal(value.version,1);assert.equal(typeof value.grant,'string');assert.equal(/^lg1_[0-9a-f]{64}$/.test(value.grant),true);
  assert.equal(typeof value.expiresAt,'string');assert.equal(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value.expiresAt),true);
  return value;
}
async function inspect(token,role='anon'){
  await claims({},role);
  const value=(await db.query('select public.inspect_lounge_grant($1) v',[token])).rows[0].v;
  assert.deepEqual(Object.keys(value).sort(),['code','eligible','subject','version']);return value;
}
const count=async()=>Number((await owner('select count(*) n from public.lounge_session_grants')).rows[0].n);
const enable=async(value=true)=>owner("update public.lounge_admission_controls set enabled=$1,privacy_policy_version='synthetic-v1',terms_of_service_version='synthetic-v1'",[value]);
const sample=i=>'lg1_'+i.toString(16).padStart(64,'0');
async function seedGrant(token,{user=A,sid=SA,expired=false}={}){
  await owner(`insert into public.lounge_session_grants(token_hash,user_id,session_id,created_at,expires_at)
    values(extensions.digest($1,'sha256'),$2,$3,clock_timestamp()-interval '2 hours',clock_timestamp()+${expired?"interval '-1 hour'":"interval '1 hour'"})`,[token,user,sid]);
}
let predicateSql,oldCleanupShape;
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz,
      email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  const files=readdirSync(migrations).filter(n=>/^\d{4}_.+\.sql$/.test(n) && Number(n.slice(0,4))<=42).sort();
  assert.equal(files.length,42);
  for(const [i,file] of files.entries()){
    assert.equal(Number(file.slice(0,4)),i+1);const sql=readFileSync(new URL(file,migrations),'utf8');
    if(i===41){
      oldCleanupShape=(await db.query("select pg_get_function_result('public.purge_expired_beta_data()'::regprocedure) shape")).rows[0].shape;
      const start=sql.indexOf('create function public.lounge_session_admission('),end=sql.indexOf('$$;',start);
      assert.ok(start>=0 && end>start);predicateSql=sql.slice(start,end+3).replace('create function','create or replace function');
    }
    await db.exec(sql);
  }
  await owner('insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp()),($2,clock_timestamp())',[A,B]);
  await owner('insert into auth.sessions(id,user_id) values($1,$2),($3,$4),($5,$2)',[SA,A,SB,B,SA2]);
  await owner("insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at) values($1,'1990-01-01','synthetic-v1','synthetic-v1',clock_timestamp()),($2,'1990-01-01','synthetic-v1','synthetic-v1',clock_timestamp())",[A,B]);
  await owner('insert into public.beta_enrollments(user_id) values($1),($2)',[A,B]);
},{timeout:60000});
beforeEach(async()=>{
  await ownerExec('delete from public.lounge_session_grants;delete from public.account_deletion_requests;');
  await ownerExec(`update public.service_feature_controls set enabled=true where feature_key='ACCOUNT';update auth.users set email_confirmed_at=clock_timestamp(),deleted_at=null,banned_until=null,is_anonymous=false;
    update public.user_private_profiles set privacy_policy_version='synthetic-v1',terms_of_service_version='synthetic-v1',legal_consented_at=clock_timestamp(),deletion_requested_at=null,delete_by=null;
    insert into public.beta_enrollments(user_id) values('${A}'),('${B}') on conflict do nothing;`);
  await owner('insert into auth.sessions(id,user_id,not_after) values($1,$2,null),($3,$4,null),($5,$2,null) on conflict(id) do update set not_after=null',[SA,A,SB,B,SA2]);
  await enable();
});
after(()=>db.close());

test('opaque grant is minimal, persisted only as SHA256 and reusable as a session credential, not a single-use ticket',async()=>{
  const value=await issue();
  assert.deepEqual(await inspect(value.grant),approved(A));assert.deepEqual(await inspect(value.grant),approved(A));
  assert.equal(await count(),1);
  const columns=(await owner("select column_name from information_schema.columns where table_schema='public' and table_name='lounge_session_grants' order by ordinal_position")).rows.map(r=>r.column_name);
  assert.deepEqual(columns,['token_hash','user_id','session_id','created_at','expires_at']);
  const row=(await owner("select octet_length(token_hash)=32 and token_hash=extensions.digest($1,'sha256') valid from public.lounge_session_grants",[value.grant])).rows[0];
  assert.equal(row.valid,true);
});
test('raw Supabase-style JWT, wrong grants and metadata cannot become lounge authority',async()=>{
  const raw='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:A,email:'synthetic@example.invalid',app_metadata:{lounge_eligible:true}})).toString('base64url')+'.syntheticSignature';
  for(const token of [raw,null,'',sample(99),sample(1).toUpperCase(),sample(1)+'\n','lg1_'+ 'a'.repeat(63)])assert.deepEqual(await inspect(token),denied('LOGIN_REQUIRED'));
  await assert.rejects(issue({session_id:SB}),e=>e.code==='42501');assert.equal(await count(),0);
  await assert.rejects(issue({exp:0}),e=>e.code==='42501');
  assert.deepEqual(await inspect((await issue()).grant),approved(A));
});
test('expiry is capped by the issuing JWT and 8h and checked on every inspection',async()=>{
  const expiry=Math.floor(Date.now()/1000)+120;
  const short=await issue({exp:expiry});assert.equal(Date.parse(short.expiresAt)/1000,expiry);
  const before=Date.now(),long=await issue({session_id:SA2,exp:Math.floor(Date.now()/1000)+86400});
  assert.ok(Date.parse(long.expiresAt)<=Date.now()+8*3600000 && Date.parse(long.expiresAt)>=before+8*3600000);
  await owner("update public.lounge_session_grants set created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' where token_hash=extensions.digest($1,'sha256')",[short.grant]);
  assert.deepEqual(await inspect(short.grant),denied('LOGIN_REQUIRED'));assert.deepEqual(await inspect(long.grant),approved(A));
});
test('dynamic gate, current legal policy and surviving session status can revoke an already-issued grant',async()=>{
  const value=await issue();await enable(false);assert.deepEqual(await inspect(value.grant),denied('LOUNGE_DISABLED'));await enable();
  await owner("update public.service_feature_controls set enabled=false where feature_key='ACCOUNT'");assert.deepEqual(await inspect(value.grant),denied('LOUNGE_DISABLED'));
  await ownerExec("update public.service_feature_controls set enabled=true where feature_key='ACCOUNT';update public.lounge_admission_controls set privacy_policy_version='synthetic-v2'");assert.deepEqual(await inspect(value.grant),denied('PARTICIPATION_RESTRICTED'));await enable();
  await owner('update auth.users set banned_until=clock_timestamp()+interval \'1 hour\' where id=$1',[A]);assert.deepEqual(await inspect(value.grant),denied('LOGIN_REQUIRED'));
  await owner('update auth.users set banned_until=null where id=$1',[A]);
  await owner('update auth.sessions set not_after=clock_timestamp()-interval \'1 second\' where id=$1',[SA]);assert.deepEqual(await inspect(value.grant),denied('LOGIN_REQUIRED'));
});
test('logout session cascade removes only that session grants and preserves another device and user',async()=>{
  const one=await issue(),other=await issue({session_id:SA2}),b=await issue({sub:B,session_id:SB});
  await owner('delete from auth.sessions where id=$1',[SA]);assert.equal(await count(),2);
  assert.deepEqual(await inspect(one.grant),denied('LOGIN_REQUIRED'));assert.deepEqual(await inspect(other.grant),approved(A));assert.deepEqual(await inspect(b.grant),approved(B));
});
test('real account deletion revokes a grant immediately without silently restoring another marker',async()=>{
  const value=await issue();await claims();await db.query('select public.request_account_deletion()');
  assert.deepEqual(await inspect(value.grant),denied('PARTICIPATION_RESTRICTED'));
  await owner('delete from public.account_deletion_requests where user_id=$1',[A]);assert.deepEqual(await inspect(value.grant),denied('PARTICIPATION_RESTRICTED'));
});
test('one-second rate and sixteen active grants are enforced per session, not globally',async()=>{
  await issue();await assert.rejects(issue(),e=>e.code==='P0001');assert.equal(await count(),1);
  await issue({session_id:SA2});await issue({sub:B,session_id:SB});assert.equal(await count(),3);
  await owner('delete from public.lounge_session_grants');
  for(let i=1;i<=16;i++)await seedGrant(sample(i));
  await assert.rejects(issue(),e=>e.code==='P0001');assert.equal(await count(),16);
  await owner('delete from public.lounge_session_grants where token_hash=extensions.digest($1,\'sha256\')',[sample(16)]);
  await issue();assert.equal(await count(),16);
});
test('anon can only inspect; no role gets private grant/session tables or the arbitrary-target predicate',async()=>{
  const grant=await issue();
  for(const role of ['anon','authenticated','service_role']){
    for(const [fn,allowed] of [['public.issue_lounge_grant()',role==='authenticated'],['public.inspect_lounge_grant(text)',role!=='service_role'],['public.lounge_session_admission(uuid,uuid,timestamptz)',false],['public.purge_expired_beta_data_before_lounge()',false],['public.purge_expired_beta_data()',role==='service_role']])
      assert.equal((await owner('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,fn])).rows[0].allowed,allowed);
    await claims({},role);
    for(const sql of ['select * from public.lounge_session_grants','select * from auth.sessions','select public.lounge_session_admission(null,null,null)'])await assert.rejects(db.query(sql),e=>e.code==='42501');
    if(role!=='authenticated')await assert.rejects(db.query('select public.issue_lounge_grant()'),e=>e.code==='42501');
  }
  assert.deepEqual(await inspect(grant.grant),approved(A));
  await claims({},'anon');
  for(const sql of ['select public.get_lounge_admission()','select * from public.user_private_profiles','select * from auth.users'])await assert.rejects(db.query(sql),e=>e.code==='42501');
});
test('OFF-state retention preserves original response/rights, purges expired grants only and rolls back all cleanup on failure',async()=>{
  await seedGrant(sample(1),{expired:true});await seedGrant(sample(2));await enable(false);
  const deletedUser='c6666666-6666-4666-8666-666666666666',deletedSession='c7777777-7777-4777-8777-777777777777';
  await owner('insert into auth.users(id) values($1)',[deletedUser]);
  await owner('insert into auth.sessions(id,user_id) values($1,$2)',[deletedSession,deletedUser]);
  await seedGrant(sample(3),{user:deletedUser,sid:deletedSession});
  await owner("with due as(select clock_timestamp()-interval '31 days' t) insert into public.account_deletion_requests(user_id,requested_at,access_blocked_at,delete_by) select $1,t,t,t+interval '30 days' from due",[deletedUser]);
  assert.equal((await owner("select pg_get_function_result('public.purge_expired_beta_data()'::regprocedure) shape")).rows[0].shape,oldCleanupShape);
  await ownerExec(`create function pg_temp.reject_grant_cleanup() returns trigger language plpgsql as $$begin
    if old.expires_at<=clock_timestamp() then raise exception 'synthetic cleanup failure';end if;return old;end;$$;
    create trigger synthetic_grant_cleanup_failure before delete on public.lounge_session_grants for each row execute function pg_temp.reject_grant_cleanup();`);
  const runs=Number((await owner('select count(*) n from public.retention_cleanup_runs')).rows[0].n);
  await claims({},'service_role');await assert.rejects(db.query('select * from public.purge_expired_beta_data()'),e=>e.code==='P0001');
  assert.equal(await count(),3);assert.equal(Number((await owner('select count(*) n from auth.users where id=$1',[deletedUser])).rows[0].n),1,'Original account purge must roll back with grant cleanup');
  assert.equal(Number((await owner('select count(*) n from public.retention_cleanup_runs')).rows[0].n),runs,'Original cleanup audit must roll back with grant cleanup');
  await owner('drop trigger synthetic_grant_cleanup_failure on public.lounge_session_grants');
  await claims({},'service_role');const rows=(await db.query('select * from public.purge_expired_beta_data()')).rows;
  assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]).sort(),['accounts_deleted','analytics_deleted']);
  assert.equal(Number(rows[0].analytics_deleted),0);assert.equal(Number(rows[0].accounts_deleted),1);
  assert.equal(Number((await owner('select count(*) n from auth.users where id=$1',[deletedUser])).rows[0].n),0,'User FK cascade removes the due account grant/session');
  assert.equal(await count(),1);assert.equal(Number((await owner('select count(*) n from public.retention_cleanup_runs')).rows[0].n),runs+1);
});
test('defect injection: named grant issuance ownership check detects missing session owner predicate and restores actual definition',async()=>{
  const needle='and s.user_id = actor';assert.equal(predicateSql.split(needle).length,2);
  try{
    await owner(predicateSql.replace(needle,'and true /* synthetic owner defect */'));
    const value=await issue({session_id:SB});
    const mutated=await inspect(value.grant);
    assert.deepEqual(mutated,approved(A),'Injected defect must really grant borrowed session authority');
    assert.throws(()=>assert.deepEqual(mutated,denied('LOGIN_REQUIRED'),'Grant cannot borrow B session'),e=>e.code==='ERR_ASSERTION' && e.message.includes('Grant cannot borrow B session'));
  }finally{await owner(predicateSql);}
  await assert.rejects(issue({session_id:SB}),e=>e.code==='42501');
});
