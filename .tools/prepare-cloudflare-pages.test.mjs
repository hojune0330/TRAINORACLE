import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { assertStaticPath, CLOUDFLARE_HEADERS, staticHeaders, prepareCloudflarePages } from './prepare-cloudflare-pages.mjs';
const sourceSha = 'a'.repeat(40);
const temporaryRoots = [];
after(async () => {
  for (const root of temporaryRoots) {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('trainoracle-static-fixture-')) throw Error('UNSAFE_TEST_CLEANUP');
    await rm(root, { recursive: true });
  }
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'trainoracle-static-fixture-'));
  temporaryRoots.push(root);
  const input = join(root, 'domain'); const output = join(root, 'prepared');
  await mkdir(join(input, 'legal'), { recursive: true });
  const files = {};
  for (const file of ['index.html', 'sw.js', 'manifest.webmanifest', 'migration.html', 'legal/privacy.html', 'legal/terms.html', 'support.html']) {
    const content = 'synthetic-' + file; await writeFile(join(input, file), content);
    files[file] = createHash('sha256').update(content).digest('hex');
  }
  const receipt = { schemaVersion: 1, sourceSha, sourceRepository: 'hojune0330/TRAINORACLE', domain: 'https://trainoracle.io/',
    accountMode: 'off', originPreserved: true, verificationScope: 'domain-hosting', sourceRegressionGate: 'separate-not-claimed-as-passed', files,
    buildEnvironment: { VITE_ACCOUNT_PUBLIC_ENABLED: 'false', VITE_KILL_ACCOUNT: 'true', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '',
      VITE_SERVER_OPERATIONS_ENABLED: 'false', VITE_FRIEND_ARENA_URL: '', VITE_LOUNGE_REALTIME_URL: '',
      VITE_LOUNGE_PUBLIC_ENABLED: 'false', VITE_ACCOUNT_STORAGE_PRIVACY_RELEASE_APPROVED: 'false' } };
  const save = () => writeFile(join(input, 'trainoracle-domain-receipt.json'), JSON.stringify(receipt)); await save();
  return { input, output, receipt, save };
}
test('prepares a static package without changing source bytes or upgrading gate claims', async () => {
  const f = await fixture(); const original = await readFile(join(f.input, 'index.html'));
  const result = await prepareCloudflarePages(f.input, f.output, sourceSha);
  assert.equal(result.deploymentStatus, 'NOT_PUBLISHED');
  assert.deepEqual(await readFile(join(f.input, 'index.html')), original);
  assert.deepEqual(await readFile(join(f.output, 'index.html')), original);
  assert.equal(await readFile(join(f.output, '_headers'), 'utf8'), CLOUDFLARE_HEADERS);
  const prepared = JSON.parse(await readFile(join(f.output, 'trainoracle-hosting-preparation.json'), 'utf8'));
  assert.equal(prepared.functions, false); assert.equal(prepared.dnsChanged, false);
  assert.equal(prepared.sourceRegressionGate, 'separate-not-claimed-as-passed');
  await assert.rejects(prepareCloudflarePages(f.input, f.output, sourceSha), /EEXIST/);
});
test('rejects a changed artifact even when its source SHA matches', async () => {
  const f = await fixture(); await writeFile(join(f.input, 'index.html'), 'changed');
  await assert.rejects(prepareCloudflarePages(f.input, f.output, sourceSha), /ARTIFACT_MISMATCH/);
});
test('rejects unexpected files, paid functions and altered account gates', async () => {
  const f = await fixture(); f.receipt.buildEnvironment.VITE_FEATURE_SYNC = 'true'; await f.save();
  await assert.rejects(prepareCloudflarePages(f.input, f.output, sourceSha), /ACCOUNT_HOLD_REQUIRED/);
  f.receipt.buildEnvironment.VITE_FEATURE_SYNC = 'false'; await f.save();
  await writeFile(join(f.input, 'extra.txt'), 'unexpected');
  await assert.rejects(prepareCloudflarePages(f.input, f.output, sourceSha), /ARTIFACT_MISMATCH/);
  for (const name of ['../file', '/root', 'a\\b', '.env', 'x/.git/config', '_worker.js', 'functions/index.js', 'private.key', 'x.map', '_routes.json', '_redirects']) {
    assert.throws(() => assertStaticPath(name), /UNSAFE_STATIC_PATH/, name);
  }
});
test('rejects a mismatched source and overlapping destination without writing', async () => {
  const f = await fixture();
  await assert.rejects(prepareCloudflarePages(f.input, f.output, 'b'.repeat(40)), /RECEIPT_REJECTED/);
  await assert.rejects(prepareCloudflarePages(f.input, join(f.input, 'nested'), sourceSha), /OUTPUT_MUST_BE_SEPARATE/);
});
test('only content-hashed asset directories receive immutable caching', () => {
  assert.match(staticHeaders(['index.html', 'assets/index-ABC123xy.js']), /max-age=31536000, immutable/);
  assert.equal(staticHeaders(['assets/index-ABC123xy.js', 'assets/manager.png']), CLOUDFLARE_HEADERS);
  assert.match(CLOUDFLARE_HEADERS, /\/sw\.js\n  Cache-Control: no-cache/);
});
test('rejects a credential-looking payload before copying even with a matching inventory', async () => {
  const f = await fixture();
  const content = 'sb_secret_' + 'x'.repeat(30);
  await writeFile(join(f.input, 'index.html'), content);
  f.receipt.files['index.html'] = createHash('sha256').update(content).digest('hex'); await f.save();
  await assert.rejects(prepareCloudflarePages(f.input, f.output, sourceSha), /CREDENTIAL_LIKE_CONTENT_REJECTED/);
});
