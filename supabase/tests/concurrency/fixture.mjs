import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash, createHmac, createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { literal } from './local-postgres.mjs';

// Same bootstrap and synthetic envelope protocol as local-postgres/account-plan-collection.test.mjs.
// Do not import that test module: it creates a single-session PGlite and registers tests.
export const A = 'a1111111-1111-4111-8111-111111111111';
export const B = 'b2222222-2222-4222-8222-222222222222';
const signingKey = Buffer.alloc(32, 71);
const encryptionKey = Buffer.alloc(32, 83);
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
export const hash = (value, scope = 'trainoracle.account-plan.v1') =>
  `sha256:${createHash('sha256').update(`${scope}\0${canonical(value)}`).digest('hex')}`;
const partHash = value => hash(value, 'trainoracle.account-plan-collection.v1');
export function legacyId(owner = A) {
  const bytes = createHash('sha256').update(JSON.stringify(['trainoracle.account.plan.v1', owner])).digest();
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = bytes.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function encrypt(value, owner = A) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  cipher.setAAD(Buffer.from(`synthetic-plan-fixture:${owner}`));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return { version: 1, algorithm: 'AES-GCM', keyId: 'disposable-fixture', iv: iv.toString('base64'), ciphertext: bytes.toString('base64') };
}
export function plan(seed, owner = A) {
  const planId = hash({ synthetic: seed }), snapshotId = partHash({ kind: 'PLAN_SNAPSHOT', planId });
  const snapshot = { version: 1, kind: 'PLAN_SNAPSHOT', id: snapshotId, planId, snapshot: { synthetic: seed } };
  const updatedAt = '2026-01-01T00:00:00.000Z', archivedAt = null;
  const revision = { version: 1, kind: 'PLAN_PROGRESS', planId, snapshotId, progress: [], updatedAt, archivedAt };
  const progress = { ...revision, id: partHash(revision) };
  const stage = part => ({ partId: part.id, partKind: part.kind, planId, contentHash: partHash(part), payload: encrypt(part, owner),
    metadata: part.kind === 'PLAN_SNAPSHOT' ? { snapshotId: null, updatedAt: null, archivedAt: null } : { snapshotId, updatedAt, archivedAt } });
  return { planId, snapshot: stage(snapshot), progress: stage(progress),
    ref: { planId, snapshotId, snapshotHash: partHash(snapshot), progressId: progress.id, progressHash: partHash(progress) } };
}
export const index = (plans = [], currentPlanId = null) => ({ version: 1, kind: 'PLAN_COLLECTION',
  documentFingerprint: partHash({ synthetic: plans.map(p => p.ref), currentPlanId }), currentPlanId, plans: plans.map(p => p.ref) });
export function commit(idx, previous = null, overrides = {}) {
  const request = { ownerId: A, operationId: randomUUID(), expectedRevision: previous?.revision ?? 0,
    previousIndexFingerprint: previous?.index_fingerprint ?? null,
    previousCurrentPlanId: previous?.index_document.currentPlanId ?? null, index: idx, legacy: null, ...overrides };
  const { ownerId, ...body } = request;
  return { ...body, indexFingerprint: hash(idx), requestFingerprint: hash(request), payload: encrypt(idx, ownerId) };
}
export function signed(action, body, owner = A) {
  const request = JSON.stringify({ domain: 'trainoracle.account-journal.gateway.v1', ownerId: owner,
    action, expiresAt: Math.floor(Date.now() / 1000) + 110, ...body });
  return [request, createHmac('sha256', signingKey).update(request).digest('hex'), 'fixture'];
}
export function oldWrite(expectedRevision = 0, owner = A) {
  return signed('commit', { documentId: legacyId(owner), operationId: randomUUID(), expectedRevision,
    encryptedPayload: encrypt({ synthetic: 'old-plan' }, owner),
    metadata: { kind: 'PLAN', occurrenceId: null, journalDate: null, eligible: false } }, owner);
}
export async function login(session, owner = A) {
  await session.query(`reset role; set role authenticated;
    set request.jwt.claim.sub = ${literal(owner)};
    set request.jwt.claims = ${literal(JSON.stringify({ sub: owner, role: 'authenticated' }))};`);
}
export const rpc = (session, name, args = []) => session.value(`public.${name}(${args.map(literal).join(',')})`);
export const submit = (session, args, legacy = false) => session.value(
  `pg_temp.fixture_submit(${legacy},${args.map(literal).join(',')})`);
export const mutate = (session, action, body, owner = A) => submit(session, signed(action, body, owner));
export async function stage(session, p, owner = A) {
  assert.equal((await mutate(session, 'planStage', p.snapshot, owner)).kind, 'staged');
  assert.equal((await mutate(session, 'planStage', p.progress, owner)).kind, 'staged');
}
export const readIndex = session => rpc(session, 'read_account_plan_collection_index');
export const readReceipt = (session, op) => rpc(session, 'read_account_plan_collection_receipt', [op]);
export const readPart = (session, p) => rpc(session, 'read_account_plan_collection_part', [p.partKind, p.partId]);

export async function prepareSession(session) {
  await session.query(`set statement_timeout='12s'; set lock_timeout='10s'; set idle_in_transaction_session_timeout='20s';
    create function pg_temp.fixture_submit(legacy boolean, request text, signature text, key_id text)
    returns jsonb language plpgsql security invoker as $$
    begin
      if legacy then return public.mutate_account_journal_attested(request,signature,key_id); end if;
      return public.mutate_account_plan_collection_attested(request,signature,key_id);
    exception when others then return jsonb_build_object('sqlstate',SQLSTATE);
    end; $$;`);
  await login(session);
}

export async function bootstrap(admin, mutation = null) {
  await admin.query(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  const migrations = new URL('../../migrations/', import.meta.url);
  const names = readdirSync(migrations).filter(n => /^\d+_.+\.sql$/.test(n) && n <= '0037_account_plan_collection.sql').sort();
  assert.equal(names.length, 37, 'Explicit migration range 0001-0037');
  for (const name of names) {
    let sql = readFileSync(new URL(name, migrations), 'utf8');
    if (name === '0037_account_plan_collection.sql' && mutation) {
      const replaceOnce = (needle, replacement) => {
        assert.equal(sql.split(needle).length, 2, 'Mutation must match exactly once');
        sql = sql.replace(needle, replacement);
      };
      if (mutation === 'owner-lock') replaceOnce(
        "perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));\n  -- A queued request",
        '-- A queued request');
      if (mutation === 'replay') replaceOnce('if found then\n    if prior.request_fingerprint', 'if false then\n    if prior.request_fingerprint');
      if (mutation === 'owner-read') replaceOnce('where r.user_id=owner_id and r.operation_id=$1;', 'where r.operation_id=$1;');
    }
    await admin.query(sql);
  }
  for (const owner of [A, B]) {
    await admin.query(`insert into auth.users(id,created_at) values(${literal(owner)},'2020-01-01');
      insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
        values(${literal(owner)},'1990-01-01','fixture','fixture',clock_timestamp());
      insert into public.beta_enrollments(user_id) values(${literal(owner)});`);
  }
  await admin.query(`update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC');
    insert into public.account_journal_gateway_keys(key_id,secret) values('fixture',decode('${signingKey.toString('hex')}','hex'));`);
}

export async function resetFixture(admin) {
  // Only our generated database is reachable; never truncate a pre-existing database.
  await admin.query(`truncate public.account_plan_collection_receipts,public.account_plan_collection_indexes,public.account_plan_collection_parts,
    public.account_journal_history,public.account_journal_operations,public.account_journal_documents,
    public.account_journal_identity,public.account_journal_finalization_events,public.account_journal_cutovers;`);
}
