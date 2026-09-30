import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Actual migrations; only Supabase-managed auth tables/JWT helpers are fixtures.
// No URL, credentials, production connection, or claim of real GoTrue/PostgREST.
const db = new PGlite({extensions:{pgcrypto}});
const migrations = new URL('../../migrations/', import.meta.url);
const A='a1111111-1111-4111-8111-111111111111', B='b2222222-2222-4222-8222-222222222222';
const SA='a3333333-3333-4333-8333-333333333333', SB='b4444444-4444-4444-8444-444444444444';
const migration = () => readFileSync(new URL('0041_lounge_admission.sql',migrations),'utf8');
async function claims(patch={}) {
  await db.exec('reset role; set role authenticated');
  const value={sub:A,role:'authenticated',session_id:SA,exp:Math.floor(Date.now()/1000)+3600,...patch};
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[value.sub || '',JSON.stringify(value)]);
}
async function read(patch={}) {
  await claims(patch);
  return (await db.query('select public.get_lounge_admission() value')).rows[0].value;
}
const denied=code=>({version:1,subject:null,eligible:false,code});
async function owner(sql,params=[]) { await db.exec('reset role'); return db.query(sql,params); }
async function enabled(value=true) {await owner("update public.lounge_admission_controls set enabled=$1,privacy_policy_version='synthetic-v1',terms_of_service_version='synthetic-v1'",[value]);}

before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz,
      email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for(const file of readdirSync(migrations).filter(name=>/^\d{4}_.+\.sql$/.test(name) && name<'0041').sort())
    await db.exec(readFileSync(new URL(file,migrations),'utf8'));
  for(const [id,sid] of [[A,SA],[B,SB]]) {
    await db.query("insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())",[id]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[sid,id]);
    await db.query("insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at) values($1,'1990-01-01','synthetic-v1','synthetic-v1',clock_timestamp())",[id]);
    await db.query('insert into public.beta_enrollments(user_id) values($1)',[id]);
  }
  await db.exec("update public.service_feature_controls set enabled=true where feature_key='ACCOUNT'");
  await db.exec(migration());
},{timeout:60000});
after(()=>db.close());

test('0041 is OFF after upgrade; same caller succeeds only after operator configuration',async()=>{
  assert.deepEqual(await read(),denied('LOUNGE_DISABLED'));
  await enabled();
  assert.deepEqual(await read(),{version:1,subject:A,eligible:true,code:null});
  assert.deepEqual(await read({sub:B,session_id:SB}),{version:1,subject:B,eligible:true,code:null});
  await owner('select 1');
  assert.equal((await db.query('select count(*)::int n from public.beta_enrollments')).rows[0].n,2);
});

test('session owner, signed JWT expiry, session removal and not_after are enforced',async()=>{
  await enabled();
  for(const patch of [{session_id:SB},{session_id:null},{session_id:'broken'},{exp:0},{exp:null},{exp:'broken'},{role:'service_role'},{sub:null}])
    assert.deepEqual(await read(patch),denied('LOGIN_REQUIRED'));
  await owner('update auth.sessions set not_after=clock_timestamp()-interval \'1 second\' where id=$1',[SA]);
  assert.deepEqual(await read(),denied('LOGIN_REQUIRED'));
  await owner('update auth.sessions set not_after=null where id=$1',[SA]);
  await owner('delete from auth.sessions where id=$1',[SA]);
  assert.deepEqual(await read(),denied('LOGIN_REQUIRED'));
  await owner('insert into auth.sessions(id,user_id) values($1,$2)',[SA,A]);
  assert.equal((await read()).eligible,true);
});

test('unconfirmed, banned, anonymous and deleted users cannot use a surviving session',async()=>{
  await enabled();
  for(const [set,restore] of [
    ['email_confirmed_at=null','email_confirmed_at=clock_timestamp()'],
    ["banned_until=clock_timestamp()+interval '1 hour'",'banned_until=null'],
    ['is_anonymous=true','is_anonymous=false'],
    ['deleted_at=clock_timestamp()','deleted_at=null'],
  ]) {
    await owner(`update auth.users set ${set} where id=$1`,[A]);
    assert.deepEqual(await read(),denied('LOGIN_REQUIRED'));
    await owner(`update auth.users set ${restore} where id=$1`,[A]);
  }
});

test('ACCOUNT kill switch and dedicated gate both fail closed',async()=>{
  await enabled();
  await owner("update public.service_feature_controls set enabled=false where feature_key='ACCOUNT'");
  assert.deepEqual(await read(),denied('LOUNGE_DISABLED'));
  await owner("update public.service_feature_controls set enabled=true where feature_key='ACCOUNT'");
  await enabled(false); assert.deepEqual(await read(),denied('LOUNGE_DISABLED')); await enabled();
  await owner('delete from public.lounge_admission_controls');
  assert.deepEqual(await read(),denied('LOUNGE_DISABLED'));
  await owner("insert into public.lounge_admission_controls values(true,true,'synthetic-v1','synthetic-v1')");
});

test('current terms and enrollment, not metadata or old consent, determine eligibility',async()=>{
  await enabled();
  await owner("update public.lounge_admission_controls set privacy_policy_version='synthetic-v2'");
  assert.deepEqual(await read({app_metadata:{lounge_eligible:true}}),denied('PARTICIPATION_RESTRICTED'));
  await enabled();
  await owner("update public.lounge_admission_controls set terms_of_service_version='synthetic-v2'");
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
  await enabled();
  for(const column of ['privacy_policy_version','terms_of_service_version']) {
    await assert.rejects(owner(`update public.lounge_admission_controls set ${column}=null`),error=>error.code==='23514');
    await assert.rejects(owner(`update public.lounge_admission_controls set ${column}='  '`),error=>error.code==='23514');
  }
  await owner("update public.user_private_profiles set legal_consented_at=clock_timestamp()+interval '1 day' where user_id=$1",[A]);
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
  await owner('update public.user_private_profiles set legal_consented_at=clock_timestamp() where user_id=$1',[A]);
  await owner('delete from public.beta_enrollments where user_id=$1',[A]);
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
  await owner('insert into public.beta_enrollments(user_id) values($1)',[A]);
});

test('actual existing under14 and deletion guards apply; no fresh consent is synthesized',async()=>{
  await enabled();
  // Existing under-14 row is simulated because the current insertion trigger correctly forbids creating one.
  await owner('alter table public.user_private_profiles disable trigger user_private_profiles_under_14_gate');
  await owner("update public.user_private_profiles set birth_date=(clock_timestamp() at time zone 'Asia/Seoul')::date-interval '13 years' where user_id=$1",[A]);
  await owner('alter table public.user_private_profiles enable trigger user_private_profiles_under_14_gate');
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
  await owner("update public.user_private_profiles set birth_date='1990-01-01',deletion_requested_at=clock_timestamp() where user_id=$1",[A]);
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
  await owner('update public.user_private_profiles set deletion_requested_at=null where user_id=$1',[A]);
  await owner("update public.user_private_profiles set birth_date=(clock_timestamp() at time zone 'Asia/Seoul')::date-interval '14 years' where user_id=$1",[A]);
  for(const zone of ['UTC','Pacific/Honolulu','Asia/Seoul']) {
    await owner(`set timezone='${zone}'`);
    assert.equal((await read()).eligible,true,'KST birthday must not depend on the database timezone');
  }
  // Exactly 24 hours behind KST: exposes date-casting regressions at any wall time.
  await owner("set time zone interval '-15:00' hour to minute");
  assert.equal((await read()).eligible,true,'KST birthday survives a whole-day database offset');
  await owner("set timezone='Asia/Seoul'");
  await claims(); await db.query('select public.request_account_deletion()');
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
  await owner('delete from public.account_deletion_requests where user_id=$1',[A]);
  // Removing one marker is not account restoration; the real deletion RPC
  // also marks the private profile and that independently continues to deny.
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
});

test('public and service roles cannot inspect controls or invoke caller RPC; members cannot modify controls',async()=>{
  await enabled();
  for(const role of ['anon','service_role']) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(db.query('select public.get_lounge_admission()'),error=>error.code==='42501');
    await assert.rejects(db.query('select * from public.lounge_admission_controls'),error=>error.code==='42501');
  }
  await claims();
  for(const sql of ['select * from public.lounge_admission_controls','update public.lounge_admission_controls set enabled=true','select * from auth.sessions'])
    await assert.rejects(db.query(sql),error=>error.code==='42501');
  const result=await read();
  assert.deepEqual(Object.keys(result).sort(),['code','eligible','subject','version']);
});

test('security-definer has empty search_path and cannot be used for a supplied target',async()=>{
  await owner('select 1');
  const row=(await db.query("select prosecdef,proconfig from pg_proc where oid='public.get_lounge_admission()'::regprocedure")).rows[0];
  assert.equal(row.prosecdef,true);assert.ok(row.proconfig.some(value=>value==='search_path=""'));
  await claims();
  await assert.rejects(db.query('select public.get_lounge_admission($1::uuid)',[B]),error=>error.code==='42883');
});
