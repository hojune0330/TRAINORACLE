import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createAccountJournalHandler, createAccountJournalRepository, importJournalKeyring,
  validateDraftDocument, validateAccountJournalDocument, MAX_BODY_BYTES } from '../functions/_shared/account-journal-handler.mjs';
import { encryptAccountJournalDocument as encrypt } from '../functions/_shared/account-journal-crypto.mjs';
import * as accountState from '../functions/_shared/account-state-validator.mjs';

const OWNER = 'a1111111-1111-4111-8111-111111111111';
const OTHER = 'b2222222-2222-4222-8222-222222222222';
const DOC = 'c3333333-3333-4333-8333-333333333333';
const DOC2 = 'd4444444-4444-4444-8444-444444444444';
const OP = 'e5555555-5555-4555-8555-555555555555';
const OP2 = 'f6666666-6666-4666-8666-666666666666';
const ORIGIN = 'https://journal.example.test';
const draft = { version: 1, state: 'DRAFT', visibility: 'PRIVATE', date: '2026-09-08', title: 'Synthetic', body: 'Synthetic private draft' };
const save = (overrides = {}) => ({ action: 'save', documentId: DOC, operationId: OP, expectedRevision: 0, document: draft, ...overrides });
const serialized = JSON.stringify({ activeKeyId: 'synthetic-v1', keys: { 'synthetic-v1': btoa('s'.repeat(32)) } });
let handlerFactory = createAccountJournalHandler;
// Optional mutation probes affect imported bytes only, never shared source files.
if (process.env.JOURNAL_HANDLER_MUTATION) {
  const url = new URL('../functions/_shared/account-journal-handler.mjs',import.meta.url);
  let source = await readFile(url,'utf8');
  const mutations = {
    'history-record-identity': ["if (doc.state === 'FINALIZED' && await recordId(ownerId, doc.entry.id) !== documentId) throw 0;", ''],
    'history-collection-filter': ["input.collection !== 'JOURNAL' || value.document.state === 'FINALIZED'", 'true'],
    'purged-operation-guard': ["if (prior.proposed_encrypted_payload === null) fail(409, 'OPERATION_REPLAY_UNAVAILABLE');", ''],
  };
  const change = mutations[process.env.JOURNAL_HANDLER_MUTATION];
  assert.ok(change && source.includes(change[0]), 'mutation must change an observed guard');
  source = source.replace(...change);
  for (const file of ['account-journal-crypto.mjs','account-journal-record-validator.mjs','account-state-validator.mjs'])
    source = source.replace(`'./${file}'`,JSON.stringify(new URL(file,url).href));
  handlerFactory = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).createAccountJournalHandler;
}

async function fixture(options = {}) {
  const material = await importJournalKeyring(serialized);
  const docs = new Map(), operations = new Map();
  const calls = { auth: 0, material: 0, commit: 0, operation: 0, enabled: 0 };
  const key = (owner, id) => `${owner}:${id}`;
  const repo = {
    enabled: async () => { calls.enabled++; return true; },
    operation: async (owner, id) => { calls.operation++; return operations.get(key(owner, id)) ?? null; },
    read: async (owner, id) => docs.get(key(owner, id)) ?? null,
    list: async (owner, limit, cursor = '') => [...docs.values()].filter(row => row.user_id === owner && row.document_id > cursor)
      .sort((a, b) => a.document_id.localeCompare(b.document_id)).slice(0, limit),
    async commit(input) {
      calls.commit++;
      assert.equal('document' in input, false, 'repository must never receive plaintext');
      const existing = operations.get(key(OWNER, input.operationId));
      if (existing) throw Object.assign(new Error('synthetic database detail'), { code: '22023' });
      const currentRevision = docs.get(key(OWNER, input.documentId))?.revision ?? 0;
      const result = currentRevision === input.expectedRevision
        ? { kind: 'saved', documentId: input.documentId, operationId: input.operationId, revision: currentRevision + 1 }
        : { kind: 'conflict', documentId: input.documentId, operationId: input.operationId, currentRevision };
      operations.set(key(OWNER, input.operationId), { user_id: OWNER, operation_id: input.operationId,
        document_id: input.documentId, expected_revision: input.expectedRevision,
        operation_kind: 'commit', source_revision: null,
        proposed_encrypted_payload: input.encryptedPayload, result, trusted_metadata: input.metadata });
      if (result.kind === 'saved') docs.set(key(OWNER, input.documentId), { user_id: OWNER,
        document_id: input.documentId, revision: result.revision, encrypted_payload: input.encryptedPayload });
      return result;
    },
  };
  Object.assign(repo, options.repo);
  const handler = handlerFactory({
    allowedOrigins: [ORIGIN], validateDocument: validateDraftDocument,
    authenticate: async token => { calls.auth++; return token === 'synthetic-token'
      ? { ownerId: OWNER, repo } : token === 'other-token' ? { ownerId: OTHER, repo } : null; },
    getMaterial: async () => { calls.material++; return material; }, ...options.dependencies,
  });
  const request = (input, init = {}) => handler(new Request('https://gateway.example.test/account-journal', {
    method: 'POST', body: JSON.stringify(input), ...init,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-token', Origin: ORIGIN, ...init.headers },
  }));
  return { handler, request, repo, material, calls, docs, operations, key };
}
async function response(response, status, value) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  if (value !== undefined) assert.deepEqual(body, value);
  return body;
}

test('status verifies identity, gates and nonextractable runtime key before ready', async () => {
  const f = await fixture();
  await response(await f.request({ action: 'status' }), 200, { kind: 'ready' });
  assert.equal(f.calls.auth, 1); assert.equal(f.calls.material, 1); assert.equal(f.calls.commit, 0);
  assert.equal(f.material.active.key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('raw', f.material.active.key));
});

test('save/read/list exact wire shapes, encryption and owner isolation', async () => {
  const f = await fixture();
  await response(await f.request(save()), 200, { kind: 'saved', documentId: DOC, operationId: OP, revision: 1 });
  assert.equal(JSON.stringify([...f.docs.values()]).includes(draft.body), false);
  const document = { documentId: DOC, revision: 1, document: draft };
  await response(await f.request({ action: 'read', documentId: DOC }), 200, { kind: 'document', ...document });
  await response(await f.request({ action: 'list' }), 200, { kind: 'list', documents: [document], nextCursor: null });
  await response(await f.request({ action: 'read', documentId: DOC }, { headers: { Authorization: 'Bearer other-token' } }), 404, { error: 'NOT_FOUND' });
  await response(await f.request({ action: 'list' }, { headers: { Authorization: 'Bearer other-token' } }), 200,
    { kind: 'list', documents: [], nextCursor: null });
});

test('idempotent semantic field order replay does not encrypt/commit again', async () => {
  const f = await fixture();
  const first = await response(await f.request(save()), 200);
  const reordered = Object.fromEntries(Object.entries(draft).reverse());
  await response(await f.request(save({ document: reordered })), 200, first);
  assert.equal(f.calls.commit, 1);
  for (const changed of [{ documentId: DOC2 }, { expectedRevision: 1 }, { document: { ...draft, body: 'different' } }]) {
    await response(await f.request(save(changed)), 409, { error: 'OPERATION_REUSED' });
  }
  assert.equal(f.calls.commit, 1);
});

test('concurrent nonce race re-reads winning operation and compares plaintext', async () => {
  const f = await fixture();
  let arrived = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  f.repo.operation = async (owner, id) => {
    if (arrived < 2) { arrived++; if (arrived === 2) release(); await barrier; return null; }
    return f.operations.get(f.key(owner, id)) ?? null;
  };
  const results = await Promise.all([f.request(save()), f.request(save())]);
  const bodies = [];
  for (const result of results) bodies.push(await response(result, 200));
  assert.deepEqual(bodies[0], bodies[1]); assert.equal(f.calls.commit, 2); assert.equal(f.operations.size, 1);
});

test('concurrent different payload or document cannot obtain an old receipt', async () => {
  for (const changed of [{ document: { ...draft, body: 'different' } }, { documentId: DOC2 }]) {
    const f = await fixture();
    const commit = f.repo.commit;
    f.repo.commit = async input => {
      await commit({ ...input, documentId: DOC,
        encryptedPayload: await encrypt(JSON.stringify(draft), { ownerId: OWNER, documentId: DOC }, f.material.active) });
      throw Object.assign(new Error('synthetic raw details'), { code: '22023' });
    };
    await response(await f.request(save(changed)), 409, { error: 'OPERATION_REUSED' });
  }
});

test('CAS conflict returns currentRevision and preserves encrypted losing draft/replay', async () => {
  const f = await fixture();
  await f.request(save());
  const proposal = save({ operationId: OP2, document: { ...draft, body: 'losing draft' } });
  const conflict = { kind: 'conflict', documentId: DOC, operationId: OP2, currentRevision: 1 };
  await response(await f.request(proposal), 409, conflict);
  await response(await f.request(proposal), 409, conflict);
  assert.equal(f.operations.size, 2);
  await response(await f.request({ action: 'read', documentId: DOC }), 200,
    { kind: 'document', documentId: DOC, revision: 1, document: draft });
});

test('latest valid draft is returned after sequential revisions', async () => {
  const f = await fixture();
  await f.request(save());
  const latest = { ...draft, visibility: 'PERSONAL', body: 'updated' };
  await response(await f.request(save({ operationId: OP2, expectedRevision: 1, document: latest })), 200,
    { kind: 'saved', documentId: DOC, operationId: OP2, revision: 2 });
  await response(await f.request({ action: 'read', documentId: DOC }), 200,
    { kind: 'document', documentId: DOC, revision: 2, document: latest });
});

test('strict draft boundary rejects finalization, extras, invalid calendar dates and size excess', async () => {
  const f = await fixture();
  for (const document of [null, [], { ...draft, extra: 1 }, { ...draft, state: 'FINAL' },
    { ...draft, visibility: 'PUBLIC' }, { ...draft, version: 2 }, { ...draft, date: '2026-02-29' },
    { ...draft, date: '2024-02-30' }, { ...draft, date: '0000-01-01' },
    { ...draft, date: '2026-9-08' }, { ...draft, title: 'x'.repeat(201) },
    { ...draft, body: 'x'.repeat(100001) }, { ...draft, body: 3 }]) {
    await response(await f.request(save({ document })), 422, { error: 'INVALID_DOCUMENT' });
  }
  assert.equal(validateDraftDocument({ ...draft, date: '2024-02-29', title: 'x'.repeat(200), body: 'x'.repeat(100000) }), true);
  assert.equal(f.calls.commit, 0); assert.equal(f.calls.material, 0);
});

test('per-action strict keys, UUIDs, safe revisions and pagination bounds', async () => {
  const f = await fixture();
  for (const input of [null, [], { action: 'finalize' }, { action: 'status', ownerId: OWNER },
    { action: 'read', documentId: 'bad' }, { action: 'read', documentId: DOC, extra: 1 },
    { action: 'list', limit: 51 }, { action: 'list', limit: 0 }, { action: 'list', cursor: null },
    { action: 'list', cursor: 'bad' }, { action: 'list', extra: 1 }, save({ extra: 1 }),
    save({ operationId: 'bad' }), save({ expectedRevision: -1 }), save({ expectedRevision: 0.5 }),
    save({ expectedRevision: Number.MAX_SAFE_INTEGER }), save({ expectedRevision: '0' })]) {
    await response(await f.request(input), 400, { error: 'INVALID_REQUEST' });
  }
});

test('CORS exact allowlist, methods and authentication fail before key access', async () => {
  const f = await fixture();
  for (const Origin of ['https://evil.example.test', `${ORIGIN}.evil.test`, 'null', '*']) {
    const result = await f.request({ action: 'status' }, { headers: { Origin } });
    assert.equal(result.headers.get('access-control-allow-origin'), null);
    await response(result, 403, { error: 'ACCESS_DENIED' });
  }
  for (const Authorization of ['', 'Basic synthetic-token', 'Bearer invalid', 'Bearer token extra']) {
    await response(await f.request({ action: 'status' }, { headers: { Authorization } }), 401, { error: 'AUTH_REQUIRED' });
  }
  const get = await f.handler(new Request('https://gateway.example.test', { method: 'GET', headers: { Origin: ORIGIN } }));
  await response(get, 405, { error: 'METHOD_NOT_ALLOWED' });
  const preflight = await f.handler(new Request('https://gateway.example.test', { method: 'OPTIONS', headers: {
    Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type,apikey,x-client-info',
  } }));
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(preflight.headers.get('cache-control'), 'no-store');
  assert.equal(f.calls.material, 0);
});

test('streaming byte bound defeats missing and lying Content-Length before parse', async () => {
  for (const declared of [undefined, '1']) {
    const f = await fixture();
    let cancelled = false;
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"action":"save","document":{"body":"'));
      controller.enqueue(new Uint8Array(MAX_BODY_BYTES));
    }, cancel() { cancelled = true; } });
    const headers = { Authorization: 'Bearer synthetic-token', 'Content-Type': 'application/json', Origin: ORIGIN };
    if (declared) headers['Content-Length'] = declared;
    const result = await f.handler(new Request('https://gateway.example.test', { method: 'POST', headers, body: stream, duplex: 'half' }));
    await response(result, 413, { error: 'BODY_TOO_LARGE' });
    assert.equal(cancelled, true); assert.equal(f.calls.material, 0);
  }
  const f = await fixture();
  await response(await f.request({}, { body: '{invalid' }), 400, { error: 'INVALID_REQUEST' });
  await response(await f.request({}, { headers: { 'Content-Type': 'text/plain' } }), 415, { error: 'UNSUPPORTED_MEDIA_TYPE' });
});

test('disabled, ineligible, database errors and missing keys never become ready/empty list', async () => {
  for (const action of ['status', 'list', 'read', 'save']) {
    const input = action === 'save' ? save() : action === 'read' ? { action, documentId: DOC } : { action };
    const f = await fixture({ repo: { enabled: async () => false } });
    await response(await f.request(input), 403, { error: 'ACCESS_DENIED' });
    assert.equal(f.calls.material, 0);
    const broken = await fixture({ repo: { enabled: async () => { throw new Error(draft.body); } } });
    await response(await broken.request(input), 503, { error: 'SERVICE_UNAVAILABLE' });
    const missing = await fixture({ dependencies: { getMaterial: async () => importJournalKeyring(undefined) } });
    await response(await missing.request(input), 503, { error: 'SERVICE_UNAVAILABLE' });
  }
});

test('gate revocation after query does not disguise RLS denial as empty or missing', async () => {
  const f = await fixture();
  let count = 0;
  f.repo.enabled = async () => ++count === 1;
  await response(await f.request({ action: 'list' }), 403, { error: 'ACCESS_DENIED' });
});

test('pagination is ordered, user bound and invalid lookahead fails whole page', async () => {
  const f = await fixture();
  await f.request(save()); await f.request(save({ documentId: DOC2, operationId: OP2 }));
  const page = await response(await f.request({ action: 'list', limit: 1 }), 200);
  assert.equal(page.documents.length, 1); assert.equal(page.nextCursor, DOC);
  const next = await response(await f.request({ action: 'list', limit: 1, cursor: page.nextCursor }), 200);
  assert.equal(next.documents[0].documentId, DOC2); assert.equal(next.nextCursor, null);
  const row = f.docs.get(f.key(OWNER, DOC2));
  row.encrypted_payload = { ...row.encrypted_payload, ciphertext: 'invalid' };
  await response(await f.request({ action: 'list', limit: 1 }), 503, { error: 'SERVICE_UNAVAILABLE' });
});

test('decrypted malformed/finalized/foreign/corrupt documents fail closed, never filter', async () => {
  for (const invalid of [{ ...draft, state: 'FINAL' }, { ...draft, extra: 'private' }, { ...draft, date: '2026-02-30' }]) {
    const f = await fixture();
    f.docs.set(f.key(OWNER, DOC), { user_id: OWNER, document_id: DOC, revision: 1,
      encrypted_payload: await encrypt(JSON.stringify(invalid), { ownerId: OWNER, documentId: DOC }, f.material.active) });
    for (const input of [{ action: 'read', documentId: DOC }, { action: 'list' }]) {
      await response(await f.request(input), 503, { error: 'SERVICE_UNAVAILABLE' });
    }
  }
  const f = await fixture(); await f.request(save());
  f.docs.get(f.key(OWNER, DOC)).user_id = OTHER;
  await response(await f.request({ action: 'read', documentId: DOC }), 503, { error: 'SERVICE_UNAVAILABLE' });
});

test('receipt IDs and expected revision must match both fresh and replayed saves', async () => {
  for (const mutation of [{ documentId: DOC2 }, { operationId: OP2 }, { revision: 3 }, { revision: '1' },
    { revision: Number.MAX_SAFE_INTEGER }, { extra: draft.body }]) {
    const f = await fixture(); const commit = f.repo.commit;
    f.repo.commit = async input => ({ ...await commit(input), ...mutation });
    await response(await f.request(save()), 503, { error: 'SERVICE_UNAVAILABLE' });
    Object.assign(f.operations.get(f.key(OWNER, OP)).result, mutation);
    await response(await f.request(save()), 503, { error: 'SERVICE_UNAVAILABLE' });
  }
});

test('rotated keyring decrypts retained proposals; missing old key is unavailable', async () => {
  const rotated = await importJournalKeyring(JSON.stringify({ activeKeyId: 'v2', keys: {
    'synthetic-v1': btoa('s'.repeat(32)), v2: btoa('t'.repeat(32)),
  } }));
  let current;
  const f = await fixture({ dependencies: { getMaterial: async () => current } });
  current = f.material; await response(await f.request(save()), 200);
  current = rotated; await response(await f.request(save()), 200);
  current = await importJournalKeyring(JSON.stringify({ activeKeyId: 'v2', keys: { v2: btoa('t'.repeat(32)) } }));
  await response(await f.request(save()), 503, { error: 'SERVICE_UNAVAILABLE' });
});

test('malformed keyring never leaks raw material or parsing/provider details', async () => {
  for (const input of [undefined, '', 'secret-not-json', '{}', JSON.stringify({ activeKeyId: 'x', keys: { x: 'bad' } }),
    JSON.stringify({ activeKeyId: 'missing', keys: { x: btoa('s'.repeat(32)) } })]) {
    await assert.rejects(importJournalKeyring(input), { message: 'KEY_UNAVAILABLE' });
  }
});

test('repository adapter uses exact authenticated RPC args and owner-bound RLS queries; errors throw', async () => {
  const calls = [];
  let data = true, error = null;
  const query = { then(resolve) { return Promise.resolve({ data, error }).then(resolve); } };
  for (const method of ['select', 'eq', 'order', 'limit', 'gt', 'maybeSingle']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  const client = { rpc: (...args) => { calls.push(['rpc', ...args]); return query; },
    from: table => { calls.push(['from', table]); return query; } };
  const attest = async (ownerId, action, input) => ({ request_text: JSON.stringify({ ownerId, action, ...input }), signature: 'synthetic', key_id: 'test' });
  const repo = createAccountJournalRepository(client, { ownerId: OWNER, attest });
  assert.equal(await repo.enabled(OWNER), true);
  assert.deepEqual(calls.splice(0), [
    ['rpc', 'service_feature_enabled', { feature_key_input: 'ACCOUNT' }],
    ['rpc', 'service_feature_enabled', { feature_key_input: 'ACCOUNT_JOURNAL_V2' }],
    ['rpc', 'account_network_access_allowed', { target_user: OWNER }],
  ]);
  data = [];
  await repo.list(OWNER, 51, DOC);
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'user_id', OWNER])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['gt', 'document_id', DOC])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['limit', 51])));
  calls.length = 0;
  await repo.commit({ documentId: DOC, operationId: OP, expectedRevision: 0, encryptedPayload: { synthetic: true } });
  assert.deepEqual(calls, [['rpc', 'mutate_account_journal_attested', await attest(OWNER,'commit', {
    documentId: DOC, operationId: OP, expectedRevision: 0, encryptedPayload: { synthetic: true } })]]);
  error = { code: '22023', message: draft.body, details: serialized };
  await assert.rejects(repo.operation(OWNER, OP), e => e.code === '22023' && e.message === 'ACCOUNT_JOURNAL_DATABASE_ERROR' && !('details' in e));
  error = { code: 'unknown', message: draft.body };
  await assert.rejects(repo.list(OWNER, 51), { message: 'ACCOUNT_JOURNAL_DATABASE_ERROR' });
});

test('deployment entrypoint pins official SDK and user auth, no service role or logging', async () => {
  const source = await readFile(new URL('../functions/account-journal/index.ts', import.meta.url), 'utf8');
  assert.match(source, /npm:@supabase\/supabase-js@2\.109\.0/);
  assert.match(source, /client\.auth\.getUser\(token\)/);
  assert.match(source, /Authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|console\./);
});

test('100000-character Korean body fits both UTF-8 and escaped JSON transport bounds', async () => {
  for (const escaped of [false, true]) {
    const f = await fixture();
    const document = { ...draft, title: '\ud55c'.repeat(200), body: '\ud55c'.repeat(100000) };
    let body = JSON.stringify(save({ document }));
    if (escaped) body = body.replaceAll('\ud55c', '\\ud55c');
    assert.ok(new TextEncoder().encode(body).length > 262144);
    assert.ok(new TextEncoder().encode(body).length < MAX_BODY_BYTES);
    await response(await f.request(save(), { body }), 200);
    const read = await response(await f.request({ action: 'read', documentId: DOC }), 200);
    assert.deepEqual(read.document, document);
  }
});

const lifecycle = (action, overrides = {}) => ({ action, documentId: DOC, operationId: OP2,
  expectedRevision: 1, ...(action === 'restore' ? { sourceRevision: 1 } : {}), ...overrides });
const historyRequest = { action: 'history', documentId: DOC };
const replacedAt = '2026-09-08T00:00:00.000Z';
const expiresAt = '2026-10-08T00:00:00.000Z';
async function historyRow(f, overrides = {}, document = draft, context = { ownerId: OWNER, documentId: DOC }) {
  return { revision: 1, encryptedPayload: await encrypt(JSON.stringify(document), context, f.material.active),
    replacedAt, expiresAt, reason: 'trash', ...overrides };
}
function operationRow(action, result, overrides = {}) {
  return { user_id: OWNER, operation_id: OP2, document_id: DOC, expected_revision: 1,
    operation_kind: action, source_revision: action === 'restore' ? 1 : null,
    proposed_encrypted_payload: null, result, ...overrides };
}
const finalized = { version: 2, state: 'FINALIZED', kind: 'JOURNAL', entry: {
  id: 'p', kind: 'post-session', date: '2026-08-01', savedAt: '2026-08-01T00:00:01.000Z',
  syncState: 'local', system: 'recovery', title: '', distanceKm: '', durationMin: '', avgPace: '',
  rpe: 0, memo: 'Synthetic private record', memoPurpose: 'PRIVATE_SELF_ONLY',
} };
let stateFixtures;
async function decorationFixtures() {
  if (!stateFixtures) stateFixtures = (async () => {
    const { build } = createRequire(new URL('../../app/package.json',import.meta.url))('esbuild');
    const output = await build({ stdin:{ contents:'export { createEmptyDecorationState } from "./src/domain/decoration-schema.ts"; export { DECORATION_CATALOG } from "./src/domain/decoration-catalog.ts";',
      resolveDir:fileURLToPath(new URL('../../app/',import.meta.url)),loader:'ts' }, bundle:true,write:false,platform:'neutral',format:'esm',minify:true });
    return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
  })();
  return stateFixtures;
}
async function fixedStateId(kind,owner=OWNER) {
  const namespace = kind === 'PLAN' ? 'trainoracle.account.plan.v1' : 'trainoracle.account.decorations.v1';
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([namespace,owner]))));
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const h=Buffer.from(bytes.slice(0,16)).toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

test('ACCOUNT_STATE fixed owner identity, stable nonDraft canonical replay, kind guard and collection exclusion',async()=>{
  const { createEmptyDecorationState }=await decorationFixtures();
  const decorations={version:3,state:'ACCOUNT_STATE',kind:'DECORATIONS',data:createEmptyDecorationState()};
  const plan={version:3,state:'ACCOUNT_STATE',kind:'PLAN',data:{schemaVersion:1,currentPlanId:null,plans:[]}};
  const f=await fixture({dependencies:{validateDocument:validateAccountJournalDocument}});
  for(const [index,document] of [decorations,plan].entries()) {
    const documentId=await fixedStateId(document.kind);
    const operationId=index===0?OP:OP2;
    await response(await f.request(save({documentId:DOC,operationId,document})),422);
    await response(await f.request(save({documentId:await fixedStateId(document.kind,OTHER),operationId,document})),422);
    await response(await f.request(save({documentId,operationId,document})),200);
    const reordered=Object.fromEntries(Object.entries(document).reverse());
    await response(await f.request(save({documentId,operationId,document:reordered})),200);
    assert.deepEqual((await response(await f.request({action:'read',documentId}),200)).document,document);
    await response(await f.request(save({documentId,operationId:crypto.randomUUID(),expectedRevision:1,document:draft})),422);
  }
  assert.deepEqual((await response(await f.request({action:'list'}),200)).documents,[]);
  assert.deepEqual((await response(await f.request({action:'list',collection:'JOURNAL'}),200)).documents,[]);
});

test('purchase metadata uses generated catalog prices, not client points or page text',async()=>{
  const { createEmptyDecorationState, DECORATION_CATALOG }=await decorationFixtures();
  assert.equal(typeof accountState.accountDecorationPurchaseMetadata,'function');
  for(const item of DECORATION_CATALOG.filter(item=>!item.starterOwned && item.cost>0)) {
    const data=structuredClone(createEmptyDecorationState()); data.ownedItemIds.push(item.id);data.spentPoints=item.cost;
    const metadata=accountState.accountDecorationPurchaseMetadata({version:3,state:'ACCOUNT_STATE',kind:'DECORATIONS',data});
    assert.deepEqual(metadata,{purchases:[{itemId:item.id,cost:item.cost}],spentPoints:item.cost});
  }
});
async function finalizedId(owner = OWNER) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(JSON.stringify(['trainoracle.journal.record.v1', owner, finalized.entry.id]))));
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = Buffer.from(bytes.slice(0,16)).toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

test('finalized update cannot change date or document kind while memo edits remain allowed', async () => {
  const f = await fixture({ dependencies: { validateDocument: validateAccountJournalDocument } });
  const documentId = await finalizedId();
  await response(await f.request(save({ documentId, document: finalized })), 200);
  const next = { ...finalized, entry: { ...finalized.entry, memo: 'Synthetic changed body' } };
  await response(await f.request(save({ documentId, operationId: OP2, expectedRevision: 1,
    document: { ...next, entry: { ...next.entry, date: '2026-08-02' } } })), 422);
  await response(await f.request(save({ documentId, operationId: OP2, expectedRevision: 1, document: draft })), 422);
  await response(await f.request(save({ documentId, operationId: OP2, expectedRevision: 1, document: next })), 200);
  const loaded = await response(await f.request({ action: 'read', documentId }), 200);
  assert.deepEqual(loaded.document, next);
  assert.equal(loaded.revision, 2);
});

test('history exact response decrypts every eligible version without returning envelopes', async () => {
  const f = await fixture();
  const latest = { ...draft, body: 'Synthetic later draft' };
  const rows = [await historyRow(f, { revision: 2, reason: 'replaced' }, latest), await historyRow(f)];
  f.repo.history = async id => { assert.equal(id, DOC); return rows; };
  await response(await f.request(historyRequest), 200, { kind: 'history', documentId: DOC, versions: [
    { revision: 2, document: latest, replacedAt, expiresAt, reason: 'replaced' },
    { revision: 1, document: draft, replacedAt, expiresAt, reason: 'trash' },
  ] });
  f.repo.history = async () => [];
  await response(await f.request(historyRequest), 200, { kind: 'history', documentId: DOC, versions: [] });
});

test('history rejects malformed metadata, duplicate/order errors and corrupt/foreign/invalid documents as a whole', async () => {
  const f = await fixture(); const valid = await historyRow(f);
  for (const rows of [null, {}, [{ ...valid, revision: 0 }], [{ ...valid, revision: '1' }],
    [{ ...valid, reason: 'unknown' }], [{ ...valid, expiresAt: replacedAt }],
    [{ ...valid, replacedAt: 'not-a-time' }], [{ ...valid, extra: 'private' }],
    [valid, valid], [valid, { ...valid, revision: 2 }],
    [await historyRow(f, {}, { ...draft, extra: 'private' })],
    [await historyRow(f, {}, draft, { ownerId: OTHER, documentId: DOC })],
    [await historyRow(f, {}, draft, { ownerId: OWNER, documentId: DOC2 })],
    [{ ...valid, encryptedPayload: { ...valid.encryptedPayload, ciphertext: 'corrupt' } }]]) {
    f.repo.history = async () => rows;
    await response(await f.request(historyRequest), 503, { error: 'SERVICE_UNAVAILABLE' });
  }
});

test('tombstone read/list shapes preserve pagination and include deletedDocuments only when nonempty', async () => {
  const f = await fixture(); await f.request(save({ documentId: DOC2 }));
  f.docs.set(f.key(OWNER,DOC), { user_id: OWNER, document_id: DOC, revision: 3,
    encrypted_payload: null, deleted_at: replacedAt });
  await response(await f.request({ action: 'read', documentId: DOC }), 200,
    { kind: 'deleted', documentId: DOC, revision: 3 });
  const tombstones = [{ documentId: DOC, revision: 3 }];
  for (const collection of [undefined, 'JOURNAL']) {
    await response(await f.request({ action: 'list', limit: 1, ...(collection ? { collection } : {}) }), 200,
      { kind: 'list', documents: [], deletedDocuments: tombstones, nextCursor: DOC });
  }
  await response(await f.request({ action: 'list', limit: 1, cursor: DOC }), 200,
    { kind: 'list', documents: [{ documentId: DOC2, revision: 1, document: draft }], nextCursor: null });
  await response(await f.request({ action: 'list' }, { headers: { Authorization: 'Bearer other-token' } }), 200,
    { kind: 'list', documents: [], nextCursor: null });
});

test('malformed tombstones and invalid deleted lookahead fail the entire read/list', async () => {
  for (const change of [{ user_id: OTHER }, { revision: 0 }, { revision: '2' },
    { deleted_at: 'bad' }, { encrypted_payload: {} }, { deleted_at: null }]) {
    const f = await fixture(); await f.request(save());
    f.docs.set(f.key(OWNER,DOC2), { user_id: OWNER, document_id: DOC2, revision: 2,
      encrypted_payload: null, deleted_at: replacedAt, ...change });
    f.repo.list = async () => [...f.docs.values()]; // Simulate a broken adapter returning a foreign lookahead.
    await response(await f.request({ action: 'read', documentId: DOC2 }), 503, { error: 'SERVICE_UNAVAILABLE' });
    await response(await f.request({ action: 'list', limit: 1 }), 503, { error: 'SERVICE_UNAVAILABLE' });
  }
});

test('FinalRecord deterministic identity, default Draft filter and JOURNAL collection remain intact', async () => {
  assert.equal(validateAccountJournalDocument(finalized), true);
  const f = await fixture({ dependencies: { validateDocument: validateAccountJournalDocument } });
  const documentId = await finalizedId();
  await response(await f.request(save({ documentId, document: finalized })), 200,
    { kind: 'saved', documentId, operationId: OP, revision: 1 });
  await f.request(save({ operationId: OP2 }));
  await response(await f.request({ action: 'list', collection: 'JOURNAL' }), 200,
    { kind: 'list', documents: [{ documentId, revision: 1, document: finalized }], nextCursor: null });
  await response(await f.request({ action: 'list' }), 200,
    { kind: 'list', documents: [{ documentId: DOC, revision: 1, document: draft }], nextCursor: null });
  await response(await f.request(save({ documentId: DOC2, document: finalized })), 422, { error: 'INVALID_DOCUMENT' });
  f.repo.history = async () => [await historyRow(f, {}, finalized, { ownerId: OWNER, documentId })];
  await response(await f.request({ action: 'history', documentId }), 200, { kind: 'history', documentId,
    versions: [{ revision: 1, document: finalized, replacedAt, expiresAt, reason: 'trash' }] });
  f.repo.history = async () => [await historyRow(f, {}, finalized)];
  await response(await f.request(historyRequest), 503, { error: 'SERVICE_UNAVAILABLE' });
  let restored = false; f.repo.restore = async () => { restored = true; };
  await response(await f.request(lifecycle('restore', { operationId: crypto.randomUUID() })), 503, { error: 'SERVICE_UNAVAILABLE' });
  assert.equal(restored, false);
});

test('delete and restore call exact lifecycle methods and return validated success receipts', async () => {
  for (const action of ['delete','restore']) {
    const f = await fixture(); const calls = [];
    f.repo.history = async () => [await historyRow(f)];
    const result = { kind: action === 'delete' ? 'deleted' : 'restored', documentId: DOC, operationId: OP2,
      revision: 2, ...(action === 'restore' ? { sourceRevision: 1 } : {}) };
    f.repo[action] = async input => { calls.push(input); return result; };
    await response(await f.request(lifecycle(action)), 200, result);
    assert.deepEqual(calls, [{ documentId: DOC, operationId: OP2, expectedRevision: 1,
      ...(action === 'restore' ? { sourceRevision: 1, metadata: { kind:'DRAFT',occurrenceId:null,journalDate:null,eligible:false } } : {}) }]);
    assert.equal(f.calls.commit, 0);
  }
});

test('same-revision tombstone conflicts are valid for save/delete/restore, not malformed receipts', async () => {
  for (const action of ['save','delete','restore']) {
    const f = await fixture(); f.repo.history = async () => [await historyRow(f)];
    const expectedRevision = 1;
    const result = { kind: 'conflict', documentId: DOC, operationId: OP2, currentRevision: expectedRevision };
    f.repo[action === 'save' ? 'commit' : action] = async () => result;
    const input = action === 'save' ? save({ operationId: OP2, expectedRevision }) : lifecycle(action);
    await response(await f.request(input), 409, result);
  }
});

test('restore validates chosen source first; missing source never calls mutation; SQL expiry race returns 409 receipt', async () => {
  const f = await fixture(); let calls = 0;
  const result = { kind: 'source_unavailable', documentId: DOC, operationId: OP2, currentRevision: 1, sourceRevision: 1 };
  f.repo.restore = async () => { calls++; return result; };
  f.repo.history = async () => [];
  await response(await f.request(lifecycle('restore')), 409, { error: 'SOURCE_UNAVAILABLE' });
  assert.equal(calls, 0);
  f.repo.history = async () => [await historyRow(f, { revision: 2 })];
  await response(await f.request(lifecycle('restore')), 409, { error: 'SOURCE_UNAVAILABLE' });
  assert.equal(calls, 0);
  f.repo.history = async () => [await historyRow(f)];
  await response(await f.request(lifecycle('restore')), 409, result);
  assert.equal(calls, 1);
});

test('lifecycle replay remains stable without re-reading expired history or mutating current revision', async () => {
  for (const action of ['delete','restore']) {
    const f = await fixture();
    const result = { kind: action === 'delete' ? 'deleted' : 'restored', documentId: DOC, operationId: OP2,
      revision: 2, ...(action === 'restore' ? { sourceRevision: 1 } : {}) };
    f.operations.set(f.key(OWNER,OP2), operationRow(action,result));
    f.repo.history = async () => { throw new Error('must not consult expired history'); };
    f.repo[action] = async () => { throw new Error('must not mutate on replay'); };
    await response(await f.request(lifecycle(action)), 200, result);
    await response(await f.request(lifecycle(action,{ expectedRevision: 2 })), 409, { error: 'OPERATION_REUSED' });
    await response(await f.request(lifecycle(action,{ documentId: DOC2 })), 409, { error: 'OPERATION_REUSED' });
    if (action === 'restore') await response(await f.request(lifecycle(action,{ sourceRevision: 2 })), 409, { error: 'OPERATION_REUSED' });
  }
});

test('operation action reuse cannot turn a commit into delete/restore or return another action receipt', async () => {
  const f = await fixture(); await f.request(save());
  for (const action of ['delete','restore']) await response(await f.request(lifecycle(action,
    { operationId: OP, expectedRevision: 0 })), 409, { error: 'OPERATION_REUSED' });
  f.operations.set(f.key(OWNER,OP), operationRow('delete', {}, { operation_id: OP, expected_revision: 0 }));
  await response(await f.request(save()), 409, { error: 'OPERATION_REUSED' });
});

test('purged save proposal fails explicitly without re-encryption/commit; hidden expired collision never resets operation', async () => {
  const f = await fixture(); await f.request(save());
  f.operations.get(f.key(OWNER,OP)).proposed_encrypted_payload = null;
  await response(await f.request(save()), 409, { error: 'OPERATION_REPLAY_UNAVAILABLE' });
  assert.equal(f.calls.commit, 1);
  f.repo.operation = async () => null; // 0034 RLS hides expired non-purged payload rows.
  await response(await f.request(save()), 503, { error: 'SERVICE_UNAVAILABLE' });
  assert.equal(f.calls.commit, 2); assert.equal(f.operations.size, 1);
  assert.equal(f.docs.get(f.key(OWNER,DOC)).revision, 1);
});

test('lifecycle concurrent operation reuse re-reads winner and checks source/action', async () => {
  for (const wrongSource of [false,true]) {
    const f = await fixture(); f.repo.history = async () => [await historyRow(f)];
    const result = { kind: 'restored', documentId: DOC, operationId: OP2, revision: 2, sourceRevision: 1 };
    f.repo.restore = async () => {
      f.operations.set(f.key(OWNER,OP2), operationRow('restore',result,{ source_revision: wrongSource ? 2 : 1 }));
      throw Object.assign(new Error('synthetic hidden database detail'), { code: '22023' });
    };
    await response(await f.request(lifecycle('restore')), wrongSource ? 409 : 200,
      wrongSource ? { error: 'OPERATION_REUSED' } : result);
  }
});

test('restore handles winner arriving while source expires without attempting a second restore', async () => {
  const f = await fixture();
  const result = { kind: 'restored', documentId: DOC, operationId: OP2, revision: 2, sourceRevision: 1 };
  f.repo.history = async () => { f.operations.set(f.key(OWNER,OP2), operationRow('restore',result)); return []; };
  f.repo.restore = async () => { throw new Error('must not mutate twice'); };
  await response(await f.request(lifecycle('restore')), 200, result);
});

test('lifecycle strict requests reject extra identity/payload, bad revisions and unknown collections', async () => {
  const f = await fixture();
  for (const input of [{ ...historyRequest, ownerId: OTHER }, { ...historyRequest, documentId: null },
    { action: 'list', collection: 'DRAFT' }, lifecycle('delete',{ sourceRevision: 1 }),
    lifecycle('delete',{ document: draft }), lifecycle('restore',{ sourceRevision: 0 }),
    lifecycle('restore',{ sourceRevision: '1' }), lifecycle('restore',{ sourceRevision: Number.MAX_SAFE_INTEGER }),
    lifecycle('restore',{ expectedRevision: -1 }), lifecycle('delete',{ operationId: null }),
    lifecycle('restore',{ encryptedPayload: {} })])
    await response(await f.request(input), 400, { error: 'INVALID_REQUEST' });
  assert.equal(f.calls.material, 0);
});

test('lifecycle malformed receipts reject wrong action/source/revision/IDs and extras, fresh AND replay', async () => {
  for (const action of ['delete','restore']) {
    const good = { kind: action === 'delete' ? 'deleted' : 'restored', documentId: DOC, operationId: OP2,
      revision: 2, ...(action === 'restore' ? { sourceRevision: 1 } : {}) };
    for (const change of [{ kind: 'saved' }, { documentId: DOC2 }, { operationId: OP }, { revision: 1 },
      { revision: '2' }, { sourceRevision: 2 }, { extra: 'private' }]) {
      const f = await fixture(); f.repo.history = async () => [await historyRow(f)];
      const result = { ...good, ...change }; f.repo[action] = async () => result;
      await response(await f.request(lifecycle(action)), 503, { error: 'SERVICE_UNAVAILABLE' });
      f.operations.set(f.key(OWNER,OP2), operationRow(action,result));
      await response(await f.request(lifecycle(action)), 503, { error: 'SERVICE_UNAVAILABLE' });
    }
  }
});

test('new actions enforce authentication/gates before key access and recheck after history/mutations', async () => {
  for (const input of [historyRequest,lifecycle('delete'),lifecycle('restore')]) {
    const f = await fixture({ repo: { enabled: async () => false } });
    await response(await f.request(input), 403, { error: 'ACCESS_DENIED' });
    await response(await f.request(input,{ headers: { Authorization: 'Bearer invalid' } }), 401, { error: 'AUTH_REQUIRED' });
    assert.equal(f.calls.material,0);
    const changing = await fixture(); let enabled = true;
    changing.repo.enabled = async () => enabled;
    changing.repo.history = async () => { enabled = false; return []; };
    changing.repo.delete = async () => { enabled = false;
      return { kind: 'deleted', documentId: DOC, operationId: OP2, revision: 2 }; };
    await response(await changing.request(input),403,{ error: 'ACCESS_DENIED' });
  }
});

test('repository lifecycle requires attested writes and selects tombstone/operation metadata', async () => {
  const calls = []; const query = { then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
  for (const method of ['select','eq','order','limit','gt','maybeSingle']) query[method] = (...args) => { calls.push([method,...args]); return query; };
  const attest = async (ownerId, action, input) => ({ request_text: JSON.stringify({ ...input, ownerId, action }), signature: 'synthetic', key_id: 'test' });
  const repo = createAccountJournalRepository({ rpc: (...args) => { calls.push(['rpc',...args]); return query; },
    from: name => { calls.push(['from',name]); return query; } }, { ownerId: OWNER, attest });
  await repo.history(DOC); await repo.delete(lifecycle('delete')); await repo.restore(lifecycle('restore'));
  assert.deepEqual(calls.splice(0), [
    ['rpc','list_account_journal_history',{ document_id: DOC }],
    ['rpc','mutate_account_journal_attested',await attest(OWNER,'delete',lifecycle('delete'))],
    ['rpc','mutate_account_journal_attested',await attest(OWNER,'restore',lifecycle('restore'))],
  ]);
  await repo.operation(OWNER,OP); await repo.read(OWNER,DOC); await repo.list(OWNER,2,DOC);
  assert.deepEqual(calls.filter(call => call[0] === 'select').map(call => call[1]), [
    'user_id,operation_id,document_id,expected_revision,operation_kind,source_revision,proposed_encrypted_payload,result,trusted_metadata',
    'user_id,document_id,revision,encrypted_payload,deleted_at', 'user_id,document_id,revision,encrypted_payload,deleted_at',
  ]);
  assert.equal(calls.filter(call => JSON.stringify(call) === JSON.stringify(['eq','user_id',OWNER])).length, 3);
});

test('history JOURNAL filter runs AFTER all validation; Draft history is empty and FinalRecord identity survives', async () => {
  const f = await fixture({ dependencies: { validateDocument: validateAccountJournalDocument } });
  f.repo.history = async () => [await historyRow(f)];
  await response(await f.request({ ...historyRequest, collection: 'JOURNAL' }), 200,
    { kind: 'history', documentId: DOC, versions: [] });
  const documentId = await finalizedId();
  f.repo.history = async () => [
    await historyRow(f,{ revision: 2 },draft,{ ownerId: OWNER,documentId }),
    await historyRow(f,{},finalized,{ ownerId: OWNER,documentId }),
  ];
  await response(await f.request({ action: 'history',documentId,collection: 'JOURNAL' }),200,
    { kind: 'history',documentId,versions: [{ revision: 1,document: finalized,replacedAt,expiresAt,reason: 'trash' }] });
  f.repo.history = async () => [await historyRow(f,{}, { ...draft,body: 123 })];
  await response(await f.request({ ...historyRequest,collection: 'JOURNAL' }),503,{ error: 'SERVICE_UNAVAILABLE' });
  for (const collection of ['DRAFT',null,{},'PLAN'])
    await response(await f.request({ ...historyRequest,collection }),400,{ error: 'INVALID_REQUEST' });
});

test('real PGlite 0034 + handler: encrypted FinalRecord lifecycle, JWT-owner isolation, expiry and replay', { timeout: 60000 }, async () => {
  const require = createRequire(new URL('./local-postgres/package.json',import.meta.url));
  const { PGlite } = require('@electric-sql/pglite');
  const db = new PGlite();
  const material = await importJournalKeyring(serialized);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on all functions in schema auth to anon,authenticated,service_role;`);
    const directory = new URL('../migrations/',import.meta.url);
    for (const name of (await readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name) && name < '0035').sort())
      await db.exec(await readFile(new URL(name,directory),'utf8'));
    for (const owner of [OWNER,OTHER]) {
      await db.query('insert into auth.users(id) values($1)',[owner]);
      await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
        values($1,'1990-01-01','synthetic-v1','synthetic-v1',clock_timestamp())`,[owner]);
      await db.query('insert into public.beta_enrollments(user_id) values($1)',[owner]);
    }
    await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2');");
    const call = async (name,args=[]) => (await db.query(
      `select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`,args)).rows[0].result;
    const rows = async (sql,args) => (await db.query(sql,args)).rows.map(row => ({ ...row,
      ...(row.deleted_at instanceof Date ? { deleted_at: row.deleted_at.toISOString() } : {}) }));
    const repo = {
      enabled: async owner => await call('service_feature_enabled',['ACCOUNT'])
        && await call('service_feature_enabled',['ACCOUNT_JOURNAL_V2']) && await call('account_network_access_allowed',[owner]),
      operation: async (owner,id) => (await rows('select * from public.account_journal_operations where user_id=$1 and operation_id=$2',[owner,id]))[0] ?? null,
      read: async (owner,id) => (await rows('select * from public.account_journal_documents where user_id=$1 and document_id=$2',[owner,id]))[0] ?? null,
      list: async (owner,limit,cursor) => rows(`select * from public.account_journal_documents where user_id=$1
        and ($2::uuid is null or document_id>$2) order by document_id limit $3`,[owner,cursor??null,limit]),
      history: id => call('list_account_journal_history',[id]),
      commit: input => call('commit_account_journal_document',[input.documentId,input.operationId,input.expectedRevision,JSON.stringify(input.encryptedPayload)]),
      delete: input => call('delete_account_journal_document',[input.documentId,input.operationId,input.expectedRevision]),
      restore: input => call('restore_account_journal_document',[input.documentId,input.operationId,input.expectedRevision,input.sourceRevision]),
    };
    // Synthetic verified-identity boundary. No live JWT signature/auth service claim.
    const f = await fixture({ dependencies: { validateDocument: validateAccountJournalDocument,
      getMaterial: async () => material, authenticate: async token => {
        const owner = token === 'synthetic-token' ? OWNER : token === 'other-token' ? OTHER : null;
        if (!owner) return null;
        await db.exec('reset role; set role authenticated;');
        await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
          [owner,JSON.stringify({sub:owner,role:'authenticated'})]);
        return { ownerId:owner,repo };
      } } });
    const documentId = await finalizedId();
    const first = save({ documentId,document:finalized });
    await response(await f.request(first),200,{ kind:'saved',documentId,operationId:OP,revision:1 });
    const del = lifecycle('delete',{documentId});
    const deleted = { kind:'deleted',documentId,operationId:OP2,revision:2 };
    await response(await f.request(del),200,deleted);
    await response(await f.request({action:'read',documentId}),200,{kind:'deleted',documentId,revision:2});
    await response(await f.request({action:'list',collection:'JOURNAL'}),200,
      {kind:'list',documents:[],deletedDocuments:[{documentId,revision:2}],nextCursor:null});
    const h = await response(await f.request({action:'history',documentId,collection:'JOURNAL'}),200);
    assert.equal(h.versions.length,1); assert.deepEqual(h.versions[0].document,finalized);
    await response(await f.request({action:'history',documentId,collection:'JOURNAL'},
      {headers:{Authorization:'Bearer other-token'}}),200,{kind:'history',documentId,versions:[]});
    const restoreRequest = lifecycle('restore',{documentId,operationId:crypto.randomUUID(),expectedRevision:2});
    await response(await f.request(restoreRequest,{headers:{Authorization:'Bearer other-token'}}),409,{error:'SOURCE_UNAVAILABLE'});
    const restored = {kind:'restored',documentId,operationId:restoreRequest.operationId,revision:3,sourceRevision:1};
    await response(await f.request(restoreRequest),200,restored);
    await response(await f.request({action:'read',documentId}),200,{kind:'document',documentId,revision:3,document:finalized});
    await response(await f.request(del),200,deleted); // Old delete replay cannot delete revision 3.
    await response(await f.request(lifecycle('delete',{documentId,operationId:crypto.randomUUID(),expectedRevision:3})),200);
    await response(await f.request(save({documentId,document:finalized,operationId:crypto.randomUUID(),expectedRevision:4})),409);
    await db.exec(`reset role;
      update public.account_journal_history set replaced_at=statement_timestamp()-interval '721 hours',expires_at=statement_timestamp()-interval '1 hour';
      update public.account_journal_operations set payload_expires_at=statement_timestamp()-interval '1 hour' where payload_expires_at is not null;`);
    await response(await f.request({action:'history',documentId,collection:'JOURNAL'}),200,{kind:'history',documentId,versions:[]});
    await response(await f.request(restoreRequest),200,restored); // Receipt replay, no restoration.
    await response(await f.request(lifecycle('restore',{documentId,operationId:crypto.randomUUID(),expectedRevision:4})),409,{error:'SOURCE_UNAVAILABLE'});
    await response(await f.request(first),503,{error:'SERVICE_UNAVAILABLE'}); // RLS-hidden old payload cannot be compared.
    await call('purge_expired_account_journal_history');
    await response(await f.request(first),409,{error:'OPERATION_REPLAY_UNAVAILABLE'});
    await response(await f.request({action:'read',documentId}),200,{kind:'deleted',documentId,revision:4});
    await response(await f.request({action:'read',documentId},{headers:{Authorization:'Bearer other-token'}}),404,{error:'NOT_FOUND'});
  } finally { await db.close(); }
});
