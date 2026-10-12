import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { startCluster, literal } from './local-postgres.mjs';
import { loadOracleMigrationChain, ORACLE_STORAGE_VERSION } from '../local-postgres/oracle-auth-fixture.mjs';

// Opt-in, disposable native PostgreSQL only. The shared cluster guard accepts no
// URL, remote host, existing database, inherited PG credentials or service file.
// Synthetic attested SQL envelopes test the server lock/receipt/consent boundary;
// these are not real Auth, Edge, browser, deployment or account-release evidence.
const args = process.argv.slice(2);
const run = args.includes('--run');
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : null;
const selected = option('--case');
const mutation = option('--mutation');
const cases = ['support', 'cas', 'idempotency', 'isolation', 'withdrawal'];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--run') continue;
  assert.ok(['--pg-bin', '--case', '--mutation'].includes(args[i]), 'Unknown option; remote connections are not accepted');
  assert.ok(args[++i] && !args[i].startsWith('--'), 'Missing option value');
}
assert.ok(!selected || cases.includes(selected), 'Unknown test case');
assert.ok(!mutation || mutation === 'reference-check', 'Unknown mutation');

const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b2222222-2222-4222-8222-222222222222';
const sessions = new Map([[A, randomUUID()], [B, randomUUID()]]);
const signingKey = Buffer.alloc(32, 62);
const payload = { version: 1, algorithm: 'AES-GCM', keyId: 'synthetic',
  iv: Buffer.alloc(12).toString('base64'), ciphertext: Buffer.alloc(16).toString('base64') };
const metadata = (kind, extra = {}) => ({ kind, occurrenceId: null, journalDate: null, eligible: false, ...extra });
const document = (kind, extra = {}) => ({ documentId: randomUUID(), operationId: randomUUID(),
  expectedRevision: 0, encryptedPayload: payload, metadata: metadata(kind), ...extra });
const part = (seed, kind = 'GOAL_PROGRAM_BODY') => document(kind, {
  metadata: metadata(kind, { goalProgramPartId: `sha256:${createHash('sha256').update(seed).digest('hex')}` }),
});
const reference = value => ({ documentId: value.documentId, kind: value.metadata.kind, partId: value.metadata.goalProgramPartId });
const index = parts => document('GOAL_PROGRAM_INDEX', {
  metadata: metadata('GOAL_PROGRAM_INDEX', { goalProgramParts: parts.map(reference) }),
});
const signed = (body, action = 'commit', actor = A) => {
  const raw = JSON.stringify({ domain: 'trainoracle.account-journal.gateway.v1', ownerId: actor,
    action, expiresAt: Math.floor(Date.now() / 1000) + 110, ...body });
  return [raw, createHmac('sha256', signingKey).update(raw).digest('hex'), 'synthetic'];
};
const submit = (connection, envelope) => connection.value(`pg_temp.goal_program_submit(${envelope.map(literal).join(',')})`);
const save = (connection, value, actor = A) => submit(connection, signed(value, 'commit', actor));
const rpc = (connection, name, values) => connection.value(`public.${name}(${values.map(literal).join(',')})`);
let cluster, admin, left, right, pids;

async function login(connection, actor = A, revision = 1) {
  const now = Math.floor(Date.now() / 1000);
  const jwt = { sub: actor, role: 'authenticated', session_id: sessions.get(actor), exp: now + 3600,
    amr: [{ method: 'oauth', timestamp: now }] };
  await connection.query(`reset role; set role authenticated;
    set request.jwt.claim.sub = ${literal(actor)};
    set request.jwt.claims = ${literal(JSON.stringify(jwt))};
    set request.headers = ${literal(JSON.stringify({ 'x-trainoracle-storage-revision': String(revision) }))};`);
}

async function prepare(connection) {
  await connection.query(`set statement_timeout='12s'; set lock_timeout='10s'; set idle_in_transaction_session_timeout='20s';
    create function pg_temp.goal_program_submit(request text, signature text, key_id text)
    returns jsonb language plpgsql security invoker as $$
    begin return public.mutate_account_journal_attested(request,signature,key_id);
    exception when others then return jsonb_build_object('sqlstate',SQLSTATE,'error',case when SQLERRM in
      ('GOAL_PROGRAM_REFERENCE_UNAVAILABLE','STORAGE_CONSENT_REVISION_CHANGED','GATEWAY_ATTESTATION_REQUIRED',
       'ACCOUNT_JOURNAL_OPERATION_REUSED') then SQLERRM else 'UNEXPECTED_SQL_ERROR' end);
    end; $$;`);
}

before(async () => {
  if (!run) return;
  assert.ok(option('--pg-bin'), 'Explicit --pg-bin required');
  cluster = await startCluster(option('--pg-bin'));
  admin = cluster.connect(); left = cluster.connect(); right = cluster.connect();
  await loadOracleMigrationChain({ exec: sql => admin.query(sql) });
  for (const actor of [A, B]) {
    await admin.query(`insert into auth.users(id,created_at,email_confirmed_at,encrypted_password)
      values(${literal(actor)},'2020-01-01',clock_timestamp(),null);
      insert into auth.sessions(id,user_id,not_after)
      values(${literal(sessions.get(actor))},${literal(actor)},clock_timestamp()+interval '1 hour');`);
  }
  await admin.query(`update public.service_feature_controls set enabled=true
      where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC','AUTH_OAUTH');
    insert into public.account_journal_gateway_keys(key_id,secret)
      values('synthetic',decode('${signingKey.toString('hex')}','hex'));
    insert into public.account_storage_operation_reviews(purpose_version,evidence_reference,reviewed_at,approved)
      values(${literal(ORACLE_STORAGE_VERSION)},'SYNTHETIC_NATIVE_CONCURRENCY_ONLY',clock_timestamp(),true);`);
  await prepare(left); await prepare(right);
  for (const actor of [A, B]) {
    await login(left, actor, 0);
    assert.equal(await rpc(left, 'claim_beta_seat', [actor, sessions.get(actor), '1990-01-01',
      ORACLE_STORAGE_VERSION, ORACLE_STORAGE_VERSION]), 'ADMITTED_NEW');
    assert.equal((await rpc(left, 'set_account_storage_consent', [actor, sessions.get(actor), 0,
      ORACLE_STORAGE_VERSION, true, true])).revision, 1);
  }
  const controls = () => admin.value("(select jsonb_agg(to_jsonb(c) order by feature_key) from public.service_feature_controls c)");
  const beforeProposal = await controls();
  await admin.query(readFileSync(new URL('../../operations/goal-program-account-storage.sql', import.meta.url), 'utf8'));
  assert.deepEqual(await controls(), beforeProposal, 'Monthly SQL proposal must not change feature controls');
  if (mutation) {
    // Change only the disposable cluster function, never a source/migration file.
    const original = await admin.value("pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure)");
    const needle = 'perform public.verify_account_goal_program_parts(owner_id,metadata);';
    assert.equal(original.split(needle).length, 2, 'Reference-check mutation must match once');
    await admin.query(`${original.replace(needle, '-- disposable reference-check fault')};`);
  }
  await login(left); await login(right);
  pids = await Promise.all([admin, left, right].map(connection => connection.value('pg_backend_pid()')));
  assert.equal(new Set(pids).size, 3, 'Observer and TWO independent writer connections');
  console.log(`Independent backend PIDs: observer=${pids[0]}, left=${pids[1]}, right=${pids[2]}`);
}, { timeout: 120000 });

after(async () => { if (cluster) await cluster.stop(); }, { timeout: 45000 });
const check = (id, name, work) => test(`${id}: ${name}`, {
  skip: !run ? 'Opt-in only: --run --pg-bin <absolute directory>' : Boolean(selected && selected !== id),
  timeout: 45000,
}, work);

async function waitBlocked(waiting, blocker) {
  const deadline = Date.now() + 4000;
  do {
    const observed = await admin.value(`(select jsonb_build_object('blockers',pg_blocking_pids(pid),
      'event',wait_event,'type',wait_event_type) from pg_stat_activity where pid=${waiting})`);
    if (observed?.blockers.includes(blocker) && observed.type === 'Lock' && observed.event === 'advisory') {
      console.log(`Observed actual advisory wait: backend ${waiting} blocked by ${blocker}`);
      return;
    }
    await delay(20);
  } while (Date.now() < deadline);
  assert.fail(`Backend ${waiting} did not wait on advisory lock held by ${blocker}`);
}

async function simultaneous(one, two) {
  await admin.query(`begin; select pg_advisory_xact_lock(hashtextextended('account_journal_v2:${A}',0));`);
  const pending = Promise.all([submit(left, one), submit(right, two)]);
  pending.catch(() => {});
  try { await waitBlocked(pids[1], pids[0]); await waitBlocked(pids[2], pids[0]); }
  finally { await admin.query('commit;'); await pending; }
  return pending;
}
const stored = id => admin.value(`(select to_jsonb(d) from public.account_journal_documents d
  where user_id=${literal(A)} and document_id=${literal(id)})`);
const receipt = (connection, operationId) => connection.value(`(select result from public.account_journal_operations
  where operation_id=${literal(operationId)})`);

check('support', 'full-chain monthly support is additive and keeps legacy receipts intact', async () => {
  assert.deepEqual(await submit(left, signed({}, 'goalProgramSupport')), { kind: 'goal-program-support', version: 1 });
  const draft = document('DRAFT');
  const first = await save(left, draft);
  assert.equal(first.kind, 'saved'); assert.equal(first.revision, 1);
  assert.deepEqual(await save(right, draft), first);
});

check('cas', 'simultaneous new and existing index CAS has one winner and retains losing immutable parts', async () => {
  const body = part('cas-body'), progress = part('cas-progress-left', 'GOAL_PROGRAM_PROGRESS');
  const alternate = part('cas-progress-right', 'GOAL_PROGRAM_PROGRESS');
  assert.equal((await save(left, body)).kind, 'saved'); assert.equal((await save(left, progress)).kind, 'saved');
  assert.equal((await save(right, alternate)).kind, 'saved');
  const proposal = index([body, progress]);
  const one = proposal, two = { ...proposal, operationId: randomUUID(),
    metadata: metadata('GOAL_PROGRAM_INDEX', { goalProgramParts: [reference(body), reference(alternate)] }) };
  const first = await simultaneous(signed(one), signed(two));
  assert.deepEqual(first.map(result => result.kind).sort(), ['conflict', 'saved']);
  assert.equal((await stored(proposal.documentId)).revision, 1);
  for (const [request, result] of [[one, first[0]], [two, first[1]]]) {
    assert.deepEqual(await receipt(left, request.operationId), result, 'Saved and conflict receipts remain exact');
  }
  const updates = [one, two].map(request => ({ ...request, operationId: randomUUID(), expectedRevision: 1 }));
  const again = await simultaneous(...updates.map(request => signed(request)));
  assert.deepEqual(again.map(result => result.kind).sort(), ['conflict', 'saved']);
  assert.equal((await stored(proposal.documentId)).revision, 2);
  for (const immutable of [body, progress, alternate]) {
    const row = await stored(immutable.documentId);
    assert.equal(row.revision, 1); assert.deepEqual(row.encrypted_payload, immutable.encryptedPayload);
  }
});

check('idempotency', 'concurrent lost-ACK replay returns one operation receipt without incrementing twice', async () => {
  const body = part('idempotency-body'); assert.equal((await save(left, body)).kind, 'saved');
  const proposal = index([body]), request = signed(proposal);
  const results = await simultaneous(request, request);
  assert.equal(results[0].kind, 'saved'); assert.deepEqual(results[1], results[0]);
  assert.equal((await stored(proposal.documentId)).revision, 1);
  assert.deepEqual(await receipt(left, proposal.operationId), results[0]);
  assert.equal(await admin.value(`(select count(*)::int from public.account_journal_operations
    where user_id=${literal(A)} and operation_id=${literal(proposal.operationId)})`), 1);
  assert.deepEqual(await save(right, { ...proposal, expectedRevision: 1 }),
    { sqlstate: '22023', error: 'ACCOUNT_JOURNAL_OPERATION_REUSED' }, 'Same operation cannot change its expected revision');
  assert.deepEqual(await submit(right, request), results[0]);
  assert.equal((await stored(proposal.documentId)).revision, 1);
});

check('isolation', 'B progresses while A holds its lock and cannot borrow A references or owner attestation', async () => {
  const bodyA = part('isolation-A'), bodyB = part('isolation-B');
  assert.equal((await save(left, bodyA)).kind, 'saved');
  await login(right, B); assert.equal((await save(right, bodyB, B)).kind, 'saved');
  const proposalA = index([bodyA]), proposalB = index([bodyB]);
  await left.query('begin;'); assert.equal((await save(left, proposalA)).kind, 'saved');
  try {
    await right.query("set statement_timeout='3s'; set lock_timeout='2s';");
    assert.equal((await save(right, proposalB, B)).kind, 'saved', 'B must finish before A releases its owner lock');
    assert.equal(await right.value(`(select count(*)::int from public.account_journal_documents
      where document_id=${literal(bodyA.documentId)})`), 0, 'RLS hides another owner ciphertext');
    assert.equal(await receipt(left, proposalB.operationId), null, 'RLS hides another owner receipt');
    assert.deepEqual(await save(right, index([bodyA]), B),
      { sqlstate: '22023', error: 'GOAL_PROGRAM_REFERENCE_UNAVAILABLE' }, 'Attested metadata cannot borrow another owner part');
    assert.deepEqual(await submit(right, signed(proposalA)),
      { sqlstate: '42501', error: 'GATEWAY_ATTESTATION_REQUIRED' });
  } finally {
    await left.query('commit;');
    await right.query("set statement_timeout='12s'; set lock_timeout='10s';");
    await login(right);
  }
});

check('withdrawal', 'withdrawal and reconsent never revive an in-flight or stale-pin monthly index', async () => {
  const body = part('withdrawal-body'), progress = part('withdrawal-progress', 'GOAL_PROGRAM_PROGRESS');
  assert.equal((await save(left, body)).kind, 'saved'); assert.equal((await save(right, progress)).kind, 'saved');
  const proposal = index([body, progress]), oldRequest = signed(proposal);
  await left.query('begin;');
  assert.equal((await rpc(left, 'set_account_storage_consent', [A, sessions.get(A), 1,
    ORACLE_STORAGE_VERSION, false, false])).revision, 2);
  const pending = submit(right, oldRequest); pending.catch(() => {});
  try {
    await waitBlocked(pids[2], pids[1]);
    assert.ok(await stored(body.documentId), 'Uncommitted erasure is not visible to the observer');
    assert.equal((await rpc(left, 'set_account_storage_consent', [A, sessions.get(A), 2,
      ORACLE_STORAGE_VERSION, true, true])).revision, 3);
  } finally { await left.query('commit;'); await pending; }
  assert.deepEqual(await pending, { sqlstate: '22023', error: 'GOAL_PROGRAM_REFERENCE_UNAVAILABLE' });
  assert.equal(await stored(body.documentId), null); assert.equal(await stored(progress.documentId), null);
  assert.equal(await stored(proposal.documentId), null); assert.equal(await receipt(right, proposal.operationId), null);
  const freshPart = part('fresh-after-reconsent');
  assert.deepEqual(await save(right, freshPart), { sqlstate: '42501', error: 'STORAGE_CONSENT_REVISION_CHANGED' });
  assert.equal(await stored(freshPart.documentId), null);
  // Explicitly fresh synthetic operations re-stage the immutable referenced
  // bytes under revision 3, then the OLD index request still carries pin 1.
  await login(left, A, 3);
  for (const original of [body, progress]) {
    assert.equal((await save(left, { ...original, operationId: randomUUID() })).kind, 'saved');
  }
  assert.deepEqual(await submit(right, oldRequest),
    { sqlstate: '42501', error: 'STORAGE_CONSENT_REVISION_CHANGED' });
  assert.equal(await stored(proposal.documentId), null); assert.equal(await receipt(right, proposal.operationId), null);
  await login(right, A, 3);
  const current = { ...proposal, operationId: randomUUID() };
  assert.equal((await save(right, current)).kind, 'saved', 'Current pin has a positive control after explicit fresh staging');
  assert.equal((await stored(current.documentId)).revision, 1);
  assert.equal(await receipt(right, proposal.operationId), null, 'Rejected old operation never gains a receipt');
});
