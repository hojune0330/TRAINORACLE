import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// In-memory real SQL only. Synthetic JWT boundary, no credentials or live DB.
// These arbitrary bytes intentionally pass the envelope gate: this does NOT
// prove AES-GCM authenticity, key recovery or validity of the final journal schema.
// PGlite is single-session; multi-connection lock contention needs separate QA.
const db = new PGlite();
const migrations = new URL('../../migrations/', import.meta.url);
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
const C = 'c3333333-3333-4333-8333-333333333333';
const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;
const envelope = (byte = 0, size = 16) => ({
  version: 1, algorithm: 'AES-GCM', keyId: 'synthetic-key',
  iv: Buffer.alloc(12, byte).toString('base64'),
  ciphertext: Buffer.alloc(size, byte).toString('base64'),
});
const commit = async (documentId, operationId, revision = 0, payload = envelope()) =>
  (await db.query('select public.commit_account_journal_document($1,$2,$3,$4) as receipt',
    [documentId, operationId, revision, payload === null ? null : JSON.stringify(payload)])).rows[0].receipt;
const reject = (action, code = '42501') => assert.rejects(action, error => error.code === code);
async function login(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)",
    [id, JSON.stringify({ sub: id, role: 'authenticated' })]);
}
let controlsBefore;
let controlsAfter;
let migrationRollbackVerified = false;
before(async () => {
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
  for (const file of readdirSync(migrations).filter(name => /^\d+_.+\.sql$/.test(name)).sort()) {
    if (file === '0033_account_journal_revision_foundation.sql') {
      controlsBefore = (await db.query('select * from public.service_feature_controls order by feature_key')).rows;
      const sql = readFileSync(new URL(file, migrations), 'utf8');
      assert.match(sql, /^(?:--[^\n]*\n|\s)*begin;/i);
      assert.match(sql, /commit;\s*$/i);
      // Separate SQL-editor submissions prove the explicit transaction protects
      // earlier DDL/control changes when a later statement fails.
      await db.exec(sql.slice(0, sql.indexOf('-- Structural ciphertext')));
      await reject(() => db.exec('select 1 / 0;'), '22012');
      await db.exec('rollback;');
      assert.deepEqual((await db.query('select * from public.service_feature_controls order by feature_key')).rows, controlsBefore);
      await reject(() => db.query(`insert into public.service_feature_controls(feature_key,enabled,change_reason)
        values('ACCOUNT_JOURNAL_V2',false,'SYNTHETIC_ROLLBACK_CHECK')`), '23514');
      migrationRollbackVerified = true;
    }
    await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
    if (file === '0033_account_journal_revision_foundation.sql') {
      controlsAfter = (await db.query('select * from public.service_feature_controls order by feature_key')).rows;
    }
  }
  for (const id of [A, B]) {
    await db.query('insert into auth.users(id) values($1)', [id]);
    await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
      values($1,'1990-01-01','synthetic-v1','synthetic-v1',clock_timestamp())`, [id]);
    await db.query('insert into public.beta_enrollments(user_id) values($1)', [id]);
  }
}, { timeout: 60000 });
beforeEach(async () => {
  await db.exec(`reset role;
    truncate public.account_journal_operations, public.account_journal_documents;
    update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','PLAN_BACKUP');`);
  await login(A);
});
after(async () => { await db.close(); });

test('additive migration defaults journal off and preserves every existing control', async () => {
  assert.deepEqual(controlsAfter.filter(row => row.feature_key !== 'ACCOUNT_JOURNAL_V2'), controlsBefore);
  assert.equal(controlsAfter.find(row => row.feature_key === 'ACCOUNT_JOURNAL_V2').enabled, false);
});

test('explicit migration transaction rolls back earlier DDL and flag insertion on SQL-editor failure', () => {
  assert.equal(migrationRollbackVerified, true);
});

test('deleting synthetic C account cascades documents and all operations, preserving A/B unchanged', async () => {
  await db.exec('reset role;');
  await db.query('insert into auth.users(id) values($1)', [C]);
  await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
    values($1,'1990-01-01','synthetic-v1','synthetic-v1',clock_timestamp())`, [C]);
  await db.query('insert into public.beta_enrollments(user_id) values($1)', [C]);
  const doc = randomUUID(); const op = randomUUID();
  for (const user of [A, B, C]) {
    await login(user);
    await commit(doc, op);
    await commit(doc, randomUUID(), 0, envelope(1));
    await commit(randomUUID(), randomUUID(), 9, envelope(2));
  }
  await db.exec('reset role;');
  const tables = ['account_journal_documents', 'account_journal_operations'];
  const preserved = [];
  for (const table of tables) {
    const order = table === 'account_journal_documents' ? 'document_id' : 'operation_id';
    preserved.push((await db.query(`select * from public.${table} where user_id<>$1 order by user_id,${order}`, [C])).rows);
    assert.equal((await db.query(`select * from public.${table} where user_id=$1`, [C])).rows.length,
      table === 'account_journal_documents' ? 1 : 3);
  }
  assert.deepEqual((await db.query('delete from auth.users where id=$1 returning id', [C])).rows, [{ id: C }]);
  for (const [index, table] of tables.entries()) {
    const order = table === 'account_journal_documents' ? 'document_id' : 'operation_id';
    assert.equal((await db.query(`select * from public.${table} where user_id=$1`, [C])).rows.length, 0);
    assert.deepEqual((await db.query(`select * from public.${table} order by user_id,${order}`)).rows, preserved[index]);
  }
  assert.deepEqual((await db.query('select id from auth.users order by id')).rows, [{ id: A }, { id: B }]);
});

test('JS-safe revision domain rejects overbound inputs/table values and saves last allowed transition exactly', async () => {
  const doc = randomUUID(); const initialOp = randomUUID();
  for (const value of [MAX_REVISION + 1, '9223372036854775807']) {
    await reject(() => commit(doc, randomUUID(), value), '22023');
  }
  assert.equal((await db.query('select * from public.account_journal_operations')).rows.length, 0);
  assert.equal((await db.query('select * from public.account_journal_documents')).rows.length, 0);
  await commit(doc, initialOp);
  await db.exec('reset role;');
  await reject(() => db.query('update public.account_journal_documents set revision=$1', [MAX_REVISION + 1]), '23514');
  await reject(() => db.query('update public.account_journal_operations set expected_revision=$1', [MAX_REVISION + 1]), '23514');
  // Seed only the synthetic DB near exhaustion; clients still cannot direct-write.
  await db.query('update public.account_journal_documents set revision=$1', [MAX_REVISION - 1]);
  await login(A);
  const op = randomUUID();
  const receipt = { kind: 'saved', documentId: doc, operationId: op, revision: MAX_REVISION };
  assert.deepEqual(await commit(doc, op, MAX_REVISION - 1, envelope(3)), receipt);
  assert.deepEqual(await commit(doc, op, MAX_REVISION - 1, envelope(3)), receipt);
  const conflictOp = randomUUID();
  assert.deepEqual(await commit(doc, conflictOp, MAX_REVISION - 1),
    { kind: 'conflict', documentId: doc, operationId: conflictOp, currentRevision: MAX_REVISION });
  const beforeDocument = (await db.query('select * from public.account_journal_documents')).rows;
  const beforeOperations = (await db.query('select * from public.account_journal_operations order by operation_id')).rows;
  await assert.rejects(() => commit(doc, randomUUID(), MAX_REVISION),
    error => error.code === '22023' && error.message === 'ACCOUNT_JOURNAL_REVISION_EXHAUSTED');
  assert.deepEqual((await db.query('select * from public.account_journal_documents')).rows, beforeDocument);
  assert.deepEqual((await db.query('select * from public.account_journal_operations order by operation_id')).rows, beforeOperations);
  const absent = randomUUID(); const absentOp = randomUUID();
  assert.deepEqual(await commit(absent, absentOp, MAX_REVISION),
    { kind: 'conflict', documentId: absent, operationId: absentOp, currentRevision: 0 });
});

test('both disabled gates hide own documents/operations and reject commits without writes', async () => {
  const doc = randomUUID(); const op = randomUUID();
  await commit(doc, op);
  for (const gate of ['ACCOUNT_JOURNAL_V2', 'ACCOUNT']) {
    await db.exec('reset role;');
    await db.query('update public.service_feature_controls set enabled=false where feature_key=$1', [gate]);
    await login(A);
    await reject(() => commit(doc, randomUUID(), 1));
    await reject(() => commit(doc, op)); // Even retries require current access.
    for (const table of ['account_journal_documents', 'account_journal_operations']) {
      assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
    }
    await db.exec('reset role;');
    assert.equal((await db.query('select * from public.account_journal_operations')).rows.length, 1);
    assert.equal((await db.query('select * from public.account_journal_documents')).rows.length, 1);
    await db.query('update public.service_feature_controls set enabled=true where feature_key=$1', [gate]);
  }
});

test('unauthenticated, anon and service_role cannot invoke the commit RPC', async () => {
  await login('');
  await reject(() => commit(randomUUID(), randomUUID()));
  for (const role of ['anon', 'service_role']) {
    await db.exec(`reset role; set role ${role};`);
    await reject(() => commit(randomUUID(), randomUUID()));
    await reject(() => db.query('select * from public.account_journal_documents'));
    await reject(() => db.query('select * from public.account_journal_operations'));
    await reject(() => db.query('select public.account_journal_envelope_valid($1)', [JSON.stringify(envelope())]));
  }
});

test('existing account eligibility gate blocks reads and writes independently of flags', async () => {
  await commit(randomUUID(), randomUUID());
  await db.exec('reset role;');
  await db.query('delete from public.beta_enrollments where user_id=$1', [A]);
  try {
    await login(A);
    await reject(() => commit(randomUUID(), randomUUID()));
    for (const table of ['account_journal_documents', 'account_journal_operations']) {
      assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
    }
  } finally {
    await db.exec('reset role;');
    await db.query('insert into public.beta_enrollments(user_id) values($1)', [A]);
  }
});

test('A/B own reads work; document and operation identities are isolated per account', async () => {
  const doc = randomUUID(); const op = randomUUID();
  await commit(doc, op);
  await login(B);
  for (const table of ['account_journal_documents', 'account_journal_operations']) {
    assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
  }
  assert.equal((await commit(doc, op, 0, envelope(1))).revision, 1);
  for (const [user, other, byte] of [[A, B, 0], [B, A, 1]]) {
    await login(user);
    for (const table of ['account_journal_documents', 'account_journal_operations']) {
      const rows = (await db.query(`select * from public.${table}`)).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].user_id, user);
      assert.deepEqual(rows[0].encrypted_payload ?? rows[0].proposed_encrypted_payload, envelope(byte));
      assert.equal((await db.query(`select * from public.${table} where user_id=$1`, [other])).rows.length, 0);
    }
  }
});

test('direct insert/update/delete/upsert/truncate denied even for own rows', async () => {
  const doc = randomUUID(); const op = randomUUID();
  await commit(doc, op);
  for (const owner of [A, B]) {
    const documentInsert = `insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values($1,$2,1,$3)`;
    const operationInsert = `insert into public.account_journal_operations(user_id,operation_id,document_id,expected_revision,proposed_encrypted_payload,result) values($1,$2,$2,0,$3,'{}')`;
    for (const [table, insert, identity] of [
      ['account_journal_documents', documentInsert, 'document_id'],
      ['account_journal_operations', operationInsert, 'operation_id'],
    ]) {
      const params = [owner, doc, JSON.stringify(envelope())];
      await reject(() => db.query(insert, params));
      await reject(() => db.query(`${insert} on conflict(user_id,${identity}) do update set user_id=excluded.user_id`, params));
      await reject(() => db.query(`update public.${table} set user_id=$1 where user_id=$1`, [owner]));
      await reject(() => db.query(`delete from public.${table} where user_id=$1`, [owner]));
      await reject(() => db.query(`truncate public.${table}`));
    }
  }
});

test('CAS conflict preserves full proposed ciphertext and never overwrites the document', async () => {
  const doc = randomUUID(); const op = randomUUID(); const conflictOp = randomUUID();
  assert.deepEqual(await commit(doc, op), { kind: 'saved', documentId: doc, operationId: op, revision: 1 });
  const oldTime = (await db.query('select updated_at from public.account_journal_documents')).rows[0].updated_at;
  const conflict = { kind: 'conflict', documentId: doc, operationId: conflictOp, currentRevision: 1 };
  assert.deepEqual(await commit(doc, conflictOp, 0, envelope(2)), conflict);
  const row = (await db.query('select * from public.account_journal_documents')).rows[0];
  assert.equal(Number(row.revision), 1);
  assert.deepEqual(row.updated_at, oldTime);
  assert.deepEqual(row.encrypted_payload, envelope());
  const proposal = (await db.query('select * from public.account_journal_operations where operation_id=$1', [conflictOp])).rows[0];
  assert.deepEqual(proposal.proposed_encrypted_payload, envelope(2));
  assert.deepEqual(proposal.result, conflict);
  const updateOp = randomUUID();
  assert.deepEqual(await commit(doc, updateOp, 1, envelope(3)), { kind: 'saved', documentId: doc, operationId: updateOp, revision: 2 });
  const updated = (await db.query('select * from public.account_journal_documents')).rows[0];
  assert.deepEqual(updated.encrypted_payload, envelope(3));
  assert.ok(new Date(updated.updated_at) >= new Date(oldTime));
  assert.deepEqual(await commit(doc, conflictOp, 0, envelope(2)), conflict);
  assert.deepEqual(await commit(doc, op), { kind: 'saved', documentId: doc, operationId: op, revision: 1 });
  assert.equal((await db.query('select * from public.account_journal_operations')).rows.length, 3);
});

test('absent-document CAS conflict records proposal and retry remains original after creation', async () => {
  const doc = randomUUID(); const op = randomUUID();
  const receipt = { kind: 'conflict', documentId: doc, operationId: op, currentRevision: 0 };
  assert.deepEqual(await commit(doc, op, 4), receipt);
  assert.equal((await db.query('select * from public.account_journal_documents')).rows.length, 0);
  await commit(doc, randomUUID());
  assert.deepEqual(await commit(doc, op, 4), receipt);
});

test('operation reuse rejects changes to any request field for saved and conflict receipts', async () => {
  const doc = randomUUID();
  for (const expected of [0, 9]) {
    const op = randomUUID();
    await commit(doc, op, expected);
    for (const args of [[randomUUID(), op, expected], [doc, op, expected + 1], [doc, op, expected, envelope(4)]]) {
      await assert.rejects(() => commit(...args), error => error.code === '22023' && error.message === 'ACCOUNT_JOURNAL_OPERATION_REUSED');
    }
  }
  assert.equal((await db.query('select * from public.account_journal_operations')).rows.length, 2);
});

test('invalid IDs/revisions/envelopes rejected before writes, including strict keys and decoded size bounds', async () => {
  await reject(() => commit('invalid-uuid', randomUUID()), '22P02');
  await reject(() => commit(randomUUID(), 'invalid-uuid'), '22P02');
  await reject(() => commit(randomUUID(), randomUUID(), '1.5'), '22P02');
  await reject(() => commit(randomUUID(), randomUUID(), '9223372036854775808'), '22003');
  for (const args of [[null, randomUUID()], [randomUUID(), null], [randomUUID(), randomUUID(), null],
    [randomUUID(), randomUUID(), -1]]) await reject(() => commit(...args), '22023');
  const invalid = [null, {}, [], 'synthetic', 1];
  for (const key of Object.keys(envelope())) {
    const missing = envelope(); delete missing[key]; invalid.push(missing);
    invalid.push({ ...envelope(), [key]: null });
  }
  for (const patch of [{ version: '1' }, { version: 2 }, { algorithm: 'AES-CBC' },
    { rawText: 'synthetic-forbidden' }, { keyId: '' }, { keyId: ' ' }, { keyId: 'k'.repeat(81) },
    { keyId: 123 }, { iv: Buffer.alloc(11).toString('base64') }, { iv: Buffer.alloc(13).toString('base64') },
    { iv: '!'.repeat(16) }, { ciphertext: 'not-base64' }, { ciphertext: 'A'.repeat(24) + '\n' },
    { ciphertext: 'A'.repeat(21) + 'B==' }]) invalid.push({ ...envelope(), ...patch });
  invalid.push(envelope(0, 15), envelope(0, 1048577));
  for (const payload of invalid) await reject(() => commit(randomUUID(), randomUUID(), 0, payload), '22023');
  assert.equal((await db.query('select * from public.account_journal_documents')).rows.length, 0);
  assert.equal((await db.query('select * from public.account_journal_operations')).rows.length, 0);
  assert.equal((await commit(randomUUID(), randomUUID(), 0, { ...envelope(0, 1048576), keyId: 'k'.repeat(80) })).kind, 'saved');
});

test('existing V3 saved plans still accept and return their payload independently of journal gate', async () => {
  await db.exec("reset role; update public.service_feature_controls set enabled=false where feature_key='ACCOUNT_JOURNAL_V2';");
  await login(A);
  const id = 'synthetic-v3-plan'; const payload = { synthetic: true };
  await db.query('insert into public.saved_training_plans(user_id,plan_id,schema_version,plan_payload) values($1,$2,3,$3)',
    [A, id, JSON.stringify(payload)]);
  assert.deepEqual((await db.query('select schema_version,plan_payload from public.saved_training_plans where plan_id=$1', [id])).rows,
    [{ schema_version: 3, plan_payload: payload }]);
});

test('RPC is security definer with fixed catalog search path and authenticated-only execution', async () => {
  const rows = (await db.query(`select prosecdef,proconfig,
    has_function_privilege('authenticated',oid,'execute') as authenticated,
    has_function_privilege('anon',oid,'execute') as anon,
    has_function_privilege('service_role',oid,'execute') as service_role
    from pg_proc where oid='public.commit_account_journal_document(uuid,uuid,bigint,jsonb)'::regprocedure`)).rows;
  assert.deepEqual(rows, [{ prosecdef: true, proconfig: ['search_path=pg_catalog'], authenticated: true, anon: false, service_role: false }]);
});
