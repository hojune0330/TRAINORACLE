import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Only an in-memory PostgreSQL instance. No URL, credentials, or production transport.
const db = new PGlite();
const migrations = new URL('../../migrations/', import.meta.url);
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
const fingerprint = `sha256:${'a'.repeat(64)}`;
const planId = `multi-v6:${fingerprint}`;
const envelope = () => ({ version: 6, selection: {}, progress: [], updatedAt: '2026-09-08T00:00:00.000Z', contentFingerprint: fingerprint });
const insert = (owner, payload = envelope(), id = planId, version = 6) => db.query(
  'insert into public.saved_training_plans(user_id,plan_id,schema_version,plan_payload) values($1,$2,$3,$4)',
  [owner, id, version, JSON.stringify(payload)],
);
async function login(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)",
    [id, JSON.stringify({ sub: id, role: 'authenticated' })]);
}
async function rejected(action, code) {
  await assert.rejects(action, error => error.code === code);
}

before(async () => {
  // Supabase-managed auth identities/JWT access are a synthetic boundary, not a login test.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema extensions;
    create table auth.users(id uuid primary key, aud text, role text, email text, created_at timestamptz, updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
  `);
  for (const file of readdirSync(migrations).filter(name => /^00\d\d_.+\.sql$/.test(name) && name < '0032').sort()) {
    await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  for (const id of [A, B]) {
    await db.query('insert into auth.users(id) values($1)', [id]);
    await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
      values($1,'1990-01-01','synthetic-v1','synthetic-v1',clock_timestamp())`, [id]);
    await db.query('insert into public.beta_enrollments(user_id) values($1)', [id]);
  }
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','PLAN_BACKUP');");
}, { timeout: 60000 });
after(async () => { await db.close(); });

test('0031 rejects V6; 0032 retains V3 and accepts only the V6 envelope', async () => {
  await login(A);
  await rejected(() => insert(A), '23514');
  await insert(A, { synthetic: true }, 'synthetic-v3-plan', 3);
  await db.exec('reset role;');
  await db.exec(readFileSync(new URL('0032_multi_adjusted_plan_snapshots.sql', migrations), 'utf8'));
  await login(A);
  await insert(A);
  const result = await db.query('select schema_version from public.saved_training_plans order by schema_version');
  assert.deepEqual(result.rows.map(row => row.schema_version), [3, 6]);
  const loaded = await db.query('select plan_payload from public.saved_training_plans where plan_id=$1', [planId]);
  assert.deepEqual(loaded.rows[0].plan_payload, envelope());
});

test('V6 rejects absent required keys, extra keys, wrong types and mismatched identity', async () => {
  await login(A);
  for (const key of Object.keys(envelope())) {
    const value = envelope(); delete value[key];
    await rejected(() => insert(A, value), '23514');
  }
  for (const patch of [{ memo: 'synthetic-forbidden' }, { selection: null }, { selection: [] }, { progress: {} },
    { contentFingerprint: null }, { contentFingerprint: 'bad' }, { version: 5 }]) {
    await rejected(() => insert(A, { ...envelope(), ...patch }), '23514');
  }
  await rejected(() => insert(A, envelope(), `multi-v6:sha256:${'b'.repeat(64)}`), '23514');
  await rejected(() => insert(A, envelope(), 'unsupported-version', 7), '23514');
});

test('B cannot read, update, delete, insert or upsert A plans; both own rows work', async () => {
  await login(B);
  assert.equal((await db.query('select * from public.saved_training_plans')).rows.length, 0);
  assert.equal((await db.query('update public.saved_training_plans set archived_at=now() where user_id=$1 returning plan_id', [A])).rows.length, 0);
  assert.equal((await db.query('delete from public.saved_training_plans where user_id=$1 returning plan_id', [A])).rows.length, 0);
  await rejected(() => insert(A), '42501');
  await rejected(() => db.query(`insert into public.saved_training_plans(user_id,plan_id,schema_version,plan_payload)
    values($1,$2,6,$3) on conflict(user_id,plan_id) do update set plan_payload=excluded.plan_payload`, [A, planId, JSON.stringify(envelope())]), '42501');
  await insert(B);
  assert.equal((await db.query('select * from public.saved_training_plans')).rows.length, 1);
  await login(A);
  assert.equal((await db.query('select * from public.saved_training_plans')).rows.length, 2);
  assert.equal((await db.query('select * from public.saved_training_plans where user_id=$1', [B])).rows.length, 0);
});

test('characterizes current DB limits: same-owner content mutation is not blocked by the envelope', async () => {
  await login(A);
  const changed = { ...envelope(), selection: { syntheticChanged: true } };
  await db.query('update public.saved_training_plans set plan_payload=$1 where plan_id=$2', [JSON.stringify(changed), planId]);
  assert.deepEqual((await db.query('select plan_payload from public.saved_training_plans where plan_id=$1', [planId])).rows[0].plan_payload, changed);
  await db.query(`insert into public.saved_training_plans(user_id,plan_id,schema_version,plan_payload)
    values($1,$2,6,$3) on conflict(user_id,plan_id) do update set plan_payload=excluded.plan_payload`, [A, planId, JSON.stringify(envelope())]);
  assert.deepEqual((await db.query('select plan_payload from public.saved_training_plans where plan_id=$1', [planId])).rows[0].plan_payload, envelope());
  // This documents a limitation, not an authorization to add such writes to the application.
});

test('client duplicate-ignore query preserves the old snapshot and archive filtering separates history', async () => {
  await login(A);
  await db.query(`insert into public.saved_training_plans(user_id,plan_id,schema_version,plan_payload)
    values($1,$2,6,$3) on conflict(user_id,plan_id) do nothing`, [A, planId, JSON.stringify({ ...envelope(), selection: { changed: true } })]);
  assert.deepEqual((await db.query('select plan_payload from public.saved_training_plans where plan_id=$1', [planId])).rows[0].plan_payload, envelope());
  await db.query('update public.saved_training_plans set archived_at=now() where plan_id=$1', [planId]);
  assert.equal((await db.query('select * from public.saved_training_plans where schema_version=6 and archived_at is null')).rows.length, 0);
  assert.equal((await db.query('select * from public.saved_training_plans where schema_version=6')).rows.length, 1);
});

test('anonymous role has no plan-table access', async () => {
  await db.exec('reset role; set role anon;');
  await rejected(() => db.query('select * from public.saved_training_plans'), '42501');
  await rejected(() => insert(A), '42501');
});

test('PLAN_BACKUP off blocks reads and writes without deleting stored plans', async () => {
  await db.exec("reset role; update public.service_feature_controls set enabled=false where feature_key='PLAN_BACKUP';");
  await login(A);
  assert.equal((await db.query('select * from public.saved_training_plans')).rows.length, 0);
  const nextFingerprint = `sha256:${'c'.repeat(64)}`;
  await assert.rejects(() => insert(A, { ...envelope(), contentFingerprint: nextFingerprint }, `multi-v6:${nextFingerprint}`),
    error => error.code === '42501' && error.message === 'SERVER_FEATURE_DISABLED_PLAN_BACKUP');
  await db.exec('reset role;');
  assert.equal((await db.query('select * from public.saved_training_plans')).rows.length, 3);
});
