import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { createAccountPlanCollectionHandler, createAccountPlanCollectionRepository,
  accountPlanCollectionDocumentId, MAX_BODY_BYTES } from '../functions/_shared/account-plan-collection-handler.mjs';
import { importJournalKeyring, importJournalAttestor, createAccountJournalHandler, validateAccountJournalDocument } from '../functions/_shared/account-journal-handler.mjs';
import { encryptAccountJournalDocument, decryptAccountJournalDocument } from '../functions/_shared/account-journal-crypto.mjs';
import { splitAccountPlanCollection, accountPlanFingerprint, accountPlanCollectionPartHash } from '../functions/_shared/account-plan-collection-validator.mjs';

const OWNER = 'a1111111-1111-4111-8111-111111111111';
const OTHER = 'b2222222-2222-4222-8222-222222222222';
const OP = 'c3333333-3333-4333-8333-333333333333';
const OP2 = 'd4444444-4444-4444-8444-444444444444';
test('Edge collection configuration delegates JWT checks to the explicit authenticated user gateway', async () => {
  const config = await readFile(new URL('../config.toml', import.meta.url), 'utf8');
  const entry = await readFile(new URL('../functions/account-plan-collection/index.ts', import.meta.url), 'utf8');
  assert.match(config, /\[functions\.account-plan-collection\]\s*verify_jwt\s*=\s*false/u);
  assert.match(entry, /client\.auth\.getUser\(token\)/u);
  assert.match(entry, /if \(error \|\| !data\.user\) return null/u);
  assert.doesNotMatch(entry, /SUPABASE_SERVICE_ROLE_KEY/u);
});
const ORIGIN = 'https://plan.example.test';
const serialized = JSON.stringify({ activeKeyId: 'test', keys: { test: btoa('s'.repeat(32)) } });
let handlerFactory = createAccountPlanCollectionHandler;
// Fault probes import modified bytes; shared source files remain untouched.
if (process.env.PLAN_COLLECTION_MUTATION) {
  const url = new URL('../functions/_shared/account-plan-collection-handler.mjs', import.meta.url);
  let source = await readFile(url, 'utf8');
  const mutations = {
    metadata: ['accountPlanFingerprint(row.metadata) !== accountPlanFingerprint(accountPlanCollectionMetadata(part))', 'false'],
    binding: ['receipt.requestFingerprint !== binding.requestFingerprint', 'false'],
    history: ['previous && validateAccountPlanCollectionUpdate(previous, next) !== true', 'false'],
    owner: ["input.action === 'commit' && input.request.ownerId !== ownerId", 'false'],
    catalogJournals: ['replan && (selected.catalogReplacement || selected.executionReplan || selected.activePlanEdit)', 'false'],
    replanJournals: ['replan && (selected.catalogReplacement || selected.executionReplan || selected.activePlanEdit)', 'false'],
    replanSource: ['selected.executionReplan && !validateExecutionReplanJournalFacts(replan, facts, sourceContext)', 'false'],
    catalogClock: ['!catalogReplacementClockIsCurrent(replan, now())', 'false'],
    successorGuard: ["if (successor && r.journalGuard === undefined && !replan) fail(422, 'JOURNAL_GUARD_REQUIRED');", ''],
    selectionAtomic: ['journalGuard !== undefined ? await repo.commitReplan(', 'false ? await repo.commitReplan('],
    paceDelta: ['...(replan ? { previousState } : {}), guard: r.paceRecordGuard,', 'guard: r.paceRecordGuard,'],
    batchJournal: ['fact.protectsReplacement', 'fact.protectsReplacement'],
  };
  const change = mutations[process.env.PLAN_COLLECTION_MUTATION];
  assert.ok(change && source.includes(change[0]));
  source = process.env.PLAN_COLLECTION_MUTATION === 'catalogClock' ? source.replaceAll(...change) : source.replace(...change);
  if (process.env.PLAN_COLLECTION_MUTATION === 'batchJournal') {
    const validator = await readFile(new URL('./account-plan-collection-validator.mjs', url), 'utf8');
    assert.equal(validator.split('protectsReplacement:').length - 1, 1);
    const broken = validator.replace('protectsReplacement:', 'protectsReplacement:!1&&');
    source = source.replace("'./account-plan-collection-validator.mjs'",
      JSON.stringify(`data:text/javascript;base64,${Buffer.from(broken).toString('base64')}`));
  }
  for (const file of ['account-journal-crypto.mjs', 'account-journal-handler.mjs', 'account-plan-collection-validator.mjs'])
    source = source.replace(`'./${file}'`, JSON.stringify(new URL(file, url).href));
  handlerFactory = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).createAccountPlanCollectionHandler;
}

const { build } = createRequire(new URL('../../app/package.json', import.meta.url))('esbuild');
const built = await build({ stdin: {
  contents: 'export { stateFixture } from "./src/domain/plan-beta-store.test-fixture.ts"; export { replanFixture } from "./src/domain/execution-replan.test-fixture.ts"; export { replacedReplanFixture } from "./src/domain/execution-replan-lineage.test-fixture.ts"; export { prepareExecutionReplan, executionReplanEvidence, replanFingerprint } from "./src/domain/execution-replan.ts"; export { accountPlanEntry } from "./src/domain/account/account-plan-document-schema.ts"; export { createPlannedSessionLogDraft } from "./src/domain/planned-session-link.ts"; export { prepareCatalogReplacement } from "./src/domain/catalog-replacement.ts"; export { ALL_WORKOUT_CATALOG } from "../impl/src/prescription/all-workout-calculator.ts";',
  resolveDir: fileURLToPath(new URL('../../app/', import.meta.url)), loader: 'ts',
}, tsconfig: fileURLToPath(new URL('../../app/tsconfig.json', import.meta.url)),
bundle: true, write: false, platform: 'neutral', format: 'esm' });
const { stateFixture, replanFixture, replacedReplanFixture, prepareExecutionReplan, accountPlanEntry, prepareCatalogReplacement, ALL_WORKOUT_CATALOG,
  executionReplanEvidence, replanFingerprint, createPlannedSessionLogDraft } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const continuityBuilt = await build({ stdin: {
  contents: 'export { deriveCandidateId, derivePairId } from "../impl/src/plan-generator/candidate-identity.ts";',
  resolveDir: fileURLToPath(new URL('../../app/', import.meta.url)), loader: 'ts',
}, tsconfig: fileURLToPath(new URL('../../app/tsconfig.json', import.meta.url)), bundle: true, write: false, platform: 'neutral', format: 'esm' });
const { deriveCandidateId, derivePairId } = await import(`data:text/javascript;base64,${Buffer.from(continuityBuilt.outputFiles[0].text).toString('base64')}`);
function successorDocument() {
  const state = stateFixture(), plan = state.activePlan;
  const continuity = 'balanced:completed-1-rested-0-skipped-0-pain_checkin-0';
  const base = plan.candidateId.replace('no-continuity', continuity);
  const projection = { kind: plan.candidateKind, eventDistanceM: plan.eventDistanceM,
    selectedDetailedTemplateRef: plan.selectedDetailedTemplateRef, selectedEnergyIntent: plan.selectedEnergyIntent,
    sourceMode: plan.sourceMode, selectionAuthority: plan.selectionActor, frame: plan.frame, sessions: plan.sessions };
  plan.candidateId = deriveCandidateId(base, projection);
  plan.pairId = derivePairId(plan.pairId.replace('no-continuity', continuity), plan.candidateId,
    deriveCandidateId(base.replace('beta:balanced:', 'beta:conservative:'), { ...projection, kind: 'CONSERVATIVE' }));
  const entry = accountPlanEntry({ state, evidence: null });
  return { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: { schemaVersion: 1, currentPlanId: entry.planId, plans: [entry] } };
}

function document(count = 1) {
  const plans = Array.from({ length: count }, (_, i) => {
    const snapshot = { state: { ...stateFixture(), generatedAt: `2026-07-24T00:00:${String(i).padStart(2, '0')}.000Z` }, evidence: null };
    return { planId: accountPlanFingerprint(snapshot), snapshot, progress: [], updatedAt: '2026-08-01T00:00:00.000Z', archivedAt: null };
  });
  return { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: { schemaVersion: 1, currentPlanId: plans.at(-1)?.planId ?? null, plans } };
}
const command = (parts, previous = null, overrides = {}) => ({ ownerId: OWNER, operationId: OP,
  expectedRevision: previous ? 1 : 0, previousIndexFingerprint: previous ? accountPlanFingerprint(previous.index) : null,
  previousCurrentPlanId: previous?.index.currentPlanId ?? null, index: parts.index, legacy: null, ...overrides });

async function fixture(options = {}) {
  const material = await importJournalKeyring(serialized);
  const parts = new Map(), receipts = new Map(), calls = { auth: 0, material: 0, status: 0, stage: 0, commit: 0 };
  let index = null;
  const repo = {
    enabled: async () => true,
    attestationStatus: async () => { calls.status++; return { kind: 'ready' }; },
    readIndex: async () => index,
    readPart: async (kind, id) => parts.get(`${kind}:${id}`) ?? null,
    receipt: async id => receipts.get(id) ?? null,
    readLegacy: async () => null,
    stage: async input => {
      calls.stage++;
      const key = `${input.partKind}:${input.partId}`, prior = parts.get(key);
      if (prior && prior.content_hash !== input.contentHash) throw Object.assign(new Error('private SQL'), { code: '22023' });
      if (!prior) parts.set(key, { part_kind: input.partKind, part_id: input.partId, plan_id: input.planId,
        content_hash: input.contentHash, payload: input.payload, metadata: input.metadata });
      return { kind: 'staged', partId: input.partId };
    },
    commit: async input => {
      calls.commit++;
      assert.equal(Object.hasOwn(input, 'ownerId'), false);
      if ((index?.revision ?? 0) !== input.expectedRevision) return { kind: 'conflict' };
      const receipt = { ownerId: OWNER, operationId: input.operationId, revision: input.expectedRevision + 1,
        indexFingerprint: input.indexFingerprint, requestFingerprint: input.requestFingerprint };
      index = { revision: receipt.revision, index_fingerprint: input.indexFingerprint, index_document: input.index, payload: input.payload };
      receipts.set(input.operationId, receipt);
      return { kind: 'committed', receipt };
    },
    ...options.repo,
  };
  const handler = handlerFactory({ allowedOrigins: [ORIGIN, '*', `${ORIGIN}/path`],
    now: () => new Date('2026-09-29T03:00:00.000Z'),
    authenticate: async token => { calls.auth++; return token === 'valid' ? { ownerId: OWNER, repo }
      : token === 'other' ? { ownerId: OTHER, repo } : null; },
    getMaterial: async () => { calls.material++; return material; }, ...options.dependencies });
  const request = (input, init = {}) => handler(new Request('https://edge.example.test/account-plan-collection', {
    method: 'POST', body: JSON.stringify(input), ...init,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid', Origin: ORIGIN, ...init.headers },
  }));
  const stage = async collection => {
    for (const part of [...collection.snapshots, ...collection.progress])
      await check(await request({ action: 'stage', ownerId: OWNER, part }), 200, { kind: 'staged' });
  };
  return { request, handler, repo, material, calls, parts, receipts, stage, getIndex: () => index };
}
async function check(response, status, expected) {
  const value = await response.json();
  assert.equal(response.status, status, JSON.stringify(value));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  if (expected !== undefined) assert.deepEqual(value, expected);
  return value;
}

const paceFixtures = build({ mainFields: ['module', 'main'], stdin: {
  contents: 'export { paceMutationFixture, paceBatchJournalFixture } from "./src/domain/account/account-plan-pace-mutations.test-fixture.ts";',
  resolveDir: fileURLToPath(new URL('../../app/', import.meta.url)), loader: 'ts',
}, tsconfig: fileURLToPath(new URL('../../app/tsconfig.json', import.meta.url)),
bundle: true, write: false, platform: 'neutral', format: 'esm' }).then(result =>
  import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`));

for (const undo of [false, true]) for (const protectedJournal of [false, true]) {
  test(`pace batch ${undo ? 'undo' : 'forward'} ${protectedJournal ? 'rejects later-slot journal' : 'accepts unrelated journal'}`, async t => {
    const { paceBatchJournalFixture } = await paceFixtures;
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
      JSON.stringify(['trainoracle.account.athlete-records.v1', OWNER]))));
    bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
    const h = Buffer.from(bytes.slice(0, 16)).toString('hex');
    const documentId = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    const seed = paceBatchJournalFixture(undo, protectedJournal, { documentId, revision: 1 });
    t.mock.timers.enable({ apis: ['Date'], now: new Date(seed.now) });
    const f = await fixture({ dependencies: { now: () => new Date(seed.now) } });
    f.repo.readAthleteRecords = async () => ({ user_id: OWNER, document_id: documentId, revision: 1, deleted_at: null,
      encrypted_payload: await encryptAccountJournalDocument(JSON.stringify({ version: 3, state: 'ACCOUNT_STATE',
        kind: 'ATHLETE_RECORDS', data: { records: [seed.record, seed.historical] } }), { ownerId: OWNER, documentId }, f.material.active) });
    let entries = seed.originalEntries.map(entry => ({ ...entry, title: '', memo: '' }));
    f.repo.readJournals = async () => Promise.all(entries.map(async entry => {
      const id = seed.journalGuard[0].documentId;
      return { user_id: OWNER, document_id: id, revision: 1, deleted_at: null,
        encrypted_payload: await encryptAccountJournalDocument(JSON.stringify({ version: 2, state: 'FINALIZED',
          kind: 'JOURNAL', entry }), { ownerId: OWNER, documentId: id }, f.material.active) };
    }));
    f.repo.commitReplan = input => f.repo.commit(input);
    let old = accountPlanEntry({ state: seed.initial, evidence: null }, seed.now);
    let oldDoc = { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: {
      schemaVersion: 1, currentPlanId: old.planId, plans: [old] } };
    let before = splitAccountPlanCollection(oldDoc);
    await f.stage(before);
    await check(await f.request({ action: 'commit', request: command(before, null,
      { paceRecordGuard: { documentId, revision: 1 } }) }), 200);
    if (undo) {
      const forward = accountPlanEntry({ state: seed.forward, evidence: null }, seed.now);
      oldDoc = { ...oldDoc, data: { schemaVersion: 1, currentPlanId: forward.planId,
        plans: [{ ...old, archivedAt: seed.now }, forward] } };
      const parts = splitAccountPlanCollection(oldDoc);
      await f.stage(parts);
      await check(await f.request({ action: 'commit', request: command(parts, before, { operationId: OP2 }) }), 200);
      before = parts; old = forward;
    }
    entries = seed.entries;
    const selected = accountPlanEntry({ state: seed.after, evidence: null }, seed.now);
    const after = splitAccountPlanCollection({ ...oldDoc, data: { schemaVersion: 1, currentPlanId: selected.planId,
      plans: [...oldDoc.data.plans.map(plan => plan.planId === old.planId ? { ...plan, archivedAt: seed.now } : plan), selected] } });
    assert.ok(after, 'complete batch document must pass structural validation');
    await f.stage(after);
    const commits = f.calls.commit;
    const response = await f.request({ action: 'commit', request: command(after, before,
      { operationId: 'e5555555-5555-4555-8555-555555555555', expectedRevision: undo ? 2 : 1 }) });
    if (protectedJournal) {
      await check(response, 422, { error: 'RECORDED_SESSION_PROTECTED' });
      assert.equal(f.calls.commit, commits);
      assert.equal(f.getIndex().index_document.currentPlanId, old.planId);
    } else {
      assert.equal((await check(response, 200)).kind, 'committed');
    }
  });
}

for (const kind of ['catalog', 'edit', 'swap', 'replan']) for (const goal of [false, true]) {
  test(`guarded record sources: ${kind} ${goal ? 'goal' : 'actual'} accepts exact sources and preserves history`, async t => {
    const { paceMutationFixture } = await paceFixtures;
    const seed = paceMutationFixture(kind, goal), f = await fixture({ dependencies: { now: () => new Date(seed.now) } });
    // The document transition validator also reads Date outside the injected gateway clock.
    t.mock.timers.enable({ apis: ['Date'], now: new Date(seed.now) });
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
      JSON.stringify(['trainoracle.account.athlete-records.v1', OWNER]))));
    bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
    const h = Buffer.from(bytes.slice(0, 16)).toString('hex');
    const documentId = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    const sourceRow = async (records, revision = 4) => ({ user_id: OWNER, document_id: documentId, revision, deleted_at: null,
      encrypted_payload: await encryptAccountJournalDocument(JSON.stringify({ version: 3, state: 'ACCOUNT_STATE',
        kind: 'ATHLETE_RECORDS', data: { records } }), { ownerId: OWNER, documentId }, f.material.active) });
    let row = await sourceRow([seed.record, seed.historical], 3);
    f.repo.readAthleteRecords = async (owner, id) => {
      assert.equal(owner, OWNER); assert.equal(id, documentId); return row;
    };
    f.repo.commitReplan = input => f.repo.commit(input);
    const old = accountPlanEntry({ state: seed.before, evidence: null }, seed.now);
    const beforeDoc = { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: {
      schemaVersion: 1, currentPlanId: old.planId, plans: [old] } };
    const before = splitAccountPlanCollection(beforeDoc);
    await f.stage(before);
    await check(await f.request({ action: 'commit', request: command(before, null,
      { paceRecordGuard: { documentId, revision: 3 } }) }), 200);
    const selected = accountPlanEntry({ state: seed.after, evidence: null }, seed.now);
    const after = splitAccountPlanCollection({ ...beforeDoc, data: { schemaVersion: 1, currentPlanId: selected.planId,
      plans: [{ ...old, archivedAt: seed.now }, selected] } });
    await f.stage(after);
    const receipt = seed.after.catalogReplacement ?? seed.after.executionReplan ?? seed.after.activePlanEdit;
    let journalRevision = 1;
    f.repo.readJournals = async () => Promise.all(seed.entries.map(async (entry, index) => ({ user_id: OWNER,
      document_id: seed.journalGuard[index].documentId, revision: journalRevision, deleted_at: null,
      encrypted_payload: await encryptAccountJournalDocument(JSON.stringify({ version: 2, state: 'FINALIZED', kind: 'JOURNAL',
        entry: { ...entry, title: '', memo: '' } }), { ownerId: OWNER, documentId: seed.journalGuard[index].documentId }, f.material.active) })));
    let race = false, guarded = 0;
    f.repo.commitReplan = async input => {
      guarded++;
      assert.deepEqual(input.paceRecordGuard, { documentId, revision: 4 });
      assert.deepEqual(input.journalGuard, receipt.journalGuard);
      if (kind === 'catalog') assert.deepEqual(input.calendarGuard, { today: seed.today, timeZone: 'UTC' });
      if (race) row.revision++;
      return row.revision !== input.paceRecordGuard.revision ? { kind: 'conflict' } : f.repo.commit(input);
    };
    const unguarded = command(after, before, { operationId: OP2 });
    const request = { ...unguarded, paceRecordGuard: { documentId, revision: 4 } };
    row = await sourceRow([seed.record]);
    await check(await f.request({ action: 'commit', request: unguarded }), 422, { error: 'PACE_RECORD_SOURCE_REQUIRED' });
    for (const changed of [null, { ...row, revision: 5 }, { ...row, deleted_at: seed.now }, { ...row, user_id: OTHER },
      await sourceRow([]), await sourceRow([{ ...seed.record, performanceSeconds: seed.record.performanceSeconds + 1 }]),
      await sourceRow([{ ...seed.record, savedAt: '2026-09-29T04:00:00.000Z' }]),
      await sourceRow([{ ...seed.record, purpose: goal ? 'RECENT_RESULT' : 'RACE_GOAL', achievedOn: goal ? '2026-09-28' : null }])]) {
      const current = row; row = changed;
      await check(await f.request({ action: 'commit', request }), 409, { error: 'PACE_RECORD_SOURCE_CHANGED' });
      row = current;
    }
    journalRevision = 2;
    await check(await f.request({ action: 'commit', request }), 409, { error: 'JOURNALS_CHANGED' });
    journalRevision = 1;
    race = true;
    await check(await f.request({ action: 'commit', request }), 200, { kind: 'conflict' });
    assert.equal(f.getIndex().index_document.currentPlanId, old.planId);
    race = false; row = await sourceRow([seed.record]);
    const accepted = await check(await f.request({ action: 'commit', request }), 200);
    assert.equal(accepted.kind, 'committed'); assert.equal(guarded, 2);
    assert.equal(f.getIndex().index_document.currentPlanId, selected.planId);
    row = null; journalRevision = 8; f.parts.clear();
    assert.deepEqual(await check(await f.request({ action: 'commit', request }), 200), accepted);
    assert.equal(guarded, 2);
    await check(await f.request({ action: 'commit', request: { ...request, paceRecordGuard: { documentId, revision: 5 } } }),
      409, { error: 'OPERATION_REUSED' });
  });
}

test('ordinary successor requires a guard, uses atomic commit without a replan receipt, and binds replay first', async () => {
  const f = await fixture(), parts = splitAccountPlanCollection(successorDocument());
  assert.ok(parts, 'canonical continuity fixture must be accepted');
  await f.stage(parts);
  const request = command(parts);
  await check(await f.request({ action: 'commit', request }), 422, { error: 'JOURNAL_GUARD_REQUIRED' });
  assert.equal(f.calls.commit, 0);
  await check(await f.request({ action: 'commit', request: { ...request, journalGuard: [] } }), 503);
  assert.equal(f.calls.commit, 0);
  let guarded = 0;
  f.repo.commitReplan = async input => { guarded++; assert.deepEqual(input.journalGuard, []); return f.repo.commit(input); };
  const exact = { ...request, journalGuard: [] };
  const accepted = await check(await f.request({ action: 'commit', request: exact }), 200);
  assert.equal(accepted.kind, 'committed'); assert.equal(guarded, 1);
  f.repo.commitReplan = async () => { throw Error('changed journals'); };
  f.parts.clear();
  assert.deepEqual(await check(await f.request({ action: 'commit', request: exact }), 200), accepted);
  await check(await f.request({ action: 'commit', request }), 409, { error: 'OPERATION_REUSED' });
  await check(await f.request({ action: 'commit', request: { ...exact, journalGuard: [{ documentId: OTHER, revision: 1 }] } }), 409, { error: 'OPERATION_REUSED' });
  for (const journalGuard of [null, [{ documentId: OTHER, revision: 0 }], [{ documentId: OTHER, revision: 1 }, { documentId: OTHER, revision: 1 }]])
    await check(await f.request({ action: 'commit', request: { ...exact, journalGuard } }), 400, { error: 'INVALID_REQUEST' });
})

test('legacy PLAN gateway rejects new successor selection but preserves saved successor progress and receipt replay', async () => {
  const material = await importJournalKeyring(serialized);
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(['trainoracle.account.plan.v1', OWNER]))));
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = Buffer.from(bytes.slice(0, 16)).toString('hex');
  const documentId = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  let current = null, commits = 0;
  const operations = new Map();
  const repo = { enabled: async () => true, read: async () => current,
    operation: async (_owner, id) => operations.get(id) ?? null,
    commit: async input => {
      commits++;
      const result = { kind: 'saved', documentId, operationId: input.operationId, revision: input.expectedRevision + 1 };
      current = { user_id: OWNER, document_id: documentId, revision: result.revision, encrypted_payload: input.encryptedPayload };
      operations.set(input.operationId, { user_id: OWNER, document_id: documentId, operation_id: input.operationId,
        expected_revision: input.expectedRevision, operation_kind: 'commit', proposed_encrypted_payload: input.encryptedPayload, result });
      return result;
    } };
  const handler = createAccountJournalHandler({ authenticate: async () => ({ ownerId: OWNER, repo }),
    getMaterial: async () => material, validateDocument: validateAccountJournalDocument });
  const request = input => handler(new Request('https://edge.example.test/account-journal', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' }, body: JSON.stringify(input) }));
  const successor = successorDocument();
  const command = { action: 'save', documentId, operationId: OP, expectedRevision: 0, document: successor };
  await check(await request(command), 422, { error: 'JOURNAL_GUARD_REQUIRED' });
  assert.equal(commits, 0);
  await check(await request({ ...command, document: document() }), 200);
  const stored = await encryptAccountJournalDocument(JSON.stringify(successor), { ownerId: OWNER, documentId }, material.active);
  current = { user_id: OWNER, document_id: documentId, revision: 1, encrypted_payload: stored };
  const progress = structuredClone(successor);
  progress.data.plans[0].progress = [{ sessionDay: 1, sessionSlot: 'AM', state: 'COMPLETED' }];
  const samePointer = { ...command, operationId: OP2, expectedRevision: 1, document: progress };
  const accepted = await check(await request(samePointer), 200);
  current = null;
  assert.deepEqual(await check(await request(samePointer), 200), accepted);
  assert.equal(commits, 2);
})

test('execution replan uses a guarded commit, preserves originals, and recovers its exact receipt', async () => {
  const f = await fixture(), seed = replanFixture(), prepared = prepareExecutionReplan(seed);
  assert.equal(prepared.kind, 'ready');
  const old = accountPlanEntry({ state: seed.state, evidence: null }, seed.now);
  const beforeDoc = { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: { schemaVersion: 1, currentPlanId: old.planId, plans: [old] } };
  const before = splitAccountPlanCollection(beforeDoc);
  await f.stage(before);
  await check(await f.request({ action: 'commit', request: command(before) }), 200);
  const selected = accountPlanEntry({ state: prepared.proposals[0].after, evidence: null }, seed.now);
  const after = splitAccountPlanCollection({ ...beforeDoc, data: { schemaVersion: 1, currentPlanId: selected.planId,
    plans: [{ ...old, archivedAt: seed.now }, selected] } });
  await f.stage(after);
  const request = command(after, before, { operationId: OP2 });
  // A gateway without the database guard must not fall back to the ordinary writer.
  await check(await f.request({ action: 'commit', request }), 422);
  assert.equal(f.calls.commit, 1);
  let guarded = 0, stale = true;
  f.repo.commitReplan = async ({ journalGuard, ...input }) => {
    guarded++;
    assert.deepEqual(journalGuard, seed.journalGuard);
    return stale ? { kind: 'conflict' } : f.repo.commit(input);
  };
  const documentId = seed.journalGuard[0].documentId;
  f.repo.readJournals = async () => [{ user_id: OWNER, document_id: documentId, revision: 1, deleted_at: null,
    encrypted_payload: await encryptAccountJournalDocument(JSON.stringify({ version: 2, state: 'FINALIZED', kind: 'JOURNAL',
      entry: { ...seed.entries[0], memo: '', title: '' } }), { ownerId: OWNER, documentId }, f.material.active) }];
  await check(await f.request({ action: 'commit', request }), 200, { kind: 'conflict' });
  assert.equal(f.getIndex().index_document.currentPlanId, old.planId);
  stale = false;
  const committed = await check(await f.request({ action: 'commit', request }), 200);
  assert.equal(committed.kind, 'committed');
  assert.equal(f.getIndex().index_document.currentPlanId, selected.planId);
  stale = true;
  assert.deepEqual(await check(await f.request({ action: 'commit', request }), 200), committed);
  assert.equal(guarded, 2);
});

test('execution replan checks actual journal protection for both changed source and move destination', async () => {
  for (const mode of ['source', 'unknown-slot', 'destination', 'other-slot', 'wrong-evidence']) {
    const f = await fixture(), seed = replanFixture(), prepared = prepareExecutionReplan(seed);
    assert.equal(prepared.kind, 'ready');
    const proposal = prepared.proposals.find(p => p.action === (mode === 'destination' ? 'MOVE_LATER' : 'REDUCE'));
    assert.ok(proposal);
    const affected = mode === 'destination' ? proposal.after.executionReplan.target : proposal.after.executionReplan.source;
    const date = new Date(`${seed.state.intake.startDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + affected.day - 1);
    const entry = { ...seed.entries[0], id: 'unlinked-actual', memo: '', title: '', plannedSessionLink: undefined,
      date: date.toISOString().slice(0, 10), activitySlot: mode === 'unknown-slot' ? 'SINGLE' : ['other-slot', 'wrong-evidence'].includes(mode) ? 'PM' : affected.slot };
    const entries = [seed.entries[0], entry], ids = [seed.journalGuard[0].documentId, '22222222-2222-5222-8222-222222222222'];
    const rows = await Promise.all(entries.map(async (e, i) => ({ user_id: OWNER, document_id: ids[i], revision: 1, deleted_at: null,
      encrypted_payload: await encryptAccountJournalDocument(JSON.stringify({ version: 2, state: 'FINALIZED', kind: 'JOURNAL',
        entry: { ...e, memo: '', title: '' } }), { ownerId: OWNER, documentId: ids[i] }, f.material.active) })));
    f.repo.readJournals = async () => rows;
    f.repo.commitReplan = ({ journalGuard: _guard, ...input }) => f.repo.commit(input);
    // The attacker supplies the correct evidence fingerprint but omits the occupied slot from protection.
    const afterState = structuredClone(proposal.after);
    afterState.executionReplan.journalGuard = ids.map(documentId => ({ documentId, revision: 1 }));
    if (mode !== 'wrong-evidence') afterState.executionReplan.evidenceFingerprint = replanFingerprint(executionReplanEvidence(entries));
    const old = accountPlanEntry({ state: seed.state, evidence: null }, seed.now);
    const beforeDoc = { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: { schemaVersion: 1, currentPlanId: old.planId, plans: [old] } };
    const before = splitAccountPlanCollection(beforeDoc);
    await f.stage(before);
    await check(await f.request({ action: 'commit', request: command(before) }), 200);
    const selected = accountPlanEntry({ state: afterState, evidence: null }, seed.now);
    const after = splitAccountPlanCollection({ ...beforeDoc, data: { schemaVersion: 1, currentPlanId: selected.planId,
      plans: [{ ...old, archivedAt: seed.now }, selected] } });
    await f.stage(after);
    const response = await f.request({ action: 'commit', request: command(after, before, { operationId: OP2 }) });
    const expectedStatus = mode === 'other-slot' ? 200 : mode === 'wrong-evidence' ? 409 : 422;
    assert.equal(response.status, expectedStatus, mode);
    await check(response, expectedStatus);
    assert.equal(f.calls.commit, mode === 'other-slot' ? 2 : 1, mode);
    assert.equal(f.getIndex().index_document.currentPlanId, mode === 'other-slot' ? selected.planId : old.planId, mode);
  }
});

test('execution replan authenticates archived source lineage and rejects forged or duplicate journal sources', async () => {
  for (const mode of ['valid', 'missing-source', 'foreign-cycle', 'cross-version-duplicate', 'pain']) {
    const f = await fixture(), seed = replacedReplanFixture();
    let entries = seed.entries, ids = seed.journalGuard.map(item => item.documentId);
    f.repo.readJournals = async () => Promise.all(entries.map(async (entry, i) => ({
      user_id: OWNER, document_id: ids[i], revision: 1, deleted_at: null,
      encrypted_payload: await encryptAccountJournalDocument(JSON.stringify({ version: 2, state: 'FINALIZED', kind: 'JOURNAL',
        entry: { ...entry, title: '', memo: '' } }), { ownerId: OWNER, documentId: ids[i] }, f.material.active),
    })));
    f.repo.commitReplan = ({ journalGuard: _guard, ...input }) => f.repo.commit(input);
    let prior = null, plans = [];
    const operations = [OP, OP2, 'e5555555-5555-4555-8555-555555555555'];
    for (const [index, state] of [...seed.archivedPlans, seed.state].entries()) {
      const entry = accountPlanEntry({ state, evidence: null }, seed.now);
      plans = [...plans.map(p => ({ ...p, archivedAt: p.archivedAt ?? seed.now })), entry];
      const parts = splitAccountPlanCollection({ version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN',
        data: { schemaVersion: 1, currentPlanId: entry.planId, plans } });
      await f.stage(parts);
      await check(await f.request({ action: 'commit', request: command(parts, prior,
        { operationId: operations[index], expectedRevision: index }) }), 200);
      prior = parts;
    }
    const preparation = prepareExecutionReplan(seed);
    assert.equal(preparation.kind, 'ready');
    const afterState = structuredClone(preparation.proposals.find(p => p.action === 'REDUCE').after);
    if (mode === 'missing-source') afterState.executionReplan.sourceJournalId = 'nonexistent';
    if (mode === 'foreign-cycle') {
      const foreign = structuredClone(seed.archivedPlans[0]);
      foreign.generatedAt = '2026-09-28T01:00:00.000Z';
      entries = [{ ...entries[0], plannedSessionLink: createPlannedSessionLogDraft(foreign, foreign.activePlan.sessions[0], seed.now).link }];
    }
    if (mode === 'cross-version-duplicate') {
      const linkedAt = '2026-09-29T03:00:01.000Z';
      entries = [...entries, { ...entries[0], id: 'duplicate-current', savedAt: linkedAt,
        plannedSessionLink: createPlannedSessionLogDraft(seed.state, seed.state.activePlan.sessions[0], linkedAt).link }];
      afterState.executionReplan.acceptedAt = '2026-09-29T03:00:02.000Z';
      ids = [...ids, '22222222-2222-5222-8222-222222222222'];
    }
    if (mode === 'pain') entries = [{ ...entries[0], painCheckStatus: 'SIGNAL_REPORTED', painParts: { knee: 2 } }];
    afterState.executionReplan.evidenceFingerprint = replanFingerprint(executionReplanEvidence(entries));
    afterState.executionReplan.journalGuard = ids.map(documentId => ({ documentId, revision: 1 }));
    const selected = accountPlanEntry({ state: afterState, evidence: null }, afterState.executionReplan.acceptedAt);
    const after = splitAccountPlanCollection({ version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: {
      schemaVersion: 1, currentPlanId: selected.planId, plans: [...plans.map(p => ({ ...p, archivedAt: p.archivedAt ?? seed.now })), selected],
    } });
    await f.stage(after);
    const response = await f.request({ action: 'commit', request: command(after, prior,
      { operationId: 'f6666666-6666-4666-8666-666666666666', expectedRevision: 3 }) });
    const expected = mode === 'valid' ? 200 : 422;
    assert.equal(response.status, expected, mode);
    await check(response, expected, mode === 'valid' ? undefined : { error: 'REPLAN_SOURCE_REQUIRED' });
    assert.equal(f.calls.commit, mode === 'valid' ? 4 : 3, mode);
    assert.equal(f.getIndex().index_document.currentPlanId, mode === 'valid' ? selected.planId : prior.index.currentPlanId, mode);
  }
});

test('replan SQL holds the journal owner lock before comparing all live journal revisions', async () => {
  const sql = await readFile(new URL('../migrations/0040_execution_replan_journal_guard.sql', import.meta.url), 'utf8');
  assert.ok(sql.indexOf('pg_advisory_xact_lock') < sql.indexOf('into actual from'));
  assert.match(sql, /d\.deleted_at is null and i\.document_kind='JOURNAL'/u);
  assert.match(sql, /expected is distinct from actual/u);
  assert.match(sql, /mutate_account_plan_collection_attested\(stripped,stripped_signature,key_id\)/u);
  assert.match(sql, /revoke all on function .* from public,anon,authenticated,service_role/u);
});

test('manual catalog replacement uses the same atomic journal guard and cannot bypass it', async () => {
  const f = await fixture(), seed = replanFixture();
  const documentId = seed.journalGuard[0].documentId;
  const row = { user_id: OWNER, document_id: documentId, revision: 1, deleted_at: null,
    encrypted_payload: await encryptAccountJournalDocument(JSON.stringify({ version: 2, state: 'FINALIZED', kind: 'JOURNAL', entry: { ...seed.entries[0], memo: '', title: '' } }),
      { ownerId: OWNER, documentId }, f.material.active) };
  f.repo.readJournals = async (owner, ids) => { assert.equal(owner, OWNER); assert.deepEqual(ids, [documentId]); return [row]; };
  const prepared = ALL_WORKOUT_CATALOG.filter(e => e.family === 'BASE').map(entry => prepareCatalogReplacement({
    ...seed, address: { day: 4, slot: 'AM' }, catalogId: entry.id, acceptStronger: false, acceptLonger: true,
    inputs: { eventDistanceM: 5000, experience: seed.state.intake.experienceBand, availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [] },
  })).find(result => result.kind === 'ready');
  assert.ok(prepared);
  const old = accountPlanEntry({ state: seed.state, evidence: null }, seed.now);
  const beforeDoc = { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: { schemaVersion: 1, currentPlanId: old.planId, plans: [old] } };
  const before = splitAccountPlanCollection(beforeDoc);
  await f.stage(before);
  await check(await f.request({ action: 'commit', request: command(before) }), 200);
  const selected = accountPlanEntry({ state: prepared.proposal.after, evidence: null }, seed.now);
  const after = splitAccountPlanCollection({ ...beforeDoc, data: { schemaVersion: 1, currentPlanId: selected.planId,
    plans: [{ ...old, archivedAt: seed.now }, selected] } });
  await f.stage(after);
  const request = command(after, before, { operationId: OP2 });
  await check(await f.request({ action: 'commit', request }), 422);
  assert.equal(f.calls.commit, 1);
  let stale = true, guarded = 0;
  f.repo.commitReplan = async ({ journalGuard, ...input }) => {
    guarded++;
    assert.deepEqual(journalGuard, seed.journalGuard);
    return stale ? { kind: 'conflict' } : f.repo.commit(input);
  };
  await check(await f.request({ action: 'commit', request }), 200, { kind: 'conflict' });
  assert.equal(f.getIndex().index_document.currentPlanId, old.planId);
  stale = false;
  const committed = await check(await f.request({ action: 'commit', request }), 200);
  assert.equal(committed.kind, 'committed');
  assert.equal(f.getIndex().index_document.currentPlanId, selected.planId);
  stale = true;
  assert.deepEqual(await check(await f.request({ action: 'commit', request }), 200), committed);
  assert.equal(guarded, 2);
});

test('catalog replacement checks stored journal contents rather than client protection claims', async () => {
  for (const mode of ['recorded', 'unknown-slot', 'unspecified', 'single', 'linked-other-date', 'other-slot', 'wrong-owner', 'stale', 'missing', 'wrong-evidence']) {
    const f = await fixture(), seed = replanFixture();
    const prepared = ALL_WORKOUT_CATALOG.filter(e => e.family === 'BASE').map(entry => prepareCatalogReplacement({
      ...seed, address: { day: 4, slot: 'AM' }, catalogId: entry.id, acceptStronger: false, acceptLonger: true,
      inputs: { eventDistanceM: 5000, experience: seed.state.intake.experienceBand, availableSeconds: null,
        confirmedRequirements: [], fiveK: null, segmentPaces: [] },
    })).find(result => result.kind === 'ready');
    assert.ok(prepared);
    const { plannedSessionLink: _link, ...base } = seed.entries[0];
    const entry = { ...base, memo: '', title: '', date: mode === 'linked-other-date' ? '2026-09-28' : '2026-10-01',
      activitySlot: ['other-slot', 'wrong-evidence'].includes(mode) ? 'PM' : mode === 'unspecified' ? 'UNSPECIFIED' : mode === 'single' ? 'SINGLE' : 'AM' };
    if (mode === 'unknown-slot') delete entry.activitySlot;
    if (mode === 'linked-other-date') entry.plannedSessionLink = createPlannedSessionLogDraft(seed.state,
      seed.state.activePlan.sessions.find(s => s.day === 4), seed.now).link;
    const documentId = seed.journalGuard[0].documentId;
    const row = { user_id: mode === 'wrong-owner' ? OTHER : OWNER, document_id: documentId,
      revision: mode === 'stale' ? 2 : 1, deleted_at: null,
      encrypted_payload: await encryptAccountJournalDocument(JSON.stringify({ version: 2, state: 'FINALIZED', kind: 'JOURNAL', entry }),
        { ownerId: OWNER, documentId }, f.material.active) };
    f.repo.readJournals = async () => mode === 'missing' ? [] : [row];
    f.repo.commitReplan = ({ journalGuard: _guard, ...input }) => f.repo.commit(input);
    const afterState = structuredClone(prepared.proposal.after);
    if (mode !== 'wrong-evidence') afterState.catalogReplacement.evidenceFingerprint = replanFingerprint(executionReplanEvidence([entry]));
    const old = accountPlanEntry({ state: seed.state, evidence: null }, seed.now);
    const beforeDoc = { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: { schemaVersion: 1, currentPlanId: old.planId, plans: [old] } };
    const before = splitAccountPlanCollection(beforeDoc);
    await f.stage(before);
    await check(await f.request({ action: 'commit', request: command(before) }), 200);
    const selected = accountPlanEntry({ state: afterState, evidence: null }, seed.now);
    const after = splitAccountPlanCollection({ ...beforeDoc, data: { schemaVersion: 1, currentPlanId: selected.planId,
      plans: [{ ...old, archivedAt: seed.now }, selected] } });
    await f.stage(after);
    const expected = ['wrong-owner', 'stale', 'missing', 'wrong-evidence'].includes(mode) ? 409 : mode === 'other-slot' ? 200 : 422;
    await check(await f.request({ action: 'commit', request: command(after, before, { operationId: OP2 }) }), expected);
    assert.equal(f.calls.commit, mode === 'other-slot' ? 2 : 1, mode);
    assert.equal(f.getIndex().index_document.currentPlanId, mode === 'other-slot' ? selected.planId : old.planId, mode);
  }
});

test('catalog replacement rejects stale calendar days with server time and preserves later receipt recovery', async () => {
  let clock = new Date('2026-09-29T03:00:00.000Z');
  const f = await fixture({ dependencies: { now: () => clock } }), seed = replanFixture();
  const prepared = ALL_WORKOUT_CATALOG.filter(e => e.family === 'BASE').map(entry => prepareCatalogReplacement({
    ...seed, entries: [], journalGuard: [], timeZone: 'Asia/Seoul', address: { day: 4, slot: 'AM' },
    catalogId: entry.id, acceptStronger: false, acceptLonger: true,
    inputs: { eventDistanceM: 5000, experience: seed.state.intake.experienceBand, availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [] },
  })).find(result => result.kind === 'ready');
  assert.ok(prepared);
  f.repo.readJournals = async () => [];
  f.repo.commitReplan = ({ journalGuard: _guard, ...input }) => f.repo.commit(input);
  const old = accountPlanEntry({ state: seed.state, evidence: null }, seed.now);
  const beforeDoc = { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: { schemaVersion: 1, currentPlanId: old.planId, plans: [old] } };
  const before = splitAccountPlanCollection(beforeDoc);
  await f.stage(before);
  await check(await f.request({ action: 'commit', request: command(before) }), 200);
  const selected = accountPlanEntry({ state: prepared.proposal.after, evidence: null }, seed.now);
  const after = splitAccountPlanCollection({ ...beforeDoc, data: { schemaVersion: 1, currentPlanId: selected.planId,
    plans: [{ ...old, archivedAt: seed.now }, selected] } });
  await f.stage(after);
  const request = command(after, before, { operationId: OP2 });
  clock = new Date('2026-09-29T15:00:00.000Z');
  await check(await f.request({ action: 'commit', request }), 409, { error: 'PLAN_DATE_CHANGED' });
  assert.equal(f.calls.commit, 1);
  clock = new Date('2026-09-29T03:00:00.000Z');
  const committed = await check(await f.request({ action: 'commit', request }), 200);
  clock = new Date('2026-10-05T03:00:00.000Z');
  assert.deepEqual(await check(await f.request({ action: 'commit', request }), 200), committed);
  assert.equal(f.calls.commit, 2);
});

test('catalog replacement rejects an erased predecessor progress snapshot at the gateway', async () => {
  const f = await fixture(), seed = replanFixture();
  const prepared = ALL_WORKOUT_CATALOG.filter(e => e.family === 'BASE').map(entry => prepareCatalogReplacement({
    ...seed, entries: [], journalGuard: [], address: { day: 4, slot: 'AM' }, catalogId: entry.id,
    acceptStronger: false, acceptLonger: true,
    inputs: { eventDistanceM: 5000, experience: seed.state.intake.experienceBand, availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [] },
  })).find(result => result.kind === 'ready');
  assert.ok(prepared);
  const old = accountPlanEntry({ state: seed.state, evidence: null }, seed.now);
  assert.ok(old.progress.length > 0);
  const beforeDoc = { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: { schemaVersion: 1, currentPlanId: old.planId, plans: [old] } };
  const before = splitAccountPlanCollection(beforeDoc);
  await f.stage(before);
  await check(await f.request({ action: 'commit', request: command(before) }), 200);
  const selected = accountPlanEntry({ state: prepared.proposal.after, evidence: null }, seed.now);
  const after = splitAccountPlanCollection({ ...beforeDoc, data: { schemaVersion: 1, currentPlanId: selected.planId,
    plans: [{ ...old, archivedAt: seed.now, progress: [] }, selected] } });
  await f.stage(after);
  f.repo.readJournals = async () => [];
  f.repo.commitReplan = input => f.repo.commit(input);
  await check(await f.request({ action: 'commit', request: command(after, before, { operationId: OP2 }) }), 422,
    { error: 'INVALID_DOCUMENT_UPDATE' });
  assert.equal(f.calls.commit, 1);
  assert.equal(f.getIndex().index_document.currentPlanId, old.planId);
});

test('stage rejects missing or mismatched intended owner before key access or storage', async () => {
  const f = await fixture();
  await check(await f.request({ action: 'stage', part: {} }), 400);
  await check(await f.request({ action: 'stage', ownerId: OWNER, part: {} },
    { headers: { Authorization: 'Bearer other' } }), 403);
  assert.equal(f.calls.material, 0);
  assert.equal(f.parts.size, 0);
});

test('stage/read/commit use real crypto, strip SQL partId and leave selection unchanged until commit', async () => {
  const f = await fixture(), collection = splitAccountPlanCollection(document());
  await check(await f.request({ action: 'readIndex' }), 200, { kind: 'missing' });
  await f.stage(collection);
  assert.equal(f.getIndex(), null);
  for (const part of [...collection.snapshots, ...collection.progress]) {
    const row = f.parts.get(`${part.kind}:${part.id}`);
    assert.equal(JSON.stringify(row).includes('BETA_ACTIVE_PLAN_SNAPSHOT'), false);
    await check(await f.request({ action: 'readPart', partKind: part.kind, partId: part.id }), 200, { kind: 'part', part });
  }
  const r = command(collection);
  const saved = await check(await f.request({ action: 'commit', request: r }), 200);
  assert.equal(saved.kind, 'committed');
  assert.equal(saved.receipt.requestFingerprint, accountPlanFingerprint(r));
  assert.equal(saved.receipt.indexFingerprint, accountPlanFingerprint(collection.index));
  await check(await f.request({ action: 'readIndex' }), 200, { kind: 'index', revision: 1, index: collection.index });
  await check(await f.request({ action: 'receipt', operationId: OP }), 200, { kind: 'receipt', receipt: saved.receipt });
  assert.equal(f.calls.status, 8);
});

test('exact replay succeeds without keys or part revalidation; same operation with altered binding rejects', async () => {
  const collection = splitAccountPlanCollection(document()), r = command(collection);
  const receipt = { ownerId: OWNER, operationId: OP, revision: 1, indexFingerprint: accountPlanFingerprint(r.index), requestFingerprint: accountPlanFingerprint(r) };
  const f = await fixture({ repo: { receipt: async () => receipt, readPart: async () => { throw Error('must not read'); } },
    dependencies: { getMaterial: async () => { throw Error('old key gone'); } } });
  await check(await f.request({ action: 'commit', request: r }), 200, { kind: 'committed', receipt });
  await check(await f.request({ action: 'commit', request: { ...r, legacy: { documentId: OP2, revision: 1, fingerprint: accountPlanFingerprint(document()) } } }),
    409, { error: 'OPERATION_REUSED' });
});

test('owner mismatch rejects before receipt lookup and cross-owner ciphertext fails AAD', async () => {
  const f = await fixture(), collection = splitAccountPlanCollection(document());
  await check(await f.request({ action: 'commit', request: command(collection, null, { ownerId: OTHER }) }), 403, { error: 'ACCESS_DENIED' });
  await f.stage(collection);
  const part = collection.snapshots[0];
  await check(await f.request({ action: 'readPart', partKind: part.kind, partId: part.id }, { headers: { Authorization: 'Bearer other' } }),
    503, { error: 'SERVICE_UNAVAILABLE' });
  const address = await accountPlanCollectionDocumentId(OWNER, part.kind, part.id);
  assert.notEqual(address, await accountPlanCollectionDocumentId(OTHER, part.kind, part.id));
  assert.notEqual(address, await accountPlanCollectionDocumentId(OWNER, 'PLAN_PROGRESS', part.id));
});

test('stored part metadata, hash, identity, ciphertext and index plaintext mismatch fail closed', async () => {
  for (const corrupt of [row => { row.metadata.snapshotId = OP; }, row => { row.content_hash = accountPlanFingerprint('wrong'); },
    row => { row.plan_id = accountPlanFingerprint('other'); }, row => { row.part_id = accountPlanFingerprint('other'); },
    row => { row.payload = { ...row.payload, ciphertext: `AAAA${row.payload.ciphertext.slice(4)}` }; }]) {
    const f = await fixture(), collection = splitAccountPlanCollection(document());
    await f.stage(collection);
    const part = collection.snapshots[0];
    corrupt(f.parts.get(`${part.kind}:${part.id}`));
    await check(await f.request({ action: 'readPart', partKind: part.kind, partId: part.id }), 503, { error: 'SERVICE_UNAVAILABLE' });
  }
  const f = await fixture(), collection = splitAccountPlanCollection(document());
  await f.stage(collection);
  await check(await f.request({ action: 'commit', request: command(collection) }), 200);
  f.getIndex().index_document = { ...collection.index, currentPlanId: null };
  await check(await f.request({ action: 'readIndex' }), 503, { error: 'SERVICE_UNAVAILABLE' });
});

test('strict HTTP actions, nested request keys, malformed JSON, byte bounds, methods and CORS', async () => {
  const f = await fixture(), r = command(splitAccountPlanCollection(document()));
  for (const input of [{ action: 'status' }, { action: 'readIndex', ownerId: OWNER }, { action: 'stage', part: {}, ownerId: OWNER, extra: true },
    { action: 'commit', request: { ...r, authorization: true } }, { action: 'readPart', partKind: 'PLAN', partId: OP }, []])
    await check(await f.request(input), 400, { error: 'INVALID_REQUEST' });
  await check(await f.request({ action: 'readIndex' }, { body: '{' }), 400, { error: 'INVALID_REQUEST' });
  await check(await f.request({}, { body: ' '.repeat(MAX_BODY_BYTES + 1) }), 413, { error: 'BODY_TOO_LARGE' });
  await check(await f.request({}, { headers: { 'Content-Type': 'text/plain' } }), 415, { error: 'UNSUPPORTED_MEDIA_TYPE' });
  await check(await f.request({}, { headers: { Origin: `${ORIGIN}.evil` } }), 403);
  await check(await f.request({}, { headers: { Authorization: 'Bearer expired' } }), 401);
  await check(await f.request({}, { method: 'GET', body: undefined }), 405);
  const preflight = await f.request({}, { method: 'OPTIONS', body: undefined, headers: {
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), ORIGIN);
  await check(await f.request({}, { method: 'OPTIONS', body: undefined, headers: {
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-arbitrary' } }), 403);
});

test('stage rejects oversized/invalid part and accepts valid unselected progress without selection authority', async () => {
  const f = await fixture(), part = splitAccountPlanCollection(document()).progress[0];
  await check(await f.request({ action: 'stage', ownerId: OWNER, part: { ...part, progress: ['x'.repeat(500_000)] } }), 422);
  await check(await f.request({ action: 'stage', ownerId: OWNER, part: { ...part, id: accountPlanFingerprint('wrong') } }), 422);
  await check(await f.request({ action: 'stage', ownerId: OWNER, part }), 200, { kind: 'staged' });
  assert.equal(f.getIndex(), null);
  assert.equal(f.calls.commit, 0);
});

test('commit independently loads parts, rejects loss of history and preserves current on failed CAS', async () => {
  const f = await fixture(), before = splitAccountPlanCollection(document(2));
  await check(await f.request({ action: 'commit', request: command(before) }), 422, { error: 'MISSING_PART' });
  await f.stage(before);
  await check(await f.request({ action: 'commit', request: command(before) }), 200);
  const lost = document(2); lost.data.plans.shift();
  const next = splitAccountPlanCollection(lost);
  await check(await f.request({ action: 'commit', request: command(next, before, { operationId: OP2 }) }), 422, { error: 'INVALID_DOCUMENT_UPDATE' });
  await check(await f.request({ action: 'commit', request: command(before, null, { operationId: OP2 }) }), 200, { kind: 'conflict' });
  assert.equal(f.getIndex().revision, 1);
  assert.equal(f.calls.commit, 1);
});

test('valid progress replacement commits but broken full-join fingerprint never reaches SQL', async () => {
  const f = await fixture(), doc = document(), before = splitAccountPlanCollection(doc);
  await f.stage(before);
  await check(await f.request({ action: 'commit', request: command(before) }), 200);
  doc.data.plans[0].progress = [{ sessionDay: 1, sessionSlot: 'AM', state: 'COMPLETED' }];
  const next = splitAccountPlanCollection(doc);
  await f.stage(next);
  await check(await f.request({ action: 'commit', request: command({ ...next,
    index: { ...next.index, documentFingerprint: accountPlanFingerprint('wrong') } }, before, { operationId: OP2 }) }), 422);
  await check(await f.request({ action: 'commit', request: command(next, before, { operationId: OP2 }) }), 200);
  assert.equal(f.getIndex().revision, 2);
});

test('consent revocation and authenticated status failures deny requests with redacted errors', async () => {
  for (const repo of [{ enabled: async () => false },
    { attestationStatus: async () => { throw Object.assign(Error('secret SQL'), { code: '42501' }); } }]) {
    const f = await fixture({ repo });
    await check(await f.request({ action: 'readIndex' }), 403, { error: 'ACCESS_DENIED' });
    assert.equal(f.calls.material, 0);
  }
  const f = await fixture({ repo: { readIndex: async () => { throw Error('secret SQL'); } } });
  await check(await f.request({ action: 'readIndex' }), 503, { error: 'SERVICE_UNAVAILABLE' });
  const revoked = await fixture({ repo: { enabled: (() => { let n = 0; return async () => ++n === 1; })() } });
  await check(await revoked.request({ action: 'readIndex' }), 403, { error: 'ACCESS_DENIED' });
});

test('repository uses exact read RPCs and signs plan actions with existing domain plus owner', async () => {
  const calls = [];
  const attest = await importJournalAttestor(JSON.stringify({ keyId: 'synthetic', key: btoa('h'.repeat(32)) }));
  const repo = createAccountPlanCollectionRepository({ rpc: async (name, args) => {
    calls.push({ name, args }); return { data: { kind: 'ready' }, error: null };
  } }, { ownerId: OWNER, attest });
  await repo.attestationStatus(); await repo.readIndex(); await repo.readPart('PLAN_PROGRESS', 'id'); await repo.receipt(OP);
  await repo.stage({ partId: 'id', payload: { ciphertext: 'synthetic' } }); await repo.commit({ operationId: OP });
  assert.deepEqual(calls.slice(1, 4), [
    { name: 'read_account_plan_collection_index', args: undefined },
    { name: 'read_account_plan_collection_part', args: { part_kind: 'PLAN_PROGRESS', part_id: 'id' } },
    { name: 'read_account_plan_collection_receipt', args: { operation_id: OP } },
  ]);
  for (const [i, action] of [[0, 'status'], [4, 'planStage'], [5, 'planCommit']]) {
    assert.equal(calls[i].name, i === 0 ? 'mutate_account_journal_attested' : 'mutate_account_plan_collection_attested');
    const signed = JSON.parse(calls[i].args.request_text);
    assert.equal(signed.domain, 'trainoracle.account-journal.gateway.v1');
    assert.equal(signed.ownerId, OWNER); assert.equal(signed.action, action);
  }
});

test('encryption separates owner, namespace, part kind and ID with nonextractable runtime keys', async () => {
  const material = await importJournalKeyring(serialized);
  const id = await accountPlanCollectionDocumentId(OWNER, 'PLAN_COLLECTION', 'index');
  const payload = await encryptAccountJournalDocument('{}', { ownerId: OWNER, documentId: id }, material.active);
  assert.equal(material.active.key.extractable, false);
  assert.equal(await decryptAccountJournalDocument(payload, { ownerId: OWNER, documentId: id }, material.active), '{}');
  for (const documentId of [await accountPlanCollectionDocumentId(OWNER, 'PLAN_PROGRESS', 'index'),
    await accountPlanCollectionDocumentId(OWNER, 'PLAN_COLLECTION', 'other')])
    await assert.rejects(decryptAccountJournalDocument(payload, { ownerId: OWNER, documentId }, material.active));
  assert.equal(accountPlanCollectionPartHash(document()) === accountPlanFingerprint(document()), false);
});

async function fixedLegacyId(owner) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(JSON.stringify(['trainoracle.account.plan.v1', owner]))));
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = Buffer.from(bytes.slice(0, 16)).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

test('legacy migration requires fixed owner document, exact logical contents and revision without deleting source', async () => {
  const doc = document(), collection = splitAccountPlanCollection(doc), documentId = await fixedLegacyId(OWNER);
  for (const mode of ['valid', 'revision', 'contents', 'other-owner', 'other-document', 'deleted']) {
    const f = await fixture();
    const source = mode === 'contents' ? document(2) : doc;
    const row = { user_id: mode === 'other-owner' ? OTHER : OWNER, document_id: documentId,
      revision: mode === 'revision' ? 2 : 1, deleted_at: mode === 'deleted' ? '2026-08-02T00:00:00.000Z' : null,
      encrypted_payload: await encryptAccountJournalDocument(JSON.stringify(source), { ownerId: OWNER, documentId }, f.material.active) };
    f.repo.readLegacy = async (owner, id) => { assert.equal(owner, OWNER); assert.equal(id, documentId); return row; };
    await f.stage(collection);
    const r = command(collection, null, { legacy: { documentId: mode === 'other-document' ? OP2 : documentId,
      revision: 1, fingerprint: accountPlanFingerprint(doc) } });
    const result = await check(await f.request({ action: 'commit', request: r }), mode === 'valid' ? 200
      : ['revision', 'other-owner', 'deleted'].includes(mode) ? 409 : 422);
    if (mode === 'valid') assert.equal(result.kind, 'committed');
    assert.equal(f.calls.commit, mode === 'valid' ? 1 : 0);
    assert.ok(row.encrypted_payload);
  }
});

test('atomic repository conflict and concurrent identical winner are handled after independent validation', async () => {
  const collection = splitAccountPlanCollection(document()), r = command(collection);
  const receipt = { ownerId: OWNER, operationId: OP, revision: 1,
    indexFingerprint: accountPlanFingerprint(r.index), requestFingerprint: accountPlanFingerprint(r) };
  for (const mode of ['conflict', 'concurrent', 'concurrent-reused']) {
    const f = await fixture();
    await f.stage(collection);
    f.repo.commit = async input => {
      assert.equal(input.expectedRevision, 0);
      assert.equal(input.previousIndexFingerprint, null);
      assert.equal(input.previousCurrentPlanId, null);
      if (mode === 'conflict') return { kind: 'conflict' };
      f.receipts.set(OP, { ...receipt, requestFingerprint: mode === 'concurrent-reused' ? accountPlanFingerprint('other') : receipt.requestFingerprint });
      throw Object.assign(Error('private concurrent error'), { code: '22023' });
    };
    await check(await f.request({ action: 'commit', request: r }), mode === 'concurrent-reused' ? 409 : 200,
      mode === 'conflict' ? { kind: 'conflict' } : mode === 'concurrent' ? { kind: 'committed', receipt } : { error: 'OPERATION_REUSED' });
  }
});

test('wrong-owner and malformed receipts never become successful recovery', async () => {
  const r = command(splitAccountPlanCollection(document()));
  for (const receipt of [{ ownerId: OTHER, operationId: OP, revision: 1,
    indexFingerprint: accountPlanFingerprint(r.index), requestFingerprint: accountPlanFingerprint(r) },
  { ownerId: OWNER, operationId: OP, revision: 1, indexFingerprint: 'invalid', requestFingerprint: 'invalid' }]) {
    const f = await fixture({ repo: { receipt: async () => receipt } });
    await check(await f.request({ action: 'receipt', operationId: OP }), 503, { error: 'SERVICE_UNAVAILABLE' });
    await check(await f.request({ action: 'commit', request: r }), 503, { error: 'SERVICE_UNAVAILABLE' });
    assert.equal(f.calls.material, 0);
  }
});

test('real PGlite 0037 with gateway and authenticated repository round trips 18 V3 frames, isolates owners and replays', { timeout: 60_000 }, async () => {
  const require = createRequire(new URL('./local-postgres/package.json', import.meta.url));
  const { PGlite } = require('@electric-sql/pglite');
  const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
  const db = new PGlite({ extensions: { pgcrypto } });
  const secret = Buffer.alloc(32, 71);
  const attest = await importJournalAttestor(JSON.stringify({ keyId: 'fixture', key: secret.toString('base64') }));
  const material = await importJournalKeyring(serialized);
  const seed = replanFixture();
  seed.now = new Date().toISOString(); seed.today = seed.now.slice(0, 10);
  const previousDay = new Date(Date.parse(seed.now) - 86400_000).toISOString().slice(0, 10);
  seed.state.intake.startDate = previousDay;
  seed.entries = seed.entries.map(entry => ({ ...entry, date: previousDay, savedAt: `${previousDay}T09:00:00.000Z`,
    plannedSessionLink: createPlannedSessionLogDraft(seed.state, seed.state.activePlan.sessions[0], `${previousDay}T00:00:00.000Z`).link }));
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on all functions in schema auth to anon,authenticated,service_role;`);
    const directory = new URL('../migrations/', import.meta.url);
    for (const name of (await readdir(directory)).filter(name => /^\d+_.+\.sql$/u.test(name) && name < '0038').sort())
      await db.exec(await readFile(new URL(name, directory), 'utf8'));
    await db.exec(await readFile(new URL('0040_execution_replan_journal_guard.sql', directory), 'utf8'));
    let calendarSql = await readFile(new URL('0043_catalog_replacement_calendar_guard.sql', directory), 'utf8');
    if (process.env.PLAN_COLLECTION_SQL_MUTATION === 'calendarClock') {
      const expression = "to_char(clock_timestamp() at time zone (calendar->>'timeZone'),'YYYY-MM-DD') is distinct from calendar->>'today'";
      assert.equal(calendarSql.split(expression).length - 1, 2);
      calendarSql = calendarSql.replaceAll(expression, 'false');
    }
    await db.exec(calendarSql);
    await db.exec(await readFile(new URL('0044_plan_successor_guard_binding.sql', directory), 'utf8'));
    for (const owner of [OWNER, OTHER]) {
      await db.query('insert into auth.users(id) values($1)', [owner]);
      await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
        values($1,'1990-01-01','fixture','fixture',clock_timestamp())`, [owner]);
      await db.query('insert into public.beta_enrollments(user_id) values($1)', [owner]);
    }
    await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2');");
    await db.query('insert into public.account_journal_gateway_keys(key_id,secret) values($1,$2)', ['fixture', secret]);
    // Only these observed RPC names/arguments can reach local PostgreSQL.
    const signatures = {
      service_feature_enabled: ['feature_key_input'], account_network_access_allowed: ['target_user'],
      mutate_account_journal_attested: ['request_text', 'signature', 'key_id'],
      mutate_account_plan_collection_attested: ['request_text', 'signature', 'key_id'],
      mutate_account_plan_replan_attested: ['request_text', 'signature', 'key_id'],
      mutate_account_plan_catalog_replacement_attested: ['request_text', 'signature', 'key_id'],
      read_account_plan_collection_index: [], read_account_plan_collection_part: ['part_kind', 'part_id'],
      read_account_plan_collection_receipt: ['operation_id'],
    };
    let calendarDateOverride = null, lastCalendarInput = null, lastReplanInput = null;
    const client = { from: table => {
      assert.equal(table, 'account_journal_documents');
      return { select: columns => {
        assert.equal(columns, 'user_id,document_id,revision,encrypted_payload,deleted_at');
        return { eq: (column, owner) => {
          assert.equal(column, 'user_id');
          return { in: async (key, ids) => {
            assert.equal(key, 'document_id');
            try { return { data: (await db.query(`select user_id,document_id,revision,encrypted_payload,deleted_at
              from public.account_journal_documents where user_id=$1 and document_id=any($2::uuid[])`, [owner, ids])).rows, error: null }; }
            catch (error) { return { data: null, error }; }
          } };
        } };
      } };
    }, rpc: async (name, args = {}) => {
      assert.ok(Object.hasOwn(signatures, name));
      if (name === 'mutate_account_plan_replan_attested') {
        const { domain: _domain, ownerId: _owner, action: _action, expiresAt: _expiry, ...input } = JSON.parse(args.request_text);
        lastReplanInput = input;
      }
      if (name === 'mutate_account_plan_catalog_replacement_attested') {
        const { domain: _domain, ownerId, action, expiresAt: _expiry, ...input } = JSON.parse(args.request_text);
        lastCalendarInput = input;
        if (calendarDateOverride !== null) args = await attest(ownerId, action,
          { ...input, calendarGuard: { ...input.calendarGuard, today: calendarDateOverride } });
      }
      const values = signatures[name].map(key => args[key]);
      try {
        const result = await db.query(`select public.${name}(${values.map((_, i) => `$${i + 1}`).join(',')}) as result`, values);
        return { data: result.rows[0].result, error: null };
      } catch (error) { return { data: null, error }; }
    } };
    let keysAvailable = true;
    const f = await fixture({ dependencies: {
      now: () => new Date(seed.now),
      getMaterial: async () => { if (!keysAvailable) throw Error('retired key'); return material; },
      authenticate: async token => {
        const ownerId = token === 'valid' ? OWNER : token === 'other' ? OTHER : null;
        if (!ownerId) return null;
        await db.exec('reset role; set role authenticated;');
        await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
          [ownerId, JSON.stringify({ sub: ownerId, role: 'authenticated' })]);
        return { ownerId, repo: createAccountPlanCollectionRepository(client, { ownerId, attest }) };
      },
    } });
    const collection = splitAccountPlanCollection(document(18)), r = command(collection);
    await f.stage(collection);
    await check(await f.request({ action: 'readIndex' }), 200, { kind: 'missing' });
    const first = await check(await f.request({ action: 'commit', request: r }), 200);
    assert.equal(first.kind, 'committed');
    await check(await f.request({ action: 'readIndex' }), 200, { kind: 'index', revision: 1, index: collection.index });
    for (const part of [collection.snapshots[17], collection.progress[17]])
      await check(await f.request({ action: 'readPart', partKind: part.kind, partId: part.id }), 200, { kind: 'part', part });
    await check(await f.request({ action: 'readIndex' }, { headers: { Authorization: 'Bearer other' } }), 200, { kind: 'missing' });
    await check(await f.request({ action: 'receipt', operationId: OP }, { headers: { Authorization: 'Bearer other' } }), 200, { kind: 'missing' });
    keysAvailable = false;
    await check(await f.request({ action: 'commit', request: r }), 200, first);
    keysAvailable = true;
    const prepared = prepareExecutionReplan(seed);
    assert.equal(prepared.kind, 'ready');
    const original = accountPlanEntry({ state: seed.state, evidence: null }, seed.now);
    const oldDocs = document(18).data.plans.map(p => p.planId === collection.index.currentPlanId ? { ...p, archivedAt: seed.now } : p);
    const baselineDoc = { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: { schemaVersion: 1,
      currentPlanId: original.planId, plans: [...oldDocs, original] } };
    const baseline = splitAccountPlanCollection(baselineDoc);
    await f.stage(baseline);
    await check(await f.request({ action: 'commit', request: command(baseline,collection,{ operationId: OP2 }) }), 200);
    const selected = accountPlanEntry({ state: prepared.proposals[0].after, evidence: null }, seed.now);
    const changed = splitAccountPlanCollection({ ...baselineDoc, data: { schemaVersion: 1, currentPlanId: selected.planId,
      plans: [...oldDocs, { ...original, archivedAt: seed.now }, selected] } });
    await f.stage(changed);
    const operationId = 'e5555555-5555-4555-8555-555555555555';
    const request = command(changed,baseline,{ operationId, expectedRevision: 2 });
    const sourceId = seed.journalGuard[0].documentId, otherJournalId = 'f6666666-6666-4666-8666-666666666666';
    const payload = await encryptAccountJournalDocument(JSON.stringify({ version: 2, state: 'FINALIZED', kind: 'JOURNAL',
      entry: { ...seed.entries[0], memo: '', title: '' } }), { ownerId: OWNER, documentId: sourceId }, material.active);
    const addJournal = async (id, revision) => {
      await db.exec('reset role');
      await db.query(`insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values($1,$2,$3,$4)`, [OWNER,id,revision,payload]);
      await db.query(`insert into public.account_journal_identity(user_id,document_id,document_kind,journal_date,active) values($1,$2,'JOURNAL','2026-09-28',true)`, [OWNER,id]);
    };
    await addJournal(sourceId,2);
    await check(await f.request({ action: 'commit', request }), 409, { error: 'JOURNALS_CHANGED' });
    await db.exec('reset role');
    await db.query('update public.account_journal_documents set revision=1 where user_id=$1 and document_id=$2',[OWNER,sourceId]);
    await addJournal(otherJournalId,1);
    await check(await f.request({ action: 'commit', request }), 200, { kind: 'conflict' });
    await db.exec('reset role');
    await db.query('update public.account_journal_documents set deleted_at=clock_timestamp(),encrypted_payload=null,revision=2 where user_id=$1 and document_id=$2',[OWNER,otherJournalId]);
    const accepted = await check(await f.request({ action: 'commit', request }),200);
    assert.equal(accepted.kind,'committed');
    await db.exec('reset role');
    await db.query('update public.account_journal_documents set revision=3 where user_id=$1 and document_id=$2',[OWNER,sourceId]);
    assert.deepEqual(await check(await f.request({ action: 'commit', request }),200),accepted);
    assert.equal((await check(await f.request({action:'readIndex'}),200)).index.currentPlanId,selected.planId);
    const realEntries = seed.entries.map(entry => ({ ...entry, memo: '', title: '' }));
    const sourcePayload = await encryptAccountJournalDocument(JSON.stringify({ version: 2, state: 'FINALIZED', kind: 'JOURNAL', entry: realEntries[0] }),
      { ownerId: OWNER, documentId: sourceId }, material.active);
    await db.exec('reset role');
    await db.query('update public.account_journal_documents set encrypted_payload=$3 where user_id=$1 and document_id=$2', [OWNER, sourceId, sourcePayload]);
    const manual = ALL_WORKOUT_CATALOG.filter(e => e.family === 'BASE').map(entry => prepareCatalogReplacement({
      ...seed, state: prepared.proposals[0].after, entries: realEntries, address: { day: 6, slot: 'AM' }, catalogId: entry.id,
      timeZone: 'UTC', acceptStronger: false, acceptLonger: true, journalGuard: [{ documentId: sourceId, revision: 3 }],
      inputs: { eventDistanceM: 5000, experience: seed.state.intake.experienceBand, availableSeconds: null,
        confirmedRequirements: [], fiveK: null, segmentPaces: [] },
    })).find(result => result.kind === 'ready');
    assert.ok(manual);
    const manualEntry = accountPlanEntry({ state: manual.proposal.after, evidence: null }, seed.now);
    const manualParts = splitAccountPlanCollection({ ...baselineDoc, data: { schemaVersion: 1, currentPlanId: manualEntry.planId,
      plans: [...oldDocs, { ...original, archivedAt: seed.now }, { ...selected, archivedAt: seed.now }, manualEntry] } });
    await f.stage(manualParts);
    const manualRequest = command(manualParts, changed, { operationId: 'a7777777-7777-4777-8777-777777777777', expectedRevision: 3 });
    calendarDateOverride = previousDay;
    await check(await f.request({ action: 'commit', request: manualRequest }), 409, { error: 'PLAN_DATE_CHANGED' });
    calendarDateOverride = null;
    assert.equal((await check(await f.request({ action: 'readIndex' }), 200)).revision, 3);
    // A deterministic SQL clock simulates rollover inside the nested commit, not a real multi-session wait.
    await db.exec('reset role');
    await db.exec(`create function pg_temp.catalog_guard_clock() returns timestamptz language plpgsql as $$
      declare calls integer := coalesce(nullif(current_setting('review.catalog_clock_calls',true),''),'0')::integer;
      begin perform set_config('review.catalog_clock_calls',(calls+1)::text,false);
        return clock_timestamp() + case when calls=0 then interval '0 days' else interval '1 day' end;
      end; $$;`);
    const replaceCalendar = sql => sql.replace('create function public.mutate_account_plan_catalog_replacement_attested',
      'create or replace function public.mutate_account_plan_catalog_replacement_attested');
    await db.exec(replaceCalendar(calendarSql).replaceAll('clock_timestamp()', 'pg_temp.catalog_guard_clock()'));
    await check(await f.request({ action: 'commit', request: manualRequest }), 409, { error: 'PLAN_DATE_CHANGED' });
    assert.equal((await check(await f.request({ action: 'readIndex' }), 200)).revision, 3);
    await check(await f.request({ action: 'receipt', operationId: manualRequest.operationId }), 200, { kind: 'missing' });
    await db.exec('reset role');
    await db.exec(replaceCalendar(calendarSql));
    const manualAccepted = await check(await f.request({ action: 'commit', request: manualRequest }), 200);
    assert.equal(manualAccepted.kind, 'committed');
    assert.equal((await check(await f.request({ action: 'readIndex' }), 200)).index.currentPlanId, manualEntry.planId);
    const replayRepo = createAccountPlanCollectionRepository(client, { ownerId: OWNER, attest });
    calendarDateOverride = previousDay;
    assert.deepEqual(await replayRepo.commitReplan(lastCalendarInput), manualAccepted);
    calendarDateOverride = null;
    await db.exec('reset role');
    await db.query('update public.account_journal_documents set revision=4 where user_id=$1 and document_id=$2', [OWNER, sourceId]);
    assert.deepEqual(await check(await f.request({ action: 'commit', request: manualRequest }), 200), manualAccepted);
    // Ordinary SELECT has no replan receipt: its transport guard still uses the
    // existing atomic SQL, including additions, edits, deletions and empty guards.
    const nextEntry = successorDocument().data.plans[0];
    const ordinary = splitAccountPlanCollection({ ...baselineDoc, data: { schemaVersion: 1, currentPlanId: nextEntry.planId,
      plans: [...oldDocs, { ...original, archivedAt: seed.now }, { ...selected, archivedAt: seed.now },
        { ...manualEntry, archivedAt: seed.now }, nextEntry] } });
    assert.ok(ordinary);
    await f.stage(ordinary);
    const ordinaryRequest = command(ordinary, manualParts, { operationId: 'b8888888-8888-4888-8888-888888888888', expectedRevision: 4,
      journalGuard: [{ documentId: sourceId, revision: 4 }] });
    await check(await f.request({ action: 'commit', request: { ...ordinaryRequest, journalGuard: [] } }), 200, { kind: 'conflict' });
    await db.exec('reset role');
    await db.query('update public.account_journal_documents set revision=5 where user_id=$1 and document_id=$2', [OWNER, sourceId]);
    await check(await f.request({ action: 'commit', request: ordinaryRequest }), 200, { kind: 'conflict' });
    await db.exec('reset role');
    const guardedSourcePayload = (await db.query('select encrypted_payload from public.account_journal_documents where user_id=$1 and document_id=$2', [OWNER, sourceId])).rows[0].encrypted_payload;
    await db.query('update public.account_journal_documents set revision=4,deleted_at=clock_timestamp(),encrypted_payload=null where user_id=$1 and document_id=$2', [OWNER, sourceId]);
    await check(await f.request({ action: 'commit', request: ordinaryRequest }), 200, { kind: 'conflict' });
    await db.exec('reset role');
    await db.query('update public.account_journal_documents set deleted_at=null,encrypted_payload=$3 where user_id=$1 and document_id=$2', [OWNER, sourceId, guardedSourcePayload]);
    await db.query('update public.account_journal_documents set deleted_at=null,encrypted_payload=$3 where user_id=$1 and document_id=$2', [OWNER, otherJournalId, payload]);
    await check(await f.request({ action: 'commit', request: ordinaryRequest }), 200, { kind: 'conflict' });
    assert.equal((await check(await f.request({ action: 'readIndex' }), 200)).revision, 4);
    await db.exec('reset role');
    await db.query('update public.account_journal_documents set deleted_at=clock_timestamp(),encrypted_payload=null where user_id=$1 and document_id=$2', [OWNER, otherJournalId]);
    const ordinaryAccepted = await check(await f.request({ action: 'commit', request: ordinaryRequest }), 200);
    assert.equal(ordinaryAccepted.kind, 'committed');
    const ordinarySqlInput = structuredClone(lastReplanInput);
    await db.exec('reset role');
    await db.query('update public.account_journal_documents set revision=6 where user_id=$1 and document_id=$2', [OWNER, sourceId]);
    await check(await f.request({ action: 'readIndex' }), 200);
    assert.deepEqual(await replayRepo.commitReplan(ordinarySqlInput), ordinaryAccepted);
    const changedGuardRequest = { ...ordinaryRequest, journalGuard: [] };
    await assert.rejects(replayRepo.commitReplan({ ...ordinarySqlInput, journalGuard: [],
      requestFingerprint: accountPlanFingerprint(changedGuardRequest) }), { code: '22023' });
    keysAvailable = false;
    assert.deepEqual(await check(await f.request({ action: 'commit', request: ordinaryRequest }), 200), ordinaryAccepted);
    await check(await f.request({ action: 'commit', request: { ...ordinaryRequest, journalGuard: [] } }), 409, { error: 'OPERATION_REUSED' });
    // One in-process PostgreSQL session, not proof of independent-session lock waiting or live JWT verification.
  } finally { await db.close(); }
});
