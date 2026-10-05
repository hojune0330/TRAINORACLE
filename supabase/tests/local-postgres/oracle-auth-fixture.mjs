import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

export const ORACLE_STORAGE_VERSION='2026-10-05';

// Supabase-owned auth objects only. Product SQL is loaded unchanged, with no skipped migrations.
// This is a local complete-chain fixture, not the production deployment inventory.
export async function loadOracleMigrationChain(db,{beforeStorageConsentMigration}={}) {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,encrypted_password text,
      created_at timestamptz,updated_at timestamptz,email_confirmed_at timestamptz,deleted_at timestamptz,
      banned_until timestamptz,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  const root=new URL('../../migrations/',import.meta.url);
  const files=readdirSync(root).filter(name=>/^\d{4}_.+\.sql$/.test(name)&&name<'0062').sort();
  assert.deepEqual(files.map(file=>file.slice(0,4)),Array.from({length:61},(_,i)=>String(i+1).padStart(4,'0')),
    'Oracle fixture must execute every integrated migration from 0001 through 0061 exactly once');
  for(const file of files) {
    if(file==='0057_purpose_scoped_storage_consent.sql' && beforeStorageConsentMigration) {
      await beforeStorageConsentMigration(db);
    }
    try { await db.exec(readFileSync(new URL(file,root),'utf8')); }
    catch(error) { throw new Error(`Local migration failed: ${file}`,{cause:error}); }
  }
}

export async function setOracleAuth(db,ownerId,sessionId,patch={}) {
  const now=Math.floor(Date.now()/1000);
  await db.exec('reset role;set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [ownerId,JSON.stringify({sub:ownerId,role:'authenticated',session_id:sessionId,exp:now+3600,
      amr:[{method:'oauth',timestamp:now}],...patch})]);
}

// Synthetic review evidence exists only in the disposable PGlite test database.
export async function approveSyntheticOracleStorage(db) {
  await db.exec('reset role');
  assert.equal((await db.query('select public.account_storage_operations_ready() ready')).rows[0].ready,false);
  await db.query(`insert into public.account_storage_operation_reviews
    (purpose_version,evidence_reference,reviewed_at,approved) values($1,'SYNTHETIC_LOCAL_PGLITE_ONLY_NOT_PRODUCTION_EVIDENCE',clock_timestamp(),true)`,[ORACLE_STORAGE_VERSION]);
}

export async function admitOracleStorage(db,ownerId,sessionId) {
  await setOracleAuth(db,ownerId,sessionId);
  assert.equal((await db.query('select public.claim_beta_seat($1,$2,$3::date,$4,$4) result',
    [ownerId,sessionId,'1990-01-01',ORACLE_STORAGE_VERSION])).rows[0].result,'ADMITTED_NEW');
  const before=(await db.query('select public.get_account_storage_consent($1) consent',[ownerId])).rows[0].consent;
  assert.equal(before.revision,0);
  assert.equal(before.healthStorage,false);
  assert.equal(before.journalTextStorage,false);
  assert.equal((await db.query('select public.account_network_access_allowed($1) allowed',[ownerId])).rows[0].allowed,false);
  const saved=(await db.query('select public.set_account_storage_consent($1,$2,0,$3,true,true) consent',
    [ownerId,sessionId,ORACLE_STORAGE_VERSION])).rows[0].consent;
  assert.equal(saved.healthStorage,true);
  assert.equal(saved.journalTextStorage,true);
  assert.equal(saved.revision,1);
}
