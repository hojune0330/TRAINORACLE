import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Synthetic in-memory PostgreSQL only. No URL, credential, production service,
// or real account is read. Actual migrations provide the code under test.
const db = new PGlite({ extensions: { pgcrypto } });
const migrations = new URL('../../migrations/', import.meta.url);
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
const LEGAL = '2026-08-26';

async function asOwner(sql = 'select 1', params = []) {
  await db.exec('reset role');
  return db.query(sql, params);
}

async function asAuthenticated(userId = A) {
  await db.exec('reset role; set role authenticated');
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)",
    [userId, JSON.stringify({ sub: userId, role: 'authenticated' })],
  );
}

async function claim(expectedUserId = A, birthDate = '1990-01-01') {
  await asAuthenticated(A);
  return (await db.query(
    'select public.claim_beta_seat($1::uuid,$2::date,$3::text,$3::text) value',
    [expectedUserId, birthDate, LEGAL],
  )).rows[0].value;
}

async function admission(expectedUserId = A) {
  await asAuthenticated(A);
  return (await db.query(
    'select public.get_current_account_admission_status($1::uuid) value',
    [expectedUserId],
  )).rows[0].value;
}

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema extensions;
    create table auth.users(
      id uuid primary key,
      aud text,
      role text,
      email text,
      created_at timestamptz,
      updated_at timestamptz,
      email_confirmed_at timestamptz,
      deleted_at timestamptz,
      banned_until timestamptz,
      is_anonymous boolean default false
    );
    create table auth.sessions(
      id uuid primary key,
      user_id uuid references auth.users(id) on delete cascade,
      not_after timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
  `);
  for (const file of readdirSync(migrations)
    .filter(name => /^\d{4}_.+\.sql$/.test(name) && name < '0041')
    .sort()) {
    await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  await db.exec(readFileSync(new URL('0047_current_account_legal_versions.sql', migrations), 'utf8'));
  await db.exec(readFileSync(new URL('0051_current_account_admission.sql', migrations), 'utf8'));
  await db.query('insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp()),($2,clock_timestamp())', [A, B]);
}, { timeout: 60000 });

after(() => db.close());

test('ACCOUNT gate and caller identity fail closed before creating enrollment data', async () => {
  assert.equal(await admission(A), 'ACCOUNT_DISABLED');
  await asOwner("update public.service_feature_controls set enabled=true where feature_key='ACCOUNT'");
  assert.equal(await admission(A), 'NEEDS_PROFILE');
  assert.equal(await admission(B), 'IDENTITY_MISMATCH');
  assert.equal(await claim(B), 'IDENTITY_MISMATCH');
  assert.equal((await asOwner('select count(*)::int count from public.beta_enrollments')).rows[0].count, 0);
});

test('claim admits the verified caller and never overwrites an existing birth date', async () => {
  assert.equal(await claim(), 'ADMITTED_NEW');
  assert.equal(await admission(), 'ADMITTED');
  assert.equal(await claim(A, '1991-01-01'), 'BIRTH_DATE_MISMATCH');
  assert.equal(
    (await asOwner('select birth_date::text birth_date from public.user_private_profiles where user_id=$1', [A])).rows[0].birth_date,
    '1990-01-01',
  );
  assert.equal(await claim(), 'ADMITTED_EXISTING');
});

test('current legal consent and beta enrollment are checked by the read RPC', async () => {
  await asOwner(`update public.user_private_profiles
    set privacy_policy_version=null, terms_of_service_version=null, legal_consented_at=null
    where user_id=$1`, [A]);
  assert.equal(await admission(), 'LEGAL_RECONSENT_REQUIRED');
  assert.equal(await claim(), 'ADMITTED_EXISTING');

  await asOwner('delete from public.beta_enrollments where user_id=$1', [A]);
  assert.equal(await admission(), 'BETA_NOT_ENROLLED');
  assert.equal(await claim(), 'ADMITTED_NEW');
  assert.equal(await admission(), 'ADMITTED');
});

test('the exact KST under-14 boundary fails closed independent of database timezone', async () => {
  await asOwner('alter table public.user_private_profiles disable trigger user_private_profiles_under_14_gate');
  await asOwner(`update public.user_private_profiles
    set birth_date=(clock_timestamp() at time zone 'Asia/Seoul')::date-interval '13 years'
    where user_id=$1`, [A]);
  await asOwner('alter table public.user_private_profiles enable trigger user_private_profiles_under_14_gate');
  for (const zone of ['UTC', 'Pacific/Honolulu', 'Asia/Seoul']) {
    await asOwner(`set timezone='${zone}'`);
    assert.equal(await admission(), 'UNDER_14');
  }
  await asOwner(`update public.user_private_profiles
    set birth_date=(clock_timestamp() at time zone 'Asia/Seoul')::date-interval '14 years'
    where user_id=$1`, [A]);
  for (const zone of ['UTC', 'Pacific/Honolulu', 'Asia/Seoul']) {
    await asOwner(`set timezone='${zone}'`);
    assert.equal(await admission(), 'ADMITTED');
  }
  await asOwner("update public.user_private_profiles set birth_date='1990-01-01' where user_id=$1", [A]);
});

test('deletion requires the same expected user id in the writing transaction', async () => {
  await asAuthenticated(A);
  await assert.rejects(
    db.query('select public.request_account_deletion($1::uuid)', [B]),
    error => error.code === '42501',
  );
  assert.equal(
    (await asOwner('select count(*)::int count from public.account_deletion_requests')).rows[0].count,
    0,
  );
  await asAuthenticated(A);
  const result = await db.query('select public.request_account_deletion($1::uuid) value', [A]);
  assert.ok(result.rows[0].value);
  assert.equal(await admission(), 'DELETION_REQUESTED');
});

test('legacy deletion is closed and only authenticated callers execute new admission RPCs', async () => {
  await asAuthenticated(A);
  await assert.rejects(db.query('select public.request_account_deletion()'), error => error.code === '42501');
  assert.equal((await db.query('select public.claim_beta_seat($1::date) value', ['1990-01-01'])).rows[0].value, 'CLIENT_UPDATE_REQUIRED');
  assert.equal((await db.query(
    'select public.claim_beta_seat($1::date,$2::text,$2::text) value',
    ['1990-01-01', LEGAL],
  )).rows[0].value, 'CLIENT_UPDATE_REQUIRED');

  for (const role of ['anon', 'service_role']) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(
      db.query('select public.get_current_account_admission_status($1::uuid)', [A]),
      error => error.code === '42501',
    );
  }
  await asOwner();
  const functions = (await db.query(`select oid::regprocedure::text signature, prosecdef, proconfig
    from pg_proc where oid in (
      'public.get_current_account_admission_status(uuid)'::regprocedure,
      'public.claim_beta_seat(uuid,date,text,text)'::regprocedure,
      'public.request_account_deletion(uuid)'::regprocedure
    )`)).rows;
  assert.equal(functions.length, 3);
  for (const fn of functions) {
    assert.equal(fn.prosecdef, true, fn.signature);
    assert.ok(fn.proconfig.some(value => value === 'search_path=pg_catalog'), fn.signature);
  }
});
