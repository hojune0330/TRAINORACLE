import { encryptAccountJournalDocument, decryptAccountJournalDocument } from './account-journal-crypto.mjs';
import { validateAccountJournalRecord, validateAccountJournalRecordUpdate, validateInitialFileObservationRecord,
  correctAccountJournalImportedObservation, FILE_OBSERVATION_CORRECTION_FIELDS, parseFileObservation,
  confirmComparisonRelationRequestSchema, releaseComparisonRelationRequestSchema, applyAccountJournalComparisonMutation,
  validateAccountJournalComparisonConfirmation, validateAccountJournalComparisonRestore, resolveComparisonOriginalFromPlanDocument } from './account-journal-record-validator.mjs';
import { readAccountJournalComparisonCollection } from './account-journal-comparison-original.mjs';
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
const observationOf = document => document?.kind === 'JOURNAL' ? document.entry?.fileObservation ?? null : null;
const sameObservation = (left, right) => canonical(observationOf(left) ?? {}) === canonical(observationOf(right) ?? {});
const relationsOf = document => document?.entry?.comparisonRelations ?? null;
const sameRelations = (left, right) => JSON.stringify(stable(relationsOf(left))) === JSON.stringify(stable(relationsOf(right)));
const comparisonAction = action => ['confirmComparisonRelation', 'releaseComparisonRelation'].includes(action);
const commitAction = action => ['save', 'correctImportedObservation', 'restartOracleV2'].includes(action) || comparisonAction(action);
const emptyOracleV2 = () => ({ version: 3, state: 'ACCOUNT_STATE', kind: 'RUNNING_PROFILE', data: {
  version: 'RUNNING_PROFILE_V2', status: 'ACTIVE', legacyAnswers: {}, legacyAnsweredAt: null, current: null, readings: [],
} });
const awardAllowed = input => input.action === 'save'
  && input.writePurpose !== 'MIGRATION' && input.writePurpose !== 'FILE_OBSERVATION';
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

const validPaceRecordGuard = guard => keys(guard, ['documentId', 'revision'])
  && isUuid(guard.documentId) && guard.documentId === guard.documentId.toLowerCase()
  && revision(guard.revision) && guard.revision > 0;
const planSessions = state => (state?.version === 3 ? state.activePlan : state?.selection?.activePlan)?.sessions ?? [];
const paceSourceFacts = session => {
  const prescription = session?.prescription;
  if (prescription?.kind === 'PACE_TARGET') {
    const { elapsedLabel: ignoredElapsed, ...anchor } = prescription.selectedAnchor;
    return [{ kind: 'PACE_TARGET', anchor }];
  }
  const inputs = prescription?.catalogWorkout?.inputs;
  return [...(inputs?.fiveK ? [{ kind: 'FIVE_K', reference: inputs.fiveK }] : []),
    ...(inputs?.paceReferences ?? []).map(reference => ({ kind: 'CATALOG_REFERENCE', reference }))];
};

/** Keep unchanged historical sources readable; moving or replacing a source is a new use. */
export function accountPlanIntroducesPaceRecordSources(previousState, nextState) {
  return introducedPaceSourceFacts(previousState, nextState).length > 0;
}

function introducedPaceSourceFacts(previousState, nextState) {
  const previous = planSessions(previousState);
  return planSessions(nextState).flatMap(session => {
    const old = previous.find(value => value.day === session.day && value.slot === session.slot);
    const remaining = paceSourceFacts(old).map(canonical);
    return paceSourceFacts(session).filter(reference => {
      const index = remaining.indexOf(canonical(reference));
      if (index < 0) return true;
      remaining.splice(index, 1);
      return false;
    });
  });
}

/** Only call with fully validated plan states. SQL must recheck the returned revision atomically. */
export async function verifyAccountPaceRecordEdit({ ownerId, nextState, previousState, read, decode }) {
  const receipt = nextState?.activePlanEdit;
  const denied = code => ({ ok: false, code });
  if (!receipt || receipt.action !== 'PACE_REFERENCE') {
    return receipt && Object.hasOwn(receipt, 'paceRecordGuard') ? denied('INVALID_PACE_RECORD_GUARD_SCOPE') : { ok: true, guard: null };
  }
  if (!previousState) return denied('PACE_RECORD_SOURCE_REQUIRED');
  if (receipt.undoOf) {
    const original = previousState.activePlanEdit;
    if (Object.hasOwn(receipt, 'paceRecordGuard') || !original || original.action !== 'PACE_REFERENCE'
      || original.undoOf || canonical(receipt.undoOf) !== canonical(original)
      || !Array.isArray(receipt.replacements) || !receipt.replacements.length) return denied('PACE_RECORD_UNDO_SOURCE_REQUIRED');
    for (const replacement of receipt.replacements) {
      const sameSlot = session => session.day === replacement.day && session.slot === replacement.slot;
      const old = original.baseSessions?.find(sameSlot), applied = original.replacements?.find(sameSlot);
      const current = previousState.activePlan?.sessions?.find(sameSlot);
      if (!old || !applied || !current || canonical(old) !== canonical(replacement)
        || canonical(applied) !== canonical(current)) return denied('PACE_RECORD_UNDO_SOURCE_REQUIRED');
    }
    return { ok: true, guard: null };
  }
  return verifyAccountPaceRecordSessions({ ownerId, sessions: receipt.replacements, guard: receipt.paceRecordGuard, read, decode });
}

/** New selections use only source references actually present in the validated plan. */
export async function verifyAccountPlanPaceRecordSources({ ownerId, nextState, previousState, guard, read, decode }) {
  const facts = introducedPaceSourceFacts(previousState, nextState);
  if (!facts.length) return guard === undefined ? { ok: true, guard: null } : { ok: false, code: 'INVALID_PACE_RECORD_GUARD_SCOPE' };
  return verifyAccountPaceRecordFacts({ ownerId, facts, guard, read, decode });
}

async function verifyAccountPaceRecordSessions({ ownerId, sessions, guard, read, decode }) {
  return verifyAccountPaceRecordFacts({ ownerId, facts: sessions?.flatMap(paceSourceFacts), guard, read, decode });
}

async function verifyAccountPaceRecordFacts({ ownerId, facts, guard, read, decode }) {
  const denied = code => ({ ok: false, code });
  const documentId = await namespacedId(['trainoracle.account.athlete-records.v1', ownerId]);
  if (!validPaceRecordGuard(guard) || guard.documentId !== documentId || typeof read !== 'function') {
    return denied('PACE_RECORD_SOURCE_REQUIRED');
  }
  const row = await read(ownerId, documentId);
  if (!row || row.user_id !== ownerId || row.document_id !== documentId || row.deleted_at != null
    || !revision(row.revision) || row.revision < 1 || row.revision !== guard.revision) return denied('PACE_RECORD_SOURCE_CHANGED');
  const document = await decode(row.encrypted_payload, documentId);
  if (document?.state !== 'ACCOUNT_STATE' || document.kind !== 'ATHLETE_RECORDS'
    || !validateAccountJournalDocument(document)) return denied('PACE_RECORD_SOURCE_REQUIRED');
  if (!Array.isArray(facts) || !facts.length) return denied('PACE_RECORD_SOURCE_REQUIRED');
  const selfRecord = id => document.data.records.find(value => value.id === id
    && value.enteredBy === 'ATHLETE' && value.verificationState === 'SELF_REPORTED');
  for (const fact of facts) {
    if (fact.kind === 'PACE_TARGET') {
      const anchor = fact.anchor, record = selfRecord(anchor?.anchorId);
      const goal = record?.purpose === 'RACE_GOAL';
      const kind = goal ? 'GOAL' : record?.purpose === 'PERSONAL_BEST' ? 'PB' : record?.purpose === 'SEASON_BEST' ? 'SB' : 'RECENT_RESULT';
      if (!record || !goal && record.achievedOn === null
        || anchor.kind !== kind || anchor.purpose !== (goal ? 'ASPIRATIONAL_TARGET' : kind === 'SB' ? 'SEASON_CONTEXT' : 'CURRENT_CAPABILITY')
        || anchor.eventDistanceM !== record.eventDistanceM || anchor.performanceSeconds !== record.performanceSeconds
        || anchor.achievedAt !== record.achievedOn || anchor.enteredBy !== record.enteredBy
        || anchor.verificationState !== record.verificationState || anchor.sourceRef !== record.sourceRef
        || anchor.seasonId !== (kind === 'SB' ? record.achievedOn.slice(0, 4) : null)
        || goal && (anchor.achievedAt !== null || anchor.freshnessState !== 'UNKNOWN'
          || anchor.selectionEvidence?.kind !== 'EXPLICIT_GOAL' || anchor.selectionEvidence.confirmed !== true
          || anchor.selectionEvidence.recordSchemaVersion !== record.schemaVersion
          || anchor.selectionEvidence.recordPurpose !== 'RACE_GOAL'
          || anchor.selectionEvidence.recordVersion !== record.savedAt)) return denied('PACE_RECORD_SOURCE_CHANGED');
      continue;
    }
    const reference = fact.reference;
    if (fact.kind === 'FIVE_K') {
      const record = selfRecord(reference.recordId);
      if (!record || record.purpose === 'RACE_GOAL' || record.eventDistanceM !== 5000 || record.achievedOn === null
        || reference.seconds !== record.performanceSeconds || reference.achievedAt !== record.achievedOn) return denied('PACE_RECORD_SOURCE_CHANGED');
    } else {
      const record = selfRecord(reference.recordId);
      const distance = record?.eventDistanceM === 21097 ? 21097.5 : record?.eventDistanceM;
      if (!record
        || reference.recordVersion !== record.savedAt || reference.eventDistanceM !== distance
        || reference.performanceSeconds !== record.performanceSeconds || reference.achievedOn !== record.achievedOn
        || reference.kind !== (record.purpose === 'RACE_GOAL' ? 'GOAL' : 'ACTUAL')) return denied('PACE_RECORD_SOURCE_CHANGED');
    }
  }
  return { ok: true, guard: { documentId, revision: row.revision } };
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
  if (document.kind === 'CALENDAR_DECORATIONS') return documentId === await namespacedId(['trainoracle.account.calendar-decorations.v1',ownerId]);
  if (document.kind === 'ATHLETE_RECORDS') return documentId === await namespacedId(['trainoracle.account.athlete-records.v1',ownerId]);
  if (document.kind === 'RUNNING_PROFILE') return documentId === await namespacedId(['trainoracle.account.running-profile.v1',ownerId]);
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
  const supportedJournalVersions = input.supportedJournalVersions ?? [2];
  if (!Array.isArray(supportedJournalVersions) || supportedJournalVersions.length < 1 || supportedJournalVersions.length > 2
    || new Set(supportedJournalVersions).size !== supportedJournalVersions.length
    || supportedJournalVersions.some(version => ![2, 3].includes(version))
    || Object.hasOwn(input, 'supportedJournalVersions') && input.supportedJournalVersions === null) fail(400, 'INVALID_REQUEST');
  if (Object.hasOwn(input, 'supportsExerciseLogV1') && typeof input.supportsExerciseLogV1 !== 'boolean') fail(400, 'INVALID_REQUEST');
  const supportsExerciseLogV1 = input.supportsExerciseLogV1 === true;
  const supportedRunningProfileVersions = input.supportedRunningProfileVersions ?? [1];
  if (!Array.isArray(supportedRunningProfileVersions) || !supportedRunningProfileVersions.length
    || supportedRunningProfileVersions.length > 2 || new Set(supportedRunningProfileVersions).size !== supportedRunningProfileVersions.length
    || supportedRunningProfileVersions.some(version => ![1, 2].includes(version))
    || Object.hasOwn(input, 'supportedRunningProfileVersions') && input.supportedRunningProfileVersions === null) fail(400, 'INVALID_REQUEST');
  const { supportedJournalVersions: _capabilities, supportsExerciseLogV1: _exerciseCapability,
    supportedRunningProfileVersions: _profileCapabilities, ...actionInput } = input;
  input = actionInput;
  const { action } = input;
  let valid = false;
  if (action === 'status') valid = keys(input, ['action']);
  if (action === 'calendarDecorationSupport') valid = keys(input, ['action']);
  if (action === 'athleteRecordSupport') valid = keys(input, ['action']);
  if (action === 'runningProfileSupport') valid = keys(input, ['action']);
  if (action === 'oracleV2Support') valid = keys(input, ['action']);
  if (action === 'oracleV2RestartSupport') valid = keys(input, ['action']);
  if (action === 'restartOracleV2') valid = keys(input, ['action','documentId','operationId','expectedRevision','confirmation'])
    && isUuid(input.documentId) && isUuid(input.operationId) && revision(input.expectedRevision) && input.expectedRevision > 0
    && input.confirmation === 'START_NEW_ORACLE_V2';
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
      && (input.document?.state === 'FINALIZED' || input.document?.state === 'ACCOUNT_STATE' && ['DECORATIONS', 'RUNNING_PROFILE'].includes(input.document?.kind))
      || input.writePurpose === 'FILE_OBSERVATION' && input.document?.state === 'FINALIZED');
  if (action === 'correctImportedObservation') valid = keys(input, ['action', 'documentId', 'operationId', 'expectedRevision',
    'previousContentRevisionFingerprint', 'replacementObservation', 'confirmedChangedFields'])
    && isUuid(input.documentId) && isUuid(input.operationId) && revision(input.expectedRevision)
    && typeof input.previousContentRevisionFingerprint === 'string' && /^sha256:[a-f0-9]{64}$/u.test(input.previousContentRevisionFingerprint)
    && Array.isArray(input.confirmedChangedFields) && input.confirmedChangedFields.length > 0
    && input.confirmedChangedFields.length <= FILE_OBSERVATION_CORRECTION_FIELDS.length
    && new Set(input.confirmedChangedFields).size === input.confirmedChangedFields.length
    && input.confirmedChangedFields.every(field => FILE_OBSERVATION_CORRECTION_FIELDS.includes(field));
  if (comparisonAction(action)) {
    const schema = action === 'confirmComparisonRelation' ? confirmComparisonRelationRequestSchema : releaseComparisonRelationRequestSchema;
    if (!schema.safeParse(input).success) fail(422, 'INVALID_COMPARISON_RELATION');
    valid = true;
  }
  if (!valid) fail(400, 'INVALID_REQUEST');
  if (action === 'save') {
    let accepted = false;
    try { accepted = validateAccountJournalDocument(input.document) && validateDocument(input.document) === true; } catch { /* Fail closed without validator details. */ }
    if (!accepted) fail(422, observationOf(input.document) || input.writePurpose === 'FILE_OBSERVATION' ? 'INVALID_FILE_OBSERVATION' : 'INVALID_DOCUMENT');
  }
  if (action === 'correctImportedObservation' && !parseFileObservation(input.replacementObservation)) fail(422, 'INVALID_FILE_OBSERVATION');
  return { ...input, supportedJournalVersions, supportsExerciseLogV1, supportedRunningProfileVersions, ...(input.documentId ? { documentId: input.documentId.toLowerCase() } : {}),
    ...(input.operationId ? { operationId: input.operationId.toLowerCase() } : {}),
    ...(input.cursor ? { cursor: input.cursor.toLowerCase() } : {}) };
}

function receiptFor(result, input) {
  if (!object(result) || result.documentId !== input.documentId || result.operationId !== input.operationId) fail(503, 'INVALID_STORED_DATA');
  const success = commitAction(input.action) ? 'saved' : { delete: 'deleted', restore: 'restored' }[input.action];
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
      const requireSupported = document => {
        if (document?.kind === 'RUNNING_PROFILE' && document.data.version === 'RUNNING_PROFILE_V2' && !input.supportedRunningProfileVersions.includes(2)) fail(426, 'UPGRADE_REQUIRED');
        if (document?.state === 'FINALIZED' && !input.supportedJournalVersions.includes(document.version)) fail(426, 'UPGRADE_REQUIRED');
        if (document?.state === 'FINALIZED' && document.entry?.exerciseLog !== undefined && !input.supportsExerciseLogV1) fail(426, 'UPGRADE_REQUIRED');
      };
      if (input.action === 'save') requireSupported(input.document);
      if (input.action === 'restartOracleV2') {
        requireSupported(emptyOracleV2());
        if (!await stateIdentityValid(ownerId, input.documentId, emptyOracleV2())) fail(422, 'INVALID_DOCUMENT');
      }
      if ((input.action === 'correctImportedObservation' || comparisonAction(input.action)) && !input.supportedJournalVersions.includes(3)) fail(426, 'UPGRADE_REQUIRED');
      if (input.action === 'save' && input.document.state === 'FINALIZED'
        && await recordId(ownerId, input.document.entry.id) !== input.documentId) fail(422, 'INVALID_DOCUMENT');
      if (input.action === 'save' && !await stateIdentityValid(ownerId,input.documentId,input.document)) fail(422,'INVALID_DOCUMENT');
      const checkGate = async () => {
        const enabled = await repo.enabled(ownerId);
        if (enabled === false) fail(403, 'ACCOUNT_JOURNAL_DISABLED');
        if (enabled !== true) fail(503, 'UNAVAILABLE');
      };
      await checkGate();
      const checkOracleV2Support = async () => {
        if (typeof repo.oracleV2Support !== 'function'
          || typeof accountState.validateInitialOracleV2Document !== 'function'
          || !accountState.validateAccountStateDocument({ version: 3, state: 'ACCOUNT_STATE', kind: 'RUNNING_PROFILE',
            data: { version: 'RUNNING_PROFILE_V2', status: 'ACTIVE', legacyAnswers: {}, legacyAnsweredAt: null, current: null, readings: [] } })) fail(503, 'UNAVAILABLE');
        const support = await repo.oracleV2Support();
        await checkGate();
        if (!keys(support, ['kind', 'version']) || support.kind !== 'oracle-v2-support' || support.version !== 2) fail(503, 'UNAVAILABLE');
        return support;
      };
      if (input.action === 'save' && input.document?.kind === 'RUNNING_PROFILE'
        && input.document.data.version === 'RUNNING_PROFILE_V2') await checkOracleV2Support();
      const checkRestartSupport = async () => {
        await checkOracleV2Support();
        if (typeof repo.oracleV2RestartSupport !== 'function') fail(503, 'UNAVAILABLE');
        const support = await repo.oracleV2RestartSupport();
        await checkGate();
        if (!keys(support, ['kind', 'version']) || support.kind !== 'oracle-v2-restart-support' || support.version !== 1) fail(503, 'UNAVAILABLE');
        return support;
      };
      if (input.action === 'restartOracleV2') await checkRestartSupport();
      const checkFileGate = async () => {
        const enabled = typeof repo.fileEvidenceEnabled === 'function' ? await repo.fileEvidenceEnabled(ownerId) : undefined;
        if (enabled === false) fail(409, 'FILE_EVIDENCE_DISABLED');
        if (enabled !== true) fail(503, 'UNAVAILABLE');
      };
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
      if (input.action === 'calendarDecorationSupport') {
        if (typeof repo.calendarDecorationSupport !== 'function'
          || typeof accountState.accountCalendarDecorationOwnershipMetadata !== 'function') fail(503, 'UNAVAILABLE');
        let support;
        try { support = await repo.calendarDecorationSupport(); }
        catch (error) {
          // An older attested SQL function rejects only this new action with 22023.
          // Do not downgrade auth, data-read, or database outages to an empty calendar.
          if (error?.code === '22023') fail(400, 'CALENDAR_DECORATION_UNSUPPORTED');
          throw error;
        }
        await checkGate();
        if (!keys(support, ['kind', 'version']) || support.kind !== 'calendar-decoration-support' || support.version !== 1) fail(503, 'UNAVAILABLE');
        return respond(200, support);
      }
      if (input.action === 'runningProfileSupport') {
        if (typeof repo.runningProfileSupport !== 'function' || !accountState.validateAccountStateDocument({
          version: 3, state: 'ACCOUNT_STATE', kind: 'RUNNING_PROFILE',
          data: { version: 'RUNNING_PROFILE_V1', answeredAt: '2026-10-04T00:00:00.000Z', answers: {} },
        })) fail(503, 'UNAVAILABLE');
        const support = await repo.runningProfileSupport();
        await checkGate();
        if (!keys(support, ['kind', 'version']) || support.kind !== 'running-profile-support' || support.version !== 1) fail(503, 'UNAVAILABLE');
        return respond(200, support);
      }
      if (input.action === 'oracleV2Support') return respond(200, await checkOracleV2Support());
      if (input.action === 'oracleV2RestartSupport') return respond(200, await checkRestartSupport());
      if (input.action === 'athleteRecordSupport') {
        if (typeof repo.athleteRecordSupport !== 'function' || !accountState.validateAccountStateDocument({
          version: 3, state: 'ACCOUNT_STATE', kind: 'ATHLETE_RECORDS', data: { records: [] },
        })) fail(503, 'UNAVAILABLE');
        let support;
        try { support = await repo.athleteRecordSupport(); }
        catch (error) { if (error?.code === '22023') fail(400, 'ATHLETE_RECORD_UNSUPPORTED'); throw error; }
        await checkGate();
        if (!keys(support, ['kind', 'version']) || support.kind !== 'athlete-record-support' || support.version !== 1) fail(503, 'UNAVAILABLE');
        return respond(200, support);
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
      const readComparisonOriginal = async reference => {
        let original = await readAccountJournalComparisonCollection(ownerId, repo.planCollection, material, reference);
        if (original?.status !== 'ORIGINAL_VERIFIED') {
          const planId = await namespacedId(['trainoracle.account.plan.v1', ownerId]);
          const row = await repo.read(ownerId, planId);
          if (row !== null) {
            if (row.document_id !== planId) fail(503, 'INVALID_STORED_DATA');
            original = resolveComparisonOriginalFromPlanDocument((await entry(row)).document, reference);
          }
        }
        if (original?.status !== 'ORIGINAL_VERIFIED') fail(409, 'COMPARISON_ORIGINAL_UNAVAILABLE');
        return original;
      };
      if (input.action === 'read') {
        const row = await repo.read(ownerId, input.documentId);
        await checkGate();
        if (row === null) fail(404, 'NOT_FOUND');
        if (row?.document_id !== input.documentId) fail(503, 'INVALID_STORED_DATA');
        const value = await entry(row);
        requireSupported(value.document);
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
        for (const value of page) {
          if (input.collection === 'JOURNAL') requireSupported(value.document);
        }
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
      const calendarOwnershipMetadata = async document => {
        if (document?.kind !== 'CALENDAR_DECORATIONS') return {};
        const ownershipDocumentId = await namespacedId(['trainoracle.account.decorations.v1', ownerId]);
        const row = await repo.read(ownerId, ownershipDocumentId);
        if (!row || row.document_id !== ownershipDocumentId) fail(409, 'OWNERSHIP_STATE_CHANGED');
        const ownership = await entry(row);
        if (!ownership.document || ownership.document.kind !== 'DECORATIONS'
          || typeof accountState.accountCalendarDecorationOwnershipMetadata !== 'function') fail(409, 'OWNERSHIP_STATE_CHANGED');
        try {
          return { ownershipDocumentId, ownershipRevision: ownership.revision,
            ...accountState.accountCalendarDecorationOwnershipMetadata(document, ownership.document) };
        } catch { fail(409, 'OWNERSHIP_STATE_CHANGED'); }
      };
      if (input.action === 'history') {
        const values = await versions();
        await checkGate();
        for (const value of values) requireSupported(value.document);
        return respond(200, { kind: 'history', documentId: input.documentId,
          versions: values.filter(value => input.collection !== 'JOURNAL' || value.document.state === 'FINALIZED') });
      }
      const originalRevision = async expected => {
        const row = await repo.read(ownerId, input.documentId);
        await checkGate();
        if (row !== null) {
          if (row.document_id !== input.documentId) fail(503, 'INVALID_STORED_DATA');
          const value = await entry(row);
          if (value.revision === expected && value.document) return value.document;
        }
        if (typeof repo.history !== 'function') fail(409, 'OPERATION_REPLAY_UNAVAILABLE');
        const original = (await versions()).find(value => value.revision === expected)?.document;
        if (!original) fail(409, 'OPERATION_REPLAY_UNAVAILABLE');
        return original;
      };
      const comparePrior = async prior => {
        if (!object(prior) || prior.user_id !== ownerId || prior.operation_id !== input.operationId
          || !isUuid(prior.document_id) || !revision(prior.expected_revision)) fail(503, 'INVALID_STORED_DATA');
        if (prior.document_id !== input.documentId || prior.expected_revision !== input.expectedRevision) fail(409, 'OPERATION_REUSED');
        const operationKind = input.action === 'restartOracleV2' ? input.action : commitAction(input.action) ? 'commit' : input.action;
        if (!['commit', 'delete', 'restore', 'restartOracleV2'].includes(prior.operation_kind)) fail(503, 'INVALID_STORED_DATA');
        if (prior.operation_kind !== operationKind
          || (input.action === 'restore' && prior.source_revision !== input.sourceRevision)) fail(409, 'OPERATION_REUSED');
        if (!commitAction(input.action)) return receiptFor(prior.result, input);
        if (input.action === 'restartOracleV2') {
          if (prior.proposed_encrypted_payload === null) fail(409, 'OPERATION_REPLAY_UNAVAILABLE');
          const proposed = await decode(prior.proposed_encrypted_payload, prior.document_id);
          if (canonical(proposed) !== canonical(emptyOracleV2())) fail(409, 'OPERATION_REUSED');
          return receiptFor(prior.result, input);
        }
        if ((input.action !== 'save' || input.document.state === 'FINALIZED') && (prior.trusted_metadata
          ? prior.trusted_metadata.awardAllowed !== awardAllowed(input)
          : input.writePurpose === 'MIGRATION')) fail(409,'OPERATION_REUSED');
        if (input.document?.kind === 'DECORATIONS'
          && Boolean(prior.trusted_metadata?.legacyInitialGrant) !== (input.writePurpose === 'MIGRATION' && input.expectedRevision === 0)) fail(409, 'OPERATION_REUSED');
        if (prior.proposed_encrypted_payload === null) fail(409, 'OPERATION_REPLAY_UNAVAILABLE');
        const document = await decode(prior.proposed_encrypted_payload, prior.document_id);
        requireSupported(document);
        if (comparisonAction(input.action)) {
          const { supportedJournalVersions: ignored, supportsExerciseLogV1: ignoredExercise, supportedRunningProfileVersions: ignoredProfile, ...request } = input;
          const proposal = applyAccountJournalComparisonMutation(await originalRevision(input.expectedRevision), request);
          if (!proposal || canonical(proposal) !== canonical(document)) fail(409, 'OPERATION_REUSED');
          return receiptFor(prior.result, input);
        }
        if (input.action === 'correctImportedObservation') {
          if (!observationOf(document) || canonical(observationOf(document)) !== canonical(input.replacementObservation)) fail(409, 'OPERATION_REUSED');
          const original = await originalRevision(input.expectedRevision);
          const proposal = correctAccountJournalImportedObservation(original, input.previousContentRevisionFingerprint,
            input.replacementObservation, input.confirmedChangedFields);
          if (!proposal || canonical(proposal) !== canonical(document)) fail(409, 'OPERATION_REUSED');
          return receiptFor(prior.result, input);
        }
        if (canonical(document) !== canonical(input.document)) fail(409, 'OPERATION_REUSED');
        if (observationOf(document)) {
          if (input.expectedRevision === 0) {
            if (!['FILE_OBSERVATION', 'MIGRATION'].includes(input.writePurpose) || !validateInitialFileObservationRecord(document)) fail(409, 'OPERATION_REUSED');
          } else if (!validateAccountJournalRecordUpdate(await originalRevision(input.expectedRevision), document, input.writePurpose)) {
            fail(409, 'OPERATION_REUSED');
          }
        }
        return receiptFor(prior.result, input);
      };
      let lifecycleCurrent;
      if (input.action === 'delete' || input.action === 'restore') {
        const row = await repo.read(ownerId, input.documentId);
        if (row !== null) {
          if (row.document_id !== input.documentId) fail(503, 'INVALID_STORED_DATA');
          lifecycleCurrent = await entry(row);
          requireSupported(lifecycleCurrent.document);
        }
      }
      const prior = await repo.operation(ownerId, input.operationId);
      let receipt;
      if (prior !== null) receipt = await comparePrior(prior);
      else if (input.action === 'restartOracleV2') {
        const row = await repo.read(ownerId, input.documentId);
        await checkGate();
        if (!row) fail(404, 'NOT_FOUND');
        if (row.document_id !== input.documentId) fail(503, 'INVALID_STORED_DATA');
        const previous = await entry(row);
        if (previous.revision !== input.expectedRevision) {
          const winner = await repo.operation(ownerId, input.operationId);
          if (winner) receipt = await comparePrior(winner);
          else receipt = { kind: 'conflict', documentId: input.documentId, operationId: input.operationId, currentRevision: previous.revision };
        } else {
          if (previous.document && (previous.document.kind !== 'RUNNING_PROFILE'
            || previous.document.data.version !== 'RUNNING_PROFILE_V2' || previous.document.data.status !== 'DELETED')) fail(422, 'INVALID_DOCUMENT_UPDATE');
          if (typeof repo.restartOracleV2 !== 'function') fail(503, 'UNAVAILABLE');
          const document = emptyOracleV2();
          if (!validateAccountJournalDocument(document) || validateDocument(document) !== true) fail(503, 'UNAVAILABLE');
          const encryptedPayload = await encryptAccountJournalDocument(canonical(document), { ownerId, documentId: input.documentId }, material.active);
          await checkGate();
          try { receipt = receiptFor(await repo.restartOracleV2({ documentId: input.documentId, operationId: input.operationId,
            expectedRevision: input.expectedRevision, encryptedPayload, metadata: accountJournalMetadata(document) }), input); }
          catch (error) {
            if (error?.code !== '22023') throw error;
            const winner = await repo.operation(ownerId, input.operationId);
            if (!winner) fail(503, 'UNAVAILABLE');
            receipt = await comparePrior(winner);
          }
        }
      }
      else if (input.action === 'delete' || input.action === 'restore') {
        let restoredDocument;
        if (input.action === 'restore') {
          const values = await versions();
          restoredDocument = values.find(value => value.revision === input.sourceRevision)?.document;
          requireSupported(restoredDocument);
          const restoreBaseline = lifecycleCurrent?.document ?? values[0]?.document;
          // Historical profile responses must not reactivate deleted answers or downgrade V2.
          if (restoredDocument?.kind === 'RUNNING_PROFILE'
            && (!lifecycleCurrent?.document || restoredDocument.data.version === 'RUNNING_PROFILE_V2'
              || restoreBaseline?.data?.version === 'RUNNING_PROFILE_V2')) fail(422, 'INVALID_DOCUMENT_UPDATE');
          if (restoredDocument && restoreBaseline?.state === 'FINALIZED' && restoredDocument.state !== 'FINALIZED') fail(422, 'INVALID_DOCUMENT_UPDATE');
          if (restoredDocument?.state === 'FINALIZED') {
            // A tombstone's newest retained version remains its evidence baseline.
            const baseline = restoreBaseline;
            if (!sameRelations(baseline, restoredDocument)) fail(422, 'INVALID_COMPARISON_RELATION');
            requireSupported(baseline);
            if (baseline?.state === 'FINALIZED' && baseline.version === 3 && restoredDocument.version === 2) fail(422, 'INVALID_FILE_OBSERVATION');
            const changed = !sameObservation(lifecycleCurrent?.document, restoredDocument);
            if (changed) await checkFileGate();
            if (baseline?.state === 'FINALIZED' && (!sameObservation(baseline, restoredDocument)
              || baseline.entry.id !== restoredDocument.entry.id || baseline.entry.date !== restoredDocument.entry.date)) fail(422, 'INVALID_FILE_OBSERVATION');
          }
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
                metadata: { ...accountJournalMetadata(restoredDocument), ...await calendarOwnershipMetadata(restoredDocument) } } : {}) }), input);
          } catch (error) {
            if (error?.code !== '22023') throw error;
            const winner = await repo.operation(ownerId, input.operationId);
            if (winner === null) fail(503, 'UNAVAILABLE');
            receipt = await comparePrior(winner);
          }
        }
      }
      else if (input.action === 'correctImportedObservation' || comparisonAction(input.action)) {
        const row = await repo.read(ownerId, input.documentId);
        await checkGate();
        if (row === null || row.revision !== input.expectedRevision || row.deleted_at != null) {
          // The same operation may have won after our first receipt lookup.
          const winner = await repo.operation(ownerId, input.operationId);
          if (winner !== null) {
            receipt = await comparePrior(winner);
            await checkGate();
            return respond(receipt.kind === 'conflict' ? 409 : 200, receipt);
          }
        }
        if (row === null) fail(404, 'NOT_FOUND');
        if (row.document_id !== input.documentId) fail(503, 'INVALID_STORED_DATA');
        const current = await entry(row);
        requireSupported(current.document);
        if (!current.document || current.revision !== input.expectedRevision) {
          return respond(409, { kind: 'conflict', documentId: input.documentId, operationId: input.operationId,
            currentRevision: current.revision });
        }
        let document;
        if (comparisonAction(input.action)) {
          const { supportedJournalVersions: ignored, supportsExerciseLogV1: ignoredExercise, supportedRunningProfileVersions: ignoredProfile, ...request } = input;
          if (input.action === 'confirmComparisonRelation') {
            if ((relationsOf(current.document)?.length ?? 0) >= 32) fail(409, 'COMPARISON_CAPACITY_EXCEEDED');
            const original = await readComparisonOriginal(input.relation.original);
            if (!validateAccountJournalComparisonConfirmation(current.document, request, original)) fail(422, 'INVALID_COMPARISON_RELATION');
          }
          document = applyAccountJournalComparisonMutation(current.document, request);
          if (!document || validateDocument(document) !== true) fail(422, 'INVALID_COMPARISON_RELATION');
        } else {
          const observation = observationOf(current.document);
          if (!observation) fail(422, 'INVALID_FILE_OBSERVATION');
          if (observation.contentRevisionFingerprint !== input.previousContentRevisionFingerprint) fail(409, 'FILE_OBSERVATION_CONFLICT');
          document = correctAccountJournalImportedObservation(current.document, input.previousContentRevisionFingerprint,
            input.replacementObservation, input.confirmedChangedFields);
          if (!document || validateDocument(document) !== true) fail(422, 'INVALID_FILE_OBSERVATION');
        }
        await checkFileGate();
        await checkGate();
        const encryptedPayload = await encryptAccountJournalDocument(canonical(document),
          { ownerId, documentId: input.documentId }, material.active);
        try {
          receipt = receiptFor(await repo.commit({ documentId: input.documentId, operationId: input.operationId,
            expectedRevision: input.expectedRevision, encryptedPayload,
            metadata: { ...accountJournalMetadata(document), awardAllowed: false } }), input);
        } catch (error) {
          if (error?.code !== '22023') throw error;
          const winner = await repo.operation(ownerId, input.operationId);
          if (winner === null) fail(503, 'UNAVAILABLE');
          receipt = await comparePrior(winner);
        }
      }
      else {
        const currentRow = await repo.read(ownerId, input.documentId);
        let currentDocument;
        if (currentRow !== null) {
          if (currentRow.document_id !== input.documentId) fail(503, 'INVALID_STORED_DATA');
          currentDocument = (await entry(currentRow)).document;
          requireSupported(currentDocument);
        }
        if (input.document.kind === 'RUNNING_PROFILE') {
          if (currentRow && !currentDocument) fail(422, 'INVALID_DOCUMENT_UPDATE');
          if (input.document.data.version === 'RUNNING_PROFILE_V2') {
            if (currentRow === null && !accountState.validateInitialOracleV2Document(input.document)) fail(422, 'INVALID_DOCUMENT_UPDATE');
            if (currentDocument?.data?.version === 'RUNNING_PROFILE_V1' && input.writePurpose !== 'MIGRATION') fail(422, 'INVALID_DOCUMENT_UPDATE');
          }
        }
        if (input.document.state === 'FINALIZED') {
          if (relationsOf(input.document)) {
            if (currentRow === null && input.writePurpose === 'MIGRATION' && input.expectedRevision === 0) {
              await checkFileGate();
              for (const relation of relationsOf(input.document)) {
                const original = await readComparisonOriginal(relation.original);
                if (!validateAccountJournalComparisonRestore(input.document, relation, original)) fail(422, 'INVALID_COMPARISON_RELATION');
              }
            } else if (currentRow === null || !sameRelations(currentDocument, input.document)) fail(422, 'INVALID_COMPARISON_RELATION');
          }
          if (relationsOf(currentDocument) && !sameRelations(currentDocument, input.document)) fail(422, 'INVALID_COMPARISON_RELATION');
          if (input.writePurpose === 'FILE_OBSERVATION' && !validateInitialFileObservationRecord(input.document)) fail(422, 'INVALID_FILE_OBSERVATION');
          if (currentRow === null && input.document.version === 3
            && (!['FILE_OBSERVATION', 'MIGRATION'].includes(input.writePurpose)
              || !validateInitialFileObservationRecord(input.document))) fail(422, 'INVALID_FILE_OBSERVATION');
        }
        if (currentRow !== null && currentRow.revision === input.expectedRevision
          && (currentRow.deleted_at === null || currentRow.deleted_at === undefined)) {
          const current = await entry(currentRow);
          if (current.document.state !== input.document.state
            || (input.document.state === 'ACCOUNT_STATE' && (current.document.kind !== input.document.kind
              || typeof accountState.validateAccountStateDocumentUpdate !== 'function'
              || !accountState.validateAccountStateDocumentUpdate(current.document,input.document)))
            || (input.document.state === 'FINALIZED'
              && !validateAccountJournalRecordUpdate(current.document, input.document, input.writePurpose))) {
            fail(422, observationOf(current.document) || observationOf(input.document) ? 'INVALID_FILE_OBSERVATION' : 'INVALID_DOCUMENT_UPDATE');
          }
        }
        const nextPlanId = input.document.kind === 'PLAN' ? input.document.data.currentPlanId : null;
        const selectedPlan = input.document.kind === 'PLAN'
          ? input.document.data.plans.find(plan => plan.planId === nextPlanId)?.snapshot.state : null;
        if (nextPlanId !== null && nextPlanId !== currentDocument?.data?.currentPlanId
          && selectedPlan?.activePlanEdit?.action === 'PACE_REFERENCE') {
          // Legacy PLAN cannot atomically protect journals; use the guarded collection commit.
          fail(422, 'JOURNAL_GUARD_REQUIRED');
        }
        // Legacy PLAN writes have no atomic all-journal CAS. Same-pointer progress
        // and old receipts remain supported; new successors use the collection.
        if (nextPlanId !== null && nextPlanId !== currentDocument?.data?.currentPlanId
          && accountPlanStateNeedsJournalGuard(selectedPlan)) fail(422, 'JOURNAL_GUARD_REQUIRED');
        if (nextPlanId !== null && nextPlanId !== currentDocument?.data?.currentPlanId && selectedPlan) {
          // New source-bound selections require the collection's explicit source-CAS transport.
          const paceSource = await verifyAccountPlanPaceRecordSources({ ownerId, nextState: selectedPlan });
          if (!paceSource.ok) fail(422, 'PACE_RECORD_SOURCE_REQUIRED');
        }
        if (!sameObservation(currentDocument, input.document)
          || input.writePurpose === 'MIGRATION' && observationOf(input.document)) await checkFileGate();
        const encryptedPayload = await encryptAccountJournalDocument(canonical(input.document),
          { ownerId, documentId: input.documentId }, material.active);
        try { receipt = receiptFor(await repo.commit({ documentId: input.documentId,
          operationId: input.operationId, expectedRevision: input.expectedRevision, encryptedPayload,
          metadata: { ...accountJournalMetadata(input.document), ...await calendarOwnershipMetadata(input.document), ...(input.document.state === 'FINALIZED'
            ? { awardAllowed: awardAllowed(input) } : {}),
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
      if (error?.code === 'PZ001') return respond(507, { error: 'CONFLICT_STORAGE_LIMIT_REACHED' });
      if (error?.code === '23505') return respond(409, { error: 'PLANNED_SESSION_ALREADY_RECORDED' });
      if (error?.code === 'P0001') return respond(409, { error: 'INSUFFICIENT_POINTS' });
      if (error?.code === 'TD001') return respond(409, { error: 'OWNERSHIP_STATE_CHANGED' });
      return respond(503, { error: 'SERVICE_UNAVAILABLE' });
    }
  };
}

/** Only inspect fully validated states; snapshots retain continuity in their canonical identity. */
export function accountPlanStateNeedsJournalGuard(state) {
  if ([4, 5, 6].includes(state?.version)) return Boolean(state.selection?.continuation
    || state.selection?.periodization?.frameOrdinal > 1);
  return state?.version === 3 && (state.periodization?.frameOrdinal > 1
    || !state.activePlan.candidateId.includes(':no-continuity:template-'));
}

/** Official SDK adapter. The supplied client MUST use the verified user's JWT. */
export function createAccountJournalRepository(client, { ownerId, attest } = {}) {
  const result = async query => {
    const { data, error } = await query;
    if (error) {
      const safe = new Error('ACCOUNT_JOURNAL_DATABASE_ERROR');
      if (['22023', '42501', '23505', 'P0001', 'TD001', 'PZ001'].includes(error.code)) safe.code = error.code;
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
    calendarDecorationSupport: () => mutate('calendarDecorationSupport', {}),
    athleteRecordSupport: () => mutate('athleteRecordSupport', {}),
    runningProfileSupport: () => mutate('runningProfileSupport', {}),
    oracleV2Support: () => mutate('oracleV2Support', {}),
    oracleV2RestartSupport: () => mutate('oracleV2RestartSupport', {}),
    restartOracleV2: input => mutate('restartOracleV2', input),
    rewardSummary: () => result(client.rpc('account_reward_summary')),
    visit: () => result(client.rpc('record_account_reward_visit')),
    fileEvidenceEnabled: () => result(client.rpc('service_feature_enabled', { feature_key_input: 'FILE_ANALYSIS_WRITE' })),
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
