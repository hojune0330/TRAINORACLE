import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Supabase-owned auth objects only. Product SQL is loaded unchanged, with no skipped migrations.
// This is a local complete-chain fixture, not the production deployment inventory.
export async function loadOracleMigrationChain(db) {
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
  const files=readdirSync(root).filter(name=>/^\d{4}_.+\.sql$/.test(name)&&name<'0061').sort();
  assert.deepEqual(files.map(file=>file.slice(0,4)),Array.from({length:60},(_,i)=>String(i+1).padStart(4,'0')),
    'Oracle fixture must execute every integrated migration from 0001 through 0060 exactly once');
  for(const file of files) {
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
