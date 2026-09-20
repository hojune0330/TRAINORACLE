import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { proposeAccountPlanLifecycleTransition as propose, validateAccountPlanLifecycleWrite as guard,
  PLAN_RESTORE_WINDOW_MS } from '../functions/_shared/account-plan-lifecycle.mjs';

const OWNER = 'a1111111-1111-4111-8111-111111111111';
const OTHER = 'b2222222-2222-4222-8222-222222222222';
const OP = 'c3333333-3333-4333-8333-333333333333';
const OP2 = 'd4444444-4444-4444-8444-444444444444';
const OP3 = 'e5555555-5555-4555-8555-555555555555';
const PLAN = `sha256:${'a'.repeat(64)}`, NEXT = `sha256:${'b'.repeat(64)}`;
const NOW = '2026-09-20T00:00:00.000Z';
const plus = ms => new Date(Date.parse(NOW) + ms).toISOString();
const available = planId => ({ planId, status: 'AVAILABLE', deletedAt: null, restoredAt: null });
const state = () => ({ version: 1, ownerId: OWNER, revision: 4, updatedAt: NOW,
  currentPlanId: PLAN, plans: [available(PLAN), available(NEXT)] });
const request = (patch = {}) => ({ version: 1, action: 'DELETE', ownerId: OWNER,
  planId: PLAN, expectedRevision: 4, operationId: OP, ...patch });
const context = (patch = {}) => ({ authenticatedOwnerId: OWNER, serverNow: NOW,
  state: state(), request: request(), priorReceipt: null, ...patch });
const denied = (result, code) => assert.deepEqual(result, { kind: 'rejected', code });
const write = (serverState, action, patch = {}) => ({ authenticatedOwnerId: OWNER,
  serverNow: serverState.updatedAt, state: serverState,
  request: request({ action, expectedRevision: serverState.revision, ...patch }) });

// Sequential fake server only. This models authoritative lookup and clock, not DB atomicity.
function fakeServer() {
  let current = state(), now = NOW;
  const receipts = new Map();
  return {
    get state() { return structuredClone(current); },
    setTime(value) { now = value; },
    dispatch(r) {
      const result = propose(context({ state: current, serverNow: now, request: r,
        priorReceipt: receipts.get(`${OWNER}:${r.operationId}`) ?? null }));
      if (result.kind === 'proposed') {
        current = structuredClone(result.nextState);
        receipts.set(`${OWNER}:${r.operationId}`, structuredClone(result.receipt));
      }
      return result;
    },
    selectNewPlan() {
      const r = request({ action: 'SELECT', planId: NEXT, operationId: OP3, expectedRevision: current.revision });
      assert.equal(guard(write(current, 'SELECT', r)).kind, 'eligible');
      current = { ...current, currentPlanId: NEXT, revision: current.revision + 1, updatedAt: now };
    },
  };
}

test('delete proposes a tombstone and clears current pointer without mutating inputs or accepting payloads', () => {
  const input = context(), before = structuredClone(input);
  const result = propose(input);
  assert.equal(result.kind, 'proposed');
  assert.equal(result.nextState.revision, 5);
  assert.equal(result.nextState.currentPlanId, null);
  assert.deepEqual(result.nextState.plans[0], { planId: PLAN, status: 'DELETED', deletedAt: NOW, restoredAt: null });
  assert.deepEqual(result.nextState.plans[1], before.state.plans[1]);
  assert.deepEqual(result.receipt.request, input.request);
  assert.equal(result.receipt.serverTime, NOW);
  assert.deepEqual(input, before);
  result.nextState.plans[1].status = 'DELETED';
  result.receipt.request.ownerId = OTHER;
  assert.deepEqual(input, before);
  for (const key of ['snapshot', 'progress', 'journal']) {
    denied(propose(context({ state: { ...state(), [key]: {} } })), 'INVALID_SERVER_STATE');
    denied(propose(context({ request: request({ [key]: {} }) })), 'INVALID_REQUEST');
  }
});

test('delete a noncurrent or archived plan preserves the new active pointer', () => {
  for (const status of ['AVAILABLE', 'ARCHIVED']) {
    const s = state(); s.currentPlanId = NEXT; s.plans[0].status = status;
    const result = propose(context({ state: s }));
    assert.equal(result.kind, 'proposed');
    assert.equal(result.nextState.currentPlanId, NEXT);
    assert.equal(result.nextState.plans[0].status, 'DELETED');
  }
});

test('stale delete or restore cannot change state; missing plans cannot be recreated', () => {
  for (const action of ['DELETE', 'RESTORE']) {
    denied(propose(context({ request: request({ action, expectedRevision: 3 }) })), 'STALE_REVISION');
    denied(propose(context({ request: request({ action, planId: `sha256:${'c'.repeat(64)}` }) })), 'PLAN_NOT_FOUND');
  }
  denied(propose(context({ request: request({ action: 'RESTORE' }) })), 'PLAN_NOT_DELETED');
  const server = fakeServer(); server.dispatch(request());
  denied(server.dispatch(request({ expectedRevision: 5, operationId: OP2 })), 'PLAN_DELETED');
});

test('exact replay survives stale revision and expiry without reapplying an old pointer', () => {
  const server = fakeServer(), original = server.dispatch(request());
  server.setTime(plus(1000)); server.selectNewPlan();
  server.setTime(plus(31 * 86400000));
  const before = server.state, replay = server.dispatch(request());
  assert.deepEqual(replay, { kind: 'replay', receipt: original.receipt });
  assert.equal(Object.hasOwn(replay, 'nextState'), false);
  assert.deepEqual(server.state, before);
  assert.equal(server.state.currentPlanId, NEXT);
});

test('same operation ID binds action, plan and expected revision exactly', () => {
  const server = fakeServer(); server.dispatch(request());
  for (const patch of [{ action: 'RESTORE' }, { planId: NEXT }, { expectedRevision: 5 }]) {
    denied(server.dispatch(request(patch)), 'OPERATION_REUSED');
  }
  const result = propose(context());
  denied(propose(context({ state: result.nextState, priorReceipt: result.receipt,
    request: request({ operationId: OP2 }) })), 'OPERATION_REUSED');
  const reordered = Object.fromEntries(Object.entries(request()).reverse());
  assert.equal(server.dispatch(reordered).kind, 'replay');
});

test('cross-owner request, state, receipt and write are rejected even with identical content hashes', () => {
  denied(propose(context({ authenticatedOwnerId: OTHER })), 'ACCESS_DENIED');
  denied(propose(context({ request: request({ ownerId: OTHER }) })), 'ACCESS_DENIED');
  denied(propose(context({ state: { ...state(), ownerId: OTHER } })), 'ACCESS_DENIED');
  const deletion = propose(context()), foreign = structuredClone(deletion.receipt);
  foreign.request.ownerId = OTHER;
  denied(propose(context({ state: deletion.nextState, priorReceipt: foreign })), 'INVALID_RECEIPT');
  for (const action of ['SELECT', 'PROGRESS']) {
    denied(guard({ ...write(state(), action), authenticatedOwnerId: OTHER }), 'ACCESS_DENIED');
  }
  const other = propose(context({ authenticatedOwnerId: OTHER, state: { ...state(), ownerId: OTHER },
    request: request({ ownerId: OTHER }) }));
  assert.equal(other.kind, 'proposed');
  assert.equal(other.receipt.request.ownerId, OTHER);
});

test('restore is archive-only, preserves deletion time and never selects the restored plan', () => {
  for (const newActive of [false, true]) {
    const server = fakeServer(); server.dispatch(request());
    server.setTime(plus(1000));
    if (newActive) server.selectNewPlan();
    const result = server.dispatch(request({ action: 'RESTORE', expectedRevision: server.state.revision, operationId: OP2 }));
    assert.equal(result.kind, 'proposed');
    assert.equal(result.nextState.currentPlanId, newActive ? NEXT : null);
    assert.deepEqual(result.nextState.plans[0], { planId: PLAN, status: 'ARCHIVED', deletedAt: NOW, restoredAt: plus(1000) });
    for (const action of ['SELECT', 'PROGRESS']) denied(guard(write(server.state, action)), 'PLAN_ARCHIVED');
  }
});

test('new active selection makes an in-flight restore stale until explicitly retried with a fresh revision', () => {
  const server = fakeServer(); server.dispatch(request());
  const restore = request({ action: 'RESTORE', expectedRevision: 5, operationId: OP2 });
  server.setTime(plus(1000)); server.selectNewPlan();
  denied(server.dispatch(restore), 'STALE_REVISION');
  assert.equal(server.state.currentPlanId, NEXT);
  assert.equal(server.dispatch({ ...restore, expectedRevision: 6 }).nextState.currentPlanId, NEXT);
});

test('restore window is exactly 30 elapsed days: last millisecond accepted, deadline and later rejected', () => {
  assert.equal(PLAN_RESTORE_WINDOW_MS, 2592000000);
  for (const [elapsed, accepted] of [[0, true], [2591999999, true], [2592000000, false], [2592000001, false]]) {
    const server = fakeServer(); server.dispatch(request()); server.setTime(plus(elapsed));
    const result = server.dispatch(request({ action: 'RESTORE', expectedRevision: 5, operationId: OP2 }));
    if (accepted) assert.equal(result.kind, 'proposed');
    else denied(result, 'RESTORE_EXPIRED');
  }
});

test('restore replay after expiry or later re-delete returns its original receipt, not another restore', () => {
  const server = fakeServer(); server.dispatch(request()); server.setTime(plus(1000));
  const restore = request({ action: 'RESTORE', expectedRevision: 5, operationId: OP2 });
  const original = server.dispatch(restore);
  server.setTime(plus(2000));
  const deletion = server.dispatch(request({ expectedRevision: 6, operationId: OP3 }));
  assert.equal(deletion.nextState.plans[0].deletedAt, plus(2000));
  server.setTime(plus(2592000001));
  assert.deepEqual(server.dispatch(restore), { kind: 'replay', receipt: original.receipt });
  assert.equal(server.state.plans[0].status, 'DELETED');
});

test('stale progress and SELECT are denied before and after deletion and restoration', () => {
  const server = fakeServer();
  for (const action of ['PROGRESS', 'SELECT']) assert.equal(guard(write(server.state, action)).kind, 'eligible');
  server.dispatch(request());
  for (const action of ['PROGRESS', 'SELECT']) {
    denied(guard(write(server.state, action, { expectedRevision: 4 })), 'STALE_REVISION');
    denied(guard(write(server.state, action)), 'PLAN_DELETED');
    denied(guard(write(server.state, action, { planId: `sha256:${'c'.repeat(64)}` })), 'PLAN_NOT_FOUND');
  }
  server.dispatch(request({ action: 'RESTORE', expectedRevision: 5, operationId: OP2 }));
  for (const action of ['PROGRESS', 'SELECT']) {
    denied(guard(write(server.state, action, { expectedRevision: 4 })), 'STALE_REVISION');
    denied(guard(write(server.state, action)), 'PLAN_ARCHIVED');
  }
});

test('invalid timestamps, normalized invalid dates, device time fields and clock rollback fail closed', () => {
  for (const serverNow of [null, 0, new Date(NOW), 'bad', '2026-02-30T00:00:00.000Z',
    '2026-09-20T00:00:00Z', '2026-09-20T09:00:00.000+09:00', '2026-09-20',
    '2026-09-20T24:00:00.000Z', '+010000-01-01T00:00:00.000Z']) {
    denied(propose(context({ serverNow })), 'INVALID_SERVER_TIME');
  }
  denied(propose(context({ serverNow: plus(-1) })), 'INVALID_SERVER_STATE');
  denied(propose(context({ request: request({ deletedAt: plus(2592000000) }) })), 'INVALID_REQUEST');
  const deleted = propose(context()).nextState;
  for (const deletedAt of ['bad', '2026-02-30T00:00:00.000Z', plus(1)]) {
    const corrupt = structuredClone(deleted); corrupt.plans[0].deletedAt = deletedAt;
    denied(propose(context({ state: corrupt })), 'INVALID_SERVER_STATE');
  }
});

test('unknown inputs reject extra, inherited, sparse, accessor and malformed identity/revision data', () => {
  for (const input of [null, undefined, 1, 'x', [], {}, new Date(), { ...context(), extra: true }]) {
    denied(propose(input), 'INVALID_REQUEST');
  }
  for (const patch of [{ version: 2 }, { action: 'PURGE' }, { ownerId: PLAN }, { planId: OWNER },
    { operationId: '' }, ...[0, -1, 1.5, '4', NaN, Infinity, Number.MAX_SAFE_INTEGER - 1]
      .map(expectedRevision => ({ expectedRevision }))]) {
    denied(propose(context({ request: request(patch) })), 'INVALID_REQUEST');
  }
  denied(propose(context({ authenticatedOwnerId: null })), 'AUTH_REQUIRED');
  denied(propose(context({ priorReceipt: undefined })), 'INVALID_RECEIPT');
  denied(propose(context({ request: Object.create(request()) })), 'INVALID_REQUEST');
  const accessor = request();
  Object.defineProperty(accessor, 'ownerId', { get() { assert.fail('must not invoke accessor'); }, enumerable: true });
  denied(propose(context({ request: accessor })), 'INVALID_REQUEST');
  const symbol = request(); symbol[Symbol('hidden')] = true;
  denied(propose(context({ request: symbol })), 'INVALID_REQUEST');
  const sparse = state(); sparse.plans = new Array(2);
  denied(propose(context({ state: sparse })), 'INVALID_SERVER_STATE');
  const extra = state(); extra.plans.extra = true;
  denied(propose(context({ state: extra })), 'INVALID_SERVER_STATE');
  const duplicate = state(); duplicate.plans.push(available(PLAN));
  denied(propose(context({ state: duplicate })), 'INVALID_SERVER_STATE');
  denied(guard({ ...write(state(), 'SELECT'), priorReceipt: null }), 'INVALID_REQUEST');
});

test('inconsistent server metadata and corrupted receipts cannot authorize replay', () => {
  const deletion = propose(context());
  const mutations = [s => { s.currentPlanId = PLAN; }, s => { s.plans[0].restoredAt = NOW; },
    s => { s.plans[1].deletedAt = NOW; }, s => { s.revision = 0; },
    s => { s.plans[0].status = 'PURGED'; }, s => { s.plans.push({ ...available(NEXT), planId: 'bad' }); }];
  for (const mutate of mutations) {
    const s = structuredClone(deletion.nextState); mutate(s);
    denied(propose(context({ state: s })), 'INVALID_SERVER_STATE');
  }
  for (const mutate of [r => { r.revision++; }, r => { r.serverTime = plus(1); },
    r => { r.currentPlanId = PLAN; }, r => { r.lifecycle.planId = NEXT; },
    r => { r.lifecycle.deletedAt = plus(-1); }, r => { r.extra = true; }]) {
    const receipt = structuredClone(deletion.receipt); mutate(receipt);
    denied(propose(context({ state: deletion.nextState, priorReceipt: receipt })), 'INVALID_RECEIPT');
  }
});

test('revision ceiling and bounded metadata do not overflow or evict history', () => {
  const s = state(); s.revision = Number.MAX_SAFE_INTEGER - 2;
  const result = propose(context({ state: s, request: request({ expectedRevision: s.revision }) }));
  assert.equal(result.nextState.revision, Number.MAX_SAFE_INTEGER - 1);
  assert.equal(propose(context({ state: result.nextState, priorReceipt: result.receipt,
    request: result.receipt.request })).kind, 'replay');
  const tooMany = state(); tooMany.plans = Array.from({ length: 101 }, (_, i) => available(`sha256:${i.toString(16).padStart(64, '0')}`));
  tooMany.currentPlanId = null;
  denied(propose(context({ state: tooMany })), 'INVALID_SERVER_STATE');
});

test('latest receipt must agree with current state, not merely have valid field types', () => {
  const deletion = propose(context());
  for (const change of [s => { s.currentPlanId = NEXT; }, s => { s.updatedAt = plus(1); },
    s => { s.plans[0] = available(PLAN); }, s => { s.plans.shift(); }]) {
    const s = structuredClone(deletion.nextState); change(s);
    denied(propose(context({ state: s, serverNow: plus(1), priorReceipt: deletion.receipt })), 'INVALID_RECEIPT');
  }
});

test('restore cannot extend its deadline using a rollback clock or a malformed stored restore time', () => {
  const deletion = propose(context());
  const restore = request({ action: 'RESTORE', expectedRevision: 5, operationId: OP2 });
  denied(propose(context({ state: deletion.nextState, serverNow: plus(-1), request: restore })), 'INVALID_SERVER_STATE');
  const restored = propose(context({ state: deletion.nextState, serverNow: plus(1000), request: restore }));
  const before = structuredClone(restored.nextState);
  for (const restoredAt of [null, plus(-1), plus(2592000000), 'bad']) {
    const s = structuredClone(before); s.updatedAt = plus(2592000000); s.plans[0].restoredAt = restoredAt;
    denied(propose(context({ state: s, serverNow: plus(2592000000) })), 'INVALID_SERVER_STATE');
  }
  assert.deepEqual(restored.nextState, before);
});

test('named fault probes detect owner, replay binding, stale write, expiry and pointer regressions', async () => {
  const source = await readFile(new URL('../functions/_shared/account-plan-lifecycle.mjs', import.meta.url), 'utf8');
  const probes = [
    ['owner', 'if (input.request.ownerId !== input.authenticatedOwnerId)', 'if (false)',
      m => denied(m.proposeAccountPlanLifecycleTransition(context({ request: request({ ownerId: OTHER }) })), 'ACCESS_DENIED')],
    ['binding', '!requestKeys.every(key => request[key] === priorReceipt.request[key])', 'false', m => {
      const d = propose(context());
      denied(m.proposeAccountPlanLifecycleTransition(context({ state: d.nextState, priorReceipt: d.receipt,
        request: request({ action: 'RESTORE' }) })), 'OPERATION_REUSED');
    }],
    ['stale-write', 'if (state.revision !== request.expectedRevision)', 'if (false)',
      m => denied(m.validateAccountPlanLifecycleWrite(write(state(), 'SELECT', { expectedRevision: 3 })), 'STALE_REVISION')],
    ['expiry', '>= PLAN_RESTORE_WINDOW_MS', '> PLAN_RESTORE_WINDOW_MS', m => {
      const d = propose(context());
      denied(m.proposeAccountPlanLifecycleTransition(context({ state: d.nextState, serverNow: plus(2592000000),
        request: request({ action: 'RESTORE', expectedRevision: 5, operationId: OP2 }) })), 'RESTORE_EXPIRED');
    }],
    ['delete-pointer', '? null : state.currentPlanId;', '? state.currentPlanId : state.currentPlanId;',
      m => assert.equal(m.proposeAccountPlanLifecycleTransition(context()).nextState.currentPlanId, null)],
    ['restore-pointer', '? null : state.currentPlanId;', '? null : target.planId;', m => {
      const d = propose(context());
      assert.equal(m.proposeAccountPlanLifecycleTransition(context({ state: d.nextState,
        request: request({ action: 'RESTORE', expectedRevision: 5, operationId: OP2 }) })).nextState.currentPlanId, null);
    }],
  ];
  for (const [name, from, to, check] of probes) {
    assert.equal(source.split(from).length, 2, `${name}: unique fault anchor`);
    const mutant = await import(`data:text/javascript;base64,${Buffer.from(source.replace(from, to)).toString('base64')}`);
    assert.throws(() => check(mutant), { name: 'AssertionError' }, `${name}: behavioral assertion must fail`);
  }
});
