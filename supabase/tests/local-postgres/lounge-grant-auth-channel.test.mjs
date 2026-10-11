import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { loadOracleMigrationChain, setOracleAuth, ORACLE_STORAGE_VERSION } from './oracle-auth-fixture.mjs';

// Complete, unchanged 0001-0064 product SQL in a disposable memory database.
// Only Supabase-managed identity objects are synthetic. No service URL,
// credential, network, real user data, durable DB or source mutation is used.
const db = new PGlite({ extensions: { pgcrypto } });
const migrations = new URL('../../migrations/', import.meta.url);
const migration = readFileSync(new URL('0064_lounge_grant_auth_channel_recheck.sql', migrations), 'utf8');
const A='a1111111-1111-4111-8111-111111111111', B='b2222222-2222-4222-8222-222222222222';
const SA='a3333333-3333-4333-8333-333333333333', SB='b4444444-4444-4444-8444-444444444444';
const SA2='a5555555-5555-4555-8555-555555555555';
const amr = (...methods) => methods.map(method => ({ method, timestamp: Math.floor(Date.now()/1000) }));
const approved = subject => ({ version:1, subject, eligible:true, code:null });
const denied = () => ({ version:1, subject:null, eligible:false, code:'LOGIN_REQUIRED' });
const sample = i => 'lg1_' + i.toString(16).padStart(64,'0');
const owner = async (sql,params=[]) => { await db.exec('reset role'); return db.query(sql,params); };
const ownerExec = async sql => { await db.exec('reset role'); return db.exec(sql); };
function definition(text,name) {
  // Checkout line endings must not hide the exact SQL mutation target.
  // The migrations themselves are still replayed unchanged below.
  text=text.replace(/\r\n?/gu,'\n');
  const start=text.indexOf(`create or replace function public.${name}(`), end=text.indexOf('$$;',start);
  assert.ok(start>=0 && end>start,`Maintained function ${name} must exist`);
  return text.slice(start,end+3);
}
const issueDefinition=definition(migration,'issue_lounge_grant');
const inspectDefinition=definition(migration,'inspect_lounge_grant');
const admissionDefinition=definition(readFileSync(new URL('0056_remaining_auth_surface_gates.sql',migrations),'utf8'),'get_lounge_admission');
let beforeUpgrade, afterUpgrade, legacyInspection;
async function auth(methods=['oauth'],patch={}) {
  await setOracleAuth(db,patch.sub ?? A,patch.session_id ?? SA,{amr:amr(...methods),...patch});
}
async function issue(methods=['oauth'],patch={}) {
  await auth(methods,patch);
  const value=(await db.query('select public.issue_lounge_grant() value')).rows[0].value;
  assert.deepEqual(Object.keys(value).sort(),['expiresAt','grant','version']);
  assert.equal(value.version,1);
  assert.match(value.grant,/^lg1_[0-9a-f]{64}$/u);
  return value;
}
async function inspect(token,role='anon') {
  await ownerExec(`set role ${role}`);
  // An inspector never needs the issuing JWT or its AMR claims.
  await db.query("select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims',$1,false)",[JSON.stringify({role})]);
  return (await db.query('select public.inspect_lounge_grant($1) value',[token])).rows[0].value;
}
async function seedGrant(token,{sid=SA,marker=null,expired=false}={}) {
  await owner(`insert into public.lounge_session_grants
    (token_hash,user_id,session_id,created_at,expires_at,requires_oauth,requires_passwordless)
    values(extensions.digest($1,'sha256'),$2,$3,clock_timestamp()-interval '2 hours',
      clock_timestamp()+${expired ? "interval '-1 hour'" : "interval '1 hour'"},$4,$5)`,
    [token,A,sid,marker?.[0]??null,marker?.[1]??null]);
}
const total = async () => Number((await owner('select count(*) value from public.lounge_session_grants')).rows[0].value);
const closeChannel = key => owner('update public.service_feature_controls set enabled=false where feature_key=$1',[key]);

before(async()=>{
  await loadOracleMigrationChain(db);
  await db.exec(readFileSync(new URL('0063_lounge_identity_deletion_outbox.sql',migrations),'utf8'));
  await owner("update public.service_feature_controls set enabled=true where feature_key in('ACCOUNT','AUTH_OAUTH','AUTH_PASSWORDLESS')");
  for (const [user,sid] of [[A,SA],[B,SB]]) {
    await owner('insert into auth.users(id,email_confirmed_at,encrypted_password) values($1,clock_timestamp(),null)',[user]);
    await owner('insert into auth.sessions(id,user_id) values($1,$2)',[sid,user]);
    await auth(['oauth'],{sub:user,session_id:sid});
    assert.equal((await db.query('select public.claim_beta_seat($1,$2,$3::date,$4,$4) value',
      [user,sid,'1990-01-01',ORACLE_STORAGE_VERSION])).rows[0].value,'ADMITTED_NEW');
  }
  await owner('insert into auth.sessions(id,user_id) values($1,$2)',[SA2,A]);
  await owner('update public.lounge_admission_controls set enabled=true,privacy_policy_version=$1,terms_of_service_version=$1 where singleton',[ORACLE_STORAGE_VERSION]);
  const legacy=await issue();
  beforeUpgrade=(await owner('select * from public.lounge_session_grants where token_hash=extensions.digest($1,\'sha256\')',[legacy.grant])).rows[0];
  await ownerExec(migration);
  afterUpgrade=(await owner('select * from public.lounge_session_grants where token_hash=extensions.digest($1,\'sha256\')',[legacy.grant])).rows[0];
  legacyInspection=await inspect(legacy.grant);
},{timeout:60000});
beforeEach(async()=>{
  await ownerExec(`delete from public.lounge_session_grants;
    delete from public.account_deletion_requests;delete from public.lounge_identity_deletion_outbox;
    update public.service_feature_controls set enabled=true where feature_key in('ACCOUNT','AUTH_OAUTH','AUTH_PASSWORDLESS');
    update auth.users set encrypted_password=null,email_confirmed_at=clock_timestamp(),banned_until=null,deleted_at=null;
    update public.user_private_profiles set deletion_requested_at=null,delete_by=null;
    update public.lounge_admission_controls set enabled=true;`);
  await owner('update public.lounge_admission_controls set privacy_policy_version=$1,terms_of_service_version=$1 where singleton',[ORACLE_STORAGE_VERSION]);
  await owner('insert into auth.sessions(id,user_id,not_after) values($1,$2,null),($3,$4,null),($5,$2,null) on conflict(id) do update set not_after=null',[SA,A,SB,B,SA2]);
});
after(()=>db.close());

test('0064 preserves legacy hashed rows without inferring origin; old capabilities fail closed and new ones can be issued',async()=>{
  assert.deepEqual(afterUpgrade,{...beforeUpgrade,requires_oauth:null,requires_passwordless:null});
  assert.deepEqual(legacyInspection,denied());
  const fresh=await issue();
  assert.deepEqual(await inspect(fresh.grant),approved(A));
});

test('only two origin booleans are stored; opaque issuance and admission DTOs add no JWT, AMR or personal metadata',async()=>{
  const proof=await issue(['oauth','token_refresh']);
  const row=(await owner("select token_hash=extensions.digest($1,'sha256') valid,requires_oauth,requires_passwordless from public.lounge_session_grants",[proof.grant])).rows[0];
  assert.deepEqual(row,{valid:true,requires_oauth:true,requires_passwordless:false});
  const columns=(await owner("select column_name from information_schema.columns where table_schema='public' and table_name='lounge_session_grants' order by ordinal_position")).rows.map(r=>r.column_name);
  assert.deepEqual(columns,['token_hash','user_id','session_id','created_at','expires_at','requires_oauth','requires_passwordless']);
  assert.deepEqual(await inspect(proof.grant),approved(A));
});

test('issued OAuth grant is revoked for anonymous inspectors on OAuth closure without closing valid passwordless grants',async()=>{
  const oauth=await issue(),otp=await issue(['otp'],{session_id:SA2});
  assert.deepEqual(await inspect(oauth.grant),approved(A));
  await closeChannel('AUTH_OAUTH');
  assert.deepEqual(await inspect(oauth.grant),denied(),'issued OAuth grant must be denied after AUTH_OAUTH closure');
  assert.deepEqual(await inspect(otp.grant),approved(A));
});

for (const origin of ['otp','magiclink','email/signup']) test(`issued ${origin} grant is revoked on passwordless closure without closing OAuth`,async()=>{
  const passwordless=await issue([origin]),oauth=await issue(['oauth'],{session_id:SA2});
  await closeChannel('AUTH_PASSWORDLESS');
  assert.deepEqual(await inspect(passwordless.grant),denied());
  assert.deepEqual(await inspect(oauth.grant),approved(A));
});

test('mixed verified origins require both current channels, not either channel',async()=>{
  const mixed=await issue(['oauth','otp','token_refresh']);
  const row=(await owner('select requires_oauth,requires_passwordless from public.lounge_session_grants')).rows[0];
  assert.deepEqual(row,{requires_oauth:true,requires_passwordless:true});
  await closeChannel('AUTH_OAUTH');assert.deepEqual(await inspect(mixed.grant),denied());
  await owner("update public.service_feature_controls set enabled=true where feature_key='AUTH_OAUTH'");
  assert.deepEqual(await inspect(mixed.grant),approved(A));
  await closeChannel('AUTH_PASSWORDLESS');assert.deepEqual(await inspect(mixed.grant),denied());
});

test('adding a password revokes already-issued OAuth and passwordless grants without relying on inspector JWT',async()=>{
  const oauth=await issue(),otp=await issue(['otp'],{session_id:SA2});
  await owner("update auth.users set encrypted_password='synthetic-password-hash' where id=$1",[A]);
  assert.deepEqual(await inspect(oauth.grant),denied());assert.deepEqual(await inspect(otp.grant),denied());
  await assert.rejects(issue(),error=>error.code==='42501');
});

test('unsupported or missing origin cannot issue authority; marker constraints reject false/partial claims',async()=>{
  for(const methods of [[],['token_refresh'],['password'],['oauth','password']]) {
    await assert.rejects(issue(methods),error=>error.code==='42501');
  }
  assert.equal(await total(),0);
  for(const marker of [[false,false],[true,null],[null,false]]) {
    await assert.rejects(seedGrant(sample(1),{marker}),error=>error.code==='23514');
  }
  assert.deepEqual(await inspect((await issue()).grant),approved(A));
});

test('sixteen invalid legacy rows do not block reissuance; sixteen effective grants and the one-second rate remain enforced',async()=>{
  for(let i=1;i<=16;i++)await seedGrant(sample(i));
  assert.equal(await total(),16);
  const fresh=await issue();assert.deepEqual(await inspect(fresh.grant),approved(A));
  assert.equal(await total(),17,'Legacy hashed metadata is retained only until its original expiry/retention');
  await assert.rejects(issue(),error=>error.code==='P0001');
  await owner("update public.lounge_session_grants set created_at=clock_timestamp()-interval '2 minutes' where requires_oauth is not null");
  for(let i=17;i<=31;i++)await seedGrant(sample(i),{marker:[true,false]});
  assert.equal(await total(),32);
  await assert.rejects(issue(),error=>error.code==='P0001');
  assert.deepEqual(await inspect((await issue(['otp'],{session_id:SA2})).grant),approved(A));
});

test('issuing JWT expiry and eight-hour ceiling are unchanged and checked on each inspection',async()=>{
  const expiry=Math.floor(Date.now()/1000)+120;
  const short=await issue(['oauth'],{exp:expiry});assert.equal(Date.parse(short.expiresAt)/1000,expiry);
  const before=Date.now(),long=await issue(['oauth'],{session_id:SA2,exp:Math.floor(Date.now()/1000)+86400});
  assert.ok(Date.parse(long.expiresAt)<=Date.now()+8*3600000 && Date.parse(long.expiresAt)>=before+8*3600000);
  await owner("update public.lounge_session_grants set created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' where token_hash=extensions.digest($1,'sha256')",[short.grant]);
  assert.deepEqual(await inspect(short.grant),denied());assert.deepEqual(await inspect(long.grant),approved(A));
});

test('session deletion cascades only that session; current ACCOUNT, policy and deletion admission remain authoritative',async()=>{
  const one=await issue(),other=await issue(['otp'],{session_id:SA2});
  await owner('delete from auth.sessions where id=$1',[SA]);
  assert.equal(await total(),1);assert.deepEqual(await inspect(one.grant),denied());
  assert.deepEqual(await inspect(other.grant),approved(A));
  await closeChannel('ACCOUNT');assert.equal((await inspect(other.grant)).eligible,false);
  await owner("update public.service_feature_controls set enabled=true where feature_key='ACCOUNT'");
  await owner("update public.lounge_admission_controls set privacy_policy_version='synthetic-changed-policy' where singleton");
  assert.equal((await inspect(other.grant)).eligible,false);
  await owner('update public.lounge_admission_controls set privacy_policy_version=$1 where singleton',[ORACLE_STORAGE_VERSION]);
  await owner('update public.user_private_profiles set deletion_requested_at=clock_timestamp(),delete_by=clock_timestamp() where user_id=$1',[A]);
  assert.equal((await inspect(other.grant)).eligible,false);
});

test('new columns do not broaden private-table/helper/function privileges or disable RLS',async()=>{
  assert.equal((await owner("select relrowsecurity enabled from pg_class where oid='public.lounge_session_grants'::regclass")).rows[0].enabled,true);
  for(const role of ['anon','authenticated','service_role']) {
    for(const [signature,allowed] of [['public.issue_lounge_grant()',role==='authenticated'],['public.inspect_lounge_grant(text)',role!=='service_role'],['public.lounge_session_admission(uuid,uuid,timestamptz)',false],['public.current_jwt_auth_method_allowed()',false]]) {
      assert.equal((await owner("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,signature])).rows[0].allowed,allowed);
    }
    for(const privilege of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await owner('select has_table_privilege($1,$2,$3) allowed',[role,'public.lounge_session_grants',privilege])).rows[0].allowed,false);
    await ownerExec(`set role ${role}`);
    await assert.rejects(db.query('select requires_oauth,requires_passwordless from public.lounge_session_grants'),error=>error.code==='42501');
  }
});

test('original OFF-state daily retention purges expired legacy and marked metadata and preserves response shape',async()=>{
  await seedGrant(sample(1),{expired:true});await seedGrant(sample(2),{marker:[true,false],expired:true});
  await seedGrant(sample(3));await seedGrant(sample(4),{marker:[false,true]});
  await owner('update public.lounge_admission_controls set enabled=false where singleton');
  await ownerExec('set role service_role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'service_role'})]);
  const rows=(await db.query('select * from public.purge_expired_beta_data()')).rows;
  assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]).sort(),['accounts_deleted','analytics_deleted']);
  assert.equal(await total(),2);
});

for(const [name,needle,replacement,prepare] of [
  ['OAuth revocation',"or (proof.requires_oauth and public.service_feature_enabled('AUTH_OAUTH') is distinct from true)",'or false',()=>closeChannel('AUTH_OAUTH')],
  ['password-free revocation',"and nullif(u.encrypted_password,'') is null",'and true',()=>owner("update auth.users set encrypted_password='synthetic-password-hash' where id=$1",[A])],
]) test(`defect injection: named ${name} failure is detected in actual inspection SQL and restored`,async t=>{
  const proof=await issue();assert.deepEqual(await inspect(proof.grant),approved(A));
  await prepare();assert.deepEqual(await inspect(proof.grant),denied());
  assert.equal(inspectDefinition.split(needle).length,2);
  try {
    await ownerExec(inspectDefinition.replace(needle,replacement));
    const mutated=await inspect(proof.grant);
    assert.deepEqual(mutated,approved(A),'Injected defect must actually restore prohibited authority');
    const failureName=`issued grant must fail ${name}`;
    assert.throws(()=>assert.deepEqual(mutated,denied(),failureName),error=>error.code==='ERR_ASSERTION' && error.message.includes(failureName));
    t.diagnostic(`Detected failing assertion by name: ${failureName}`);
  } finally { await ownerExec(inspectDefinition); }
  assert.deepEqual(await inspect(proof.grant),denied());
});

test('defect injection: named inside-lock authentication recheck failure is detected and real helpers restored',async t=>{
  const needle="if public.current_jwt_auth_method_allowed() is distinct from true then\n    raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE' using errcode = '42501';\n  end if;";
  assert.equal(issueDefinition.split(needle).length,2);
  await ownerExec(`create temporary sequence synthetic_lounge_auth_reads;
    alter function public.current_jwt_auth_method_allowed() rename to synthetic_original_lounge_auth_method;
    create function public.current_jwt_auth_method_allowed() returns boolean language plpgsql volatile security definer set search_path='' as $$begin
      return nextval('pg_temp.synthetic_lounge_auth_reads')=1 and public.synthetic_original_lounge_auth_method();end;$$;
    revoke all on function public.current_jwt_auth_method_allowed() from public,anon,authenticated,service_role;`);
  try {
    await ownerExec(admissionDefinition);
    await assert.rejects(issue(),error=>error.code==='42501');
    assert.equal(await total(),0,'Auth denial inside the issuance lock must persist no grant');
    await ownerExec('alter sequence pg_temp.synthetic_lounge_auth_reads restart with 1');
    await ownerExec(issueDefinition.replace(needle,'-- synthetic omitted authentication recheck'));
    const mutated=await issue();assert.match(mutated.grant,/^lg1_[0-9a-f]{64}$/u);
    const failureName='no grant may be persisted after authentication changes inside the issuance lock';
    const mutatedCount=await total();
    assert.throws(()=>assert.equal(mutatedCount,0,failureName),error=>error.code==='ERR_ASSERTION' && error.message.includes(failureName));
    assert.equal(mutatedCount,1,'Injected defect must actually persist an unauthorized grant');
    t.diagnostic(`Detected failing assertion by name: ${failureName}`);
  } finally {
    await ownerExec(`drop function public.current_jwt_auth_method_allowed();
      alter function public.synthetic_original_lounge_auth_method() rename to current_jwt_auth_method_allowed;
      drop sequence pg_temp.synthetic_lounge_auth_reads;`);
    await ownerExec(admissionDefinition);await ownerExec(issueDefinition);
    await ownerExec('delete from public.lounge_session_grants');
  }
  assert.deepEqual(await inspect((await issue()).grant),approved(A));
});

test('defect injection: named marker-less legacy denial is detected and actual inspector restored',async t=>{
  const legacy=sample(1);await seedGrant(legacy);
  assert.deepEqual(await inspect(legacy),denied());
  const needle='or proof.requires_oauth is null or proof.requires_passwordless is null\n    or not (proof.requires_oauth or proof.requires_passwordless)';
  assert.equal(inspectDefinition.split(needle).length,2);
  try {
    await ownerExec(inspectDefinition.replace(needle,''));
    const mutated=await inspect(legacy);
    assert.deepEqual(mutated,approved(A),'Injected defect must actually authorize marker-less legacy authority');
    const failureName='legacy capability without verified origin must be denied';
    assert.throws(()=>assert.deepEqual(mutated,denied(),failureName),error=>error.code==='ERR_ASSERTION' && error.message.includes(failureName));
    t.diagnostic(`Detected failing assertion by name: ${failureName}`);
  } finally { await ownerExec(inspectDefinition); }
  assert.deepEqual(await inspect(legacy),denied());
});
