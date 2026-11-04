import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
for (const scenario of [{ points: 3600, legacy: false }, { points: 14400, legacy: true }]) test(`synthetic ${scenario.points}-point ${scenario.legacy ? 'V3 to V5 correction' : 'file'} survives real Chromium encrypted IDB reload and complete V7 backup`, async () => {
  const app = fileURLToPath(new URL('../', import.meta.url));
  const result = await build({ stdin: { contents: `
    export { largeFileJournalFixture } from './src/test/large-file-journal-fixture.ts';
    export { createAccountDocumentBuffer } from './src/domain/account/account-journal-draft-buffer.ts';
    export { accountJournalRecordSchema } from './src/domain/account/account-journal-record-schema.ts';
    export { correctAccountJournalImportedObservation } from './src/domain/account/account-journal-record-schema.ts';
    export { buildFileObservation, prepareLegacyFileDetailUpgrade } from './src/domain/import/file-observation.ts';
    export { initializeCanonicalJournalStorage } from './src/domain/canonical-journal-storage.ts';
    export { saveEntry, exportEntriesJSON } from './src/domain/journal-store.ts';
    export { readBackupFile } from './src/domain/restore/backup-file.ts';`, resolveDir: app, loader: 'ts' },
    bundle: true, write: false, format: 'iife', globalName: 'LargeFileFixture', platform: 'browser', target: 'es2022', absWorkingDir: app,
    alias: { '@impl': fileURLToPath(new URL('../../impl/src', import.meta.url)) }, define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"test"' } });
  const source = result.outputFiles[0].text + '\nwindow.LargeFileFixture = LargeFileFixture;';
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Synthetic large FILE storage</title>' }));
    await page.goto('https://synthetic.trainoracle.local/'); await page.addScriptTag({ content: source });
    const written = await page.evaluate(async ({ points, legacy }) => {
      const f = window.LargeFileFixture;
      let document = f.largeFileJournalFixture(points);
      const buffer = f.createAccountDocumentBuffer(f.accountJournalRecordSchema, 'synthetic-large-file-test');
      const owner = 'a1111111-1111-4111-8111-111111111111', id = 'c3333333-3333-4333-8333-333333333333';
      if (legacy) {
        const observation = document.entry.fileObservation;
        const { schemaVersion, source, sourceObservationKey, sourceIdentityFingerprint, contentRevisionFingerprint, completeness, detail, ...input } = observation;
        const oldObservation = f.buildFileObservation(input);
        const old = f.accountJournalRecordSchema.parse({ ...document, version: 3, entry: { ...document.entry, fileObservation: oldObservation } });
        const replacement = f.prepareLegacyFileDetailUpgrade(oldObservation, observation);
        if (!replacement) throw new Error('SYNTHETIC_LEGACY_UPGRADE_REFUSED');
        const proposal = f.correctAccountJournalImportedObservation(old, oldObservation.contentRevisionFingerprint, replacement, ['detail']);
        if (!proposal) throw new Error('SYNTHETIC_LEGACY_PROPOSAL_REFUSED');
        await buffer.importRemote(owner, id, old, 1);
        const view = await buffer.read(owner, id);
        await buffer.saveMutation(owner, id, proposal, { action: 'correctImportedObservation', previousContentRevisionFingerprint: oldObservation.contentRevisionFingerprint,
          replacementObservation: replacement, confirmedChangedFields: ['detail'] }, 'd4444444-4444-4444-8444-444444444444', view.localSequence, 1);
        document = proposal;
      } else await buffer.saveDraft(owner, id, document, 0, 'FILE_OBSERVATION');
      buffer.close(); return document;
    }, scenario);
    await page.reload(); await page.addScriptTag({ content: source });
    const read = await page.evaluate(async () => {
      const f = window.LargeFileFixture, buffer = f.createAccountDocumentBuffer(f.accountJournalRecordSchema, 'synthetic-large-file-test');
      const record = await buffer.read('a1111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333333');
      const other = await buffer.read('b2222222-2222-4222-8222-222222222222', 'c3333333-3333-4333-8333-333333333333');
      const initialized = await f.initializeCanonicalJournalStorage(localStorage, sessionStorage);
      if (initialized.status !== 'ready' || !f.saveEntry(record.draft.entry).ok) throw new Error('SYNTHETIC_LOCAL_BACKUP_PREPARATION_FAILED');
      const text = f.exportEntriesJSON({ includeRawMemos: true }), backup = f.readBackupFile(text);
      buffer.close(); return { document: record.draft, mutation: record.pending?.mutation?.action ?? null, other, restored: backup.entries, format: JSON.parse(text).format, backupBytes: new TextEncoder().encode(text).length };
    });
    assert.deepEqual(read.document, written); assert.deepEqual(read.restored, [written.entry]); assert.equal(read.other, null);
    assert.equal(read.format, 'trainoracle.journal.full-backup.v7');
    if (scenario.legacy) assert.equal(read.mutation, 'correctImportedObservation');
    console.log(JSON.stringify({ synthetic: true, chromium: browser.version(), samples: written.entry.fileObservation.detail.samples.length,
      encryptedIdbActualReload: true, ownerIsolation: true, fullBackupBytes: read.backupBytes, deepEquality: true }));
  } finally { await browser.close(); }
});
