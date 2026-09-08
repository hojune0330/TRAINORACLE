import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { createAccountPlanCollectionHandler, createAccountPlanCollectionRepository,
  accountPlanCollectionDocumentId, MAX_BODY_BYTES } from '../functions/_shared/account-plan-collection-handler.mjs';
import { importJournalKeyring, importJournalAttestor } from '../functions/_shared/account-journal-handler.mjs';
import { encryptAccountJournalDocument, decryptAccountJournalDocument } from '../functions/_shared/account-journal-crypto.mjs';
import { splitAccountPlanCollection, accountPlanFingerprint, accountPlanCollectionPartHash } from '../functions/_shared/account-plan-collection-validator.mjs';

const OWNER = 'a1111111-1111-4111-8111-111111111111';
const OTHER = 'b2222222-2222-4222-8222-222222222222';
const OP = 'c3333333-3333-4333-8333-333333333333';
const OP2 = 'd4444444-4444-4444-8444-444444444444';
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
  };
  const change = mutations[process.env.PLAN_COLLECTION_MUTATION];
  assert.ok(change && source.includes(change[0]));
  source = source.replace(...change);
  for (const file of ['account-journal-crypto.mjs', 'account-journal-handler.mjs', 'account-plan-collection-validator.mjs'])
    source = source.replace(`'./${file}'`, JSON.stringify(new URL(file, url).href));
  handlerFactory = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).createAccountPlanCollectionHandler;
}

const { build } = createRequire(new URL('../../app/package.json', import.meta.url))('esbuild');
const built = await build({ stdin: {
  contents: 'export { stateFixture } from "./src/domain/plan-beta-store.test-fixture.ts";',
  resolveDir: fileURLToPath(new URL('../../app/', import.meta.url)), loader: 'ts',
}, tsconfig: fileURLToPath(new URL('../../app/tsconfig.json', import.meta.url)),
bundle: true, write: false, platform: 'neutral', format: 'esm' });
const { stateFixture } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
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
    authenticate: async token => { calls.auth++; return token === 'valid' ? { ownerId: OWNER, repo }
      : token === 'other' ? { ownerId: OTHER, repo } : null; },
    getMaterial: async () => { calls.material++; return material; }, ...options.dependencies });
  const request = (input, init = {}) => handler(new Request('https://edge.example.test/account-plan-collection', {
    method: 'POST', body: JSON.stringify(input), ...init,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid', Origin: ORIGIN, ...init.headers },
  }));
  const stage = async collection => {
    for (const part of [...collection.snapshots, ...collection.progress])
      await check(await request({ action: 'stage', part }), 200, { kind: 'staged' });
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
  for (const input of [{ action: 'status' }, { action: 'readIndex', ownerId: OWNER }, { action: 'stage', part: {}, ownerId: OWNER },
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
  await check(await f.request({ action: 'stage', part: { ...part, progress: ['x'.repeat(500_000)] } }), 422);
  await check(await f.request({ action: 'stage', part: { ...part, id: accountPlanFingerprint('wrong') } }), 422);
  await check(await f.request({ action: 'stage', part }), 200, { kind: 'staged' });
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
      read_account_plan_collection_index: [], read_account_plan_collection_part: ['part_kind', 'part_id'],
      read_account_plan_collection_receipt: ['operation_id'],
    };
    const client = { rpc: async (name, args = {}) => {
      assert.ok(Object.hasOwn(signatures, name));
      const values = signatures[name].map(key => args[key]);
      try {
        const result = await db.query(`select public.${name}(${values.map((_, i) => `$${i + 1}`).join(',')}) as result`, values);
        return { data: result.rows[0].result, error: null };
      } catch (error) { return { data: null, error }; }
    } };
    let keysAvailable = true;
    const f = await fixture({ dependencies: {
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
    // One in-process PostgreSQL session, not proof of independent-session lock waiting or live JWT verification.
  } finally { await db.close(); }
});
