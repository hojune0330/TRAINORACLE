import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createAccountPlanCollectionHandler, accountPlanCollectionDocumentId } from '../functions/_shared/account-plan-collection-handler.mjs';
import { decryptAccountJournalDocument } from '../functions/_shared/account-journal-crypto.mjs';
import { accountPlanFingerprint, splitAccountPlanCollection } from '../functions/_shared/account-plan-collection-validator.mjs';

// No real session, filesystem fixture, HTTP listener or network fetch is used.
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const appRequire = createRequire(new URL('../../app/package.json', import.meta.url));
const { build } = appRequire('esbuild');
const { createClient } = appRequire('@supabase/supabase-js');
const built = await build({
  stdin: {
    contents: [
      'export { createAccountPlanCollectionClient } from "./src/domain/account/account-plan-collection-api.ts";',
      'export { stateFixture } from "./src/domain/plan-beta-store.test-fixture.ts";',
    ].join('\n'),
    resolveDir: fileURLToPath(new URL('../../app/', import.meta.url)), loader: 'ts',
  },
  tsconfig: fileURLToPath(new URL('../../app/tsconfig.json', import.meta.url)),
  bundle: true, write: false, platform: 'node', format: 'cjs',
  define: { 'import.meta.env': '{}' }, logLevel: 'silent',
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(appRequire, compiled, compiled.exports);
const { createAccountPlanCollectionClient, stateFixture } = compiled.exports;

function snapshotPart() {
  const snapshot = { state: stateFixture(), evidence: null };
  const entry = { planId: accountPlanFingerprint(snapshot), snapshot, progress: [],
    updatedAt: '2026-08-01T00:00:00.000Z', archivedAt: null };
  return splitAccountPlanCollection({ version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN',
    data: { schemaVersion: 1, currentPlanId: entry.planId, plans: [entry] } }).snapshots[0];
}

async function runRace(switchAccount) {
  const part = snapshotPart();
  const material = { keyId: 'synthetic-owner-race', key: await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) };
  let activeOwner = OWNER, sessionReads = 0, requests = 0, outboundOwner = null, stored = null;
  const handler = createAccountPlanCollectionHandler({
    authenticate: async token => {
      const ownerId = token === 'synthetic-owner-token' ? OWNER
        : token === 'synthetic-other-token' ? OTHER : null;
      if (!ownerId) return null;
      return { ownerId, repo: {
        enabled: async () => true, attestationStatus: async () => ({ kind: 'ready' }),
        stage: async value => {
          stored = { ownerId, ...value };
          return { kind: 'staged', partId: value.partId };
        },
      } };
    },
    getMaterial: async () => ({ active: material, get: () => material }),
  });
  const sdk = createClient('https://synthetic.invalid', 'synthetic-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      requests++;
      const authorization = new Headers(options.headers).get('Authorization');
      outboundOwner = authorization === 'Bearer synthetic-owner-token' ? OWNER
        : authorization === 'Bearer synthetic-other-token' ? OTHER : null;
      assert.deepEqual(JSON.parse(options.body).part, part);
      return handler(new Request(url, options));
    } },
  });
  try {
    await sdk.auth.initialize();
    // First read is the app's owner check; the second is the real SDK fetchWithAuth.
    sdk.auth.getSession = async () => {
      sessionReads++;
      if (switchAccount && sessionReads === 2) activeOwner = OTHER;
      return { data: { session: { user: { id: activeOwner }, access_token: activeOwner === OWNER
        ? 'synthetic-owner-token' : 'synthetic-other-token' } }, error: null };
    };
    const api = createAccountPlanCollectionClient(OWNER, () => activeOwner === OWNER,
      { client: async () => sdk, owner: () => activeOwner });
    let result = 'staged';
    try { await api.stage(OWNER, part); } catch (error) { result = error.code; }
    let decryptsAsOriginal = false;
    if (stored) {
      const restored = JSON.parse(await decryptAccountJournalDocument(stored.payload, {
        ownerId: stored.ownerId,
        documentId: await accountPlanCollectionDocumentId(stored.ownerId, part.kind, part.id),
      }, material));
      assert.deepEqual(restored, part);
      decryptsAsOriginal = true;
    }
    return { result, sessionReads, requests, outboundOwner, storedOwner: stored?.ownerId ?? null,
      decryptsAsOriginal };
  } finally {
    await sdk.auth.stopAutoRefresh();
  }
}

test('actual SDK and collection handler accept a valid same-account synthetic stage', async () => {
  assert.deepEqual(await runRace(false), { result: 'staged', sessionReads: 2, requests: 1,
    outboundOwner: OWNER, storedOwner: OWNER, decryptsAsOriginal: true });
});

test('actual SDK token reread must not persist the original plan under another account', async () => {
  const result = await runRace(true);
  assert.equal(result.result, 'STALE');
  assert.equal(result.sessionReads, 2, 'Exercise the actual SDK second token acquisition');
  assert.equal(result.requests, 1);
  assert.equal(result.outboundOwner, OWNER, 'Bind the HTTP bearer to the session already checked by the API');
  assert.notEqual(result.storedOwner, OTHER, 'Late STALE must not hide an earlier cross-account write');
  assert.equal(result.storedOwner, OWNER);
  assert.equal(result.decryptsAsOriginal, true);
});
