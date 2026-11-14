import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

// Disposable SQL only; synthetic users and production-like installed migration chain.
test('own-account auth methods and saved-DOB reconsent preserve installed policy and deny unauthorized changes',{timeout:60000},async()=>{
 const db=new PGlite({extensions:{pgcrypto}}),migrations=new URL('../../migrations/',import.meta.url);
 const A='a1111111-1111-4111-8111-111111111111',B='b2222222-2222-4222-8222-222222222222',S='c3333333-3333-4333-8333-333333333333';
 const owner=async(sql,args=[])=>{await db.exec('reset role');return db.query(sql,args)};
 const login=async(method='oauth')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[A,JSON.stringify({sub:A,role:'authenticated',session_id:S,exp:4102444800,amr:[{method,timestamp:1790000000}]})]);await db.exec('set role authenticated')};
 const reaccept=async(user=A,session=S,legal='2026-11-04')=>(await db.query('select public.reaccept_account_terms($1::uuid,$2::uuid,$3,$3)value',[user,session,legal])).rows[0].value;
 const methods=async(user=A,session=S)=>(await db.query('select public.get_account_auth_methods($1::uuid,$2::uuid)value',[user,session])).rows[0].value;
 const snapshot=async()=>JSON.stringify((await owner('select to_jsonb(p) profile,(select to_jsonb(e) from public.beta_enrollments e where e.user_id=p.user_id) enrollment from public.user_private_profiles p order by user_id')).rows);
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema extensions;
   create table auth.users(id uuid primary key,aud text,role text,email text,encrypted_password text,created_at timestamptz,updated_at timestamptz,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,is_anonymous boolean default false);
   create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id)on delete cascade,not_after timestamptz);
   create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   grant usage on schema auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  const chain=[...readdirSync(migrations).filter(name=>/^\d{4}_.+\.sql$/.test(name)&&name<'0066'&&!name.startsWith('0062_')).sort(),
   '20261104145316_account_legal_version_20261104.sql'];
  for(const file of chain)await db.exec(readFileSync(new URL(file,migrations),'utf8'));

  for(const file of ['20261114035856_oauth_credential_auth_method_fix.sql','20261114042129_password_account_auth_channel.sql'])await db.exec(readFileSync(new URL(file,migrations),'utf8'));
  await owner('create table auth.identities(id uuid primary key,user_id uuid references auth.users(id),provider text,identity_data jsonb)');
  await owner("insert into auth.users(id,email_confirmed_at,encrypted_password)values($1,clock_timestamp(),'SYNTHETIC_SECRET_NEVER_RETURN'),($2,clock_timestamp(),null)",[A,B]);
  await owner('insert into auth.sessions values($1,$2,null)',[S,A]);
  await owner("insert into auth.identities values('d4444444-4444-4444-8444-444444444444',$1,'google',$2::jsonb)",[A,JSON.stringify({private:'SYNTHETIC_IDENTITY_SECRET'})]);
  await owner("update public.service_feature_controls set enabled=true where feature_key in('ACCOUNT','AUTH_OAUTH','AUTH_PASSWORD')");
  await login();assert.equal((await db.query('select public.claim_beta_seat($1::uuid,$2::uuid,$3::date,$4,$4)value',[A,S,'1990-01-01','2026-11-04'])).rows[0].value,'ADMITTED_NEW');
  // Saved consent predates the installed legal policy, without changing the saved DOB.
  await owner('alter table public.user_private_profiles disable trigger user');
  await owner("update public.user_private_profiles set privacy_policy_version='2026-10-05',terms_of_service_version='2026-10-05' where user_id=$1",[A]);
  await owner('alter table public.user_private_profiles enable trigger user');
  await db.exec(readFileSync(new URL('20261114120000_account_settings_actions.sql',migrations),'utf8'));
  await login();assert.equal(await reaccept(),'ADMITTED_EXISTING');
  const current=await snapshot();await login();assert.equal(await reaccept(),'ADMITTED_EXISTING');assert.equal(await snapshot(),current,'current consent is idempotent, including timestamps');
  await login();assert.deepEqual(await methods(),{providers:['google'],hasPassword:true});
  await owner("update auth.users set encrypted_password=null where id=$1",[A]);await login();assert.deepEqual(await methods(),{providers:['google'],hasPassword:false});
  await assert.rejects(methods(B),/ACCOUNT_SETTINGS_UNAVAILABLE/);await assert.rejects(methods(A,B),/ACCOUNT_SETTINGS_UNAVAILABLE/);
  assert.equal(await reaccept(B),'IDENTITY_MISMATCH');assert.equal(await reaccept(A,B),'SESSION_MISMATCH');
  assert.equal(await reaccept(A,S,'2026-10-05'),'LEGAL_VERSION_INVALID');assert.equal(await snapshot(),current,'invalid versions and identities make no writes');
  await login('recovery');await assert.rejects(methods(),/ACCOUNT_SETTINGS_UNAVAILABLE/);assert.equal(await reaccept(),'AUTH_METHOD_UNSUPPORTED');
  await owner("update public.user_private_profiles set deletion_requested_at=now(),delete_by=now()+interval '30 days' where user_id=$1",[A]);
  await login();await assert.rejects(methods(),/ACCOUNT_SETTINGS_UNAVAILABLE/);assert.equal(await reaccept(),'ACCOUNT_BLOCKED');
  await owner('update public.user_private_profiles set deletion_requested_at=null,delete_by=null where user_id=$1',[A]);
  await owner('alter table public.user_private_profiles disable trigger user');await owner("update public.user_private_profiles set birth_date=current_date-interval '10 years' where user_id=$1",[A]);await owner('alter table public.user_private_profiles enable trigger user');
  await login();await assert.rejects(methods(),/ACCOUNT_SETTINGS_UNAVAILABLE/);assert.equal(await reaccept(),'UNDER_14_NOT_ELIGIBLE');
  await owner('delete from public.beta_enrollments where user_id=$1',[A]);await login();assert.equal(await reaccept(),'BETA_NOT_ENROLLED');
  assert.equal((await owner('select count(*)::int count from public.beta_enrollments where user_id=$1',[A])).rows[0].count,0);
  await owner('delete from public.user_private_profiles where user_id=$1',[A]);await login();assert.equal(await reaccept(),'NEEDS_PROFILE');
  assert.equal((await owner('select count(*)::int count from public.user_private_profiles where user_id=$1',[A])).rows[0].count,0);
 }finally{await db.close()}
});
