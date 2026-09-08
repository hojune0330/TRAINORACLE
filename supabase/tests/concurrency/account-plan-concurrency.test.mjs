import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { startCluster, literal } from './local-postgres.mjs';
import { A, B, bootstrap, prepareSession, resetFixture, login, plan, index, commit, signed,
  stage, submit, mutate, oldWrite, legacyId, hash, readIndex, readReceipt, readPart } from './fixture.mjs';

const args = process.argv.slice(2);
const run = args.includes('--run');
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : null;
const selected = option('--case');
const mutation = option('--mutation');
const cases = ['cas', 'idempotency', 'legacy-first', 'collection-first', 'isolation'];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--run') continue;
  assert.ok(['--pg-bin', '--case', '--mutation'].includes(args[i]), 'Unknown option; URLs and external connections are not accepted');
  assert.ok(args[++i] && !args[i].startsWith('--'), 'Missing option value');
}
assert.ok(!selected || cases.includes(selected), 'Unknown test case');
assert.ok(!mutation || ['owner-lock', 'replay', 'owner-read'].includes(mutation), 'Unknown mutation');
let cluster, admin, left, right, pids;
before(async () => {
  if (!run) return;
  assert.ok(option('--pg-bin'), 'Explicit --pg-bin required');
  cluster = await startCluster(option('--pg-bin'));
  admin = cluster.connect(); left = cluster.connect(); right = cluster.connect();
  await bootstrap(admin, mutation);
  await prepareSession(left); await prepareSession(right);
  pids = await Promise.all([admin, left, right].map(s => s.value('pg_backend_pid()')));
  assert.equal(new Set(pids).size, 3, 'Observer plus TWO independent PostgreSQL writer connections');
  console.log(`Independent backend PIDs: observer=${pids[0]}, left=${pids[1]}, right=${pids[2]}`);
}, { timeout: 120000 });
beforeEach(async () => {
  if (!run) return;
  await left.query('rollback;'); await right.query('rollback;'); await admin.query('rollback;');
  await resetFixture(admin);
  await login(left); await login(right);
});
after(async () => { if (cluster) await cluster.stop(); }, { timeout: 45000 });

const check = (id, name, fn) => test(`${id}: ${name}`, {
  skip: !run ? 'Opt-in only: --run --pg-bin <absolute directory>' : Boolean(selected && selected !== id),
  timeout: 45000,
}, fn);
async function waitBlocked(waiting, blocker) {
  const deadline = Date.now() + 4000;
  do {
    const state = await admin.value(`(select jsonb_build_object('blockers',pg_blocking_pids(pid),
      'event',wait_event,'type',wait_event_type) from pg_stat_activity where pid=${waiting})`);
    if (state?.blockers.includes(blocker) && state.type === 'Lock' && state.event === 'advisory') {
      console.log(`Observed real advisory wait: backend ${waiting} blocked by ${blocker}`);
      return;
    }
    await delay(20);
  } while (Date.now() < deadline);
  assert.fail(`Backend ${waiting} did not wait on advisory lock held by ${blocker}`);
}
async function simultaneous(a, b) {
  await admin.query(`begin; select pg_advisory_xact_lock(hashtextextended('account_journal_v2:${A}',0));`);
  const first = submit(left, signed('planCommit', a));
  const second = submit(right, signed('planCommit', b));
  // Attach rejection handlers immediately; release the blocker even on an assertion failure.
  const results = Promise.all([first, second]);
  results.catch(() => {});
  try { await waitBlocked(pids[1], pids[0]); await waitBlocked(pids[2], pids[0]); }
  finally { await admin.query('commit;'); await results; }
  return results;
}
const receiptCount = () => admin.value('(select count(*)::int from public.account_plan_collection_receipts)');
const sourceRows = () => admin.value(`(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb)
  from public.account_journal_documents d where user_id=${literal(A)})`);

check('cas', 'same-owner simultaneous commits have exactly one CAS winner and preserve losing parts', async () => {
  const one = plan('cas-left'), two = plan('cas-right');
  await stage(left, one); await stage(right, two);
  const bodies = [commit(index([one], one.planId)), commit(index([two], two.planId))];
  const results = await simultaneous(...bodies);
  assert.deepEqual(results.map(r => r.kind).sort(), ['committed', 'conflict']);
  const winner = results.findIndex(r => r.kind === 'committed'), loser = 1 - winner;
  const state = await readIndex(left);
  assert.equal(state.revision, 1);
  assert.deepEqual(state.index_document, bodies[winner].index);
  assert.deepEqual(state.payload, bodies[winner].payload);
  assert.deepEqual(await readReceipt(left, bodies[winner].operationId), results[winner].receipt);
  assert.equal(await readReceipt(right, bodies[loser].operationId), null);
  assert.equal(await receiptCount(), 1);
  for (const p of [one, two]) {
    assert.deepEqual((await readPart(left, p.snapshot)).payload, p.snapshot.payload);
    assert.deepEqual((await readPart(right, p.progress)).payload, p.progress.payload);
  }
  // Exercise the existing-row CAS as well as the initially absent index row.
  const updates = [commit(state.index_document, state), commit(state.index_document, state)];
  const again = await simultaneous(...updates);
  assert.deepEqual(again.map(r => r.kind).sort(), ['committed', 'conflict']);
  assert.equal((await readIndex(left)).revision, 2);
  assert.equal(await receiptCount(), 2);
  const losingUpdate = updates[again.findIndex(r => r.kind === 'conflict')];
  assert.equal(await readReceipt(right, losingUpdate.operationId), null);
});

check('idempotency', 'same operation concurrently returns one exact receipt without a second revision', async () => {
  const p = plan('same-operation'); await stage(left, p);
  const body = commit(index([p], p.planId));
  const results = await simultaneous(body, body);
  assert.equal(results[0].kind, 'committed');
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].receipt.operationId, body.operationId);
  assert.equal(results[0].receipt.revision, 1);
  assert.equal(await receiptCount(), 1);
  const original = await readIndex(left);
  assert.equal(original.revision, 1);
  const changed = commit(body.index, original, { operationId: body.operationId });
  assert.deepEqual(await mutate(right, 'planCommit', changed), { sqlstate: '22023' });
  assert.deepEqual(await readIndex(right), original);
  assert.equal((await mutate(left, 'planCommit', commit(body.index, original))).receipt.revision, 2);
  assert.deepEqual(await mutate(right, 'planCommit', body), results[0]);
  assert.equal((await readIndex(left)).revision, 2, 'Late replay cannot rewind the current revision');
});

check('legacy-first', 'uncommitted legacy writer blocks collection migration and invalidates source CAS', async () => {
  assert.equal((await submit(left, oldWrite(), true)).revision, 1);
  const p = plan('legacy-first'); await stage(left, p);
  const body = commit(index([p], p.planId), null,
    { legacy: { documentId: legacyId(), revision: 1, fingerprint: hash('synthetic-source') } });
  await left.query('begin;');
  assert.equal((await submit(left, oldWrite(1), true)).revision, 2);
  const pending = mutate(right, 'planCommit', body); pending.catch(() => {});
  try {
    await waitBlocked(pids[2], pids[1]);
    assert.equal((await sourceRows())[0].revision, 1, 'Uncommitted source not visible to observer');
  } finally { await left.query('commit;'); await pending; }
  assert.deepEqual(await pending, { kind: 'conflict' });
  assert.equal(await readIndex(right), null);
  assert.equal(await readReceipt(right, body.operationId), null);
  assert.equal((await sourceRows())[0].revision, 2);
  assert.ok(await readPart(right, p.snapshot));
});

check('collection-first', 'uncommitted collection migration blocks and then denies the legacy writer', async () => {
  assert.equal((await submit(left, oldWrite(), true)).revision, 1);
  const p = plan('collection-first'); await stage(left, p);
  const original = await sourceRows();
  const body = commit(index([p], p.planId), null,
    { legacy: { documentId: legacyId(), revision: 1, fingerprint: hash('synthetic-source') } });
  await left.query('begin;');
  const result = await mutate(left, 'planCommit', body);
  assert.equal(result.kind, 'committed');
  const pending = submit(right, oldWrite(1), true); pending.catch(() => {});
  try {
    await waitBlocked(pids[2], pids[1]);
    assert.equal(await receiptCount(), 0, 'Uncommitted receipt remains invisible');
  } finally { await left.query('commit;'); await pending; }
  assert.deepEqual(await pending, { sqlstate: '42501' });
  assert.deepEqual(await sourceRows(), original, 'Source ciphertext and revision preserved');
  assert.deepEqual(await readReceipt(right, body.operationId), result.receipt);
  assert.equal((await readIndex(right)).revision, 1);
  assert.equal(await receiptCount(), 1);
});

check('isolation', 'account B commits while A holds its lock; cross-owner reads and attestation stay isolated', async () => {
  const a = plan('owner-a'), b = plan('owner-b', B);
  await stage(left, a); await login(right, B); await stage(right, b, B);
  const bodyA = commit(index([a], a.planId)), bodyB = commit(index([b], b.planId), null, { ownerId: B });
  await left.query('begin;');
  const resultA = await mutate(left, 'planCommit', bodyA);
  assert.equal(resultA.kind, 'committed');
  try {
    await right.query("set statement_timeout='3s'; set lock_timeout='2s';");
    const resultB = await mutate(right, 'planCommit', bodyB, B);
    assert.equal(resultB.kind, 'committed', 'B must finish before A releases its lock');
    assert.equal(resultB.receipt.ownerId, B);
    assert.equal((await readIndex(right)).index_document.currentPlanId, b.planId);
    assert.equal(await readPart(right, a.snapshot), null);
    assert.equal(await readReceipt(left, bodyB.operationId), null);
    assert.deepEqual(await submit(right, signed('planCommit', bodyA)), { sqlstate: '42501' });
  } finally {
    await left.query('commit;');
    await right.query("set statement_timeout='12s'; set lock_timeout='10s';");
  }
  assert.equal(await readReceipt(right, bodyA.operationId), null);
  assert.equal(await readPart(left, b.snapshot), null);
  assert.equal((await readIndex(left)).index_document.currentPlanId, a.planId);
  assert.equal((await readIndex(right)).index_document.currentPlanId, b.planId);
  // Identical operation UUID is independently scoped to each authenticated owner.
  const previousB = await readIndex(right);
  const reused = commit(previousB.index_document, previousB, { ownerId: B, operationId: bodyA.operationId });
  const receiptB = await mutate(right, 'planCommit', reused, B);
  assert.equal(receiptB.receipt.ownerId, B);
  assert.equal(receiptB.receipt.revision, 2);
  assert.deepEqual(await readReceipt(left, bodyA.operationId), resultA.receipt);
  assert.equal((await readIndex(left)).revision, 1);
});
