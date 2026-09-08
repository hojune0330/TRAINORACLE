import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAccountJournalHandler, createAccountJournalRepository, importJournalKeyring,
  validateDraftDocument, MAX_BODY_BYTES } from '../functions/_shared/account-journal-handler.mjs';
import { encryptAccountJournalDocument as encrypt } from '../functions/_shared/account-journal-crypto.mjs';

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
        proposed_encrypted_payload: input.encryptedPayload, result });
      if (result.kind === 'saved') docs.set(key(OWNER, input.documentId), { user_id: OWNER,
        document_id: input.documentId, revision: result.revision, encrypted_payload: input.encryptedPayload });
      return result;
    },
  };
  Object.assign(repo, options.repo);
  const handler = createAccountJournalHandler({
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
  const repo = createAccountJournalRepository(client);
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
  assert.deepEqual(calls, [['rpc', 'commit_account_journal_document', { document_id: DOC,
    operation_id: OP, expected_revision: 0, encrypted_payload: { synthetic: true } }]]);
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
