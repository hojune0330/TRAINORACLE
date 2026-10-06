import { decryptAccountJournalDocument } from './account-journal-crypto.mjs';
import { profileComparisonRequestSchema, profileComparisonResponseSchema, readComparisonProfile,
  comparePermittedProfileAnswers, profileComparisonExportText } from './oracle-profile-comparison-validator.mjs';

const MAX_BODY = 16_000;
const encoder = new TextEncoder();
class ComparisonError extends Error { constructor(status, code) { super(code); this.status = status; } }
const deny = () => { throw new ComparisonError(403, 'COMPARISON_UNAVAILABLE'); };

/** Same HMAC pattern as the journal gateway, with a separate key and protocol domain. */
export async function importProfileComparisonAttestor(serialized) {
  try {
    const config = JSON.parse(serialized);
    if (!config || Object.keys(config).sort().join(',') !== 'key,keyId' || typeof config.keyId !== 'string'
      || !config.keyId.trim() || config.keyId.length > 80 || typeof config.key !== 'string' || !/^[A-Za-z0-9+/]{43}=$/u.test(config.key)) throw 0;
    const bytes = Uint8Array.from(atob(config.key), c => c.charCodeAt(0));
    let key;
    try { key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); }
    finally { bytes.fill(0); }
    return async (ownerId, sessionId, action, input) => {
      const request_text = JSON.stringify({ ...input, action, ownerId, sessionId,
        domain: 'trainoracle.profile-comparison.gateway.v1', proofExpiresAt: Math.floor(Date.now() / 1000) + 90 });
      const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(request_text));
      return { request_text, signature: [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join(''), key_id: config.keyId };
    };
  } catch { throw new ComparisonError(503, 'UNAVAILABLE'); }
}

export function createProfileComparisonRepository(client, { ownerId, sessionId, attest }) {
  return { async call(action, input) {
    const proof = await attest(ownerId, sessionId, action, input);
    const { data, error } = await client.rpc('oracle_profile_comparison_attested', proof);
    if (error) {
      if (['42501', '22023', '23514', '22P02', '22007'].includes(error.code)) deny();
      throw new ComparisonError(503, 'UNAVAILABLE');
    }
    return data;
  } };
}

async function body(request) {
  if (!request.body) throw new ComparisonError(400, 'INVALID_REQUEST');
  const reader = request.body.getReader(); let size = 0; const chunks = [];
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new ComparisonError(413, 'INVALID_REQUEST'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new ComparisonError(400, 'INVALID_REQUEST'); }
}

export function createProfileComparisonHandler({ authenticate, getMaterial, allowedOrigins = [] }) {
  const origins = new Set(allowedOrigins.filter(origin => {
    try { return /^https?:\/\//u.test(origin) && new URL(origin).origin === origin; } catch { return false; }
  }));
  return async request => {
    const origin = request.headers.get('origin');
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' });
    const respond = (status, value) => new Response(value === null ? null : JSON.stringify(value), { status, headers });
    if (origin && !origins.has(origin)) return respond(403, { error: 'COMPARISON_UNAVAILABLE' });
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'POST');
      headers.set('Access-Control-Allow-Headers', 'authorization, content-type, apikey, x-client-info');
      return respond(204, null);
    }
    if (request.method !== 'POST') return respond(405, { error: 'INVALID_REQUEST' });
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return respond(415, { error: 'INVALID_REQUEST' });
    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._~-]+)$/u)?.[1];
    if (!token) return respond(401, { error: 'AUTH_REQUIRED' });
    try {
      const parsed = profileComparisonRequestSchema.safeParse(await body(request));
      if (!parsed.success) return respond(400, { error: 'INVALID_REQUEST' });
      const input = parsed.data;
      const auth = await authenticate(token);
      if (!auth?.ownerId || !auth.sessionId || !auth.repo) return respond(401, { error: 'AUTH_REQUIRED' });
      let output;
      if (input.action === 'createInvite') {
        if (Date.parse(input.expiresAt) <= Date.now()) deny();
        const code = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(code)))].map(b => b.toString(16).padStart(2, '0')).join('');
        const saved = await auth.repo.call('createInvite', { comparisonId: crypto.randomUUID(), tokenHash: hash, expiresAt: input.expiresAt });
        output = { ...saved, invitationCode: code };
      } else if (input.action === 'acceptInvite') {
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input.invitationCode)))].map(b => b.toString(16).padStart(2, '0')).join('');
        output = await auth.repo.call('acceptInvite', { tokenHash: hash });
      } else if (input.action === 'consent') {
        if (Date.parse(input.expiresAt) <= Date.now()) deny();
        const source = await auth.repo.call('source', { comparisonId: input.comparisonId, documentId: input.documentId, documentRevision: input.documentRevision });
        if (source?.ownerId !== auth.ownerId || source.documentId !== input.documentId || source.documentRevision !== input.documentRevision) deny();
        const keyring = await getMaterial();
        const raw = await decryptAccountJournalDocument(source.encryptedPayload, { ownerId: auth.ownerId, documentId: input.documentId }, keyring.get(source.encryptedPayload?.keyId));
        readComparisonProfile(JSON.parse(raw), input);
        // SQL rechecks the canonical source revision after decryption/validation.
        output = await auth.repo.call('consent', input);
      } else if (input.action === 'compare' || input.action === 'export') {
        const sources = await auth.repo.call(input.action, input);
        if (sources?.kind !== 'sources' || sources.comparisonId !== input.comparisonId || sources.self?.ownerId !== auth.ownerId
          || !sources.peer?.ownerId || sources.peer.ownerId === auth.ownerId) deny();
        const keyring = await getMaterial();
        const decode = async source => JSON.parse(await decryptAccountJournalDocument(source.encryptedPayload,
          { ownerId: source.ownerId, documentId: source.documentId }, keyring.get(source.encryptedPayload?.keyId)));
        const own = await decode(sources.self), peer = await decode(sources.peer);
        const result = comparePermittedProfileAnswers(own, peer, { self: sources.self, peer: sources.peer });
        if (input.action === 'export' && !result.rows.length) deny();
        // Never release a result based only on the earlier source read.
        const verified = await auth.repo.call('verify', { comparisonId: input.comparisonId, purpose: input.action, expectedManifest: sources.manifest });
        if (verified?.kind !== 'verified' || !Number.isFinite(Date.parse(verified.validUntil)) || Date.parse(verified.validUntil) <= Date.now()) deny();
        const common = { comparisonId: input.comparisonId, checkedAt: verified.checkedAt, validUntil: verified.validUntil };
        output = input.action === 'compare' ? { ...common, kind: 'comparison', ...result }
          : { ...common, kind: 'export', text: profileComparisonExportText(result) };
      } else output = await auth.repo.call(input.action, input);
      for (const field of ['expiresAt', 'checkedAt', 'validUntil']) {
        if (output?.[field] != null) output[field] = new Date(output[field]).toISOString();
      }
      const safe = profileComparisonResponseSchema.safeParse(output);
      if (!safe.success) throw new ComparisonError(503, 'UNAVAILABLE');
      return respond(200, safe.data);
    } catch (error) {
      // No raw source, request, token, provider error or ciphertext is returned/logged.
      return respond(error instanceof ComparisonError ? error.status : 503,
        { error: error instanceof ComparisonError ? error.message : 'UNAVAILABLE' });
    }
  };
}
