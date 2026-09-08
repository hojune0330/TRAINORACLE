import { encryptAccountJournalDocument, decryptAccountJournalDocument } from './account-journal-crypto.mjs';
import { validateAccountJournalRecord, validateAccountJournalRecordUpdate } from './account-journal-record-validator.mjs';
import * as accountState from './account-state-validator.mjs';

// Gateway-derived metadata is authenticated together with ciphertext by 0035.
// 100,000 UTF-16 code units can require 600,000 bytes as JSON \uXXXX escapes.
// Keep the streaming bound above that plus the 200-unit title and request metadata.
export const MAX_BODY_BYTES = 655_360;
const MAX_REVISION = 9_007_199_254_740_990;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isUuid = value => typeof value === 'string' && UUID.test(value);
const revision = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_REVISION;
const timestamp = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
  && Number.isFinite(Date.parse(value));
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
const stable = value => Array.isArray(value) ? value.map(stable) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const canonical = document => document.state !== 'DRAFT' ? JSON.stringify(stable(document))
  : JSON.stringify({ version: document.version, state: document.state,
    visibility: document.visibility, date: document.date, title: document.title, body: document.body });
export const validateAccountJournalDocument = value => validateDraftDocument(value) || validateAccountJournalRecord(value)
  || accountState.validateAccountStateDocument(value);

/** Mirrors toEngagementJournalRef in engagement.ts, not performance or memo scoring. */
export function accountJournalMetadata(document) {
  if (document.state !== 'FINALIZED') {
    const metadata = { kind: document.state === 'DRAFT' ? 'DRAFT' : document.kind,
      occurrenceId: null, journalDate: null, eligible: false };
    if (document.kind === 'DECORATIONS') {
      if (typeof accountState.accountDecorationPurchaseMetadata !== 'function') fail(503, 'UNAVAILABLE');
      return { ...metadata, ...accountState.accountDecorationPurchaseMetadata(document) };
    }
    return metadata;
  }
  const e = document.entry;
  const eligible = e.kind === 'post-session'
    ? e.activityOutcome !== undefined || e.system === 'rest' || e.title.trim() !== ''
      || e.distanceKm.trim() !== '' || e.durationMin.trim() !== '' || e.avgPace.trim() !== ''
      || e.rpe > 0 || e.intensityAssessment !== undefined
    : e.kind === 'evening' ? e.sleepH > 0 || e.sleepQuality > 0 || e.weightKg.trim() !== ''
      || e.restingHr.trim() !== '' || Object.values(e.painParts).some(level => level > 0) || e.mood > 0
      : e.tension !== undefined || e.condition !== undefined || e.mood !== undefined;
  return { kind: 'JOURNAL', occurrenceId: e.kind === 'post-session' ? e.plannedSessionLink?.plannedSessionId ?? null : null,
    journalDate: e.date, eligible };
}

/** Separate runtime-only signing key, never the journal encryption key or user JWT. */
export async function importJournalAttestor(serialized) {
  try {
    const config = JSON.parse(serialized);
    if (!keys(config, ['keyId', 'key']) || typeof config.keyId !== 'string'
      || config.keyId.length < 1 || config.keyId.length > 80 || typeof config.key !== 'string'
      || !/^[A-Za-z0-9+/]{43}=$/u.test(config.key)) throw 0;
    const bytes = Uint8Array.from(atob(config.key), char => char.charCodeAt(0));
    if (bytes.length !== 32 || btoa(String.fromCharCode(...bytes)) !== config.key) throw 0;
    let key;
    try { key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); }
    finally { bytes.fill(0); }
    return async (ownerId, action, input) => {
      const requestText = JSON.stringify({ ...input, domain: 'trainoracle.account-journal.gateway.v1', ownerId, action,
        expiresAt: Math.floor(Date.now() / 1000) + 90 });
      const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(requestText));
      return { request_text: requestText, signature: [...new Uint8Array(signature)]
        .map(byte => byte.toString(16).padStart(2, '0')).join(''), key_id: config.keyId };
    };
  } catch { fail(503, 'KEY_UNAVAILABLE'); }
}

async function recordId(ownerId, entryId) {
  return namespacedId(['trainoracle.journal.record.v1', ownerId, entryId]);
}
async function namespacedId(parts) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(parts))));
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
async function stateIdentityValid(ownerId, documentId, document) {
  if (document.state !== 'ACCOUNT_STATE') return true;
  if (document.kind === 'DECORATIONS') return documentId === await namespacedId(['trainoracle.account.decorations.v1',ownerId]);
  if (document.kind === 'PLAN') return documentId === await namespacedId(['trainoracle.account.plan.v1',ownerId]);
  // Plan worker supplies a bound identity helper with its schema; no guessed IDs.
  return typeof accountState.accountStateDocumentId === 'function'
    && documentId === await accountState.accountStateDocumentId(ownerId,document);
}

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
  if (action === 'rewardSummary' || action === 'visit') valid = keys(input, ['action']);
  if (action === 'list') valid = keys(input, ['action'], ['limit', 'cursor', 'collection'])
    && (!Object.hasOwn(input, 'collection') || input.collection === 'JOURNAL')
    && (!Object.hasOwn(input, 'limit') || (Number.isInteger(input.limit) && input.limit >= 1 && input.limit <= 50))
    && (!Object.hasOwn(input, 'cursor') || isUuid(input.cursor));
  if (action === 'read') valid = keys(input, ['action', 'documentId']) && isUuid(input.documentId);
  if (action === 'history') valid = keys(input, ['action', 'documentId'], ['collection']) && isUuid(input.documentId)
    && (!Object.hasOwn(input, 'collection') || input.collection === 'JOURNAL');
  if (action === 'delete' || action === 'restore') valid = keys(input,
    ['action', 'documentId', 'operationId', 'expectedRevision', ...(action === 'restore' ? ['sourceRevision'] : [])])
    && isUuid(input.documentId) && isUuid(input.operationId) && revision(input.expectedRevision)
    && (action !== 'restore' || (revision(input.sourceRevision) && input.sourceRevision > 0));
  if (action === 'save') valid = keys(input, ['action', 'documentId', 'operationId', 'expectedRevision', 'document'], ['writePurpose'])
    && isUuid(input.documentId) && isUuid(input.operationId) && revision(input.expectedRevision)
    && (!Object.hasOwn(input,'writePurpose') || input.writePurpose === 'MIGRATION'
      && (input.document?.state === 'FINALIZED' || input.document?.state === 'ACCOUNT_STATE' && input.document?.kind === 'DECORATIONS'));
  if (!valid) fail(400, 'INVALID_REQUEST');
  if (action === 'save') {
    let accepted = false;
    try { accepted = validateAccountJournalDocument(input.document) && validateDocument(input.document) === true; } catch { /* Fail closed without validator details. */ }
    if (!accepted) fail(422, 'INVALID_DOCUMENT');
  }
  return { ...input, ...(input.documentId ? { documentId: input.documentId.toLowerCase() } : {}),
    ...(input.operationId ? { operationId: input.operationId.toLowerCase() } : {}),
    ...(input.cursor ? { cursor: input.cursor.toLowerCase() } : {}) };
}

function receiptFor(result, input) {
  if (!object(result) || result.documentId !== input.documentId || result.operationId !== input.operationId) fail(503, 'INVALID_STORED_DATA');
  const success = { save: 'saved', delete: 'deleted', restore: 'restored' }[input.action];
  if (result.kind === success && keys(result, ['kind', 'documentId', 'operationId', 'revision',
    ...(input.action === 'restore' ? ['sourceRevision'] : [])])
    && (input.action !== 'restore' || result.sourceRevision === input.sourceRevision)
    && revision(result.revision) && result.revision === input.expectedRevision + 1) return result;
  if (result.kind === 'conflict' && keys(result, ['kind', 'documentId', 'operationId', 'currentRevision'])
    && revision(result.currentRevision)) return result;
  if (input.action === 'restore' && result.kind === 'source_unavailable'
    && keys(result, ['kind', 'documentId', 'operationId', 'currentRevision', 'sourceRevision'])
    && revision(result.currentRevision) && result.currentRevision === input.expectedRevision
    && result.sourceRevision === input.sourceRevision) return result;
  fail(503, 'INVALID_STORED_DATA');
}

/**
 * Draft/FinalRecord POST gateway. Dependencies:
 * authenticate(token) -> {ownerId: UUID, repo} | null (server-verified identity).
 * repo: enabled(ownerId), operation(ownerId, operationId), read(ownerId, documentId),
 * list(ownerId, fetchLimit, cursor), commit({documentId,operationId,expectedRevision,encryptedPayload}).
 * history(documentId), delete({documentId,operationId,expectedRevision}),
 * restore({documentId,operationId,expectedRevision,sourceRevision}); RPCs derive owner from JWT.
 * Reads return SQL-shaped rows or null, list returns ordered rows; failures must throw.
 * getMaterial() -> {active: {keyId,key}, get(keyId): {keyId,key}|undefined}; nonextractable AES-256-GCM keys.
 * validateDocument(document) -> boolean, synchronous and non-transforming; union schema always enforced.
 * allowedOrigins: exact http(s) origins, no wildcard. No environment access before runtime/auth.
 * Responses: ready | document | deleted | list (documents,nextCursor, optional deletedDocuments)
 * | history (documentId,versions) | saved/deleted/restored/conflict/source_unavailable receipts.
 * Conflict/source_unavailable receipts return HTTP 409; successes return 200.
 * Missing preflight restore source: 409 {error:'SOURCE_UNAVAILABLE'} without mutation.
 * Purged save proposal: 409 {error:'OPERATION_REPLAY_UNAVAILABLE'} without re-encryption.
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
      if (input.action === 'save' && input.document.state === 'FINALIZED'
        && await recordId(ownerId, input.document.entry.id) !== input.documentId) fail(422, 'INVALID_DOCUMENT');
      if (input.action === 'save' && !await stateIdentityValid(ownerId,input.documentId,input.document)) fail(422,'INVALID_DOCUMENT');
      const checkGate = async () => {
        const enabled = await repo.enabled(ownerId);
        if (enabled === false) fail(403, 'ACCOUNT_JOURNAL_DISABLED');
        if (enabled !== true) fail(503, 'UNAVAILABLE');
      };
      await checkGate();
      if (input.action === 'rewardSummary' || input.action === 'visit') {
        const result = await repo[input.action]();
        await checkGate();
        const summary = input.action === 'visit' ? result?.summary : result;
        if (!keys(summary, ['kind','ownerId','today','points','spentPoints','availablePoints','journalDays','visitDays','visitedToday','journalRecordedToday'], ['legacySpentPoints'])
          || (Object.hasOwn(summary,'legacySpentPoints') && !revision(summary.legacySpentPoints))
          || summary.kind !== 'rewardSummary' || summary.ownerId !== ownerId
          || !validateDraftDocument({ ...{ version:1,state:'DRAFT',visibility:'PRIVATE',title:'',body:'' },date:summary.today })
          || !['points','spentPoints','availablePoints','journalDays','visitDays'].every(key => revision(summary[key]))
          || summary.points !== summary.journalDays * 4 + summary.visitDays
          || summary.availablePoints !== summary.points - summary.spentPoints
          || typeof summary.visitedToday !== 'boolean' || typeof summary.journalRecordedToday !== 'boolean'
          || (input.action === 'visit' && (!keys(result,['kind','awardedPoints','summary'])
            || result.kind !== 'visit' || ![0,1].includes(result.awardedPoints)))) fail(503,'INVALID_STORED_DATA');
        return respond(200,result);
      }
      let material;
      try {
        material = await getMaterial();
        const key = material?.active?.key;
        if (!key || key.extractable !== false || key.algorithm?.name !== 'AES-GCM'
          || key.algorithm?.length !== 256 || !key.usages.includes('encrypt') || !key.usages.includes('decrypt')
          || typeof material.get !== 'function' || material.get(material.active.keyId)?.key !== key) throw 0;
      }
      catch { fail(503, 'KEY_UNAVAILABLE'); }
      if (input.action === 'status') {
        if (repo.attestationStatus) {
          const status = await repo.attestationStatus();
          if (!keys(status,['kind']) || status.kind !== 'ready') fail(503,'UNAVAILABLE');
          await checkGate();
        }
        return respond(200, { kind: 'ready' });
      }
      const decode = async (payload, documentId) => {
        const key = material.get(payload?.keyId);
        if (!key) fail(503, 'KEY_UNAVAILABLE');
        try {
          const doc = JSON.parse(await decryptAccountJournalDocument(payload, { ownerId, documentId }, key));
          if (!validateAccountJournalDocument(doc) || validateDocument(doc) !== true) throw 0;
          if (doc.state === 'FINALIZED' && await recordId(ownerId, doc.entry.id) !== documentId) throw 0;
          if (!await stateIdentityValid(ownerId,documentId,doc)) throw 0;
          return JSON.parse(canonical(doc));
        } catch { fail(503, 'INVALID_STORED_DATA'); }
      };
      const entry = async row => {
        if (!object(row) || row.user_id !== ownerId || !isUuid(row.document_id)
          || row.document_id !== row.document_id.toLowerCase() || !revision(row.revision) || row.revision < 1) fail(503, 'INVALID_STORED_DATA');
        if (row.deleted_at !== null && row.deleted_at !== undefined) {
          if (!timestamp(row.deleted_at) || row.encrypted_payload !== null) fail(503, 'INVALID_STORED_DATA');
          return { documentId: row.document_id, revision: row.revision };
        }
        return { documentId: row.document_id, revision: row.revision,
          document: await decode(row.encrypted_payload, row.document_id) };
      };
      if (input.action === 'read') {
        const row = await repo.read(ownerId, input.documentId);
        await checkGate();
        if (row === null) fail(404, 'NOT_FOUND');
        if (row?.document_id !== input.documentId) fail(503, 'INVALID_STORED_DATA');
        const value = await entry(row);
        return respond(200, { kind: Object.hasOwn(value, 'document') ? 'document' : 'deleted', ...value });
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
        const page = entries.slice(0, limit);
        const deletedDocuments = page.filter(entry => !Object.hasOwn(entry, 'document'));
        return respond(200, { kind: 'list', documents: page.filter(entry => entry.document && (input.collection === 'JOURNAL'
          ? entry.document.state === 'FINALIZED' : entry.document.state === 'DRAFT')),
          ...(deletedDocuments.length ? { deletedDocuments } : {}),
          nextCursor: entries.length > limit ? entries[limit - 1].documentId : null });
      }
      const versions = async () => {
        const rows = await repo.history(input.documentId);
        await checkGate();
        if (!Array.isArray(rows)) fail(503, 'INVALID_STORED_DATA');
        let previous = MAX_REVISION + 1;
        const values = [];
        for (const row of rows) {
          if (!keys(row, ['revision', 'encryptedPayload', 'replacedAt', 'expiresAt', 'reason'])
            || !revision(row.revision) || row.revision < 1 || row.revision >= previous
            || !timestamp(row.replacedAt) || !timestamp(row.expiresAt)
            || Date.parse(row.expiresAt) - Date.parse(row.replacedAt) !== 30 * 24 * 60 * 60 * 1000
            || !['replaced', 'trash'].includes(row.reason)) fail(503, 'INVALID_STORED_DATA');
          values.push({ revision: row.revision, document: await decode(row.encryptedPayload, input.documentId),
            replacedAt: row.replacedAt, expiresAt: row.expiresAt, reason: row.reason });
          previous = row.revision;
        }
        return values;
      };
      if (input.action === 'history') {
        const values = await versions();
        await checkGate();
        return respond(200, { kind: 'history', documentId: input.documentId,
          versions: values.filter(value => input.collection !== 'JOURNAL' || value.document.state === 'FINALIZED') });
      }
      const comparePrior = async prior => {
        if (!object(prior) || prior.user_id !== ownerId || prior.operation_id !== input.operationId
          || !isUuid(prior.document_id) || !revision(prior.expected_revision)) fail(503, 'INVALID_STORED_DATA');
        if (prior.document_id !== input.documentId || prior.expected_revision !== input.expectedRevision) fail(409, 'OPERATION_REUSED');
        const operationKind = input.action === 'save' ? 'commit' : input.action;
        if (!['commit', 'delete', 'restore'].includes(prior.operation_kind)) fail(503, 'INVALID_STORED_DATA');
        if (prior.operation_kind !== operationKind
          || (input.action === 'restore' && prior.source_revision !== input.sourceRevision)) fail(409, 'OPERATION_REUSED');
        if (input.action !== 'save') return receiptFor(prior.result, input);
        if (input.document.state === 'FINALIZED' && (prior.trusted_metadata
          ? prior.trusted_metadata.awardAllowed !== (input.writePurpose !== 'MIGRATION')
          : input.writePurpose === 'MIGRATION')) fail(409,'OPERATION_REUSED');
        if (input.document.kind === 'DECORATIONS'
          && Boolean(prior.trusted_metadata?.legacyInitialGrant) !== (input.writePurpose === 'MIGRATION' && input.expectedRevision === 0)) fail(409, 'OPERATION_REUSED');
        if (prior.proposed_encrypted_payload === null) fail(409, 'OPERATION_REPLAY_UNAVAILABLE');
        const document = await decode(prior.proposed_encrypted_payload, prior.document_id);
        if (canonical(document) !== canonical(input.document)) fail(409, 'OPERATION_REUSED');
        return receiptFor(prior.result, input);
      };
      const prior = await repo.operation(ownerId, input.operationId);
      let receipt;
      if (prior !== null) receipt = await comparePrior(prior);
      else if (input.action === 'delete' || input.action === 'restore') {
        let restoredDocument;
        if (input.action === 'restore') {
          const values = await versions();
          restoredDocument = values.find(value => value.revision === input.sourceRevision)?.document;
          if (restoredDocument?.state === 'ACCOUNT_STATE') {
            const row = await repo.read(ownerId,input.documentId);
            if (row?.revision === input.expectedRevision) {
              const current = await entry(row);
              if (!current.document || typeof accountState.validateAccountStateDocumentUpdate !== 'function'
                || !accountState.validateAccountStateDocumentUpdate(current.document,restoredDocument)) fail(422,'INVALID_DOCUMENT_UPDATE');
            }
          }
          if (!values.some(value => value.revision === input.sourceRevision)) {
            // A concurrent operation may have completed while history expired.
            const winner = await repo.operation(ownerId, input.operationId);
            if (winner !== null) receipt = await comparePrior(winner);
            else fail(409, 'SOURCE_UNAVAILABLE');
          }
        }
        if (!receipt) {
          try {
            receipt = receiptFor(await repo[input.action]({ documentId: input.documentId,
              operationId: input.operationId, expectedRevision: input.expectedRevision,
              ...(input.action === 'restore' ? { sourceRevision: input.sourceRevision,
                metadata: accountJournalMetadata(restoredDocument) } : {}) }), input);
          } catch (error) {
            if (error?.code !== '22023') throw error;
            const winner = await repo.operation(ownerId, input.operationId);
            if (winner === null) fail(503, 'UNAVAILABLE');
            receipt = await comparePrior(winner);
          }
        }
      }
      else {
        const currentRow = await repo.read(ownerId, input.documentId);
        if (currentRow !== null && currentRow.revision === input.expectedRevision
          && (currentRow.deleted_at === null || currentRow.deleted_at === undefined)) {
          const current = await entry(currentRow);
          if (current.document.state !== input.document.state
            || (input.document.state === 'ACCOUNT_STATE' && (current.document.kind !== input.document.kind
              || typeof accountState.validateAccountStateDocumentUpdate !== 'function'
              || !accountState.validateAccountStateDocumentUpdate(current.document,input.document)))
            || (input.document.state === 'FINALIZED'
              && !validateAccountJournalRecordUpdate(current.document, input.document))) fail(422, 'INVALID_DOCUMENT_UPDATE');
        }
        const encryptedPayload = await encryptAccountJournalDocument(canonical(input.document),
          { ownerId, documentId: input.documentId }, material.active);
        try { receipt = receiptFor(await repo.commit({ documentId: input.documentId,
          operationId: input.operationId, expectedRevision: input.expectedRevision, encryptedPayload,
          metadata: { ...accountJournalMetadata(input.document), ...(input.document.state === 'FINALIZED'
            ? { awardAllowed: input.writePurpose !== 'MIGRATION' } : {}),
            ...(input.document.kind === 'DECORATIONS' && input.writePurpose === 'MIGRATION' && input.expectedRevision === 0
              ? { legacyInitialGrant: true } : {}) } }), input); }
        catch (error) {
          // Concurrent identical plaintext has a different nonce. Compare the winning proposal.
          if (error?.code !== '22023') throw error;
          const winner = await repo.operation(ownerId, input.operationId);
          if (winner === null) fail(503, 'UNAVAILABLE');
          receipt = await comparePrior(winner);
        }
      }
      await checkGate();
      return respond(['conflict', 'source_unavailable'].includes(receipt.kind) ? 409 : 200, receipt);
    } catch (error) {
      if (error instanceof GatewayError) return respond(error.status, { error: error.status === 503
        ? 'SERVICE_UNAVAILABLE' : error.status === 403 ? 'ACCESS_DENIED' : error.code });
      if (error?.code === '42501') return respond(403, { error: 'ACCESS_DENIED' });
      if (error?.code === '23505') return respond(409, { error: 'PLANNED_SESSION_ALREADY_RECORDED' });
      if (error?.code === 'P0001') return respond(409, { error: 'INSUFFICIENT_POINTS' });
      return respond(503, { error: 'SERVICE_UNAVAILABLE' });
    }
  };
}

/** Official SDK adapter. The supplied client MUST use the verified user's JWT. */
export function createAccountJournalRepository(client, { ownerId, attest } = {}) {
  const result = async query => {
    const { data, error } = await query;
    if (error) {
      const safe = new Error('ACCOUNT_JOURNAL_DATABASE_ERROR');
      if (['22023', '42501', '23505', 'P0001'].includes(error.code)) safe.code = error.code;
      throw safe;
    }
    return data;
  };
  const mutate = async (action, input) => {
    if (!isUuid(ownerId) || typeof attest !== 'function') throw new Error('ACCOUNT_JOURNAL_ATTESTATION_REQUIRED');
    return result(client.rpc('mutate_account_journal_attested', await attest(ownerId.toLowerCase(), action, input)));
  };
  return {
    attestationStatus: () => mutate('status', {}),
    rewardSummary: () => result(client.rpc('account_reward_summary')),
    visit: () => result(client.rpc('record_account_reward_visit')),
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
      .select('user_id,operation_id,document_id,expected_revision,operation_kind,source_revision,proposed_encrypted_payload,result,trusted_metadata')
      .eq('user_id', ownerId).eq('operation_id', operationId).maybeSingle()),
    read: (ownerId, documentId) => result(client.from('account_journal_documents')
      .select('user_id,document_id,revision,encrypted_payload,deleted_at').eq('user_id', ownerId)
      .eq('document_id', documentId).maybeSingle()),
    list(ownerId, limit, cursor) {
      let query = client.from('account_journal_documents').select('user_id,document_id,revision,encrypted_payload,deleted_at')
        .eq('user_id', ownerId).order('document_id', { ascending: true }).limit(limit);
      if (cursor) query = query.gt('document_id', cursor);
      return result(query);
    },
    commit: input => mutate('commit', input),
    history: documentId => result(client.rpc('list_account_journal_history', { document_id: documentId })),
    delete: input => mutate('delete', input),
    restore: input => mutate('restore', input),
  };
}
