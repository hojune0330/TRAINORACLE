import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Real in-memory PostgreSQL; synthetic claims/bytes only. PGlite serializes one
// session: Promise.all below verifies order/CAS outcomes, NOT multi-session locks.
const db = new PGlite();
const migrations = new URL('../../migrations/', import.meta.url);
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
const MAX = Number.MAX_SAFE_INTEGER - 1;
const envelope = (byte = 0) => ({ version: 1, algorithm: 'AES-GCM', keyId: 'synthetic-key',
  iv: Buffer.alloc(12, byte).toString('base64'), ciphertext: Buffer.alloc(16, byte).toString('base64') });
const rpc = async (name, args = []) => (await db.query(
  `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args)).rows[0].result;
const commit = (doc, op = randomUUID(), rev = 0, body = envelope()) =>
  rpc('commit_account_journal_document', [doc, op, rev, body === null ? null : JSON.stringify(body)]);
const remove = (doc, op, rev) => rpc('delete_account_journal_document', [doc, op, rev]);
const restore = (doc, op, rev, source) => rpc('restore_account_journal_document', [doc, op, rev, source]);
const history = doc => rpc('list_account_journal_history', [doc]);
const purge = () => rpc('purge_expired_account_journal_history');
const denied = (fn, code = '42501') => assert.rejects(fn, e => e.code === code);
async function login(id = A) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)",
    [id, JSON.stringify({ sub: id, role: 'authenticated' })]);
}
async function admin(sql, args = []) {
  await db.exec('reset role;');
  return db.query(sql, args);
}
async function expire(doc, owner = A) {
  // Move ONLY disposable fixture clocks, keeping the exact 720-hour invariant.
  await admin(`update public.account_journal_history set replaced_at=statement_timestamp()-interval '721 hours',
    expires_at=statement_timestamp()-interval '1 hour'
    where user_id=$1 and document_id=$2`, [owner, doc]);
  await admin(`update public.account_journal_operations set payload_expires_at=clock_timestamp()-interval '1 second'
    where user_id=$1 and document_id=$2 and payload_expires_at is not null`, [owner, doc]);
  await login(owner);
}
let preservedBefore;
let preservedAfter;
let rollbackVerified = false;
const legacyDoc = randomUUID();
const legacyOp = randomUUID();
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key, aud text, role text, email text, created_at timestamptz, updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for (const file of readdirSync(migrations).filter(n => /^\d+_.+\.sql$/.test(n) && n < '0034').sort()) {
    await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  for (const id of [A, B]) {
    await db.query('insert into auth.users(id) values($1)', [id]);
    await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
      values($1,'1990-01-01','synthetic-v1','synthetic-v1',clock_timestamp())`, [id]);
    await db.query('insert into public.beta_enrollments(user_id) values($1)', [id]);
  }
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2');");
  await login();
  await commit(legacyDoc, legacyOp);
  const snapshot = async () => ({
    docs: (await db.query('select user_id,document_id,revision,encrypted_payload,updated_at from public.account_journal_documents')).rows,
    ops: (await db.query('select user_id,operation_id,document_id,expected_revision,proposed_encrypted_payload,result from public.account_journal_operations')).rows,
    flags: (await db.query('select * from public.service_feature_controls order by feature_key')).rows,
  });
  await db.exec('reset role;');
  preservedBefore = await snapshot();
  let sql = readFileSync(new URL('0034_account_journal_history_and_trash.sql', migrations), 'utf8');
  // Optional in-memory mutation. Never edits the migration or existing files.
  if (process.env.LIFECYCLE_TEST_MUTATION === 'allow-deleted-commit') {
    sql = sql.replace("or (action_kind = 'commit' and current_doc.deleted_at is not null)", '');
  }
  if (process.env.LIFECYCLE_TEST_MUTATION === 'allow-expired-restore') {
    sql = sql.replace('and h.expires_at > accepted_at', '');
  }
  if (process.env.LIFECYCLE_TEST_MUTATION === 'history-cross-owner') {
    sql = sql.replace('where h.user_id = owner_id and h.document_id = $1 and h.expires_at > clock_timestamp()',
      'where h.document_id = $1 and h.expires_at > clock_timestamp()');
  }
  await db.exec(sql.slice(0, sql.indexOf('create table public.account_journal_history')));
  await denied(() => db.exec('select 1/0;'), '22012');
  await db.exec('rollback;');
  assert.equal((await db.query(`select column_name from information_schema.columns
    where table_name='account_journal_documents' and column_name='deleted_at'`)).rows.length, 0);
  assert.deepEqual(await snapshot(), preservedBefore);
  rollbackVerified = true;
  await db.exec(sql);
  preservedAfter = await snapshot();
  await login();
  assert.equal((await commit(legacyDoc, legacyOp)).revision, 1);
  await commit(legacyDoc, randomUUID(), 1, envelope(1));
  assert.deepEqual((await history(legacyDoc))[0].encryptedPayload, envelope());
}, { timeout: 60000 });
beforeEach(async () => {
  await db.exec(`reset role;
    truncate public.account_journal_history, public.account_journal_operations, public.account_journal_documents;
    update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2');`);
  await login();
});
after(async () => { await db.close(); });

test('0034 preserves existing rows/flags, legacy replay and atomic DDL rollback', () => {
  assert.deepEqual(preservedAfter, preservedBefore);
  assert.equal(rollbackVerified, true);
});

test('history starts 30 days at replacement, not original creation, with opaque payload and exact API', async () => {
  const doc = randomUUID();
  await commit(doc);
  await admin("update public.account_journal_documents set updated_at='2000-01-01'");
  await login();
  await commit(doc, randomUUID(), 1, envelope(1));
  const rows = await history(doc);
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['encryptedPayload','expiresAt','reason','replacedAt','revision']);
  assert.equal(rows[0].revision, 1);
  assert.equal(rows[0].reason, 'replaced');
  assert.deepEqual(rows[0].encryptedPayload, envelope());
  const timing = (await db.query(`select h.replaced_at=d.updated_at as same_acceptance,
    h.expires_at-h.replaced_at=interval '720 hours' as thirty_days,
    h.replaced_at > timestamptz '2020-01-01' as fresh
    from public.account_journal_history h join public.account_journal_documents d using(user_id,document_id)`)).rows[0];
  assert.deepEqual(timing, { same_acceptance: true, thirty_days: true, fresh: true });
});

test('delete creates payload-free tombstone and rejects stale AND current-revision commit resurrection', async () => {
  const doc = randomUUID(); const op = randomUUID();
  await commit(doc);
  const result = await remove(doc, op, 1);
  assert.deepEqual(result, { kind: 'deleted', documentId: doc, operationId: op, revision: 2 });
  const row = (await db.query('select * from public.account_journal_documents')).rows[0];
  assert.equal(row.encrypted_payload, null);
  assert.ok(row.deleted_at);
  assert.equal((await history(doc))[0].reason, 'trash');
  for (const rev of [0, 1, 2]) assert.equal((await commit(doc, randomUUID(), rev, envelope(9))).kind, 'conflict');
  assert.equal((await remove(doc, randomUUID(), 2)).kind, 'conflict');
  assert.deepEqual(await remove(doc, op, 1), result);
  assert.equal((await history(doc)).length, 1);
  assert.equal((await db.query('select revision from public.account_journal_documents')).rows[0].revision, 2);
  assert.equal((await db.query("select * from public.account_journal_operations where result->>'kind'='conflict' and proposed_encrypted_payload is not null")).rows.length, 3);
});

test('restore chooses eligible history/trash into NEW revision and repeated restore cannot rewind', async () => {
  const doc = randomUUID();
  await commit(doc);
  await commit(doc, randomUUID(), 1, envelope(1));
  await remove(doc, randomUUID(), 2);
  const op = randomUUID();
  assert.deepEqual(await restore(doc, op, 3, 1),
    { kind: 'restored', documentId: doc, operationId: op, revision: 4, sourceRevision: 1 });
  let row = (await db.query('select * from public.account_journal_documents')).rows[0];
  assert.deepEqual(row.encrypted_payload, envelope()); assert.equal(row.deleted_at, null);
  assert.equal((await restore(doc, randomUUID(), 4, 2)).revision, 5);
  assert.equal((await restore(doc, randomUUID(), 4, 1)).kind, 'conflict');
  assert.equal((await restore(doc, op, 3, 1)).revision, 4);
  row = (await db.query('select * from public.account_journal_documents')).rows[0];
  assert.equal(row.revision, 5); assert.deepEqual(row.encrypted_payload, envelope(1));
  assert.deepEqual((await history(doc)).map(h => h.revision), [4, 2, 1]);
});

test('expired source rejected by server clock without cleanup, while live source restores', async () => {
  const doc = randomUUID(); await commit(doc); await remove(doc, randomUUID(), 1);
  const op = randomUUID();
  await expire(doc);
  assert.deepEqual(await history(doc), []);
  assert.equal((await db.query('select * from public.account_journal_history')).rows.length, 0);
  assert.equal((await db.query("select * from public.account_journal_operations where result->>'kind'='saved'")).rows.length, 0);
  assert.deepEqual(await restore(doc, op, 2, 1), { kind: 'source_unavailable', documentId: doc,
    operationId: op, currentRevision: 2, sourceRevision: 1 });
  const live = randomUUID(); await commit(live); await remove(live, randomUUID(), 1);
  assert.equal((await restore(live, randomUUID(), 2, 1)).kind, 'restored');
  assert.equal((await restore(doc, op, 2, 1)).kind, 'source_unavailable');
});

test('purge removes expired ciphertext copies only; receipts, tombstones and unresolved conflicts survive', async () => {
  const doc = randomUUID(); const savedOp = randomUUID(); const conflictOp = randomUUID();
  const saved = await commit(doc, savedOp);
  const conflict = await commit(doc, conflictOp, 0, envelope(2));
  await remove(doc, randomUUID(), 1);
  await expire(doc);
  assert.deepEqual(await purge(), { historyPurged: 1, operationPayloadsPurged: 1 });
  assert.deepEqual(await purge(), { historyPurged: 0, operationPayloadsPurged: 0 });
  assert.deepEqual(await commit(doc, savedOp), saved);
  await denied(() => commit(doc, savedOp, 0, envelope(3)), '22023');
  assert.deepEqual(await commit(doc, conflictOp, 0, envelope(2)), conflict);
  const ops = (await db.query('select * from public.account_journal_operations')).rows;
  assert.equal(ops.find(o => o.operation_id === savedOp).proposed_encrypted_payload, null);
  assert.deepEqual(ops.find(o => o.operation_id === conflictOp).proposed_encrypted_payload, envelope(2));
  assert.equal((await commit(doc, randomUUID(), 0)).kind, 'conflict');
  assert.equal((await commit(doc, randomUUID(), 2)).kind, 'conflict');
  assert.equal((await restore(doc, randomUUID(), 2, 1)).kind, 'source_unavailable');
  assert.equal((await db.query('select * from public.account_journal_documents')).rows[0].revision, 2);
});

test('same operation ID cannot change action, source, document, expected revision or payload', async () => {
  const doc = randomUUID(); const commitOp = randomUUID(); const deleteOp = randomUUID();
  await commit(doc, commitOp); await remove(doc, deleteOp, 1);
  await denied(() => remove(doc, commitOp, 0), '22023');
  await denied(() => commit(doc, deleteOp, 1), '22023');
  await denied(() => remove(randomUUID(), deleteOp, 1), '22023');
  await denied(() => remove(doc, deleteOp, 2), '22023');
  const op = randomUUID(); const result = await restore(doc, op, 2, 1);
  for (const args of [[doc,op,2,2], [doc,op,3,1], [randomUUID(),op,2,1]])
    await denied(() => restore(...args), '22023');
  await remove(doc, randomUUID(), 3);
  assert.deepEqual(await restore(doc, op, 2, 1), result);
  assert.equal((await db.query('select revision from public.account_journal_documents')).rows[0].revision, 4);
});

test('restore conflict retains chosen eligible ciphertext beyond history expiry', async () => {
  const doc = randomUUID(); const op = randomUUID();
  await commit(doc); await commit(doc, randomUUID(), 1, envelope(1));
  const result = await restore(doc, op, 1, 1);
  assert.equal(result.kind, 'conflict');
  await expire(doc); await purge();
  assert.deepEqual(await restore(doc, op, 1, 1), result);
  const row = (await db.query('select * from public.account_journal_operations where operation_id=$1', [op])).rows[0];
  assert.deepEqual(row.proposed_encrypted_payload, envelope());
  assert.equal(row.payload_expires_at, null);
});

test('source-unavailable receipt remains stable when that revision later becomes eligible history', async () => {
  const doc = randomUUID(); const op = randomUUID();
  await commit(doc);
  const result = await restore(doc,op,1,1);
  assert.equal(result.kind, 'source_unavailable');
  await remove(doc,randomUUID(),1);
  assert.equal((await history(doc))[0].revision, 1);
  assert.deepEqual(await restore(doc,op,1,1), result);
  assert.equal((await restore(doc,randomUUID(),2,1)).revision, 3);
});

test('restoring history does not extend source expiry; later replacement gets its own full retention window', async () => {
  const doc = randomUUID(); await commit(doc); await remove(doc,randomUUID(),1);
  const source = (await history(doc))[0];
  await restore(doc,randomUUID(),2,1);
  assert.deepEqual((await history(doc))[0], source);
  await commit(doc,randomUUID(),3,envelope(4));
  const rows = await history(doc);
  assert.deepEqual(rows[1], source);
  assert.equal(rows[0].revision, 3);
  assert.equal(new Date(rows[0].expiresAt)-new Date(rows[0].replacedAt), 30*24*60*60*1000);
});

test('expiry boundary uses wall clock inside a transaction, not transaction-start now()', async () => {
  const doc = randomUUID(); await commit(doc); await remove(doc, randomUUID(), 1);
  await db.exec('reset role; begin;');
  try {
    await db.query(`update public.account_journal_history set
      replaced_at=statement_timestamp()+interval '200 milliseconds'-interval '720 hours',
      expires_at=statement_timestamp()+interval '200 milliseconds' where document_id=$1`, [doc]);
    await login();
    assert.equal((await history(doc)).length, 1);
    await db.exec('select pg_sleep(0.25);');
    assert.deepEqual(await history(doc), []);
    assert.equal((await restore(doc,randomUUID(),2,1)).kind, 'source_unavailable');
    assert.equal((await purge()).historyPurged, 1);
  } finally {
    await db.exec('rollback;');
    await login();
  }
});

test('A/B isolation includes history RPC, direct RLS, restores, operation IDs and owner-only purge', async () => {
  const doc = randomUUID(); const op = randomUUID();
  await commit(doc, op); await remove(doc, randomUUID(), 1);
  await login(B);
  assert.deepEqual(await history(doc), []);
  assert.equal((await db.query('select * from public.account_journal_history')).rows.length, 0);
  assert.equal((await restore(doc, randomUUID(), 0, 1)).kind, 'conflict');
  await commit(doc, op, 0, envelope(2));
  assert.equal((await restore(doc, randomUUID(), 1, 1)).kind, 'source_unavailable');
  await remove(doc, randomUUID(), 1);
  assert.deepEqual((await history(doc))[0].encryptedPayload, envelope(2));
  await expire(doc, A); await expire(doc, B); await login(A);
  assert.equal((await purge()).historyPurged, 1);
  const remaining = (await admin('select user_id from public.account_journal_history')).rows;
  assert.deepEqual(remaining, [{ user_id: B }]);
});

test('all lifecycle RPCs require authenticated privilege and present identity; private helpers stay private', async () => {
  const doc = randomUUID();
  const calls = [() => commit(doc), () => remove(doc, randomUUID(), 0),
    () => restore(doc, randomUUID(), 0, 1), () => history(doc), purge];
  await login(''); for (const call of calls) await denied(call);
  for (const role of ['anon', 'service_role']) {
    await login(); await db.exec(`reset role; set role ${role};`);
    for (const call of calls) await denied(call);
    await denied(() => db.query('select * from public.account_journal_history'));
  }
  await login();
  await denied(() => rpc('account_journal_lifecycle_owner'));
  await denied(() => rpc('mutate_account_journal_lifecycle', [doc,randomUUID(),0,null,'delete',null]));
});

test('both feature gates and account eligibility deny history, writes, cleanup AND replay', async () => {
  const doc = randomUUID(); const op = randomUUID();
  await commit(doc); await remove(doc, op, 1);
  const calls = [() => commit(doc), () => remove(doc, op, 1),
    () => restore(doc, randomUUID(), 2, 1), () => history(doc), purge];
  for (const gate of ['ACCOUNT', 'ACCOUNT_JOURNAL_V2', 'eligibility']) {
    if (gate === 'eligibility') await admin('delete from public.beta_enrollments where user_id=$1', [A]);
    else await admin('update public.service_feature_controls set enabled=false where feature_key=$1', [gate]);
    await login();
    for (const call of calls) await denied(call);
    for (const table of ['account_journal_history','account_journal_documents','account_journal_operations'])
      assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
    if (gate === 'eligibility') await admin('insert into public.beta_enrollments(user_id) values($1)', [A]);
    else await admin('update public.service_feature_controls set enabled=true where feature_key=$1', [gate]);
    await login();
  }
  assert.equal((await restore(doc, randomUUID(), 2, 1)).kind, 'restored');
});

test('history direct insert/update/delete/upsert/truncate denied for own and foreign rows', async () => {
  const doc = randomUUID(); await commit(doc); await remove(doc, randomUUID(), 1);
  for (const owner of [A, B]) {
    const insert = `insert into public.account_journal_history(user_id,document_id,revision,encrypted_payload,replaced_at,expires_at,reason)
      values($1,$2,1,$3,now(),now()+interval '720 hours','trash')`;
    const args = [owner, doc, JSON.stringify(envelope())];
    await denied(() => db.query(insert, args));
    await denied(() => db.query(`${insert} on conflict(user_id,document_id,revision) do update set reason='trash'`, args));
    await denied(() => db.query('update public.account_journal_history set reason=reason where user_id=$1', [owner]));
    await denied(() => db.query('delete from public.account_journal_history where user_id=$1', [owner]));
    await denied(() => db.exec('truncate public.account_journal_history'));
  }
});

test('queued edit/delete races in both orders have one CAS winner and retain losing proposal', async () => {
  for (const first of ['edit', 'delete']) {
    const doc = randomUUID(); await commit(doc);
    const edit = () => commit(doc, randomUUID(), 1, envelope(7));
    const del = () => remove(doc, randomUUID(), 1);
    const results = await Promise.all(first === 'edit' ? [edit(), del()] : [del(), edit()]);
    assert.equal(results[0].kind, first === 'edit' ? 'saved' : 'deleted');
    assert.equal(results[1].kind, 'conflict');
    assert.equal(results[1].currentRevision, 2);
    assert.equal((await history(doc)).length, 1);
    if (first === 'delete') assert.deepEqual((await db.query(
      'select proposed_encrypted_payload from public.account_journal_operations where operation_id=$1',
      [results[1].operationId])).rows[0].proposed_encrypted_payload, envelope(7));
  }
});

test('queued duplicate restore and restore/delete race return stable receipts with no double revisions', async () => {
  const doc = randomUUID(); await commit(doc); await remove(doc, randomUUID(), 1);
  const op = randomUUID();
  const results = await Promise.all([restore(doc,op,2,1),restore(doc,op,2,1),remove(doc,randomUUID(),2)]);
  assert.deepEqual(results[0], results[1]); assert.equal(results[0].revision, 3);
  assert.equal(results[2].kind, 'conflict');
  assert.equal((await db.query('select revision from public.account_journal_documents')).rows[0].revision, 3);
});

test('invalid lifecycle inputs and exhausted counters fail atomically', async () => {
  const doc = randomUUID();
  for (const args of [[null,randomUUID(),0], [doc,null,0], [doc,randomUUID(),null],
    [doc,randomUUID(),-1], [doc,randomUUID(),MAX+1]]) await denied(() => remove(...args), '22023');
  for (const source of [null, 0, -1, MAX+1]) await denied(() => restore(doc, randomUUID(), 0, source), '22023');
  await denied(() => history(null), '22023');
  assert.equal((await remove(doc,randomUUID(),0)).kind, 'conflict');
  await commit(doc);
  await admin('update public.account_journal_documents set revision=$1', [MAX]); await login();
  await denied(() => remove(doc,randomUUID(),MAX), '22023');
  assert.deepEqual(await history(doc), []);
  assert.equal((await db.query('select revision from public.account_journal_documents')).rows[0].revision, MAX);
});

test('account deletion cascades history, receipts and tombstones only for the deleted synthetic owner', async () => {
  const doc = randomUUID();
  for (const owner of [A,B]) { await login(owner); await commit(doc); await remove(doc,randomUUID(),1); }
  const tables = ['account_journal_history','account_journal_operations','account_journal_documents'];
  const beforeB = [];
  for (const table of tables) beforeB.push((await admin(`select * from public.${table} where user_id=$1`, [B])).rows);
  await admin('delete from auth.users where id=$1', [A]);
  for (const [i,table] of tables.entries()) {
    assert.equal((await db.query(`select * from public.${table} where user_id=$1`, [A])).rows.length, 0);
    assert.deepEqual((await db.query(`select * from public.${table} where user_id=$1`, [B])).rows, beforeB[i]);
  }
});
