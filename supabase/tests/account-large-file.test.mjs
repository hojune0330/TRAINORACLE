import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createAccountJournalHandler, importJournalKeyring, validateAccountJournalDocument } from '../functions/_shared/account-journal-handler.mjs';
import { createAccountDataRightsHandler } from '../functions/_shared/account-data-rights-handler.mjs';
import { encryptAccountJournalDocument } from '../functions/_shared/account-journal-crypto.mjs';
import { correctAccountJournalImportedObservation } from '../functions/_shared/account-journal-record-validator.mjs';
import { compressFileJson, decompressFileJson, FILE_DOCUMENT_MAX_BYTES, FILE_MUTATION_MAX_BYTES, FILE_COMPRESSED_MAX_BYTES, FILE_CORRECTION_MAX_BYTES } from '../functions/_shared/account-file-document-codec.mjs';
const require = createRequire(new URL('../../app/package.json', import.meta.url));
const { build } = require('esbuild'), { JSDOM } = require('jsdom');
const OWNER = 'a1111111-1111-4111-8111-111111111111', OTHER = 'b2222222-2222-4222-8222-222222222222', OP = 'c3333333-3333-4333-8333-333333333333';
let source, document, documentId, backupReader;
const bytes = value => Buffer.byteLength(JSON.stringify(value));
before(async () => {
  const app = fileURLToPath(new URL('../../app/', import.meta.url));
  const result = await build({ stdin: { contents: 'export { largeFileJournalFixture } from "./src/test/large-file-journal-fixture.ts"; export { buildFileObservation } from "./src/domain/import/file-observation.ts"; export { readBackupFile } from "./src/domain/restore/backup-file.ts";', resolveDir: app, loader: 'ts' },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', absWorkingDir: app, alias: { '@impl': fileURLToPath(new URL('../../impl/src', import.meta.url)) }, define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"test"' } });
  source = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text + '\n//# sourceURL=synthetic-large-file-fixture.mjs').toString('base64')}`);
  const dom = new JSDOM(); globalThis.DOMParser = dom.window.DOMParser;
  document = source.largeFileJournalFixture(); backupReader = source.readBackupFile;
  dom.window.close();
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(['trainoracle.journal.record.v1', OWNER, document.entry.id]))));
  hash[6] = (hash[6] & 15) | 80; hash[8] = (hash[8] & 63) | 128;
  const hex = [...hash.subarray(0, 16)].map(value => value.toString(16).padStart(2, '0')).join('');
  documentId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
});
async function fixture() {
  const material = await importJournalKeyring(JSON.stringify({ activeKeyId: 'synthetic', keys: { synthetic: btoa('k'.repeat(32)) } }));
  let row = null, operation = null, enabled = true, commits = 0;
  const repo = { enabled: async () => enabled, fileEvidenceEnabled: async () => true,
    read: async owner => owner === OWNER ? row : null, list: async owner => owner === OWNER && row ? [row] : [],
    operation: async owner => owner === OWNER ? operation : null,
    commit: async input => {
      commits++; assert.equal(Object.hasOwn(input, 'document'), false);
      const result = { kind: 'saved', documentId, operationId: OP, revision: 1 };
      row = { user_id: OWNER, document_id: documentId, revision: 1, encrypted_payload: input.encryptedPayload };
      operation = { user_id: OWNER, operation_id: OP, document_id: documentId, expected_revision: 0, operation_kind: 'commit', source_revision: null,
        proposed_encrypted_payload: input.encryptedPayload, result, trusted_metadata: input.metadata };
      return result;
    } };
  const handler = createAccountJournalHandler({ authenticate: async token => ({ ownerId: token === 'other' ? OTHER : OWNER, repo }), getMaterial: async () => material,
    validateDocument: validateAccountJournalDocument });
  const request = (body, token = 'owner') => handler(new Request('https://synthetic.local/account-journal', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  return { request, repo, material, setEnabled: value => { enabled = value; }, get row() { return row; }, get commits() { return commits; } };
}
const capabilities = { supportedJournalVersions: [2, 3, 4, 5], supportsExerciseLogV1: true, supportsLargeFileV1: true };
async function wire() { return { action: 'compressedFileMutation', envelope: await compressFileJson({ action: 'save', documentId, operationId: OP, expectedRevision: 0,
  document, writePurpose: 'FILE_OBSERVATION', ...capabilities }, FILE_MUTATION_MAX_BYTES) }; }
test('synthetic hour saves through actual handler/AES, rereads exactly and restores V7 backup', async () => {
  const f = await fixture(), body = await wire(), cpu = process.cpuUsage(), start = performance.now();
  const saved = await f.request(body); assert.equal(saved.status, 200, JSON.stringify(await saved.clone().json()));
  const saveMs = performance.now() - start, saveCpu = process.cpuUsage(cpu);
  assert.ok(bytes(body) < 655_360); assert.ok(bytes(document) > 600_000);
  assert.ok(bytes(f.row.encrypted_payload) < 1_600_000);
  assert.equal(JSON.stringify(f.row).includes('Synthetic measurement'), false);
  const readStart = performance.now(), read = await f.request({ action: 'read', documentId, ...capabilities });
  assert.equal(read.status, 200); const received = (await read.json()).document;
  assert.deepEqual(received, document);
  const backup = { app: 'TRAINORACLE', format: 'trainoracle.journal.full-backup.v7', exportMode: 'OWNER_FULL_BACKUP', exportedAt: '2026-11-04T02:00:00.000Z', entries: [received.entry] };
  assert.deepEqual(backupReader(JSON.stringify(backup)).entries, [document.entry]);
  const retry = await f.request(body); assert.equal(retry.status, 200); assert.equal(f.commits, 1);
  console.log(JSON.stringify({ synthetic: true, samples: document.entry.fileObservation.detail.samples.length, documentBytes: bytes(document), requestBytes: bytes(body), encryptedEnvelopeBytes: bytes(f.row.encrypted_payload), saveMs: Math.round(saveMs), saveCpuMs: Math.round((saveCpu.user + saveCpu.system) / 1000), readAndBackupMs: Math.round(performance.now() - readStart) }));
});
test('owner isolation, revoked storage and old-client 426 stay closed for large records', async () => {
  const f = await fixture(); assert.equal((await f.request(await wire())).status, 200);
  assert.equal((await f.request({ action: 'read', documentId, ...capabilities }, 'other')).status, 404);
  assert.equal((await f.request({ action: 'read', documentId, supportedJournalVersions: [2, 3, 4, 5] })).status, 426);
  assert.equal((await f.request({ action: 'list', collection: 'JOURNAL', supportedJournalVersions: [2, 3, 4, 5] })).status, 426);
  f.setEnabled(false); assert.equal((await f.request({ action: 'read', documentId, ...capabilities })).status, 403);
  assert.equal((await f.request(await wire())).status, 403); assert.equal(f.commits, 1);
});
test('compressed input corruption and a tiny lying expansion limit never commit', async () => {
  const f = await fixture(), valid = await wire();
  for (const patch of [{ uncompressedBytes: 1 }, { uncompressedBytes: FILE_MUTATION_MAX_BYTES + 1 }, { sha256: '0'.repeat(64) }, { data: valid.envelope.data.slice(0, -4) }]) {
    assert.equal((await f.request({ ...valid, envelope: { ...valid.envelope, ...patch } })).status, 422);
  }
  assert.equal(f.commits, 0);
  await assert.rejects(compressFileJson('x'.repeat(FILE_DOCUMENT_MAX_BYTES)));
});
test('stored ciphertext tampering cannot return any document', async () => {
  const f = await fixture(); await f.request(await wire());
  const current = f.row.encrypted_payload.ciphertext;
  f.row.encrypted_payload = { ...f.row.encrypted_payload, ciphertext: (current[0] === 'A' ? 'B' : 'A') + current.slice(1) };
  const response = await f.request({ action: 'read', documentId, ...capabilities });
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'SERVICE_UNAVAILABLE' });
});
test('capability advertises bounded limits and never confers provider/AI authority', async () => {
  const f = await fixture(), response = await f.request({ action: 'journalLargeFileSupport' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { kind: 'journal-large-file-support', version: 1, maxDocumentBytes: FILE_DOCUMENT_MAX_BYTES, maxCompressedBytes: FILE_COMPRESSED_MAX_BYTES, maxCorrectionBytes: FILE_CORRECTION_MAX_BYTES });
  assert.equal((await f.request({ action: 'journalLargeFileSupport', runtimeBudget: 'COMPANY_NODE' })).status, 400);
  const packed = await compressFileJson(document); assert.deepEqual(await decompressFileJson(packed), document);
});
test('near-limit valid synthetic FILE document remains bounded through full handler validation', async () => {
  const original = document, observation = original.entry.fileObservation;
  const { schemaVersion, source: origin, sourceObservationKey, contentRevisionFingerprint, completeness, ...observationInput } = observation;
  let count = Math.floor((FILE_DOCUMENT_MAX_BYTES - 10_000) / 235);
  let candidate;
  while (true) {
    candidate = { ...original, entry: { ...original.entry, fileObservation: source.buildFileObservation({ ...observationInput,
      detail: { ...observation.detail, samples: Array.from({ length: count }, (_, index) => ({ ...observation.detail.samples[0], sourceIndex: index })) } }) } };
    if (bytes(candidate) <= FILE_DOCUMENT_MAX_BYTES) break;
    count -= 100;
  }
  assert.ok(bytes(candidate) > FILE_DOCUMENT_MAX_BYTES * 0.9);
  document = candidate;
  try {
    const f = await fixture(), body = await wire(), cpu = process.cpuUsage(), start = performance.now();
    const saved = await f.request(body);
    const usage = process.cpuUsage(cpu);
    assert.equal(saved.status, 200, JSON.stringify(await saved.clone().json()));
    const read = await f.request({ action: 'read', documentId, ...capabilities });
    assert.equal(read.status, 200); assert.deepEqual((await read.json()).document, candidate);
    console.log(JSON.stringify({ synthetic: true, boundaryDocumentBytes: bytes(candidate), samples: count, saveWallMs: Math.round(performance.now() - start), saveCpuMs: Math.round((usage.user + usage.system) / 1000) }));
  } finally { document = original; }
});
test('four-hour 14400-point synthetic activity saves and rereads without stripping sensors', async () => {
  const original = document;
  const dom = new JSDOM(); globalThis.DOMParser = dom.window.DOMParser;
  const fourHours = source.largeFileJournalFixture(14_400);
  document = { ...fourHours, entry: { ...fourHours.entry, id: original.entry.id } };
  dom.window.close();
  try {
    const f = await fixture(), body = await wire(), cpu = process.cpuUsage(), start = performance.now();
    const saved = await f.request(body), usage = process.cpuUsage(cpu), saveMs = performance.now() - start;
    assert.equal(saved.status, 200, JSON.stringify(await saved.clone().json()));
    const read = await f.request({ action: 'read', documentId, ...capabilities });
    assert.equal(read.status, 200); assert.deepEqual((await read.json()).document, document);
    console.log(JSON.stringify({ synthetic: true, durationHours: 4, samples: 14_400, documentBytes: bytes(document), requestBytes: bytes(body), saveMs: Math.round(saveMs), saveCpuMs: Math.round((usage.user + usage.system) / 1000) }));
    const observation = document.entry.fileObservation;
    const { schemaVersion, source: origin, sourceObservationKey, contentRevisionFingerprint, completeness, ...input } = observation;
    const replacement = source.buildFileObservation({ ...input, detail: { ...observation.detail,
      samples: observation.detail.samples.map((sample, index) => index === 0 ? { ...sample, metrics: { ...sample.metrics, heartRateBpm: 141 } } : sample) } });
    const correction = { action: 'correctImportedObservation', documentId, operationId: 'd4444444-4444-4444-8444-444444444444', expectedRevision: 1,
      previousContentRevisionFingerprint: observation.contentRevisionFingerprint, replacementObservation: replacement, confirmedChangedFields: ['detail'], ...capabilities };
    f.repo.operation = async () => null;
    f.repo.commit = async input => ({ kind: 'saved', documentId, operationId: input.operationId, revision: 2 });
    const correctionBody = { action: 'compressedFileMutation', envelope: await compressFileJson(correction, FILE_MUTATION_MAX_BYTES) };
    const correctionCpu = process.cpuUsage(), correctionStart = performance.now();
    const corrected = await f.request(correctionBody), correctionUsage = process.cpuUsage(correctionCpu);
    assert.equal(corrected.status, 413); assert.deepEqual(await corrected.json(), { error: 'DOCUMENT_CAPACITY_EXCEEDED' });
    console.log(JSON.stringify({ synthetic: true, durationHours: 4, operation: 'correctImportedObservation', result: 'EXPLICIT_CAPACITY_REFUSAL', wallMs: Math.round(performance.now() - correctionStart), cpuMs: Math.round((correctionUsage.user + correctionUsage.system) / 1000) }));
  } finally { document = original; }
});
test('large history pages and targeted correction replay survive aggregate history beyond the page budget', async () => {
  const f = await fixture(); await f.request(await wire());
  const original = document.entry.fileObservation;
  const { schemaVersion, source: origin, sourceObservationKey, contentRevisionFingerprint, completeness, ...input } = original;
  const replacement = source.buildFileObservation({ ...input, detail: { ...original.detail,
    samples: original.detail.samples.map((sample, index) => index === 0 ? { ...sample, metrics: { ...sample.metrics, heartRateBpm: 141 } } : sample) } });
  const proposal = correctAccountJournalImportedObservation(document, original.contentRevisionFingerprint, replacement, ['detail']);
  assert.ok(proposal);
  const payload = await encryptAccountJournalDocument(JSON.stringify(await compressFileJson(proposal)), { ownerId: OWNER, documentId }, f.material.active);
  const history = [5, 4, 3, 2, 1].map(revision => ({ revision, encryptedPayload: f.row.encrypted_payload,
    replacedAt: '2026-11-04T00:00:00.000Z', expiresAt: '2026-12-04T00:00:00.000Z', reason: 'replaced' }));
  f.repo.history = async () => history;
  f.repo.read = async () => ({ ...f.row, revision: 6, encrypted_payload: payload });
  f.repo.operation = async () => ({ user_id: OWNER, operation_id: OP, document_id: documentId, expected_revision: 2,
    operation_kind: 'commit', source_revision: null, proposed_encrypted_payload: payload, trusted_metadata: { awardAllowed: false },
    result: { kind: 'saved', documentId, operationId: OP, revision: 3 } });
  const request = { action: 'correctImportedObservation', documentId, operationId: OP, expectedRevision: 2,
    previousContentRevisionFingerprint: original.contentRevisionFingerprint, replacementObservation: replacement, confirmedChangedFields: ['detail'], ...capabilities };
  const replay = await f.request({ action: 'compressedFileMutation', envelope: await compressFileJson(request, FILE_MUTATION_MAX_BYTES) });
  assert.equal(replay.status, 200, JSON.stringify(await replay.clone().json()));
  assert.equal(f.commits, 1);
  const first = await f.request({ action: 'history', documentId, collection: 'JOURNAL', ...capabilities });
  const page = await first.json(); assert.equal(first.status, 200); assert.deepEqual(page.versions.map(v => v.revision), [5]); assert.equal(page.nextRevision, 5);
  const second = await f.request({ action: 'history', documentId, collection: 'JOURNAL', beforeRevision: 5, ...capabilities });
  assert.deepEqual((await second.json()).versions.map(v => v.revision), [4]);
  const target = await f.request({ action: 'history', documentId, collection: 'JOURNAL', targetRevision: 2, ...capabilities });
  assert.deepEqual((await target.json()).versions.map(v => v.revision), [2]);
});
test('explicit data-rights download returns restored document, never an internal compression wrapper', async () => {
  const f = await fixture(); await f.request(await wire());
  const handler = createAccountDataRightsHandler({ getMaterial: async () => f.material, authenticate: async () => ({ ownerId: OWNER,
    read: async () => ({ ownerId: OWNER, collection: 'journal', items: [{ cursor: documentId, record: structuredClone(f.row) }], nextCursor: null }), verify: async () => true }) });
  const response = await handler(new Request('https://synthetic.local/account-data-rights', { method: 'POST', headers: { Authorization: 'Bearer synthetic', 'content-type': 'application/json' },
    body: JSON.stringify({ expectedUserId: OWNER, expectedSessionId: OWNER, collection: 'journal', cursor: '' }) }));
  assert.equal(response.status, 200); const exported = await response.json();
  assert.deepEqual(exported.items[0].record.document, document); assert.equal(exported.items[0].record.encrypted_payload, undefined);
});
