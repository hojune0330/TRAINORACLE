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
const C = 'c3333333-3333-4333-8333-333333333333';
const D = 'd4444444-4444-4444-8444-444444444444';
const E = 'e5555555-5555-4555-8555-555555555555';
const F = 'f6666666-6666-4666-8666-666666666666';
const G = 'a7777777-7777-4777-8777-777777777777';
const H = 'b8888888-8888-4888-8888-888888888888';
const S1 = 'c9999999-9999-4999-8999-999999999999';
const S2 = 'd0000000-0000-4000-8000-000000000000';
const LEGAL = '2026-08-26';

const amr = (...methods) => methods.map((method, index) => ({
  method,
  timestamp: 1_790_000_000 + index,
}));

async function asOwner(sql = 'select 1', params = []) {
  await db.exec('reset role');
  return db.query(sql, params);
}

async function asAuthenticated(userId, methods, { ensureSession = true, sessionId = userId } = {}) {
  await db.exec('reset role');
  const claims = { sub: userId, role: 'authenticated', session_id: sessionId, exp: 4_102_444_800 };
  if (methods !== undefined) claims.amr = methods;
  if (ensureSession) {
    await db.query(
      `insert into auth.sessions(id,user_id,not_after) values($1,$2,null)
       on conflict (id) do update set user_id=excluded.user_id,not_after=null`,
      [sessionId, userId],
    );
  }
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)",
    [userId, JSON.stringify(claims)],
  );
  await db.exec('set role authenticated');
}

async function claim(userId, methods, options) {
  await asAuthenticated(userId, methods, options);
  const expectedSessionId = options?.expectedSessionId ?? options?.sessionId ?? userId;
  return (await db.query(
    'select public.claim_beta_seat($1::uuid,$2::uuid,$3::date,$4::text,$4::text) value',
    [userId, expectedSessionId, '1990-01-01', LEGAL],
  )).rows[0].value;
}

async function admission(userId, methods, options) {
  await asAuthenticated(userId, methods, options);
  return (await db.query(
    'select public.get_current_account_admission_status($1::uuid) value',
    [userId],
  )).rows[0].value;
}

async function networkAllowed(userId, methods, options) {
  await asAuthenticated(userId, methods, options);
  return (await db.query(
    'select public.account_network_access_allowed($1::uuid) value',
    [userId],
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
      encrypted_password text,
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
  for (const file of [
    '0041_lounge_admission.sql',
    '0042_lounge_scoped_grants.sql',
    '0047_current_account_legal_versions.sql',
    '0051_current_account_admission.sql',
    '0053_supported_auth_method_gate.sql',
    '0054_public_profile_admission_policies.sql',
    '0055_session_bound_account_admission.sql',
    '0056_remaining_auth_surface_gates.sql',
  ]) {
    await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  await db.query(
    `insert into auth.users(id,email_confirmed_at)
     select value::uuid,clock_timestamp()
     from unnest($1::text[]) value`,
    [[A, B, C, D, E, F, G, H]],
  );
  await asOwner("update public.service_feature_controls set enabled=true where feature_key='ACCOUNT'");
}, { timeout: 60000 });

after(() => db.close());

test('password and mixed password authentication are denied without enrollment, while deletion stays reachable', async () => {
  assert.equal(await claim(A, amr('password')), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await admission(A, amr('password')), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await networkAllowed(A, amr('password')), false);
  assert.equal(await claim(A, amr('oauth', 'password')), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(
    (await asOwner('select count(*)::int count from public.beta_enrollments where user_id=$1', [A])).rows[0].count,
    0,
  );
  assert.equal(
    (await asOwner('select count(*)::int count from public.user_private_profiles where user_id=$1', [A])).rows[0].count,
    0,
  );

  await asAuthenticated(A, amr('password'));
  const deletion = await db.query('select public.request_account_deletion($1::uuid) value', [A]);
  assert.ok(deletion.rows[0].value);
  assert.equal(
    (await asOwner('select count(*)::int count from public.account_deletion_requests where user_id=$1', [A])).rows[0].count,
    1,
  );
});

test('missing and malformed AMR fail closed without enrollment', async () => {
  assert.equal(await claim(B, undefined), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await claim(B, { method: 'otp', timestamp: 1_790_000_000 }), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await claim(B, [{ method: 'otp' }]), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await admission(B, []), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(
    (await asOwner('select count(*)::int count from public.beta_enrollments where user_id=$1', [B])).rows[0].count,
    0,
  );
});

test('server auth-channel controls start closed and block direct public Auth API sessions', async () => {
  assert.equal(await claim(C, amr('otp')), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await claim(D, amr('oauth')), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await networkAllowed(C, amr('otp')), false);
  await asOwner(
    "update public.service_feature_controls set enabled=true where feature_key in ('AUTH_OAUTH','AUTH_PASSWORDLESS')",
  );
});

test('email signup AMR is allowed only when the auth identity has no password credential', async () => {
  await asOwner("update auth.users set encrypted_password='$2a$synthetic-password-hash' where id=$1", [B]);
  assert.equal(await claim(B, amr('email/signup')), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await admission(B, amr('email/signup')), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await networkAllowed(B, amr('email/signup')), false);
  assert.equal(
    (await asOwner('select count(*)::int count from public.beta_enrollments where user_id=$1', [B])).rows[0].count,
    0,
  );

  await asOwner("update auth.users set encrypted_password='' where id=$1", [B]);
  assert.equal(await claim(B, amr('email/signup')), 'ADMITTED_NEW');
  assert.equal(await admission(B, amr('email/signup')), 'ADMITTED');
});

test('OTP and OAuth sessions can enroll and retain network access', async () => {
  assert.equal(await claim(C, amr('otp')), 'ADMITTED_NEW');
  assert.equal(await admission(C, amr('otp')), 'ADMITTED');
  assert.equal(await networkAllowed(C, amr('otp')), true);

  assert.equal(await claim(D, amr('oauth')), 'ADMITTED_NEW');
  assert.equal(await admission(D, amr('oauth')), 'ADMITTED');
  assert.equal(await networkAllowed(D, amr('oauth')), true);

  assert.equal(await admission(C, amr('password')), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await networkAllowed(C, amr('password')), false);
});

test('closing an auth channel immediately removes account network access for existing sessions', async () => {
  assert.equal(await admission(C, amr('otp')), 'ADMITTED');
  assert.equal(await admission(D, amr('oauth')), 'ADMITTED');
  await asOwner("update public.service_feature_controls set enabled=false where feature_key='AUTH_OAUTH'");
  assert.equal(await admission(D, amr('oauth')), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await networkAllowed(D, amr('oauth')), false);
  assert.equal(await networkAllowed(C, amr('otp')), true);
  await asOwner("update public.service_feature_controls set enabled=true where feature_key='AUTH_OAUTH'");
});

test('a refreshed supported session keeps access but token_refresh alone does not authorize', async () => {
  const refreshedMagicLink = amr('magiclink', 'token_refresh');
  assert.equal(await claim(E, refreshedMagicLink), 'ADMITTED_NEW');
  assert.equal(await admission(E, refreshedMagicLink), 'ADMITTED');
  assert.equal(await networkAllowed(E, refreshedMagicLink), true);

  assert.equal(await claim(F, amr('token_refresh')), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(
    (await asOwner('select count(*)::int count from public.beta_enrollments where user_id=$1', [F])).rows[0].count,
    0,
  );
});

test('account admission is bound to the exact verified session and remains valid after token refresh', async () => {
  assert.equal(await claim(G, amr('otp'), { sessionId: S1 }), 'ADMITTED_NEW');
  assert.equal(
    await claim(G, amr('otp', 'token_refresh'), { sessionId: S1, expectedSessionId: S1 }),
    'ADMITTED_EXISTING',
  );

  assert.equal(
    await claim(H, amr('oauth'), { sessionId: S2, expectedSessionId: S1 }),
    'SESSION_MISMATCH',
  );
  assert.equal(
    (await asOwner('select count(*)::int count from public.beta_enrollments where user_id=$1', [H])).rows[0].count,
    0,
  );
  assert.equal(
    (await asOwner('select count(*)::int count from public.user_private_profiles where user_id=$1', [H])).rows[0].count,
    0,
  );
});

test('legacy account-admission overload cannot write around session binding', async () => {
  await asAuthenticated(H, amr('oauth'), { sessionId: S2 });
  const result = await db.query(
    'select public.claim_beta_seat($1::uuid,$2::date,$3::text,$3::text) value',
    [H, '1990-01-01', LEGAL],
  );
  assert.equal(result.rows[0].value, 'CLIENT_UPDATE_REQUIRED');
  assert.equal(
    (await asOwner('select count(*)::int count from public.beta_enrollments where user_id=$1', [H])).rows[0].count,
    0,
  );
  assert.equal(
    (await asOwner('select count(*)::int count from public.user_private_profiles where user_id=$1', [H])).rows[0].count,
    0,
  );
});

test('removing the server session immediately blocks data access and the destructive deletion RPC', async () => {
  assert.equal(await claim(F, amr('otp')), 'ADMITTED_NEW');
  await asOwner('delete from auth.sessions where id=$1', [F]);
  assert.equal(await admission(F, amr('otp'), { ensureSession: false }), 'AUTH_METHOD_UNSUPPORTED');
  assert.equal(await networkAllowed(F, amr('otp'), { ensureSession: false }), false);
  await asAuthenticated(F, amr('otp'));
  await asOwner('delete from auth.sessions where id=$1', [F]);
  await db.exec('set role authenticated');
  await assert.rejects(
    db.query('select public.request_account_deletion($1::uuid)', [F]),
    error => error.code === '42501',
  );
});

test('lounge admission rejects an unsupported auth method before issuing any grant', async () => {
  await asOwner(
    `update public.lounge_admission_controls
     set enabled=true, privacy_policy_version=$1, terms_of_service_version=$1
     where singleton`,
    [LEGAL],
  );

  await asAuthenticated(C, amr('otp'));
  const allowed = (await db.query('select public.get_lounge_admission() value')).rows[0].value;
  assert.equal(allowed.eligible, true);
  assert.equal(allowed.subject, C);

  await asAuthenticated(C, amr('password'));
  const denied = (await db.query('select public.get_lounge_admission() value')).rows[0].value;
  assert.equal(denied.eligible, false);
  assert.equal(denied.subject, null);
});

test('guardian authority cannot be probed through a direct authenticated RPC call', async () => {
  await asAuthenticated(C, amr('otp'));
  await assert.rejects(
    db.query("select public.guardian_authority_allowed($1::uuid,'ACCOUNT_SYNC',null) value", [C]),
    error => error.code === '42501',
  );
});

async function seedPublicProfileRows(userId, suffix) {
  await asOwner(
    `insert into public.public_athlete_profiles(user_id,handle,display_name,is_public)
     values($1,$2,$3,true)`,
    [userId, `runner_${suffix}`, `Runner ${suffix}`],
  );
  await asOwner(
    `insert into public.public_plan_share_cards(user_id,plan_id,share_slug,card_payload,is_public)
     values($1,$2,$3,'{}'::jsonb,true)`,
    [userId, `plan-${suffix}-1234567890123456`, `share${suffix}1234567890`],
  );
  await asOwner(
    `insert into public.public_oracle_comparison_snapshots(user_id,snapshot_payload,is_enabled)
     values($1,$2::jsonb,true)`,
    [userId, JSON.stringify({
      schemaVersion: 1,
      sharedFields: ['BEST_RECORD'],
      record: { eventDistanceM: 5000, bestSeconds: 1200 },
      recent8WeekDistanceKm: null,
      structuredSessionCount: null,
      energySessionCounts: [],
    })],
  );
}

async function visiblePublicRowCounts(userId) {
  const [profile, card, comparison] = await Promise.all([
    db.query('select count(*)::int count from public.public_athlete_profiles where user_id=$1', [userId]),
    db.query('select count(*)::int count from public.public_plan_share_cards where user_id=$1', [userId]),
    db.query('select count(*)::int count from public.public_oracle_comparison_snapshots where user_id=$1', [userId]),
  ]);
  return [profile.rows[0].count, card.rows[0].count, comparison.rows[0].count];
}

async function visiblePrivateProfileCount(userId) {
  return (await db.query(
    'select count(*)::int count from public.user_private_profiles where user_id=$1',
    [userId],
  )).rows[0].count;
}

async function asAnon() {
  await db.exec('reset role');
  await db.query(
    "select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claims','{}',false)",
  );
  await db.exec('set role anon');
}

test('public-profile lifecycle helper closes with the public-profile feature gate', async () => {
  await asOwner("update public.service_feature_controls set enabled=true where feature_key='PUBLIC_PROFILE'");
  await seedPublicProfileRows(C, 'c');
  await asOwner("update public.service_feature_controls set enabled=false where feature_key='PUBLIC_PROFILE'");
  await asAnon();
  assert.equal(
    (await db.query('select public.account_subject_public_data_allowed($1::uuid) value', [C])).rows[0].value,
    false,
  );
});

test('public-profile owner reads require a live supported admitted session', async () => {
  // Hosted Supabase may provide table defaults beyond this minimal PGlite role
  // scaffold. Grant SELECT here so the test exercises RLS rather than ACLs.
  await asOwner('grant select on table public.user_private_profiles to authenticated');
  await asOwner("update public.service_feature_controls set enabled=true where feature_key='PUBLIC_PROFILE'");
  await asOwner('update public.public_athlete_profiles set is_public=false where user_id=$1', [C]);
  await asOwner('update public.public_plan_share_cards set is_public=false where user_id=$1', [C]);
  await asOwner('update public.public_oracle_comparison_snapshots set is_enabled=false where user_id=$1', [C]);

  await asAuthenticated(C, amr('otp'));
  assert.deepEqual(await visiblePublicRowCounts(C), [1, 1, 1]);
  assert.equal(await visiblePrivateProfileCount(C), 1);

  await asAuthenticated(C, amr('password'));
  assert.deepEqual(await visiblePublicRowCounts(C), [0, 0, 0]);
  assert.equal(await visiblePrivateProfileCount(C), 0);

  await asAuthenticated(C, amr('otp'));
  await asOwner('delete from auth.sessions where id=$1', [C]);
  await db.exec('set role authenticated');
  assert.deepEqual(await visiblePublicRowCounts(C), [0, 0, 0]);
  assert.equal(await visiblePrivateProfileCount(C), 0);

  await asAuthenticated(C, amr('otp'));
  await asOwner("update public.service_feature_controls set enabled=false where feature_key='ACCOUNT'");
  await db.exec('set role authenticated');
  assert.deepEqual(await visiblePublicRowCounts(C), [0, 0, 0]);
  assert.equal(await visiblePrivateProfileCount(C), 0);
  await asOwner("update public.service_feature_controls set enabled=true where feature_key='ACCOUNT'");
});

test('anonymous public reads close immediately for under-14 and deleted subjects', async () => {
  await asOwner('update public.public_athlete_profiles set is_public=true where user_id=$1', [C]);
  await asOwner('update public.public_plan_share_cards set is_public=true where user_id=$1', [C]);
  await asOwner('update public.public_oracle_comparison_snapshots set is_enabled=true where user_id=$1', [C]);
  await asAnon();
  assert.deepEqual(await visiblePublicRowCounts(C), [1, 1, 1]);

  // Rehearse a retained legacy row. Current writes are separately blocked by
  // the under-14 trigger, but read policies must still fail closed for rows
  // that predate that trigger or were restored administratively.
  await asOwner('alter table public.user_private_profiles disable trigger user_private_profiles_under_14_gate');
  await asOwner("update public.user_private_profiles set birth_date=current_date - interval '10 years' where user_id=$1", [C]);
  await asOwner('alter table public.user_private_profiles enable trigger user_private_profiles_under_14_gate');
  await asAnon();
  assert.deepEqual(await visiblePublicRowCounts(C), [0, 0, 0]);

  await asOwner(
    `update public.user_private_profiles
     set birth_date='1990-01-01', privacy_policy_version=$2, terms_of_service_version=$2,
         legal_consented_at=clock_timestamp(), deletion_requested_at=null, delete_by=null
     where user_id=$1`,
    [C, LEGAL],
  );
  await asOwner(
    `insert into public.account_deletion_requests(user_id,requested_at,access_blocked_at,delete_by)
     values($1,clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '30 days')`,
    [C],
  );
  await asAnon();
  assert.deepEqual(await visiblePublicRowCounts(C), [0, 0, 0]);
});

test('public account-lifecycle helper does not expose private-profile state for a non-public subject', async () => {
  await asOwner('update public.public_athlete_profiles set is_public=false where user_id=$1', [C]);
  await asAnon();
  assert.equal(
    (await db.query('select public.account_subject_public_data_allowed($1::uuid) value', [C])).rows[0].value,
    false,
  );
});
