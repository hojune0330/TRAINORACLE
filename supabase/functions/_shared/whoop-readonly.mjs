/**
 * Server-only WHOOP v2 read:workout transport, not an HTTP endpoint or importer.
 * Official schema inspected 2026-10-29:
 * https://api.prod.whoop.com/developer/doc/openapi.json
 * https://developer.whoop.com/docs/developing/pagination/
 * WorkoutV2.id is UUID; start/end are workout bounds (NOT created_at).
 * WorkoutScore.distance_meter is optional, in metres; missing is not zero.
 * Request nextToken comes from response next_token; limit is query, maximum 25.
 *
 * NOT IMPLEMENTED: OAuth consent/exchange/refresh/revocation, encrypted token
 * storage, account authorization/connection-generation checks, production wiring.
 * Trusted server caller must authorize the subject before getCredentials runs.
 * No persistence, derived domain metrics, prescription, or automatic adoption.
 * fetchImpl is a trusted test transport dependency, never caller/request input.
 */
const ENDPOINT = 'https://api.prod.whoop.com/developer/v2/activity/workout';
const SCOPE = 'read:workout';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = code => { throw new WhoopReadonlyError(code); };

const ERROR_CODES = new Set(['SERVER_ONLY', 'INVALID_RESPONSE', 'BODY_LIMIT', 'INVALID_CONFIG',
  'TIMEOUT', 'CREDENTIALS_UNAVAILABLE', 'INVALID_CREDENTIALS', 'REDIRECT_REJECTED',
  'UNAUTHORIZED', 'RATE_LIMITED', 'UPSTREAM_FAILURE', 'TRANSPORT_FAILURE',
  'INVALID_QUERY', 'INVALID_PAGINATION', 'INVALID_ID']);

export class WhoopReadonlyError extends Error {
  constructor(code) {
    code = ERROR_CODES.has(code) ? code : 'TRANSPORT_FAILURE';
    super(`WHOOP read-only request failed (${code})`);
    this.name = 'WhoopReadonlyError';
    this.code = code;
  }
}

function serverOnly() {
  if (typeof window !== 'undefined' || typeof document !== 'undefined') fail('SERVER_ONLY');
}

function timestamp(v) {
  if (typeof v !== 'string' || v.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)) return false;
  const [y, m, d] = v.slice(0, 10).split('-').map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(y, m - 1, d);
  return calendar.getUTCFullYear() === y && calendar.getUTCMonth() === m - 1 &&
    calendar.getUTCDate() === d && Number.isFinite(Date.parse(v));
}

function cursor(v, code) {
  if (typeof v !== 'string' || v.length > 4096 || /[\x00-\x20\x7f]/.test(v)) fail(code);
  return v;
}

function workout(raw) {
  if (!object(raw) || !UUID.test(raw.id ?? '') ||
      !['SCORED', 'PENDING_SCORE', 'UNSCORABLE'].includes(raw.score_state) ||
      typeof raw.sport_name !== 'string' || raw.sport_name.length < 1 || raw.sport_name.length > 100 ||
      /[\x00-\x1f\x7f]/.test(raw.sport_name) ||
      typeof raw.timezone_offset !== 'string' || !/^(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(raw.timezone_offset) ||
      !['start', 'end', 'created_at', 'updated_at'].every(k => timestamp(raw[k])) ||
      Date.parse(raw.end) < Date.parse(raw.start)) fail('INVALID_RESPONSE');
  // Privacy allowlist. Never spread raw provider objects, even inside score.
  const result = {
    id: raw.id, start: raw.start, end: raw.end,
    created_at: raw.created_at, updated_at: raw.updated_at,
    timezone_offset: raw.timezone_offset, sport_name: raw.sport_name,
    score_state: raw.score_state,
  };
  if (raw.score_state === 'SCORED') {
    if (!object(raw.score)) fail('INVALID_RESPONSE');
    if (Object.hasOwn(raw.score, 'distance_meter')) {
      const distance = raw.score.distance_meter;
      if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0) fail('INVALID_RESPONSE');
      result.score = { distance_meter: distance };
    }
  }
  return result;
}

async function readBounded(response, maxBytes, signal) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) fail('BODY_LIMIT');
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) fail('INVALID_RESPONSE');
  if (!response.body || typeof response.body.getReader !== 'function') fail('INVALID_RESPONSE');
  const reader = response.body.getReader();
  const cancel = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks = [];
  let size = 0;
  let complete = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) fail('BODY_LIMIT');
      chunks.push(value);
    }
    complete = true;
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { fail('INVALID_RESPONSE'); }
  } finally {
    signal.removeEventListener('abort', cancel);
    if (!complete) cancel();
    reader.releaseLock();
  }
}

export function createWhoopReadonlyAdapter({ getCredentials, fetchImpl = globalThis.fetch,
  timeoutMs = 10_000, maxBodyBytes = 262_144 } = {}) {
  serverOnly();
  if (typeof getCredentials !== 'function' || typeof fetchImpl !== 'function' ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000 ||
      !Number.isInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 1_048_576) fail('INVALID_CONFIG');

  async function request(url, parse) {
    serverOnly();
    const controller = new AbortController();
    let timer;
    let response;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new WhoopReadonlyError('TIMEOUT')); }, timeoutMs);
    });
    const operation = async () => {
      // Callback receives no user-supplied URL or parameters and must return an
      // already authorized server-side token. No tokens are cached by adapter.
      let credentials;
      try { credentials = await getCredentials({ scope: SCOPE, signal: controller.signal }); }
      catch { fail('CREDENTIALS_UNAVAILABLE'); }
      if (controller.signal.aborted) fail('TIMEOUT');
      if (!object(credentials) || !Array.isArray(credentials.scopes) ||
          credentials.scopes.length !== 1 || credentials.scopes[0] !== SCOPE ||
          typeof credentials.accessToken !== 'string' || credentials.accessToken.length < 1 ||
          credentials.accessToken.length > 8192 || !/^[A-Za-z0-9\-._~+/]+=*$/.test(credentials.accessToken)) fail('INVALID_CREDENTIALS');
      response = await fetchImpl(url.href, {
        method: 'GET', redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${credentials.accessToken}` },
      });
      if (controller.signal.aborted) {
        try { response.body?.cancel().catch(() => {}); } catch { /* Late transport cleanup is non-blocking. */ }
        fail('TIMEOUT');
      }
      // Reject test/custom transports that disregard redirect:error too.
      if (response.redirected || (response.url && response.url !== url.href)) fail('REDIRECT_REJECTED');
      if (response.status !== 200) {
        if (response.status >= 300 && response.status < 400) fail('REDIRECT_REJECTED');
        fail(response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' :
          response.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_FAILURE');
      }
      return parse(await readBounded(response, maxBodyBytes, controller.signal));
    };
    try { return await Promise.race([operation(), deadline]); }
    catch (error) {
      // Deliberately omit cause, status text, URL, body and token from errors.
      if (error instanceof WhoopReadonlyError) throw new WhoopReadonlyError(error.code);
      fail(controller.signal.aborted ? 'TIMEOUT' : 'TRANSPORT_FAILURE');
    } finally {
      clearTimeout(timer);
      controller.abort();
      if (response?.body && !response.body.locked) {
        try { response.body.cancel().catch(() => {}); } catch { /* no provider error logging */ }
      }
    }
  }

  return Object.freeze({
    async listWorkoutsPage(options = {}) {
      if (!object(options) || Object.keys(options).some(k => !['start', 'end', 'limit', 'nextToken'].includes(k))) fail('INVALID_QUERY');
      const { start, end, limit = 10, nextToken } = options;
      if (!Number.isInteger(limit) || limit < 1 || limit > 25 ||
          (start !== undefined && !timestamp(start)) || (end !== undefined && !timestamp(end)) ||
          (start !== undefined && end !== undefined && Date.parse(start) >= Date.parse(end))) fail('INVALID_QUERY');
      const url = new URL(ENDPOINT);
      url.searchParams.set('limit', String(limit));
      if (start !== undefined) url.searchParams.set('start', start);
      if (end !== undefined) url.searchParams.set('end', end);
      if (nextToken !== undefined) url.searchParams.set('nextToken', cursor(nextToken, 'INVALID_QUERY'));
      return request(url, raw => {
        if (!object(raw) || !Array.isArray(raw.records) || raw.records.length > limit) fail('INVALID_RESPONSE');
        const next = raw.next_token === undefined ? '' : cursor(raw.next_token, 'INVALID_RESPONSE');
        if (next && next === nextToken) fail('INVALID_PAGINATION');
        return { records: raw.records.map(workout), nextToken: next || null,
          hasMore: next.length > 0, coverage: 'single_page_only' };
      });
    },
    async getWorkout(id) {
      if (typeof id !== 'string' || !UUID.test(id)) fail('INVALID_ID');
      return request(new URL(`${ENDPOINT}/${id}`), raw => {
        const result = workout(raw);
        if (result.id.toLowerCase() !== id.toLowerCase()) fail('INVALID_RESPONSE');
        return result;
      });
    },
  });
}

