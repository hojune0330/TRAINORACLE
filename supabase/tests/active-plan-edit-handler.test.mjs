import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createAccountPlanCollectionHandler } from '../functions/_shared/account-plan-collection-handler.mjs';
import { importJournalKeyring } from '../functions/_shared/account-journal-handler.mjs';
import { encryptAccountJournalDocument } from '../functions/_shared/account-journal-crypto.mjs';
import { accountPlanFingerprint, splitAccountPlanCollection } from '../functions/_shared/account-plan-collection-validator.mjs';

const OWNER = 'a1111111-1111-4111-8111-111111111111';
const JOURNAL_ID = 'e5555555-5555-4555-8555-555555555555';
const OP = 'c3333333-3333-4333-8333-333333333333';
const OP2 = 'd4444444-4444-4444-8444-444444444444';
const ORIGIN = 'https://plan.example.test';
const NOW = new Date();
const localDate = date => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const shiftDate = (date, days) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const serialized = JSON.stringify({ activeKeyId: 'test', keys: { test: btoa('s'.repeat(32)) } });

const { build } = createRequire(new URL('../../app/package.json', import.meta.url))('esbuild');
const built = await build({ stdin: {
  contents: `export { stateFixture } from "./src/domain/plan-beta-store.test-fixture.ts";
    export { planBetaStateV3Schema } from "./src/domain/plan-beta-schema.ts";
    export { deriveCandidateId } from "@impl/plan-generator/candidate-identity";
    export { activePlanEditEvidenceFingerprint } from "./src/domain/active-plan-edit.ts";
    export { activePlanEditFingerprint, replayActivePlanEdit } from "./src/domain/active-plan-edit-policy.ts";
    export { accountPlanEntry } from "./src/domain/account/account-plan-document-schema.ts";
    export { parseAccountJournalRecord } from "./src/domain/account/account-journal-record-schema.ts";`,
  resolveDir: fileURLToPath(new URL('../../app/', import.meta.url)), loader: 'ts',
}, tsconfig: fileURLToPath(new URL('../../app/tsconfig.json', import.meta.url)),
bundle: true, write: false, platform: 'neutral', format: 'esm' });
const {
  stateFixture, planBetaStateV3Schema, deriveCandidateId, activePlanEditEvidenceFingerprint,
  activePlanEditFingerprint, replayActivePlanEdit, accountPlanEntry, parseAccountJournalRecord,
} = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);

function postSessionRecord(date) {
  return parseAccountJournalRecord({ version: 2, state: 'FINALIZED', kind: 'JOURNAL', entry: {
    id: 'guarded-session', kind: 'post-session', date, savedAt: `${date}T01:00:00.000Z`,
    syncState: 'local', captureDepth: 'QUICK', activityOutcome: 'COMPLETED', activitySlot: 'AM',
    objectiveDataState: 'WAITING', planExecutionRelation: 'NOT_APPLICABLE', painCheckStatus: 'NO_SIGNAL_REPORTED',
    system: '', title: '보호 대상', memo: 'PRIVATE-MEMO-MUST-NOT-LEAK', memoPurpose: 'PRIVATE_SELF_ONLY',
    distanceKm: '', durationMin: '', avgPace: '', rpe: 6,
    fieldProvenance: {
      activityOutcome: { provenance: 'EXPLICIT' }, activitySlot: { provenance: 'EXPLICIT' },
      plannedSessionLink: { provenance: 'MISSING' },
      planExecutionRelation: { provenance: 'DERIVED', derivedFrom: ['activityOutcome', 'plannedSessionLink'],
        derivationRuleId: 'QUICK_PLAN_EXECUTION_RELATION_V2' },
      painCheckStatus: { provenance: 'EXPLICIT' }, painParts: { provenance: 'MISSING' }, rpe: { provenance: 'EXPLICIT' },
    },
  } });
}

function editedDocuments(record) {
  const today = localDate(NOW), startDate = shiftDate(today, 5), timeZone = 'Asia/Seoul';
  const before = planBetaStateV3Schema.parse({ ...stateFixture(), intake: { ...stateFixture().intake, startDate } });
  const source = before.activePlan.sessions[0];
  const entries = record ? [record.entry] : [];
  const journalGuard = record ? [{ documentId: JOURNAL_ID, revision: 1 }] : [];
  const evidenceFingerprint = activePlanEditEvidenceFingerprint(entries);
  const receipt = {
    version: 1, policy: 'manual-active-plan-edit-v1', trigger: 'EXPLICIT_PLAN_EDIT', action: 'DURATION',
    source: { day: source.day, slot: source.slot }, target: null,
    baseStateFingerprint: activePlanEditFingerprint({ state: before, evidenceFingerprint, journalGuard, today, timeZone }),
    baseCandidateId: before.activePlan.candidateId, baseSessions: [...structuredClone(before.activePlan.sessions)],
    protectedSlots: [], startDate, projectionLengthDays: 9, today, timeZone, unstartedConfirmed: true,
    evidenceFingerprint, journalGuard, noFixedFutureCommitments: false, maximumMinutes: 25,
    replacement: null, acceptedRpeMaximum: null, acceptedLongerDuration: false, acceptedAt: NOW.toISOString(),
  };
  const sessions = replayActivePlanEdit(receipt);
  assert.ok(sessions, 'manual edit receipt must replay');
  const frame = before.activePlan.frame;
  assert.ok('formationKind' in frame && 'slotCount' in frame);
  const activePlan = { ...before.activePlan, sessions,
    candidateId: deriveCandidateId(before.activePlan.candidateId, {
      kind: before.activePlan.candidateKind, eventDistanceM: before.activePlan.eventDistanceM,
      selectedDetailedTemplateRef: before.activePlan.selectedDetailedTemplateRef,
      selectedEnergyIntent: before.activePlan.selectedEnergyIntent, sourceMode: before.activePlan.sourceMode,
      selectionAuthority: 'SELF', frame, sessions,
    }) };
  const after = planBetaStateV3Schema.parse({ ...before, activePlan, activePlanEdit: receipt });
  const at = before.generatedAt > NOW.toISOString() ? before.generatedAt : NOW.toISOString();
  const oldEntry = accountPlanEntry({ state: before, evidence: null }, at);
  const beforeDoc = { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: {
    schemaVersion: 1, currentPlanId: oldEntry.planId, plans: [oldEntry],
  } };
  const newEntry = accountPlanEntry({ state: after, evidence: null }, at);
  const afterDoc = structuredClone(beforeDoc);
  afterDoc.data.plans[0].archivedAt = at;
  afterDoc.data.plans.push(newEntry);
  afterDoc.data.currentPlanId = newEntry.planId;
  return { before: splitAccountPlanCollection(beforeDoc), after: splitAccountPlanCollection(afterDoc), receipt };
}

async function fixture({ record = null, returnedRevision = 1 } = {}) {
  const material = await importJournalKeyring(serialized), parts = new Map();
  const calls = { ordinary: 0, guarded: 0, journalReads: 0 };
  let index = null;
  const receipts = new Map();
  const repo = {
    enabled: async () => true,
    attestationStatus: async () => ({ kind: 'ready' }),
    readIndex: async () => index,
    readPart: async (kind, id) => parts.get(`${kind}:${id}`) ?? null,
    receipt: async id => receipts.get(id) ?? null,
    readLegacy: async () => null,
    readJournals: async (ownerId, ids) => {
      calls.journalReads++;
      assert.equal(ownerId, OWNER);
      assert.deepEqual(ids, [JOURNAL_ID]);
      if (!record) return [];
      const encrypted_payload = await encryptAccountJournalDocument(JSON.stringify(record),
        { ownerId: OWNER, documentId: JOURNAL_ID }, material.active);
      return [{ user_id: OWNER, document_id: JOURNAL_ID, revision: returnedRevision, deleted_at: null, encrypted_payload }];
    },
    stage: async input => {
      const key = `${input.partKind}:${input.partId}`;
      parts.set(key, { part_kind: input.partKind, part_id: input.partId, plan_id: input.planId,
        content_hash: input.contentHash, payload: input.payload, metadata: input.metadata });
      return { kind: 'staged', partId: input.partId };
    },
    commit: async input => {
      calls.ordinary++;
      return commit(input);
    },
    commitReplan: async ({ ...input }) => { calls.guarded++; return commit(input); },
  };
  function commit(input) {
    if ((index?.revision ?? 0) !== input.expectedRevision) return { kind: 'conflict' };
    const receipt = { ownerId: OWNER, operationId: input.operationId, revision: input.expectedRevision + 1,
      indexFingerprint: input.indexFingerprint, requestFingerprint: input.requestFingerprint };
    index = { revision: receipt.revision, index_fingerprint: input.indexFingerprint,
      index_document: input.index, payload: input.payload };
    receipts.set(input.operationId, receipt);
    return { kind: 'committed', receipt };
  }
  const handler = createAccountPlanCollectionHandler({
    allowedOrigins: [ORIGIN], now: () => new Date(NOW),
    authenticate: async token => token === 'valid' ? { ownerId: OWNER, repo } : null,
    getMaterial: async () => material,
  });
  const request = input => handler(new Request('https://edge.example.test/account-plan-collection', {
    method: 'POST', body: JSON.stringify(input), headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer valid', Origin: ORIGIN,
    },
  }));
  const stage = async collection => {
    for (const part of [...collection.snapshots, ...collection.progress]) {
      const response = await request({ action: 'stage', ownerId: OWNER, part });
      assert.equal(response.status, 200);
    }
  };
  const command = (collection, operationId, expectedRevision, previousIndexFingerprint, previousCurrentPlanId) => ({
    ownerId: OWNER, operationId, expectedRevision, previousIndexFingerprint, previousCurrentPlanId,
    index: collection.index, legacy: null,
  });
  const saveCurrent = async collection => {
    await stage(collection);
    const response = await request({ action: 'commit', request: command(collection, OP, 0, null, null) });
    assert.equal(response.status, 200);
    return index;
  };
  const saveEdit = async (collection, previousIndex) => {
    await stage(collection);
    const req = command(collection, OP2, previousIndex.revision,
      accountPlanFingerprint(previousIndex.index_document), previousIndex.index_document.currentPlanId);
    // The handler forwards only the database guard; this fixture lets the repository assert it.
    repo.commitReplan = async ({ journalGuard, ...input }) => {
      calls.guarded++;
      assert.deepEqual(journalGuard, editedDocuments(record).receipt.journalGuard);
      return commit(input);
    };
    return request({ action: 'commit', request: req });
  };
  return { request, repo, calls, stage, saveCurrent, saveEdit, getIndex: () => index };
}

async function scenario(record, returnedRevision = 1) {
  const f = await fixture({ record, returnedRevision });
  const before = editedDocuments(null).before;
  const oldIndex = await f.saveCurrent(before);
  const { after } = editedDocuments(record);
  return { f, after, oldIndex };
}

test('manual edit commits through guarded CAS with the unchanged journal set and preserves predecessor', async () => {
  const { f, after, oldIndex } = await scenario(null);
  const response = await f.saveEdit(after, oldIndex);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).kind, 'committed');
  assert.equal(f.calls.guarded, 1);
  assert.equal(f.calls.journalReads, 0);
  assert.equal(f.getIndex().index_document.currentPlanId, after.index.currentPlanId);
  assert.equal(after.index.plans.length, 2);
  assert.notEqual(oldIndex.index_document.currentPlanId, after.index.currentPlanId);
  assert.ok(after.index.plans.some(plan => plan.planId === oldIndex.index_document.currentPlanId));
});

test('manual edit rejects a journaled source slot without committing or leaking journal text', async () => {
  const record = postSessionRecord(shiftDate(localDate(NOW), 5));
  assert.ok(record);
  const { f, after, oldIndex } = await scenario(record);
  const response = await f.saveEdit(after, oldIndex);
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.deepEqual(body, { error: 'RECORDED_SESSION_PROTECTED' });
  assert.equal(JSON.stringify(body).includes('PRIVATE-MEMO-MUST-NOT-LEAK'), false);
  assert.equal(f.calls.journalReads, 1);
  assert.equal(f.calls.guarded, 0);
  assert.equal(f.getIndex().index_document.currentPlanId, oldIndex.index_document.currentPlanId);
});

test('manual edit rejects stale guarded journal revision before commitReplan', async () => {
  const record = postSessionRecord(shiftDate(localDate(NOW), 5));
  assert.ok(record);
  const { f, after, oldIndex } = await scenario(record, 2);
  const response = await f.saveEdit(after, oldIndex);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'JOURNALS_CHANGED' });
  assert.equal(f.calls.guarded, 0);
  assert.equal(f.getIndex().index_document.currentPlanId, oldIndex.index_document.currentPlanId);
});
