import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { decryptAccountJournalDocument } from '../../supabase/functions/_shared/account-journal-crypto.mjs';
import { importJournalKeyring } from '../../supabase/functions/_shared/account-journal-handler.mjs';
import { prepareCoachingRecordEvidence, buildCoachingEvidenceFacts, evaluateProviderDataUse, deriveProviderDataLineage } from './contracts.mjs';

export const VERSION = 'SELF_HOSTED_COACHING_V1';
export const PURPOSE_VERSION = '2026-10-30';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const actions = { REVIEW_JOURNAL: '기록을 확인하기', REVIEW_PLAN: '기존 훈련계획을 검토하기' };
const summaries = {
  OBSERVED_TOTALS: '선택한 기록에서 확인 가능한 수치를 읽었습니다. 아래 값은 기록된 사실이며 새로운 훈련 처방이 아닙니다.',
  REVIEW_LIMITS: '기록된 거리와 시간만으로 회복 상태나 훈련 적정성을 판단할 수 없습니다. 원래 기록과 기존 계획을 함께 검토하세요.',
  SEPARATE_TIME_BASIS: '종목과 시간 측정 기준을 나누어 읽었습니다. 경과 시간·타이머 시간·이동 시간을 하나의 페이스나 합계로 섞지 않았습니다.',
  MISSING_DATA: '일부 기록은 값이나 시간 의미가 부족합니다. 확인된 값만 표시하며 누락된 수치를 추정하지 않았습니다.',
  DUPLICATE_SOURCE: '중복되거나 서로 다른 값이 있는 원천 기록 사본을 확인했습니다. 같은 활동은 여러 번 더하지 않고 충돌하는 근거는 제외했습니다.',
};
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, fields) => object(v) && Object.keys(v).length === fields.length && fields.every(k => Object.hasOwn(v, k));
const integer = v => Number.isSafeInteger(v) && v >= 0;
const publicConsent = consent => ({ revision: consent?.revision, active: consent?.active, purposeVersion: consent?.purposeVersion });
const ids = v => Array.isArray(v) && v.length > 0 && v.length <= 20 && v.every(x => typeof x === 'string' && UUID.test(x)) && new Set(v).size === v.length;
export class CoachingError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
const fail = (status, code) => { throw new CoachingError(status, code); };

export async function boundedJson(response, max = 64_000) {
  if (!response.body) fail(502, 'INFERENCE_UNAVAILABLE');
  const reader = response.body.getReader(); const parts = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); fail(413, 'INVALID_REQUEST'); }
      parts.push(value);
    }
    const joined = new Uint8Array(size); let offset = 0;
    for (const part of parts) { joined.set(part, offset); offset += part.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
  } catch (error) { if (error instanceof CoachingError) throw error; fail(400, 'INVALID_REQUEST'); }
  finally { reader.releaseLock(); }
}

export function validateRequest(value) {
  if (exact(value, ['action']) && value.action === 'status') return value;
  if (exact(value, ['action', 'expectedConsentRevision']) && value.action === 'withdraw' && integer(value.expectedConsentRevision)) return value;
  if (exact(value, ['action', 'expectedConsentRevision', 'purposeVersion', 'documentIds', 'documentRevisions']) && value.action === 'consent'
    && integer(value.expectedConsentRevision) && value.purposeVersion === PURPOSE_VERSION && ids(value.documentIds)
    && Array.isArray(value.documentRevisions) && value.documentRevisions.length === value.documentIds.length
    && new Set(value.documentRevisions.map(row => row?.documentId)).size === value.documentIds.length
    && value.documentRevisions.every(row => exact(row, ['documentId', 'revision']) && value.documentIds.includes(row.documentId)
      && integer(row.revision) && row.revision > 0)) return value;
  if (exact(value, ['action', 'documentIds', 'consentRevision']) && value.action === 'infer' && ids(value.documentIds)
    && integer(value.consentRevision) && value.consentRevision > 0) return value;
  fail(400, 'INVALID_REQUEST');
}

/** Only authenticated server registry entries may reach this shared policy. */
export function sourcePermission(lineage, grants, now = Date.now(), requestedFields = ['distanceKm', 'durationMin']) {
  const decision = evaluateProviderDataUse({lineage, grants, now:new Date(now).toISOString(), requestedFields,
    purpose:'SELF_HOSTED_INFERENCE', hosting:'COMPANY_SELF_HOSTED', consentActive:true});
  return decision.allowed ? 'READY' : decision.reason === 'PROVIDER_PERMISSION_REQUIRED' ? 'PROVIDER_APPROVAL_PENDING' : 'SOURCE_REVIEW_REQUIRED';
}

export function projectRecord(row, document, allowedFormats = []) {
  if (row.confirmed !== true || row.analysisEligible !== true || row.deletedAt != null) fail(409, 'SOURCE_CHANGED');
  const evidence = prepareCoachingRecordEvidence({documentId:row.documentId,revision:row.revision,document,lineage:row.lineage,allowedFormats});
  if (!evidence) fail(409, 'SOURCE_CHANGED');
  return evidence;
}

function validateModel(value, facts, summaryIds) {
  if (!exact(value, ['summaryId', 'factIds', 'actionIds']) || !Object.hasOwn(summaries, value.summaryId)
    || !summaryIds.includes(value.summaryId)
    || !Array.isArray(value.factIds) || !value.factIds.length || value.factIds.length > 40 || new Set(value.factIds).size !== value.factIds.length
    || !value.factIds.every(id => facts.some(fact => fact.id === id))
    || !Array.isArray(value.actionIds) || value.actionIds.length > 2 || new Set(value.actionIds).size !== value.actionIds.length
    || !value.actionIds.every(id => Object.hasOwn(actions, id))) fail(502, 'INFERENCE_UNAVAILABLE');
  return value;
}

function trustedUrl(value, allowLocalHttp) {
  const url = new URL(value);
  const local = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if (url.username || url.password || url.hash || url.search || (url.protocol !== 'https:' && !(allowLocalHttp && local && url.protocol === 'http:'))) throw new Error('CONFIGURATION_INVALID');
  return url;
}

export function createCompanyInference({ endpoint, allowedOrigin, model, token, timeoutMs = 12_000, allowLocalHttp = false, fetchImpl = fetch }) {
  const url = trustedUrl(endpoint, allowLocalHttp);
  if (url.origin !== trustedUrl(allowedOrigin, allowLocalHttp).origin || url.pathname !== '/v1/chat/completions'
    || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/u.test(model) || !integer(timeoutMs) || timeoutMs < 10 || timeoutMs > 30_000) throw new Error('CONFIGURATION_INVALID');
  return async (facts, signal, summaryIds = ['OBSERVED_TOTALS', 'REVIEW_LIMITS']) => {
    try {
      const response = await fetchImpl(url, { method: 'POST', redirect: 'error', cache: 'no-store',
        signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]),
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ model, stream: false, store: false, temperature: 0, max_tokens: 1024,
          response_format: { type: 'json_schema', json_schema: { name: 'bounded_coaching', strict: true, schema: {
            type: 'object', additionalProperties: false, required: ['summaryId', 'factIds', 'actionIds'], properties: {
              summaryId: { type: 'string', enum: summaryIds },
              factIds: { type: 'array', minItems: 1, maxItems: 40, items: { type: 'string', enum: facts.map(fact => fact.id) } },
              actionIds: { type: 'array', maxItems: 2, items: { type: 'string', enum: Object.keys(actions) } },
            },
          } } }, messages: [
            { role: 'system', content: 'Select only supplied fact and review action IDs. Never prescribe, diagnose, clear safety, alter plans, or generate new numbers. No training, evaluation, persistence or tools. Return the strict JSON schema only.' },
            { role: 'user', content: JSON.stringify({ facts: facts.map(({ id, label, value, unit }) => ({ id, label, value, unit })), summaryIds }) },
          ] }),
      });
      if (!response.ok) fail(502, 'INFERENCE_UNAVAILABLE');
      const payload = await boundedJson(response, 16_000);
      if (!Array.isArray(payload?.choices) || payload.choices.length !== 1 || payload.choices[0].finish_reason !== 'stop'
        || payload.choices[0].message?.tool_calls || payload.choices[0].message?.function_call
        || typeof payload.choices[0].message?.content !== 'string') fail(502, 'INFERENCE_UNAVAILABLE');
      return validateModel(JSON.parse(payload.choices[0].message.content), facts, summaryIds);
    } catch { fail(502, 'INFERENCE_UNAVAILABLE'); }
  };
}

export function createSupabaseRepository({ url, publishableKey, attestation, keyring, allowLocalHttp = false, fetchImpl = fetch }) {
  const base = trustedUrl(url, allowLocalHttp); if (base.pathname !== '/') throw new Error('CONFIGURATION_INVALID');
  if (!publishableKey || !attestation?.keyId || !/^[A-Za-z0-9+/]{43}=$/u.test(attestation.key ?? '')) throw new Error('CONFIGURATION_INVALID');
  const secret = Buffer.from(attestation.key, 'base64');
  async function request(path, token, body) {
    const response = await fetchImpl(new URL(path, base), { method: body ? 'POST' : 'GET', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(8_000), headers: { apikey: publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) {
      if (response.status === 401) fail(401, 'AUTH_REQUIRED');
      if (response.status === 403) fail(403, 'ACCESS_DENIED');
      fail(503, 'OPERATIONS_PENDING');
    }
    return boundedJson(response, 24_000_000);
  }
  return {
    async authenticate(token) {
      const user = await request('/auth/v1/user', token);
      let claims; try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { fail(401, 'AUTH_REQUIRED'); }
      // Decoded claims are used only after /user verifies this exact token. SQL independently verifies JWT + active session.
      if (!UUID.test(user.id ?? '') || claims.sub !== user.id || !UUID.test(claims.session_id ?? '') || claims.exp * 1000 <= Date.now()) fail(401, 'AUTH_REQUIRED');
      return { ownerId: user.id, sessionId: claims.session_id, token };
    },
    async call(auth, input) {
      const request_text = JSON.stringify({ ...input, ownerId: auth.ownerId, sessionId: auth.sessionId,
        domain: 'trainoracle.self-hosted-coaching.v1', proofExpiresAt: Math.floor(Date.now() / 1000) + 60 });
      const signature = createHmac('sha256', secret).update(request_text).digest('hex');
      const result = await request('/rest/v1/rpc/self_hosted_coaching_attested', auth.token, { request_text, signature, key_id: attestation.keyId });
      if (result?.error) fail(result.error === 'CONSENT_CHANGED' || result.error === 'SOURCE_CHANGED' ? 409 : 403, result.error);
      return result;
    },
    async decode(auth, row) {
      const material = keyring.get(row.encryptedPayload?.keyId);
      return JSON.parse(await decryptAccountJournalDocument(row.encryptedPayload, { ownerId: auth.ownerId, documentId: row.documentId }, material));
    },
  };
}

export function createCoachingHandler({ repository, infer, allowedOrigins = [], allowedFormats = [], enabled = false, now = () => Date.now() }) {
  const origins = new Set(allowedOrigins);
  const active = new Set();
  const inferenceControllers = new Map();
  return async request => {
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Pragma: 'no-cache', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' });
    const response = (status, value) => new Response(value === null ? null : JSON.stringify(value), { status, headers });
    const origin = request.headers.get('origin');
    if (origin && !origins.has(origin)) return response(403, { error: 'ACCESS_DENIED' });
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    if (new URL(request.url).pathname !== '/api/self-hosted-coaching') return response(404, { error: 'NOT_FOUND' });
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'POST'); headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return response(204, null);
    }
    if (request.method !== 'POST') return response(405, { error: 'INVALID_REQUEST' });
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return response(415, { error: 'INVALID_REQUEST' });
    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._~-]{1,12000})$/u)?.[1];
    if (!token) return response(401, { error: 'AUTH_REQUIRED' });
    let activeOwner;
    try {
      const input = validateRequest(await boundedJson(request, 4_000));
      if (!repository) fail(503, 'OPERATIONS_PENDING');
      const auth = await repository.authenticate(token);
      if (input.action === 'withdraw') {
        const result = await repository.call(auth, input);
        inferenceControllers.get(auth.ownerId)?.abort();
        return response(200, result);
      }
      if (active.has(auth.ownerId) || active.size >= 8) fail(429, 'BUSY');
      activeOwner = auth.ownerId; active.add(activeOwner);
      if (!enabled && input.action !== 'withdraw') {
        if (input.action !== 'status') fail(503, 'OPERATIONS_PENDING');
        const stopped = await repository.call(auth, { action: 'status' });
        return response(200, { version: VERSION, capability: { enabled: false, reason: 'OPERATIONS_PENDING' },
          consent: publicConsent(stopped.consent), records: [], retention: 'REQUEST_ONLY' });
      }
      const bundle = await repository.call(auth, { action: input.action === 'status' ? 'status' : 'bundle',
        ...(input.documentIds ? { documentIds: input.documentIds } : {}), ...(input.consentRevision ? { consentRevision: input.consentRevision } : {}) });
      if (bundle?.operationsReady !== true) {
        if (input.action === 'status') return response(200, { version: VERSION, capability: { enabled: false, reason: 'OPERATIONS_PENDING' }, consent: publicConsent(bundle.consent), records: [], retention: 'REQUEST_ONLY' });
        fail(503, 'OPERATIONS_PENDING');
      }
      if (!Array.isArray(bundle.rows) || !Array.isArray(bundle.grants) || !object(bundle.consent)) fail(503, 'OPERATIONS_PENDING');
      if (input.action !== 'status' && (bundle.rows.length !== input.documentIds.length || bundle.rows.some(row => !input.documentIds.includes(row.documentId)))) fail(409, 'SOURCE_CHANGED');
      if (input.action === 'consent' && bundle.rows.some(row => input.documentRevisions.find(expected => expected.documentId === row.documentId)?.revision !== row.revision)) fail(409, 'SOURCE_CHANGED');
      const records = []; const statusRecords = [];
      for (const row of bundle.rows) {
        let record;
        try { record = projectRecord(row, await repository.decode(auth, row), allowedFormats); }
        catch (error) { if (input.action === 'status') continue; throw error; }
        const reason = sourcePermission(record.lineage, bundle.grants, now(), record.requiredFields);
        if (input.action !== 'status' && reason !== 'READY') fail(403, 'ACCESS_DENIED');
        statusRecords.push({ documentId: record.documentId, revision: record.revision, journalEntryId: record.journalEntryId,
          date: record.date, provider: record.provider, label: '확인한 운동기록', eligible: reason === 'READY', reason });
        records.push(record);
      }
      if (input.action === 'status') return response(200, { version: VERSION, capability: { enabled: true, reason: 'READY' }, consent: publicConsent(bundle.consent),
        records: statusRecords, retention: 'REQUEST_ONLY' });
      if (input.action === 'consent') return response(200, await repository.call(auth, { ...input, expectedManifest: bundle.manifest }));
      if (bundle.consent.active !== true || bundle.consent.revision !== input.consentRevision || bundle.consent.purposeVersion !== PURPOSE_VERSION
        || !input.documentIds.every(id => bundle.consent.documentIds?.includes(id))) fail(409, 'CONSENT_CHANGED');
      const files = records.filter(record => record.fileObservation);
      const includePace = files.length > 0 && files.every(record => {
        const derived = deriveProviderDataLineage([{lineage:record.lineage,fields:record.requiredFields}],['avgPace']);
        return sourcePermission(derived,bundle.grants,now(),['avgPace']) === 'READY';
      });
      const evidence = buildCoachingEvidenceFacts(records, { includePace });
      if (!evidence?.facts.length) fail(409, 'SOURCE_CHANGED');
      const facts = evidence.facts;
      // Recheck immediately before disclosure to the model; recheck again before releasing any result.
      const verifyInput = { action: 'verify', documentIds: input.documentIds, consentRevision: input.consentRevision, expectedManifest: bundle.manifest };
      if ((await repository.call(auth, verifyInput))?.verified !== true) fail(403, 'ACCESS_DENIED');
      const inferenceController = new AbortController(); inferenceControllers.set(auth.ownerId, inferenceController);
      const summaryIds = evidence.summaryIds;
      const selected = validateModel(await infer(facts, AbortSignal.any([request.signal, inferenceController.signal]), summaryIds), facts, summaryIds);
      if ((await repository.call(auth, verifyInput))?.verified !== true) fail(403, 'ACCESS_DENIED');
      if (request.signal.aborted) fail(499, 'CANCELLED');
      const mandatoryIds = summaryIds.filter(id => !['OBSERVED_TOTALS', 'REVIEW_LIMITS', selected.summaryId].includes(id));
      const usedDocumentIds = [...new Set(facts.flatMap(fact => fact.sourceDocumentIds))];
      return response(200, { version: VERSION, kind: 'explanation', summary: [selected.summaryId, ...mandatoryIds].map(id => summaries[id]).join(' '),
        facts: [...selected.factIds.map(id => facts.find(fact => fact.id === id)), ...facts.filter(fact => !selected.factIds.includes(fact.id))],
        actions: selected.actionIds.map(id => ({ id, label: actions[id] })), sourceDocumentIds: usedDocumentIds,
        attribution: [...new Set(bundle.rows.filter(row => usedDocumentIds.includes(row.documentId)).flatMap(row => row.lineage.sources.map(source => source.originProvider)))].filter(provider => provider !== 'USER'),
        generatedAt: new Date(now()).toISOString(), retention: 'REQUEST_ONLY', planChanged: false, safetyChanged: false });
    } catch (error) {
      return response(error instanceof CoachingError ? error.status : 503, { error: error instanceof CoachingError ? error.message : 'OPERATIONS_PENDING' });
    } finally { if (activeOwner) { active.delete(activeOwner); inferenceControllers.delete(activeOwner); } }
  };
}

export function createNodeServer(handler) {
  const server = createServer(async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const request = new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, signal: controller.signal,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: req, duplex: 'half' }) });
      const result = await handler(request);
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer()));
    } catch { res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"error":"OPERATIONS_PENDING"}'); }
  });
  server.requestTimeout = 20_000; server.headersTimeout = 10_000; server.maxHeadersCount = 40;
  return server;
}

export async function serviceFromEnvironment(env = process.env) {
  const enabled = env.TRAINORACLE_SELF_HOSTED_COACHING_ENABLED === 'true';
  let repository; let infer;
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.TRAINORACLE_COACHING_ATTESTATION_JSON && env.TRAINORACLE_JOURNAL_KEYRING_JSON) {
    repository = createSupabaseRepository({ url: env.SUPABASE_URL, publishableKey: env.SUPABASE_ANON_KEY,
      attestation: JSON.parse(env.TRAINORACLE_COACHING_ATTESTATION_JSON), keyring: await importJournalKeyring(env.TRAINORACLE_JOURNAL_KEYRING_JSON) });
  }
  if (enabled) infer = createCompanyInference({ endpoint: env.TRAINORACLE_INTERNAL_LLM_URL, allowedOrigin: env.TRAINORACLE_INTERNAL_LLM_ORIGIN,
    model: env.TRAINORACLE_INTERNAL_LLM_MODEL, token: env.TRAINORACLE_INTERNAL_LLM_TOKEN });
  return createNodeServer(createCoachingHandler({ repository, infer, enabled,
    allowedFormats: (env.TRAINORACLE_COACHING_FILE_FORMATS ?? '').split(',').map(s => s.trim()).filter(s => ['tcx','csv','json','gpx'].includes(s)),
    allowedOrigins: (env.TRAINORACLE_COACHING_ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = await serviceFromEnvironment();
    const port = Number(process.env.PORT ?? '8788'); if (!Number.isInteger(port) || port < 1 || port > 65535) throw 0;
    // Local interface only; the company TLS reverse proxy is the public entry point.
    server.listen(port, '127.0.0.1');
  } catch { process.stderr.write('SELF_HOSTED_COACHING_CONFIGURATION_INVALID\n'); process.exitCode = 1; }
}
