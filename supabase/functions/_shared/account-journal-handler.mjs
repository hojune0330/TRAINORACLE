import { encryptAccountJournalDocument, decryptAccountJournalDocument } from './account-journal-crypto.mjs';

// Standalone DRAFT storage only: no finalization, statistics, rewards or full sync.
// 100,000 UTF-16 code units can require 600,000 bytes as JSON \uXXXX escapes.
// Keep the streaming bound above that plus the 200-unit title and request metadata.
export const MAX_BODY_BYTES = 655_360;
const MAX_REVISION = 9_007_199_254_740_990;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isUuid = value => typeof value === 'string' && UUID.test(value);
const revision = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_REVISION;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, required, optional = []) => object(value)
  && required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
class GatewayError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new GatewayError(status, code); };

/** Strict shared wire schema; validation returns boolean and never transforms input. */
export function validateDraftDocument(value) {
  if (!keys(value, ['version', 'state', 'visibility', 'date', 'title', 'body'])
    || value.version !== 1 || value.state !== 'DRAFT'
    || !['PRIVATE', 'PERSONAL'].includes(value.visibility)
    || typeof value.title !== 'string' || value.title.length > 200
    || typeof value.body !== 'string' || value.body.length > 100_000
    || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value.date)) return false;
  const date = new Date(`${value.date}T00:00:00.000Z`);
  return value.date.slice(0, 4) !== '0000' && Number.isFinite(date.getTime())
    && date.toISOString().slice(0, 10) === value.date;
}
const canonical = document => JSON.stringify({ version: document.version, state: document.state,
  visibility: document.visibility, date: document.date, title: document.title, body: document.body });

/** Called only at request runtime. Never reads environment variables itself. */
export async function importJournalKeyring(serialized) {
  try {
    const config = JSON.parse(serialized);
    if (!keys(config, ['activeKeyId', 'keys']) || !object(config.keys)
      || !Object.hasOwn(config.keys, config.activeKeyId) || Object.keys(config.keys).length === 0) throw 0;
    const imported = new Map();
    for (const [keyId, encoded] of Object.entries(config.keys)) {
      if (!keyId.trim() || keyId.length > 80 || typeof encoded !== 'string'
        || !/^[A-Za-z0-9+/]{43}=$/u.test(encoded)) throw 0;
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      if (bytes.length !== 32 || btoa(String.fromCharCode(...bytes)) !== encoded) throw 0;
      try {
        imported.set(keyId, { keyId, key: await crypto.subtle.importKey(
          'raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']) });
      } finally { bytes.fill(0); }
    }
    return { active: imported.get(config.activeKeyId), get: keyId => imported.get(keyId) };
  } catch { fail(503, 'KEY_UNAVAILABLE'); }
}

async function bodyJson(request) {
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get('content-type') ?? '')) fail(415, 'UNSUPPORTED_MEDIA_TYPE');
  if (!request.body) fail(400, 'INVALID_REQUEST');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        fail(413, 'BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(400, 'INVALID_REQUEST'); }
}

function parseAction(input, validateDocument) {
  if (!object(input)) fail(400, 'INVALID_REQUEST');
  const { action } = input;
  let valid = false;
  if (action === 'status') valid = keys(input, ['action']);
  if (action === 'list') valid = keys(input, ['action'], ['limit', 'cursor'])
    && (!Object.hasOwn(input, 'limit') || (Number.isInteger(input.limit) && input.limit >= 1 && input.limit <= 50))
    && (!Object.hasOwn(input, 'cursor') || isUuid(input.cursor));
  if (action === 'read') valid = keys(input, ['action', 'documentId']) && isUuid(input.documentId);
  if (action === 'save') valid = keys(input, ['action', 'documentId', 'operationId', 'expectedRevision', 'document'])
    && isUuid(input.documentId) && isUuid(input.operationId) && revision(input.expectedRevision);
  if (!valid) fail(400, 'INVALID_REQUEST');
  if (action === 'save') {
    let accepted = false;
    try { accepted = validateDraftDocument(input.document) && validateDocument(input.document) === true; } catch { /* Fail closed without validator details. */ }
    if (!accepted) fail(422, 'INVALID_DOCUMENT');
  }
  return { ...input, ...(input.documentId ? { documentId: input.documentId.toLowerCase() } : {}),
    ...(input.operationId ? { operationId: input.operationId.toLowerCase() } : {}),
    ...(input.cursor ? { cursor: input.cursor.toLowerCase() } : {}) };
}

function receiptFor(result, input) {
  if (!object(result) || result.documentId !== input.documentId || result.operationId !== input.operationId) fail(503, 'INVALID_STORED_DATA');
  if (result.kind === 'saved' && keys(result, ['kind', 'documentId', 'operationId', 'revision'])
    && revision(result.revision) && result.revision === input.expectedRevision + 1) return result;
  if (result.kind === 'conflict' && keys(result, ['kind', 'documentId', 'operationId', 'currentRevision'])
    && revision(result.currentRevision) && result.currentRevision !== input.expectedRevision) return result;
  fail(503, 'INVALID_STORED_DATA');
}

/**
 * DRAFT-only POST gateway. Dependencies:
 * authenticate(token) -> {ownerId: UUID, repo} | null (server-verified identity).
 * repo: enabled(ownerId), operation(ownerId, operationId), read(ownerId, documentId),
 * list(ownerId, fetchLimit, cursor), commit({documentId,operationId,expectedRevision,encryptedPayload}).
 * Reads return SQL-shaped rows or null, list returns ordered rows; failures must throw.
 * getMaterial() -> {active: {keyId,key}, get(keyId): {keyId,key}|undefined}; nonextractable AES-256-GCM keys.
 * validateDocument(document) -> boolean, synchronous and non-transforming; DRAFT schema always enforced.
 * allowedOrigins: exact http(s) origins, no wildcard. No environment access before runtime/auth.
 * Responses: ready | document (flat) | list (documents,nextCursor) | 0033 saved/conflict.
 * Errors: {error: stableEnum}; conflict retains the proposal in 0033 and returns HTTP 409.
 */
export function createAccountJournalHandler({ authenticate, getMaterial, validateDocument, allowedOrigins = [] }) {
  const origins = new Set(allowedOrigins.filter(origin => {
    try { return origin !== '*' && new URL(origin).origin === origin && /^https?:\/\//u.test(origin); }
    catch { return false; }
  }));
  return async request => {
    const origin = request.headers.get('origin');
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin', 'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff' });
    const respond = (status, body) => new Response(body === null ? null : JSON.stringify(body), { status, headers });
    try {
      if (origin !== null && !origins.has(origin)) fail(403, 'ORIGIN_DENIED');
      if (origin !== null) headers.set('Access-Control-Allow-Origin', origin);
      if (request.method === 'OPTIONS') {
        if (!origin || request.headers.get('access-control-request-method') !== 'POST') fail(403, 'ORIGIN_DENIED');
        const requested = (request.headers.get('access-control-request-headers') ?? '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
        if (requested.some(x => !['authorization', 'content-type', 'apikey', 'x-client-info'].includes(x))) fail(403, 'ORIGIN_DENIED');
        headers.set('Access-Control-Allow-Methods', 'POST');
        headers.set('Access-Control-Allow-Headers', 'authorization, content-type, apikey, x-client-info');
        return respond(204, null);
      }
      if (request.method !== 'POST') { headers.set('Allow', 'POST, OPTIONS'); fail(405, 'METHOD_NOT_ALLOWED'); }
      const match = /^Bearer ([^\s]+)$/iu.exec(request.headers.get('authorization') ?? '');
      if (!match) fail(401, 'AUTH_REQUIRED');
      let session;
      try { session = await authenticate(match[1]); } catch { fail(401, 'AUTH_REQUIRED'); }
      if (!isUuid(session?.ownerId) || !session.repo) fail(401, 'AUTH_REQUIRED');
      const ownerId = session.ownerId.toLowerCase();
      const repo = session.repo;
      const input = parseAction(await bodyJson(request), validateDocument);
      const checkGate = async () => {
        const enabled = await repo.enabled(ownerId);
        if (enabled === false) fail(403, 'ACCOUNT_JOURNAL_DISABLED');
        if (enabled !== true) fail(503, 'UNAVAILABLE');
      };
      await checkGate();
      let material;
      try {
        material = await getMaterial();
        const key = material?.active?.key;
        if (!key || key.extractable !== false || key.algorithm?.name !== 'AES-GCM'
          || key.algorithm?.length !== 256 || !key.usages.includes('encrypt') || !key.usages.includes('decrypt')
          || typeof material.get !== 'function' || material.get(material.active.keyId)?.key !== key) throw 0;
      }
      catch { fail(503, 'KEY_UNAVAILABLE'); }
      if (input.action === 'status') return respond(200, { kind: 'ready' });
      const decode = async (payload, documentId) => {
        const key = material.get(payload?.keyId);
        if (!key) fail(503, 'KEY_UNAVAILABLE');
        try {
          const doc = JSON.parse(await decryptAccountJournalDocument(payload, { ownerId, documentId }, key));
          if (!validateDraftDocument(doc) || validateDocument(doc) !== true) throw 0;
          return JSON.parse(canonical(doc));
        } catch { fail(503, 'INVALID_STORED_DATA'); }
      };
      const entry = async row => {
        if (!object(row) || row.user_id !== ownerId || !isUuid(row.document_id)
          || row.document_id !== row.document_id.toLowerCase() || !revision(row.revision) || row.revision < 1) fail(503, 'INVALID_STORED_DATA');
        return { documentId: row.document_id, revision: row.revision,
          document: await decode(row.encrypted_payload, row.document_id) };
      };
      if (input.action === 'read') {
        const row = await repo.read(ownerId, input.documentId);
        await checkGate();
        if (row === null) fail(404, 'NOT_FOUND');
        if (row?.document_id !== input.documentId) fail(503, 'INVALID_STORED_DATA');
        return respond(200, { kind: 'document', ...await entry(row) });
      }
      if (input.action === 'list') {
        const limit = input.limit ?? 50;
        const rows = await repo.list(ownerId, limit + 1, input.cursor);
        await checkGate();
        if (!Array.isArray(rows) || rows.length > limit + 1) fail(503, 'INVALID_STORED_DATA');
        let previous = input.cursor ?? '';
        const entries = [];
        for (const row of rows) {
          if (typeof row?.document_id !== 'string' || row.document_id <= previous) fail(503, 'INVALID_STORED_DATA');
          entries.push(await entry(row));
          previous = row.document_id;
        }
        return respond(200, { kind: 'list', documents: entries.slice(0, limit),
          nextCursor: entries.length > limit ? entries[limit - 1].documentId : null });
      }
      const comparePrior = async prior => {
        if (!object(prior) || prior.user_id !== ownerId || prior.operation_id !== input.operationId
          || !isUuid(prior.document_id) || !revision(prior.expected_revision)) fail(503, 'INVALID_STORED_DATA');
        if (prior.document_id !== input.documentId || prior.expected_revision !== input.expectedRevision) fail(409, 'OPERATION_REUSED');
        const document = await decode(prior.proposed_encrypted_payload, prior.document_id);
        if (canonical(document) !== canonical(input.document)) fail(409, 'OPERATION_REUSED');
        return receiptFor(prior.result, input);
      };
      const prior = await repo.operation(ownerId, input.operationId);
      let receipt;
      if (prior !== null) receipt = await comparePrior(prior);
      else {
        const encryptedPayload = await encryptAccountJournalDocument(canonical(input.document),
          { ownerId, documentId: input.documentId }, material.active);
        try { receipt = receiptFor(await repo.commit({ documentId: input.documentId,
          operationId: input.operationId, expectedRevision: input.expectedRevision, encryptedPayload }), input); }
        catch (error) {
          // Concurrent identical plaintext has a different nonce. Compare the winning proposal.
          if (error?.code !== '22023') throw error;
          const winner = await repo.operation(ownerId, input.operationId);
          if (winner === null) fail(503, 'UNAVAILABLE');
          receipt = await comparePrior(winner);
        }
      }
      await checkGate();
      return respond(receipt.kind === 'conflict' ? 409 : 200, receipt);
    } catch (error) {
      if (error instanceof GatewayError) return respond(error.status, { error: error.status === 503
        ? 'SERVICE_UNAVAILABLE' : error.status === 403 ? 'ACCESS_DENIED' : error.code });
      if (error?.code === '42501') return respond(403, { error: 'ACCESS_DENIED' });
      return respond(503, { error: 'SERVICE_UNAVAILABLE' });
    }
  };
}

/** Official SDK adapter. The supplied client MUST use the verified user's JWT. */
export function createAccountJournalRepository(client) {
  const result = async query => {
    const { data, error } = await query;
    if (error) {
      const safe = new Error('ACCOUNT_JOURNAL_DATABASE_ERROR');
      if (['22023', '42501'].includes(error.code)) safe.code = error.code;
      throw safe;
    }
    return data;
  };
  return {
    async enabled(ownerId) {
      for (const feature of ['ACCOUNT', 'ACCOUNT_JOURNAL_V2']) {
        const value = await result(client.rpc('service_feature_enabled', { feature_key_input: feature }));
        if (value === false) return false;
        if (value !== true) throw new Error('ACCOUNT_JOURNAL_DATABASE_ERROR');
      }
      const eligible = await result(client.rpc('account_network_access_allowed', { target_user: ownerId }));
      if (typeof eligible !== 'boolean') throw new Error('ACCOUNT_JOURNAL_DATABASE_ERROR');
      return eligible;
    },
    operation: (ownerId, operationId) => result(client.from('account_journal_operations')
      .select('user_id,operation_id,document_id,expected_revision,proposed_encrypted_payload,result')
      .eq('user_id', ownerId).eq('operation_id', operationId).maybeSingle()),
    read: (ownerId, documentId) => result(client.from('account_journal_documents')
      .select('user_id,document_id,revision,encrypted_payload').eq('user_id', ownerId)
      .eq('document_id', documentId).maybeSingle()),
    list(ownerId, limit, cursor) {
      let query = client.from('account_journal_documents').select('user_id,document_id,revision,encrypted_payload')
        .eq('user_id', ownerId).order('document_id', { ascending: true }).limit(limit);
      if (cursor) query = query.gt('document_id', cursor);
      return result(query);
    },
    commit: input => result(client.rpc('commit_account_journal_document', { document_id: input.documentId,
      operation_id: input.operationId, expected_revision: input.expectedRevision, encrypted_payload: input.encryptedPayload })),
  };
}
