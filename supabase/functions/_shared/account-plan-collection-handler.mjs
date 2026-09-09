import { encryptAccountJournalDocument, decryptAccountJournalDocument } from './account-journal-crypto.mjs';
import { createAccountJournalRepository, validateAccountJournalDocument } from './account-journal-handler.mjs';
import { validateAccountPlanCollectionIndex, validateAccountPlanCollectionPart,
  joinAccountPlanCollection, validateAccountPlanCollectionUpdate,
  accountPlanCollectionPartHash, accountPlanFingerprint } from './account-plan-collection-validator.mjs';

export const MAX_BODY_BYTES = 655_360;
export const MAX_PART_BYTES = 500_000;
const encoder = new TextEncoder();
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v, names) => object(v) && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v);
const hash = v => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/u.test(v);
const revision = v => Number.isSafeInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER - 2;
const partKind = v => ['PLAN_SNAPSHOT', 'PLAN_PROGRESS'].includes(v);
const fits = v => encoder.encode(JSON.stringify(v)).byteLength <= MAX_PART_BYTES;
class GatewayError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new GatewayError(status, code); };

async function namespacedId(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(value))));
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = [...bytes.slice(0, 16)].map(v => v.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// The fixed index address and content-addressed parts cannot collide with legacy PLAN.
export const accountPlanCollectionDocumentId = (ownerId, kind, id) =>
  namespacedId(['trainoracle.account.plan.collection.v1', ownerId, kind, id]);
const legacyId = ownerId => namespacedId(['trainoracle.account.plan.v1', ownerId]);
export const accountPlanCollectionMetadata = part => part.kind === 'PLAN_SNAPSHOT'
  ? { snapshotId: null, updatedAt: null, archivedAt: null }
  : { snapshotId: part.snapshotId, updatedAt: part.updatedAt, archivedAt: part.archivedAt };

async function bodyJson(request) {
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get('content-type') ?? '')) fail(415, 'UNSUPPORTED_MEDIA_TYPE');
  if (!request.body) fail(400, 'INVALID_REQUEST');
  const reader = request.body.getReader(), chunks = [];
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

function validCommit(r) {
  return keys(r, ['ownerId', 'operationId', 'expectedRevision', 'previousIndexFingerprint', 'previousCurrentPlanId', 'index', 'legacy'])
    && uuid(r.ownerId) && uuid(r.operationId) && revision(r.expectedRevision)
    && (r.previousIndexFingerprint === null || hash(r.previousIndexFingerprint))
    && (r.previousCurrentPlanId === null || hash(r.previousCurrentPlanId))
    && (r.expectedRevision === 0 ? r.previousIndexFingerprint === null && r.previousCurrentPlanId === null
      : r.previousIndexFingerprint !== null && r.legacy === null)
    && (r.legacy === null || keys(r.legacy, ['documentId', 'revision', 'fingerprint'])
      && uuid(r.legacy.documentId) && revision(r.legacy.revision) && r.legacy.revision > 0 && hash(r.legacy.fingerprint));
}

function parseAction(input) {
  if (!object(input)) fail(400, 'INVALID_REQUEST');
  const valid = input.action === 'readIndex' ? keys(input, ['action'])
    : input.action === 'readPart' ? keys(input, ['action', 'partKind', 'partId']) && partKind(input.partKind) && hash(input.partId)
      : input.action === 'receipt' ? keys(input, ['action', 'operationId']) && uuid(input.operationId)
        : input.action === 'stage' ? keys(input, ['action', 'ownerId', 'part']) && uuid(input.ownerId)
          : input.action === 'commit' ? keys(input, ['action', 'request']) && validCommit(input.request) : false;
  if (!valid) fail(400, 'INVALID_REQUEST');
  return input;
}

function validateReceipt(receipt, ownerId, operationId) {
  if (!keys(receipt, ['ownerId', 'operationId', 'revision', 'indexFingerprint', 'requestFingerprint'])
    || receipt.ownerId !== ownerId || receipt.operationId !== operationId
    || !Number.isSafeInteger(receipt.revision) || receipt.revision < 1 || receipt.revision > Number.MAX_SAFE_INTEGER - 1
    || !hash(receipt.indexFingerprint) || !hash(receipt.requestFingerprint)) fail(503, 'INVALID_STORED_DATA');
  return receipt;
}

/** Storage only. Neither hashes, staged evidence nor migration grant execution authority. */
export function createAccountPlanCollectionHandler({ authenticate, getMaterial, allowedOrigins = [] }) {
  const origins = new Set(allowedOrigins.filter(origin => {
    try { return new URL(origin).origin === origin && /^https?:\/\//u.test(origin); } catch { return false; }
  }));
  return async request => {
    const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin', 'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff' });
    const respond = (status, value) => new Response(value === null ? null : JSON.stringify(value), { status, headers });
    try {
      const origin = request.headers.get('origin');
      if (origin !== null && !origins.has(origin)) fail(403, 'ACCESS_DENIED');
      if (origin !== null) headers.set('Access-Control-Allow-Origin', origin);
      if (request.method === 'OPTIONS') {
        if (!origin || request.headers.get('access-control-request-method') !== 'POST') fail(403, 'ACCESS_DENIED');
        const requested = (request.headers.get('access-control-request-headers') ?? '').toLowerCase().split(',').map(v => v.trim()).filter(Boolean);
        if (requested.some(v => !['authorization', 'content-type', 'apikey', 'x-client-info'].includes(v))) fail(403, 'ACCESS_DENIED');
        headers.set('Access-Control-Allow-Methods', 'POST');
        headers.set('Access-Control-Allow-Headers', 'authorization, content-type, apikey, x-client-info');
        return respond(204, null);
      }
      if (request.method !== 'POST') { headers.set('Allow', 'POST, OPTIONS'); fail(405, 'METHOD_NOT_ALLOWED'); }
      const token = /^Bearer ([^\s]+)$/iu.exec(request.headers.get('authorization') ?? '')?.[1];
      if (!token) fail(401, 'AUTH_REQUIRED');
      let session;
      try { session = await authenticate(token); } catch { fail(401, 'AUTH_REQUIRED'); }
      if (!uuid(session?.ownerId) || !session.repo) fail(401, 'AUTH_REQUIRED');
      const { ownerId, repo } = session;
      const input = parseAction(await bodyJson(request));
      if (input.action === 'commit' && input.request.ownerId !== ownerId) fail(403, 'ACCESS_DENIED');
      if (input.action === 'stage' && input.ownerId !== ownerId) fail(403, 'ACCESS_DENIED');
      const gate = async () => {
        const enabled = await repo.enabled(ownerId);
        if (enabled === false) fail(403, 'ACCESS_DENIED');
        if (enabled !== true) fail(503, 'UNAVAILABLE');
      };
      await gate();
      const status = await repo.attestationStatus();
      if (!keys(status, ['kind']) || status.kind !== 'ready') fail(503, 'UNAVAILABLE');
      const finish = async value => { await gate(); return respond(200, value); };
      const readReceipt = async operationId => {
        const value = await repo.receipt(operationId);
        return value === null ? null : validateReceipt(value, ownerId, operationId);
      };
      if (input.action === 'receipt') {
        const receipt = await readReceipt(input.operationId);
        return await finish(receipt === null ? { kind: 'missing' } : { kind: 'receipt', receipt });
      }
      const r = input.request;
      const binding = input.action === 'commit' ? { requestFingerprint: accountPlanFingerprint(r), indexFingerprint: accountPlanFingerprint(r.index) } : null;
      const replay = receipt => {
        if (receipt.revision !== r.expectedRevision + 1 || receipt.indexFingerprint !== binding.indexFingerprint
          || receipt.requestFingerprint !== binding.requestFingerprint) fail(409, 'OPERATION_REUSED');
        return { kind: 'committed', receipt };
      };
      // Receipt binding precedes key access and time-dependent historical validation.
      if (r) {
        const prior = await readReceipt(r.operationId);
        if (prior !== null) return await finish(replay(prior));
        if (!fits(r.index) || validateAccountPlanCollectionIndex(r.index) !== true) fail(422, 'INVALID_DOCUMENT');
      }
      if (input.action === 'stage' && (!fits(input.part) || validateAccountPlanCollectionPart(input.part) !== true)) fail(422, 'INVALID_DOCUMENT');
      let material;
      try { material = await getMaterial(); } catch { fail(503, 'KEY_UNAVAILABLE'); }
      const decode = async (payload, documentId) => {
        const key = material?.get(payload?.keyId);
        if (!key) fail(503, 'KEY_UNAVAILABLE');
        try {
          const value = JSON.parse(await decryptAccountJournalDocument(payload, { ownerId, documentId }, key));
          if (!fits(value)) throw 0;
          return value;
        } catch { fail(503, 'INVALID_STORED_DATA'); }
      };
      const encrypt = async (value, kind, id) => encryptAccountJournalDocument(JSON.stringify(value),
        { ownerId, documentId: await accountPlanCollectionDocumentId(ownerId, kind, id) }, material?.active);
      const readPart = async (kind, id) => {
        const row = await repo.readPart(kind, id);
        if (row === null) return null;
        if (!keys(row, ['part_kind', 'part_id', 'plan_id', 'content_hash', 'payload', 'metadata'])
          || row.part_kind !== kind || row.part_id !== id) fail(503, 'INVALID_STORED_DATA');
        const part = await decode(row.payload, await accountPlanCollectionDocumentId(ownerId, kind, id));
        if (validateAccountPlanCollectionPart(part) !== true || part.kind !== kind || part.id !== id
          || row.plan_id !== part.planId || row.content_hash !== accountPlanCollectionPartHash(part)
          || accountPlanFingerprint(row.metadata) !== accountPlanFingerprint(accountPlanCollectionMetadata(part))) fail(503, 'INVALID_STORED_DATA');
        return part;
      };
      const readIndex = async () => {
        const row = await repo.readIndex();
        if (row === null) return null;
        if (!keys(row, ['revision', 'index_fingerprint', 'index_document', 'payload'])
          || !Number.isSafeInteger(row.revision) || row.revision < 1
          || row.revision > Number.MAX_SAFE_INTEGER - 1) fail(503, 'INVALID_STORED_DATA');
        const index = await decode(row.payload, await accountPlanCollectionDocumentId(ownerId, 'PLAN_COLLECTION', 'index'));
        if (validateAccountPlanCollectionIndex(index) !== true || row.index_fingerprint !== accountPlanFingerprint(index)
          || accountPlanFingerprint(row.index_document) !== accountPlanFingerprint(index)) fail(503, 'INVALID_STORED_DATA');
        return { kind: 'index', revision: row.revision, index };
      };
      if (input.action === 'readIndex') return await finish(await readIndex() ?? { kind: 'missing' });
      if (input.action === 'readPart') {
        const part = await readPart(input.partKind, input.partId);
        return await finish(part === null ? { kind: 'missing' } : { kind: 'part', part });
      }
      if (input.action === 'stage') {
        const part = input.part;
        await gate();
        const result = await repo.stage({ partId: part.id, partKind: part.kind, planId: part.planId,
          contentHash: accountPlanCollectionPartHash(part), payload: await encrypt(part, part.kind, part.id),
          metadata: accountPlanCollectionMetadata(part) });
        if (!keys(result, ['kind', 'partId']) || result.kind !== 'staged' || result.partId !== part.id) fail(503, 'INVALID_STORED_DATA');
        return await finish({ kind: 'staged' });
      }
      const current = await readIndex();
      if ((current?.revision ?? 0) !== r.expectedRevision
        || (current ? accountPlanFingerprint(current.index) : null) !== r.previousIndexFingerprint
        || (current?.index.currentPlanId ?? null) !== r.previousCurrentPlanId) {
        const prior = await readReceipt(r.operationId);
        return await finish(prior === null ? { kind: 'conflict' } : replay(prior));
      }
      const loadParts = async index => {
        const snapshots = [], progress = [];
        for (const ref of index.plans) {
          const snapshot = await readPart('PLAN_SNAPSHOT', ref.snapshotId);
          const mutable = await readPart('PLAN_PROGRESS', ref.progressId);
          if (!snapshot || !mutable) fail(422, 'MISSING_PART');
          snapshots.push(snapshot); progress.push(mutable);
        }
        const parts = { index, snapshots, progress };
        if (!joinAccountPlanCollection(parts)) fail(422, 'INVALID_DOCUMENT');
        return parts;
      };
      const next = await loadParts(r.index);
      const previous = current ? await loadParts(current.index) : null;
      if (previous && validateAccountPlanCollectionUpdate(previous, next) !== true) fail(422, 'INVALID_DOCUMENT_UPDATE');
      if (r.legacy) {
        if (r.legacy.documentId !== await legacyId(ownerId)) fail(422, 'INVALID_DOCUMENT');
        const row = await repo.readLegacy(ownerId, r.legacy.documentId);
        if (!row || row.user_id !== ownerId || row.document_id !== r.legacy.documentId || row.deleted_at != null
          || row.revision !== r.legacy.revision) fail(409, 'LEGACY_CHANGED');
        const document = await decode(row.encrypted_payload, r.legacy.documentId);
        if (!validateAccountJournalDocument(document) || document.kind !== 'PLAN' || document.version !== 3
          || accountPlanFingerprint(document) !== r.legacy.fingerprint
          || accountPlanFingerprint(joinAccountPlanCollection(next)) !== r.legacy.fingerprint) fail(422, 'INVALID_DOCUMENT');
      }
      const { ownerId: ignoredOwner, ...commitInput } = r;
      await gate();
      let result;
      try {
        result = await repo.commit({ ...commitInput, ...binding, payload: await encrypt(r.index, 'PLAN_COLLECTION', 'index') });
      } catch (error) {
        if (error?.code !== '22023') throw error;
        const prior = await readReceipt(r.operationId);
        if (prior === null) throw error;
        return await finish(replay(prior));
      }
      if (keys(result, ['kind']) && result.kind === 'conflict') {
        const prior = await readReceipt(r.operationId);
        return await finish(prior === null ? result : replay(prior));
      }
      if (!keys(result, ['kind', 'receipt']) || result.kind !== 'committed') fail(503, 'INVALID_STORED_DATA');
      return await finish(replay(validateReceipt(result.receipt, ownerId, r.operationId)));
    } catch (error) {
      if (error instanceof GatewayError) return respond(error.status,
        { error: error.status === 503 ? 'SERVICE_UNAVAILABLE' : error.code });
      if (error?.code === '42501') return respond(403, { error: 'ACCESS_DENIED' });
      if (error?.code === '22023') return respond(409, { error: 'OPERATION_REUSED' });
      return respond(503, { error: 'SERVICE_UNAVAILABLE' });
    }
  };
}

/** The client carries the verified caller JWT. SQL derives the owner, never service role. */
export function createAccountPlanCollectionRepository(client, { ownerId, attest } = {}) {
  const journal = createAccountJournalRepository(client, { ownerId, attest });
  const result = async query => {
    const { data, error } = await query;
    if (error) {
      const safe = new Error('ACCOUNT_PLAN_COLLECTION_DATABASE_ERROR');
      if (['22023', '42501'].includes(error.code)) safe.code = error.code;
      throw safe;
    }
    return data;
  };
  const mutate = async (action, input) => {
    if (!uuid(ownerId) || typeof attest !== 'function') throw new Error('ACCOUNT_PLAN_COLLECTION_ATTESTATION_REQUIRED');
    return result(client.rpc('mutate_account_plan_collection_attested', await attest(ownerId, action, input)));
  };
  return {
    attestationStatus: () => journal.attestationStatus(),
    enabled: owner => journal.enabled(owner),
    readLegacy: (owner, documentId) => journal.read(owner, documentId),
    readIndex: () => result(client.rpc('read_account_plan_collection_index')),
    readPart: (kind, id) => result(client.rpc('read_account_plan_collection_part', { part_kind: kind, part_id: id })),
    receipt: operationId => result(client.rpc('read_account_plan_collection_receipt', { operation_id: operationId })),
    stage: input => mutate('planStage', input),
    commit: input => mutate('planCommit', input),
  };
}
