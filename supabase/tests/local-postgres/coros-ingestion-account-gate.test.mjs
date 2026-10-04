import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Synthetic, in-memory PostgreSQL only. Provider and account identifiers are
// fixtures; this test reads no credential, real activity, URL, or live service.
const db = new PGlite({ extensions: { pgcrypto } });
const migrations = new URL('../../migrations/', import.meta.url);
const A = 'a1111111-1111-4111-8111-111111111111';
const CONNECTION = 'c3333333-3333-4333-8333-333333333333';
const PROVIDER_USER = 'coros-synthetic-user';
const LEGAL = '2026-08-26';

function activity(providerRecordId) {
  return {
    providerUserId: PROVIDER_USER,
    providerRecordId,
    activityStart: '2026-10-03T00:00:00.000Z',
    sportCode: 'RUN',
    distanceMeters: 5000,
    durationSeconds: 1200,
    deviceName: 'SYNTHETIC COROS',
    payloadDigest: 'a'.repeat(64),
  };
}

async function admin(sql = 'select 1', params = []) {
  await db.exec('reset role');
  return db.query(sql, params);
}

async function ingest(providerRecordId) {
  await db.exec('reset role; set role service_role');
  return (await db.query(
    'select public.ingest_coros_activity_batch($1::jsonb) result',
    [JSON.stringify([activity(providerRecordId)])],
  )).rows[0].result;
}

async function resetAdmission() {
  await admin('delete from public.external_activity_inbox');
  await admin('delete from public.account_deletion_requests');
  await admin(`update public.user_private_profiles
    set birth_date='1990-01-01', deletion_requested_at=null,
      privacy_policy_version=$2, terms_of_service_version=$2,
      legal_consented_at=clock_timestamp()
    where user_id=$1`, [A, LEGAL]);
  await admin(`insert into public.beta_enrollments(user_id) values($1)
    on conflict (user_id) do nothing`, [A]);
  await admin(`update public.service_feature_controls set enabled=true
    where feature_key in ('ACCOUNT','DEVICE_INTEGRATION')`);
  await admin(`update public.external_provider_connections
    set connection_status='ACTIVE', revoked_at=null where id=$1`, [CONNECTION]);
}

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table public.service_feature_controls(
      feature_key text primary key,
      enabled boolean not null default false,
      change_reason text not null default 'SYNTHETIC_TEST',
      constraint service_feature_controls_feature_key_check
        check (feature_key in ('ACCOUNT'))
    );
    create table public.service_feature_control_events(
      feature_key text not null,
      constraint service_feature_control_events_feature_key_check
        check (feature_key in ('ACCOUNT'))
    );
    create function public.service_feature_enabled(feature_key_input text)
    returns boolean
    language sql
    stable
    security definer
    set search_path = pg_catalog
    as $$
      select coalesce((
        select control.enabled
        from public.service_feature_controls control
        where control.feature_key = feature_key_input
      ), false)
    $$;
  `);

  // Apply the original provider schema first, then prove that 0052 replaces
  // its RPC without changing the service-role entry point.
  await db.exec(readFileSync(new URL('0030_device_integration_readiness.sql', migrations), 'utf8'));
  await db.exec(`
    create table public.user_private_profiles(
      user_id uuid primary key references auth.users(id) on delete cascade,
      birth_date date not null,
      deletion_requested_at timestamptz,
      privacy_policy_version text,
      terms_of_service_version text,
      legal_consented_at timestamptz
    );
    create table public.beta_enrollments(
      user_id uuid primary key references auth.users(id) on delete cascade
    );
    create table public.account_deletion_requests(
      user_id uuid primary key references auth.users(id) on delete cascade,
      requested_at timestamptz not null default clock_timestamp()
    );
  `);
  await db.exec(readFileSync(new URL('0052_coros_ingestion_account_gate.sql', migrations), 'utf8'));

  await db.query('insert into auth.users(id) values($1)', [A]);
  await db.query(`insert into public.service_feature_controls(feature_key,enabled,change_reason)
    values('ACCOUNT',true,'SYNTHETIC_TEST')`);
  await db.query(`insert into public.user_private_profiles(
    user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at
  ) values($1,'1990-01-01',$2,$2,clock_timestamp())`, [A, LEGAL]);
  await db.query('insert into public.beta_enrollments(user_id) values($1)', [A]);
  await db.query(`insert into public.external_provider_connections(
    id,user_id,provider,provider_user_id,connection_status,scopes,consent_version
  ) values($1,$2,'COROS',$3,'ACTIVE',array[]::text[],'synthetic-v1')`,
  [CONNECTION, A, PROVIDER_USER]);
}, { timeout: 60000 });

beforeEach(resetAdmission);
after(() => db.close());

test('service_role accepts an active link only for a currently admitted account', async () => {
  const accepted = await ingest('accepted-001');
  assert.deepEqual(accepted, { accepted: 1, duplicates: 0, rejected: 0 });
  assert.deepEqual(await ingest('accepted-001'), { accepted: 0, duplicates: 1, rejected: 0 });
  assert.equal(
    (await admin('select count(*)::int count from public.external_activity_inbox where user_id=$1', [A])).rows[0].count,
    1,
  );

  await db.exec('reset role; set role authenticated');
  await assert.rejects(
    db.query('select public.ingest_coros_activity_batch($1::jsonb)', [JSON.stringify([activity('denied-client')])]),
    error => error.code === '42501',
  );
});

test('ACCOUNT off rejects the provider batch before storing an active-link activity', async () => {
  await admin("update public.service_feature_controls set enabled=false where feature_key='ACCOUNT'");
  await assert.rejects(
    ingest('account-off'),
    error => error.code === 'P0001' && /ACCOUNT_DISABLED/u.test(error.message),
  );
  assert.equal((await admin('select count(*)::int count from public.external_activity_inbox')).rows[0].count, 0);
});

test('a deletion request rejects an activity even while the COROS link remains active', async () => {
  await admin('insert into public.account_deletion_requests(user_id) values($1)', [A]);
  assert.deepEqual(await ingest('deletion-requested'), { accepted: 0, duplicates: 0, rejected: 1 });
  assert.equal((await admin('select count(*)::int count from public.external_activity_inbox')).rows[0].count, 0);
});

test('under-14, stale-legal, profile-deletion, and non-enrolled accounts all fail closed', async () => {
  const blockedStates = [
    async () => admin(`update public.user_private_profiles
      set birth_date=(clock_timestamp() at time zone 'Asia/Seoul')::date-interval '13 years'
      where user_id=$1`, [A]),
    async () => admin(`update public.user_private_profiles
      set privacy_policy_version='stale',terms_of_service_version='stale'
      where user_id=$1`, [A]),
    async () => admin(`update public.user_private_profiles
      set legal_consented_at=clock_timestamp()+interval '1 day'
      where user_id=$1`, [A]),
    async () => admin(`update public.user_private_profiles
      set deletion_requested_at=clock_timestamp()
      where user_id=$1`, [A]),
    async () => admin('delete from public.beta_enrollments where user_id=$1', [A]),
  ];

  for (const [index, blockAccount] of blockedStates.entries()) {
    await resetAdmission();
    await blockAccount();
    assert.deepEqual(
      await ingest(`blocked-${index}`),
      { accepted: 0, duplicates: 0, rejected: 1 },
      `blocked admission variant ${index}`,
    );
    assert.equal(
      (await admin('select count(*)::int count from public.external_activity_inbox')).rows[0].count,
      0,
      `blocked admission variant ${index}`,
    );
  }
});
