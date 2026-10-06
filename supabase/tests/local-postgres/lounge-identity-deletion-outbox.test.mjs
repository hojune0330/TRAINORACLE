import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Execute actual migration SQL in an isolated synthetic PostgreSQL engine.
// No production URL, personal records, credentials, sockets or TLS proof.
const db = new PGlite({ extensions: { pgcrypto } });
const migrations = new URL('../../migrations/', import.meta.url);
const A='a1111111-1111-4111-8111-111111111111', B='b2222222-2222-4222-8222-222222222222';
async function owner(sql='select 1', params=[]) { await db.exec('reset role'); return db.query(sql,params); }
async function role(name, actor=A, claimsRole=name) {
  await db.exec(`reset role;set role ${name}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [actor,
    JSON.stringify({ sub:actor, role:claimsRole, session_id:actor, exp:4102444800, amr:[{method:'password',timestamp:1790000000}] })]);
}
const deletion = async () => { await role('authenticated'); return db.query('select public.request_account_deletion($1::uuid) value',[A]); };
const claim = async () => { await role('service_role'); return (await db.query('select public.claim_lounge_identity_deletions(10) value')).rows[0].value; };

before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,encrypted_password text,created_at timestamptz,
      updated_at timestamptz,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  const files = readdirSync(migrations).filter(name => /^\d{4}_.+\.sql$/u.test(name) && Number(name.slice(0,4))<=63).sort();
  assert.equal(files.length,63);
  for (const file of files) {
    if (file.startsWith('0063_')) {
      await owner('insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())',[A]);
      await owner('insert into auth.sessions(id,user_id) values($1,$1)',[A]);
      await deletion();
      await db.exec('reset role');
    }
    await db.exec(readFileSync(new URL(file,migrations),'utf8'));
  }
  assert.equal((await owner('select count(*)::int n from public.lounge_identity_deletion_outbox')).rows[0].n,1,'Migration backfills existing deletion');
}, {timeout:60000});
beforeEach(async () => {
  await owner('truncate auth.users cascade');
  await owner('truncate public.lounge_identity_deletion_outbox');
  await owner('insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp()),($2,clock_timestamp())',[A,B]);
  await owner('insert into auth.sessions(id,user_id) values($1,$1),($2,$2)',[A,B]);
});
after(() => db.close());

test('deletion transaction atomically queues only minimum data and duplicate request reuses identity', async () => {
  await deletion();
  const first=(await owner('select * from public.lounge_identity_deletion_outbox')).rows[0];
  assert.equal(first.subject,A);assert.equal(first.status,'PENDING');assert.equal(first.lease_id,null);
  assert.deepEqual(Object.keys(first).sort(),['available_at','lease_id','lease_until','request_id','requested_at','status','subject']);
  await deletion();
  assert.equal((await owner('select request_id from public.lounge_identity_deletion_outbox')).rows[0].request_id,first.request_id);
  const ttl=(await owner('select extract(epoch from delete_by-requested_at)::int seconds from public.account_deletion_requests')).rows[0].seconds;
  assert.equal(ttl,0,'Current immediate-due account deletion is unchanged');
  const consent=(await owner('select revision,health_storage,journal_text_storage from public.account_storage_consents where user_id=$1',[A])).rows[0];
  assert.equal(Number(consent.revision),1,'Repeated deletion cannot renew withdrawn storage');
  assert.equal(consent.health_storage,false);assert.equal(consent.journal_text_storage,false);
});

test('wrong owner and revoked session cannot enqueue deletion', async () => {
  await role('authenticated');
  await assert.rejects(db.query('select public.request_account_deletion($1::uuid)',[B]),e=>e.code==='42501');
  await owner('delete from auth.sessions where user_id=$1',[A]);
  await role('authenticated');
  await assert.rejects(db.query('select public.request_account_deletion($1::uuid)',[A]),e=>e.code==='42501');
  assert.equal((await owner('select count(*)::int n from public.lounge_identity_deletion_outbox')).rows[0].n,0);
});

test('rollback preserves neither local deletion request nor orphan queue item', async () => {
  await role('authenticated');await db.exec('begin');
  await db.query('select public.request_account_deletion($1::uuid)',[A]);
  await db.exec('rollback');
  for (const table of ['account_deletion_requests','lounge_identity_deletion_outbox']) {
    assert.equal((await owner(`select count(*)::int n from public.${table}`)).rows[0].n,0);
  }
});

test('unacknowledged minimum queue survives the actual immediate-due account purge', async () => {
  await deletion();
  await role('service_role');
  const purge=(await db.query('select * from public.purge_expired_beta_data()')).rows[0];
  assert.equal(Number(purge.accounts_deleted),1);
  assert.equal((await owner('select count(*)::int n from auth.users where id=$1',[A])).rows[0].n,0);
  assert.equal((await claim()).length,1);
});

test('all direct table access is revoked; only service operator can call scoped RPCs', async () => {
  await deletion();
  for (const name of ['anon','authenticated','service_role']) {
    await role(name);
    await assert.rejects(db.query('select * from public.lounge_identity_deletion_outbox'),e=>e.code==='42501');
    if (name!=='service_role') await assert.rejects(db.query('select public.claim_lounge_identity_deletions(10)'),e=>e.code==='42501');
  }
  await role('service_role',A,'authenticated');
  await assert.rejects(db.query('select public.claim_lounge_identity_deletions(10)'),e=>e.code==='42501');
  await role('service_role');
  await assert.rejects(db.query('select public.claim_lounge_identity_deletions(11)'),e=>e.code==='22023');
});

test('lease prevents double claim and stale ACK cannot delete a renewed attempt', async () => {
  await deletion();
  const [first]=await claim();assert.equal((await claim()).length,0);
  await owner("update public.lounge_identity_deletion_outbox set lease_until=clock_timestamp()-interval '1 second'");
  const [second]=await claim();assert.equal(second.requestId,first.requestId);assert.notEqual(second.leaseId,first.leaseId);
  const complete=async row=>(await db.query('select public.complete_lounge_identity_deletion($1::uuid,$2::uuid) value',[row.requestId,row.leaseId])).rows[0].value;
  assert.equal(await complete(first),false);assert.equal(await complete(second),true);assert.equal(await complete(second),false);
  assert.equal((await claim()).length,0);
});

test('failed delivery uses bounded backoff while retaining the original remote request ID', async () => {
  await deletion();const [first]=await claim();
  assert.equal((await db.query('select public.retry_lounge_identity_deletion($1::uuid,$2::uuid) value',[first.requestId,first.leaseId])).rows[0].value,true);
  assert.equal((await claim()).length,0);
  await owner("update public.lounge_identity_deletion_outbox set available_at=clock_timestamp()-interval '1 second'");
  const [second]=await claim();assert.equal(second.requestId,first.requestId);assert.equal(second.subject,first.subject);
});
