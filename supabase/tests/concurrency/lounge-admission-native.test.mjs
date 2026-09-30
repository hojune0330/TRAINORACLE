import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startCluster, literal } from './local-postgres.mjs';

// Native PostgreSQL 17, fresh loopback cluster only. Auth identity/JWT helpers
// are synthetic, NOT real GoTrue/PostgREST signature validation. Query-time
// session checks are not a distributed transaction, reservation, or WS proof.
// Usage: node <this file> --pg-bin "C:\Program Files\PostgreSQL\17\bin"
const args=process.argv.slice(2);
assert.equal(args.length,2,'Only --pg-bin <absolute local directory> is accepted; no URLs/environment fallback');
assert.equal(args[0],'--pg-bin','Only --pg-bin is accepted');
assert.ok(args[1] && !args[1].startsWith('--'),'Explicit PostgreSQL binary directory required');
const migrations=new URL('../../migrations/',import.meta.url);
const A='a1111111-1111-4111-8111-111111111111', B='b2222222-2222-4222-8222-222222222222';
const SA='a3333333-3333-4333-8333-333333333333', SB='b4444444-4444-4444-8444-444444444444';
const SA2='a5555555-5555-4555-8555-555555555555';
const approved=subject=>({version:1,subject,eligible:true,code:null});
const denied=code=>({version:1,subject:null,eligible:false,code});
let cluster,admin,left,right,pids,version,functionSql;
const completed=[];
let mutationDetected=false;
let upgraded=false,grantSql,migrationsApplied=41,grantMutationDetected=false,advisoryWaits=0;

async function claims(session,patch={}){
  const value={sub:A,role:'authenticated',session_id:SA,exp:Math.floor(Date.now()/1000)+3600,...patch};
  await session.query(`reset role; set role authenticated;
    set request.jwt.claim.sub=${literal(value.sub || '')};
    set request.jwt.claims=${literal(JSON.stringify(value))};`);
}
async function read(session=left,patch={}){
  await claims(session,patch);
  const result=await session.value('public.get_lounge_admission()');
  assert.deepEqual(Object.keys(result).sort(),['code','eligible','subject','version'],'Only minimal DTO fields may leave RPC');
  return result;
}
async function enable(value=true){
  await admin.query(`update public.lounge_admission_controls set enabled=${value},privacy_policy_version='synthetic-v1',terms_of_service_version='synthetic-v1';`);
}
async function reset(){
  await Promise.all([admin,left,right].map(s=>s.query("rollback; reset role; set time zone 'UTC'; set statement_timeout='12s'; set lock_timeout='10s'; set idle_in_transaction_session_timeout='20s';")));
  await admin.query(`update public.service_feature_controls set enabled=true where feature_key='ACCOUNT';
    delete from public.account_deletion_requests where user_id in (${literal(A)},${literal(B)});
    update auth.users set email_confirmed_at=clock_timestamp(),deleted_at=null,banned_until=null,is_anonymous=false;
    update public.user_private_profiles set birth_date='1990-01-01',privacy_policy_version='synthetic-v1',terms_of_service_version='synthetic-v1',legal_consented_at=clock_timestamp(),deletion_requested_at=null,delete_by=null;
    insert into public.beta_enrollments(user_id) values(${literal(A)}),(${literal(B)}) on conflict(user_id) do nothing;
    insert into auth.sessions(id,user_id,not_after) values(${literal(SA)},${literal(A)},null),(${literal(SA2)},${literal(A)},null),(${literal(SB)},${literal(B)},null)
      on conflict(id) do update set user_id=excluded.user_id,not_after=null;`);
  await enable();
  if(upgraded)await admin.query('delete from public.lounge_session_grants;');
}
const check=(name,fn)=>test(name,{timeout:45000},async()=>{await fn();completed.push(name);});

before(async()=>{
  cluster=await startCluster(args[1]);
  admin=cluster.connect();left=cluster.connect();right=cluster.connect();
  version=await admin.value("current_setting('server_version')");
  const number=await admin.value("current_setting('server_version_num')::int");
  assert.ok(number>=170000 && number<180000,'Only native PostgreSQL 17 is accepted');
  pids=await Promise.all([admin,left,right].map(s=>s.value('pg_backend_pid()')));
  assert.equal(new Set(pids).size,3,'Three actual independent PostgreSQL test connections');
  console.log(JSON.stringify({nativePostgres:version,provisionConnectionsCreatedAndClosed:1,testConnections:3,backendPids:pids}));
  await admin.query(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz,
      email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  const names=readdirSync(migrations).filter(name=>/^\d{4}_.+\.sql$/.test(name) && Number(name.slice(0,4))<=41).sort();
  assert.equal(names.length,41,'Entire actual migration range 0001-0041');
  for(const [i,name] of names.entries()){
    assert.equal(Number(name.slice(0,4)),i+1,'No skipped or duplicate migration number');
    const sql=readFileSync(new URL(name,migrations),'utf8');
    await admin.query(sql);
    if(name.startsWith('0041_')){
      const start=sql.indexOf('create function public.get_lounge_admission()');
      const end=sql.indexOf('$$;',start);
      assert.ok(start>=0 && end>start,'Exact function definition available for isolated defect injection');
      functionSql=sql.slice(start,end+3).replace('create function','create or replace function');
    }
  }
  // Same managed-auth fixture as PGlite; no application policy helper stubs.
  await admin.query(`insert into auth.users(id,email_confirmed_at) values(${literal(A)},clock_timestamp()),(${literal(B)},clock_timestamp());
    update public.service_feature_controls set enabled=true where feature_key='ACCOUNT';
    insert into auth.sessions(id,user_id) values(${literal(SA)},${literal(A)}),(${literal(SA2)},${literal(A)}),(${literal(SB)},${literal(B)});
    insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
      values(${literal(A)},'1990-01-01','synthetic-v1','synthetic-v1',clock_timestamp()),(${literal(B)},'1990-01-01','synthetic-v1','synthetic-v1',clock_timestamp());
    insert into public.beta_enrollments(user_id) values(${literal(A)}),(${literal(B)});`);
  assert.deepEqual(await read(),denied('LOUNGE_DISABLED'),'Actual upgrade must default OFF before any test config');
},{timeout:120000});
beforeEach(async()=>{await reset();});
after(async()=>{
  if(!cluster)return;
  await cluster.stop();
  let serverStopped=false;
  try{await access(join(cluster.root,'data','postmaster.pid'));}
  catch(error){if(error.code==='ENOENT')serverStopped=true;else throw error;}
  assert.equal(serverStopped,true,'pg_ctl stop succeeded and owned cluster PID file is gone');
  console.log(JSON.stringify({nativePostgres:version,migrationsApplied,independentTestConnections:3,
    casesPassed:completed.length,sessionOwnerMutationDetected:mutationDetected,serverStopped,
    scopedGrantLockMutationDetected:grantMutationDetected,actualGrantAdvisoryWaits:advisoryWaits,
    filesRetained:cluster.root,proof:'synthetic JWT and query-time native SQL only; not GoTrue, PostgREST, distributed transaction or production'}));
},{timeout:45000});

check('configured admission grants only the current A or B and adds no enrollment or legal consent',async()=>{
  await enable(false);assert.deepEqual(await read(),denied('LOUNGE_DISABLED'));
  const before=await admin.value("(select jsonb_agg(jsonb_build_object('user',user_id,'privacy',privacy_policy_version,'terms',terms_of_service_version,'consent',legal_consented_at) order by user_id) from public.user_private_profiles)");
  await enable();
  assert.deepEqual(await read(),approved(A));
  assert.deepEqual(await read(right,{sub:B,session_id:SB}),approved(B));
  assert.equal(await admin.value('(select count(*)::int from public.beta_enrollments)'),2);
  const after=await admin.value("(select jsonb_agg(jsonb_build_object('user',user_id,'privacy',privacy_policy_version,'terms',terms_of_service_version,'consent',legal_consented_at) order by user_id) from public.user_private_profiles)");
  assert.deepEqual(after,before,'RPC must not synthesize fresh legal consent');
});

check('A with B session, missing session or wrong claim role never borrows B authority',async()=>{
  assert.deepEqual(await read(right,{sub:B,session_id:SB}),approved(B),'Positive control: B session actually exists and is eligible');
  for(const patch of [{session_id:SB},{session_id:null},{session_id:'broken'},{sub:null},{role:'service_role'}])
    assert.deepEqual(await read(left,patch),denied('LOGIN_REQUIRED'));
  assert.deepEqual(await read(),approved(A),'Positive control: owned A session still admitted');
});

check('deleting one session denies a NEW query after COMMIT on an independent connection without global logout',async()=>{
  assert.deepEqual(await read(),approved(A));
  await admin.query(`begin; delete from auth.sessions where id=${literal(SA)};`);
  try{
    assert.deepEqual(await read(),approved(A),'Uncommitted deletion must not be presented as completed logout');
    assert.deepEqual(await read(right,{sub:B,session_id:SB}),approved(B));
    await admin.query('commit;');
  }finally{await admin.query('rollback;');}
  assert.deepEqual(await read(),denied('LOGIN_REQUIRED'),'New query after deletion COMMIT must reject old session');
  assert.deepEqual(await read(left,{session_id:SA2}),approved(A),'Another device session for A remains active');
  assert.deepEqual(await read(right,{sub:B,session_id:SB}),approved(B),'B session is not globally revoked');
  assert.equal(await admin.value('(select count(*)::int from auth.sessions)'),2);
});

check('JWT expiry and auth session not_after are checked against current time',async()=>{
  for(const patch of [{exp:0},{exp:null},{exp:'broken'},{exp:Math.floor(Date.now()/1000)-1}])
    assert.deepEqual(await read(left,patch),denied('LOGIN_REQUIRED'));
  await admin.query(`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=${literal(SA)};`);
  assert.deepEqual(await read(),denied('LOGIN_REQUIRED'));
  assert.deepEqual(await read(right,{sub:B,session_id:SB}),approved(B));
  await admin.query(`update auth.sessions set not_after=clock_timestamp()+interval '1 hour' where id=${literal(SA)};`);
  assert.deepEqual(await read(),approved(A));
});

check('ACCOUNT switch, dedicated switch and missing configuration all fail closed',async()=>{
  await admin.query("update public.service_feature_controls set enabled=false where feature_key='ACCOUNT';");
  assert.deepEqual(await read(),denied('LOUNGE_DISABLED'));
  await admin.query("update public.service_feature_controls set enabled=true where feature_key='ACCOUNT';");
  await enable(false);assert.deepEqual(await read(),denied('LOUNGE_DISABLED'));
  await admin.query('delete from public.lounge_admission_controls;');
  assert.deepEqual(await read(),denied('LOUNGE_DISABLED'));
  await admin.query("insert into public.lounge_admission_controls(singleton,enabled,privacy_policy_version,terms_of_service_version) values(true,true,'synthetic-v1','synthetic-v1');");
  assert.deepEqual(await read(),approved(A));
});

check('current legal versions, enrollment and real deletion markers override metadata claims',async()=>{
  for(const field of ['privacy_policy_version','terms_of_service_version']){
    await admin.query(`update public.lounge_admission_controls set ${field}='synthetic-v2';`);
    assert.deepEqual(await read(left,{app_metadata:{lounge_eligible:true}}),denied('PARTICIPATION_RESTRICTED'));
    await enable();
  }
  await admin.query(`update public.user_private_profiles set legal_consented_at=clock_timestamp()+interval '1 day' where user_id=${literal(A)};`);
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
  await admin.query(`update public.user_private_profiles set legal_consented_at=clock_timestamp() where user_id=${literal(A)};
    delete from public.beta_enrollments where user_id=${literal(A)};`);
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
  assert.deepEqual(await read(right,{sub:B,session_id:SB}),approved(B));
});

check('unconfirmed, banned, anonymous and soft-deleted auth users are denied despite surviving session rows',async()=>{
  for(const [change,restore] of [
    ['email_confirmed_at=null','email_confirmed_at=clock_timestamp()'],
    ["banned_until=clock_timestamp()+interval '1 hour'",'banned_until=null'],
    ['is_anonymous=true','is_anonymous=false'],['deleted_at=clock_timestamp()','deleted_at=null'],
  ]){
    await admin.query(`update auth.users set ${change} where id=${literal(A)};`);
    assert.deepEqual(await read(),denied('LOGIN_REQUIRED'));
    assert.deepEqual(await read(right,{sub:B,session_id:SB}),approved(B));
    await admin.query(`update auth.users set ${restore} where id=${literal(A)};`);
  }
});

check('KST exact 14th birthday succeeds even in UTC-15 and existing under14 rows remain denied',async()=>{
  await admin.query(`update public.user_private_profiles set birth_date=(clock_timestamp() at time zone 'Asia/Seoul')::date-interval '14 years' where user_id=${literal(A)};`);
  await left.query("set time zone interval '-15:00' hour to minute;");
  assert.deepEqual(await read(),approved(A),'KST age boundary must not be rechecked using session UTC-15');
  // Only an existing legacy row is modeled; the actual insertion/update gate is retained.
  await admin.query('alter table public.user_private_profiles disable trigger user_private_profiles_under_14_gate;');
  try{await admin.query(`update public.user_private_profiles set birth_date=(clock_timestamp() at time zone 'Asia/Seoul')::date-interval '13 years' where user_id=${literal(A)};`);}
  finally{await admin.query('alter table public.user_private_profiles enable trigger user_private_profiles_under_14_gate;');}
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
});

check('actual account deletion RPC revokes eligibility and removing only one marker never restores it',async()=>{
  assert.deepEqual(await read(),approved(A));
  await left.query('select public.request_account_deletion();');
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'));
  await admin.query(`delete from public.account_deletion_requests where user_id=${literal(A)};`);
  assert.deepEqual(await read(),denied('PARTICIPATION_RESTRICTED'),'Private profile deletion marker independently denies');
  assert.deepEqual(await read(right,{sub:B,session_id:SB}),approved(B));
});

async function sqlDenied(session,sql){
  // Expected errors are caught in SQL: ON_ERROR_STOP must not kill the connection.
  await session.query(`do $test$ declare denied boolean:=false; begin
    begin ${sql}; exception when insufficient_privilege then denied:=true; end;
    if not denied then raise exception 'expected SQLSTATE 42501'; end if;
  end $test$;`);
}
check('authenticated RPC privilege is narrow; anon/service_role cannot execute and no caller can access private tables',async()=>{
  for(const role of ['anon','authenticated','service_role']){
    assert.equal(await admin.value(`has_function_privilege(${literal(role)},'public.get_lounge_admission()','EXECUTE')`),role==='authenticated');
    for(const [table,permission] of [['public.lounge_admission_controls','SELECT'],['public.lounge_admission_controls','UPDATE'],['auth.sessions','SELECT'],['auth.users','SELECT']])
      assert.equal(await admin.value(`has_table_privilege(${literal(role)},${literal(table)},${literal(permission)})`),false);
    await right.query(`reset role; set role ${role};`);
    if(role!=='authenticated')await sqlDenied(right,'perform public.get_lounge_admission()');
    await sqlDenied(right,'perform 1 from public.lounge_admission_controls');
    await sqlDenied(right,'update public.lounge_admission_controls set enabled=true');
    await sqlDenied(right,'perform 1 from auth.sessions');
    await sqlDenied(right,'perform 1 from auth.users');
  }
  const definition=await admin.value("(select jsonb_build_object('definer',prosecdef,'config',proconfig) from pg_proc where oid='public.get_lounge_admission()'::regprocedure)");
  assert.equal(definition.definer,true);assert.ok(definition.config.includes('search_path=""'));
  assert.equal(await admin.value("to_regprocedure('public.get_lounge_admission(uuid)') is null"),true);
  assert.deepEqual(await read(),approved(A));
});

check('defect injection: named A-with-B-session assertion detects a missing owner predicate and original definition is restored',async()=>{
  const needle='and s.user_id = actor';
  assert.equal(functionSql.split(needle).length,2,'Mutation must match exactly once');
  const name='A cannot borrow B session authority';
  try{
    await admin.query(functionSql.replace(needle,'and true /* synthetic owner-binding defect */'));
    const mutated=await read(left,{session_id:SB});
    assert.deepEqual(mutated,approved(A),'Injected defect must actually grant incorrect authority');
    assert.throws(()=>assert.deepEqual(mutated,denied('LOGIN_REQUIRED'),name),error=>error.code==='ERR_ASSERTION' && error.message.includes(name));
    mutationDetected=true;
  }finally{await admin.query(functionSql);}
  assert.deepEqual(await read(left,{session_id:SB}),denied('LOGIN_REQUIRED'),'Restored original owner predicate rejects borrowed session');
  assert.deepEqual(await read(),approved(A));
});

const sample=i=>'lg1_'+i.toString(16).padStart(64,'0');
function validGrant(value){
  assert.equal(value.version,1);assert.equal(typeof value.grant,'string');assert.equal(/^lg1_[0-9a-f]{64}$/.test(value.grant),true);
  assert.deepEqual(Object.keys(value).sort(),['expiresAt','grant','version']);
  assert.equal(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value.expiresAt),true);
  return value;
}
async function issue(session=left,patch={}){await claims(session,patch);return session.value('pg_temp.synthetic_issue_grant()');}
async function inspect(token,session=right){
  await session.query('reset role;set role anon;');
  const result=await session.value(`public.inspect_lounge_grant(${literal(token)})`);
  assert.deepEqual(Object.keys(result).sort(),['code','eligible','subject','version']);return result;
}
async function seedGrant(token,{sid=SA,user=A,expired=false}={}){
  await admin.query(`insert into public.lounge_session_grants(token_hash,user_id,session_id,created_at,expires_at)
    values(extensions.digest(${literal(token)},'sha256'),${literal(user)},${literal(sid)},clock_timestamp()-interval '2 hours',clock_timestamp()+interval '${expired?'-1':'1'} hour');`);
}
const grantCount=()=>admin.value('(select count(*)::int from public.lounge_session_grants)');
async function waitGrantLock(waiter,blocker,name='Grant issuance must wait on session advisory barrier'){
  const deadline=Date.now()+4000;
  do{
    const state=await admin.value(`(select jsonb_build_object('blocked',pg_blocking_pids(pid),'event',wait_event,'type',wait_event_type) from pg_stat_activity where pid=${waiter})`);
    if(state?.blocked.includes(blocker) && state.type==='Lock' && state.event==='advisory'){advisoryWaits++;return;}
    await delay(20);
  }while(Date.now()<deadline);
  assert.fail(name);
}
async function raceIssuance(){
  await claims(left);await claims(right);
  await admin.query(`begin;select pg_advisory_xact_lock(hashtextextended('lounge-grant:${SA}',0));`);
  const results=Promise.all([left.value('pg_temp.synthetic_issue_grant()'),right.value('pg_temp.synthetic_issue_grant()')]);
  results.catch(()=>{});
  try{await waitGrantLock(pids[1],pids[0]);await waitGrantLock(pids[2],pids[0]);}
  finally{await admin.query('commit;');}
  return results;
}

check('0042 upgrade preserves original cleanup contract; UTC grant JSON and hashed storage expose no raw JWT',async()=>{
  const oldShape=await admin.value("pg_get_function_result('public.purge_expired_beta_data()'::regprocedure)");
  const sql=readFileSync(new URL('0042_lounge_scoped_grants.sql',migrations),'utf8');
  await admin.query(sql);upgraded=true;migrationsApplied=42;
  const start=sql.indexOf('create function public.issue_lounge_grant()'),end=sql.indexOf('$$;',start);
  assert.ok(start>=0 && end>start);grantSql=sql.slice(start,end+3).replace('create function','create or replace function');
  for(const session of [left,right])await session.query(`reset role;
    create function pg_temp.synthetic_issue_grant() returns jsonb language plpgsql security invoker as $$begin
      return public.issue_lounge_grant();exception when others then return jsonb_build_object('sqlstate',SQLSTATE);end;$$;`);
  assert.equal(await admin.value("pg_get_function_result('public.purge_expired_beta_data()'::regprocedure)"),oldShape);
  await left.query("set time zone interval '-15:00' hour to minute;");
  const expiry=Math.floor(Date.now()/1000)+120,value=validGrant(await issue(left,{exp:expiry}));
  assert.equal(Date.parse(value.expiresAt)/1000,expiry);
  assert.equal(await admin.value(`(select token_hash=extensions.digest(${literal(value.grant)},'sha256') and octet_length(token_hash)=32 from public.lounge_session_grants)`),true);
  assert.deepEqual(await inspect(value.grant),approved(A));assert.deepEqual(await inspect(value.grant),approved(A));
  assert.equal(await grantCount(),1,'Inspect is reusable, not a consumed single-use ticket');
  assert.deepEqual(await inspect('eyJhbGciOiJIUzI1NiJ9.syntheticJWT.syntheticSignature'),denied('LOGIN_REQUIRED'));
  for(const role of ['anon','authenticated','service_role']){
    for(const [fn,expected] of [['public.issue_lounge_grant()',role==='authenticated'],['public.inspect_lounge_grant(text)',role!=='service_role'],['public.lounge_session_admission(uuid,uuid,timestamptz)',false],['public.purge_expired_beta_data_before_lounge()',false],['public.purge_expired_beta_data()',role==='service_role']])
      assert.equal(await admin.value(`has_function_privilege(${literal(role)},${literal(fn)},'EXECUTE')`),expected);
    assert.equal(await admin.value(`has_table_privilege(${literal(role)},'public.lounge_session_grants','SELECT')`),false);
    await right.query(`reset role;set role ${role};`);
    await sqlDenied(right,'perform 1 from public.lounge_session_grants');
    await sqlDenied(right,'perform public.lounge_session_admission(null,null,null)');
    if(role!=='authenticated')await sqlDenied(right,'perform public.issue_lounge_grant()');
  }
  await right.query('reset role;set role anon;');await sqlDenied(right,'perform 1 from public.user_private_profiles');
  await sqlDenied(right,'perform public.get_lounge_admission()');
});

check('0042 actual two-connection lock waits enforce one-second rate and sixteen-grant ceiling after COMMIT',async()=>{
  const first=await raceIssuance();
  assert.equal(first.filter(v=>v.sqlstate===undefined).length,1);assert.equal(first.filter(v=>v.sqlstate==='P0001').length,1);
  assert.equal(await grantCount(),1);
  await admin.query('delete from public.lounge_session_grants;');
  for(let i=1;i<=15;i++)await seedGrant(sample(i));
  const cap=await raceIssuance();
  assert.equal(cap.filter(v=>v.sqlstate===undefined).length,1);assert.equal(cap.filter(v=>v.sqlstate==='P0001').length,1);
  assert.equal(await grantCount(),16,'Concurrent winner must be counted after wait; no seventeenth grant');
  const other=validGrant(await issue(right,{sub:B,session_id:SB}));
  assert.deepEqual(await inspect(other.grant),approved(B),'Session cap must not be global');
});

check('0042 issuance rollback, dynamic policy and session-delete COMMIT cascade cannot leave effective orphan authority',async()=>{
  await left.query('begin;');const rolledBack=validGrant(await issue());
  assert.deepEqual(await inspect(rolledBack.grant),denied('LOGIN_REQUIRED'),'Independent observer must not see uncommitted proof');
  await left.query('rollback;');assert.equal(await grantCount(),0);assert.deepEqual(await inspect(rolledBack.grant),denied('LOGIN_REQUIRED'));
  const value=validGrant(await issue()),other=validGrant(await issue(left,{session_id:SA2})),b=validGrant(await issue(right,{sub:B,session_id:SB}));
  await enable(false);assert.deepEqual(await inspect(value.grant),denied('LOUNGE_DISABLED'));await enable();
  await admin.query("update public.lounge_admission_controls set privacy_policy_version='synthetic-v2';");
  assert.deepEqual(await inspect(value.grant),denied('PARTICIPATION_RESTRICTED'));await enable();
  await admin.query(`begin;delete from auth.sessions where id=${literal(SA)};`);
  try{assert.deepEqual(await inspect(value.grant),approved(A));await admin.query('commit;');}
  finally{await admin.query('rollback;');}
  assert.equal(await grantCount(),2);assert.deepEqual(await inspect(value.grant),denied('LOGIN_REQUIRED'));
  assert.deepEqual(await inspect(other.grant),approved(A));assert.deepEqual(await inspect(b.grant),approved(B));
});

check('0042 OFF-state daily purge preserves original result and rolls original cleanup back if grant deletion fails',async()=>{
  await seedGrant(sample(1),{expired:true});await seedGrant(sample(2));await enable(false);
  const deletedUser='c6666666-6666-4666-8666-666666666666',deletedSession='c7777777-7777-4777-8777-777777777777';
  await admin.query(`insert into auth.users(id) values(${literal(deletedUser)});insert into auth.sessions(id,user_id) values(${literal(deletedSession)},${literal(deletedUser)});`);
  await seedGrant(sample(3),{user:deletedUser,sid:deletedSession});
  await admin.query(`with due as(select clock_timestamp()-interval '31 days' t) insert into public.account_deletion_requests(user_id,requested_at,access_blocked_at,delete_by) select ${literal(deletedUser)},t,t,t+interval '30 days' from due;`);
  await admin.query(`create function pg_temp.reject_grant_cleanup() returns trigger language plpgsql as $$begin
    if old.expires_at<=clock_timestamp() then raise exception 'synthetic cleanup failure';end if;return old;end;$$;
    create trigger synthetic_grant_cleanup_failure before delete on public.lounge_session_grants for each row execute function pg_temp.reject_grant_cleanup();`);
  const runs=await admin.value('(select count(*)::int from public.retention_cleanup_runs)');
  await right.query(`reset role;set role service_role;set request.jwt.claims='{"role":"service_role"}';
    do $$declare denied boolean:=false;begin
      begin perform public.purge_expired_beta_data();exception when raise_exception then denied:=true;end;
      if not denied then raise exception 'expected cleanup failure';end if;end$$;`);
  assert.equal(await grantCount(),3);assert.equal(await admin.value(`(select count(*)::int from auth.users where id=${literal(deletedUser)})`),1);
  assert.equal(await admin.value('(select count(*)::int from public.retention_cleanup_runs)'),runs);
  await admin.query('drop trigger synthetic_grant_cleanup_failure on public.lounge_session_grants;');
  const value=await right.value('(select to_jsonb(p) from public.purge_expired_beta_data() p)');
  assert.deepEqual(value,{analytics_deleted:0,accounts_deleted:1});assert.equal(await grantCount(),1);
  assert.equal(await admin.value(`(select count(*)::int from auth.users where id=${literal(deletedUser)})`),0);
  assert.equal(await admin.value('(select count(*)::int from public.retention_cleanup_runs)'),runs+1);
});

check('0042 defect injection: named native lock-wait assertion detects omitted issuance lock and restores original function',async()=>{
  const needle="perform pg_advisory_xact_lock(hashtextextended('lounge-grant:' || session_uuid::text, 0));";
  assert.equal(grantSql.split(needle).length,2);
  await admin.query(grantSql.replace(needle,'-- synthetic omitted session issuance lock'));
  await claims(left);await admin.query(`begin;select pg_advisory_xact_lock(hashtextextended('lounge-grant:${SA}',0));`);
  const pending=left.value('pg_temp.synthetic_issue_grant()');pending.catch(()=>{});
  try{
    await assert.rejects(waitGrantLock(pids[1],pids[0],'Named grant issuance session-lock barrier'),e=>e.code==='ERR_ASSERTION' && e.message.includes('Named grant issuance session-lock barrier'));
    grantMutationDetected=true;
  }finally{await admin.query('commit;');await pending;await admin.query(grantSql);}
  await admin.query('delete from public.lounge_session_grants;');
  const restored=await raceIssuance();assert.equal(restored.filter(v=>v.sqlstate==='P0001').length,1);assert.equal(await grantCount(),1);
});
