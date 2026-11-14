import {test}from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync}from 'node:fs';
import {PGlite}from '@electric-sql/pglite';
import {pgcrypto}from '@electric-sql/pglite/contrib/pgcrypto';

// Disposable PostgreSQL and synthetic identities only. No URL/key/JWT/account
// from an actual service is read. One focused run includes the before/after bug.
test('actual admission SQL permits pure OAuth with a linked password credential and preserves denied channels',{timeout:60000},async()=>{
 const db=new PGlite({extensions:{pgcrypto}}),migrations=new URL('../../migrations/',import.meta.url);
 const A='a1111111-1111-4111-8111-111111111111',B='b2222222-2222-4222-8222-222222222222',S='c3333333-3333-4333-8333-333333333333';
 const amr=(...methods)=>methods.map(method=>({method,timestamp:1790000000}));
 const owner=async(sql,parameters=[])=>{await db.exec('reset role');return db.query(sql,parameters);};
 const login=async(methods,user=A)=>{
  await db.exec('reset role');const claims={sub:user,role:'authenticated',session_id:S,exp:4102444800};if(methods!==undefined)claims.amr=methods;
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify(claims)]);await db.exec('set role authenticated');
 };
 const claim=async(user=A,session=S,legal='2026-11-04')=>(await db.query('select public.claim_beta_seat($1::uuid,$2::uuid,$3::date,$4::text,$4::text)value',[user,session,'1990-01-01',legal])).rows[0].value;
 const admission=async()=>(await db.query('select public.get_current_account_admission_status($1::uuid)value',[A])).rows[0].value;
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema extensions;
   create table auth.users(id uuid primary key,aud text,role text,email text,encrypted_password text,created_at timestamptz,updated_at timestamptz,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,is_anonymous boolean default false);
   create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id)on delete cascade,not_after timestamptz);
   create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   grant usage on schema auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  const chain=[...readdirSync(migrations).filter(name=>/^\d{4}_.+\.sql$/.test(name)&&name<'0059').sort(),
   '20261104145316_account_legal_version_20261104.sql'];
  for(const file of chain)await db.exec(readFileSync(new URL(file,migrations),'utf8'));
  await owner("insert into auth.users(id,email_confirmed_at,encrypted_password)values($1,clock_timestamp(),'synthetic-linked-password'),($2,clock_timestamp(),null)",[A,B]);
  await owner('insert into auth.sessions values($1,$2,null)',[S,A]);
  await owner("update public.service_feature_controls set enabled=true where feature_key in('ACCOUNT','AUTH_OAUTH')");
  await login(amr('oauth'));assert.equal(await claim(),'AUTH_METHOD_UNSUPPORTED','before hotfix: known pure-OAuth credential bug');
  await db.exec('reset role');await db.exec(readFileSync(new URL('20261114035856_oauth_credential_auth_method_fix.sql',migrations),'utf8'));
  await login(amr('oauth'));assert.equal(await claim(),'ADMITTED_NEW');assert.equal(await admission(),'ADMITTED');
  assert.equal((await db.query('select public.account_network_access_allowed($1::uuid)value',[A])).rows[0].value,false,'separate storage grant remains closed');
  assert.equal(await claim(B),'IDENTITY_MISMATCH');assert.equal(await claim(A,B),'SESSION_MISMATCH');assert.equal(await claim(A,S,'2026-10-05'),'LEGAL_VERSION_INVALID');
  await login(amr('oauth','token_refresh'));assert.equal(await claim(),'ADMITTED_EXISTING');
  for(const methods of[undefined,[],[{method:'oauth'}],{method:'oauth',timestamp:1790000000},...['password','recovery','invite','anonymous','email_change','totp','sso/saml','token_refresh','google','oauth_provider/authorization_code'].map(m=>amr(m)),amr('oauth','password')]){
   await login(methods);assert.equal(await admission(),'AUTH_METHOD_UNSUPPORTED');
  }
  await owner("update public.service_feature_controls set enabled=false where feature_key='AUTH_OAUTH'");
  await login(amr('oauth'));assert.equal(await admission(),'AUTH_CHANNEL_DISABLED');assert.equal(await claim(),'AUTH_CHANNEL_DISABLED');
  await owner("update public.service_feature_controls set enabled=true where feature_key in('AUTH_OAUTH','AUTH_PASSWORDLESS')");
  for(const method of['email/signup','otp','magiclink']){await login(amr(method));assert.equal(await admission(),'AUTH_METHOD_UNSUPPORTED');}
  await owner("update auth.users set encrypted_password=null where id=$1",[A]);await login(amr('email/signup'));assert.equal(await admission(),'ADMITTED');
  await owner("update public.service_feature_controls set enabled=false where feature_key='AUTH_PASSWORDLESS'");await login(amr('otp'));assert.equal(await admission(),'AUTH_CHANNEL_DISABLED');
  await login(amr('oauth'));assert.equal(await admission(),'ADMITTED');
  await owner("update auth.sessions set not_after=clock_timestamp()-interval '1 minute'where id=$1",[S]);await login(amr('oauth'));assert.equal(await admission(),'AUTH_SESSION_INACTIVE');assert.equal(await claim(),'AUTH_SESSION_INACTIVE');
  await owner('delete from auth.sessions where id=$1',[S]);await login(amr('oauth'));assert.equal(await admission(),'AUTH_SESSION_INACTIVE');
  const grants=await owner("select has_function_privilege('authenticated','public.current_jwt_auth_method_status()','execute')status,has_function_privilege('authenticated','public.current_jwt_auth_method_allowed()','execute')allowed");
  assert.deepEqual(grants.rows[0],{status:false,allowed:false});
 }finally{await db.close();}
});
