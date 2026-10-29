/** Server-only WHOOP OAuth protocol module. No HTTP handler or production store.
 * Store and credentials provider are TRUSTED server dependencies. See README.
 * Official contract inspected 2026-10-29: developer.whoop.com/docs/developing/oauth
 * and api.prod.whoop.com/developer/doc/openapi.json.
 */
const AUTH = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN = 'https://api.prod.whoop.com/oauth/oauth2/token';
const REVOKE = 'https://api.prod.whoop.com/developer/v2/user/access';
const READ = 'read:workout';
const CODES = new Set(['SERVER_ONLY','INVALID_CONFIG','INVALID_INPUT','INVALID_STATE',
  'ACCESS_DENIED','TIMEOUT','STORE_FAILURE','CREDENTIALS_UNAVAILABLE','INVALID_RESPONSE',
  'BODY_LIMIT','REDIRECT_REJECTED','UNAUTHORIZED','RATE_LIMITED','UPSTREAM_FAILURE',
  'TRANSPORT_FAILURE','NOT_CONNECTED','OFFLINE_REQUIRED','REAUTH_REQUIRED','STALE_CONNECTION']);
export class WhoopOAuthError extends Error {
  constructor(code) {
    code = CODES.has(code) ? code : 'TRANSPORT_FAILURE';
    super(`WHOOP OAuth failed (${code})`);
    this.name = 'WhoopOAuthError'; this.code = code;
  }
}
const fail = code => { throw new WhoopOAuthError(code); };
const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 8192) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\x00-\x20\x7f]/.test(v);
const token = v => text(v) && /^[A-Za-z0-9\-._~+/]+=*$/.test(v);
const epoch = v => Number.isSafeInteger(v) && v >= 0 && v < Number.MAX_SAFE_INTEGER;
const guard = () => { if (typeof window !== 'undefined' || typeof document !== 'undefined') fail('SERVER_ONLY'); };
const stop = signal => { if (signal.aborted) fail('TIMEOUT'); };
function cancel(body) { try { Promise.resolve(body?.cancel()).catch(() => {}); } catch { /* never block cleanup */ } }
async function digest(value) {
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2,'0')).join('');
}
function scopes(raw, offline) {
  if (typeof raw !== 'string' || raw.length > 128) fail('INVALID_RESPONSE');
  const list = raw.split(' ');
  const expected = offline ? [READ, 'offline'] : [READ];
  if (list.length !== expected.length || new Set(list).size !== list.length || !expected.every(s => list.includes(s))) fail('INVALID_RESPONSE');
  return expected;
}
function connection(raw, offline, now) {
  if (!obj(raw) || !token(raw.access_token) || typeof raw.token_type !== 'string' || raw.token_type.toLowerCase() !== 'bearer' ||
      !Number.isSafeInteger(raw.expires_in) || raw.expires_in < 1 || raw.expires_in > 31_536_000 ||
      (offline ? !token(raw.refresh_token) : raw.refresh_token !== undefined)) fail('INVALID_RESPONSE');
  return { accessToken: raw.access_token, refreshToken: offline ? raw.refresh_token : null,
    scopes: scopes(raw.scope, offline), expiresAt: now + raw.expires_in * 1000, offline };
}
function stored(raw) {
  if (!obj(raw) || !epoch(raw.epoch) || !(raw.connection === null || obj(raw.connection))) fail('STORE_FAILURE');
  const c = raw.connection;
  if (c && (!token(c.accessToken) || typeof c.offline !== 'boolean' || !Number.isSafeInteger(c.expiresAt) ||
      !Array.isArray(c.scopes) || (c.offline ? !token(c.refreshToken) : c.refreshToken !== null))) fail('STORE_FAILURE');
  if (c) { try { scopes(c.scopes.join(' '), c.offline); } catch { fail('STORE_FAILURE'); } }
  return raw;
}
const receipt = c => ({ provider: 'whoop', connected: true, scopes: [READ], offline: c.offline, expiresAt: c.expiresAt });

export function createWhoopOAuth({ clientId, getClientSecret, redirectAllowlist, store,
  fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 10_000,
  stateTtlMs = 300_000, maxBodyBytes = 65_536 } = {}) {
  guard();
  const methods = ['putState','consumeState','withAccountLock','loadConnection','saveConnection'];
  if (!text(clientId,512) || typeof getClientSecret !== 'function' || typeof fetchImpl !== 'function' ||
      typeof now !== 'function' || !globalThis.crypto?.subtle || !obj(store) || methods.some(k => typeof store[k] !== 'function') ||
      !Array.isArray(redirectAllowlist) || !redirectAllowlist.length || redirectAllowlist.length > 20 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000 ||
      !Number.isInteger(stateTtlMs) || stateTtlMs < 1 || stateTtlMs > 600_000 ||
      !Number.isInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 1_048_576) fail('INVALID_CONFIG');
  const allowed = new Set(redirectAllowlist);
  for (const uri of allowed) {
    let u; try { u = new URL(uri); } catch { fail('INVALID_CONFIG'); }
    // Server callback only, not arbitrary mobile custom schemes. Exact string allowlist.
    // URL.hash/search erase empty '#'/'?' values; inspect raw delimiters too.
    if (!text(uri,2048) || uri.includes('#') || uri.includes('?') || u.protocol !== 'https:' || !u.hostname || u.username || u.password || u.hash || u.search || u.href !== uri) fail('INVALID_CONFIG');
  }
  function time() { const n = now(); if (!Number.isSafeInteger(n) || n < 0 || n > Number.MAX_SAFE_INTEGER - 31_536_000_000) fail('INVALID_CONFIG'); return n; }
  function account(id) { if (!text(id,256)) fail('INVALID_INPUT'); }
  function redirect(uri) { if (!allowed.has(uri)) fail('INVALID_INPUT'); }
  async function bounded(work) {
    guard();
    const ctl = new AbortController(); let timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { reject(new WhoopOAuthError('TIMEOUT')); ctl.abort(); }, timeoutMs); });
    try { return await Promise.race([Promise.resolve().then(() => work(ctl.signal)), deadline]); }
    catch(e) { throw new WhoopOAuthError(e instanceof WhoopOAuthError ? e.code : ctl.signal.aborted ? 'TIMEOUT' : 'TRANSPORT_FAILURE'); }
    finally { clearTimeout(timer); ctl.abort(); }
  }
  async function db(method, args, signal) {
    stop(signal);
    let result; try { result = await store[method]({ ...args, signal }); }
    catch { stop(signal); fail('STORE_FAILURE'); }
    stop(signal); return result;
  }
  async function locked(accountId, signal, work) {
    let entered = false;
    try {
      return await store.withAccountLock({ accountId, signal }, async () => {
        stop(signal); entered = true;
        // Settle the STORE callback too, not only bounded()'s outer promise.
        // An abort-ignoring dependency may stay pending forever; the account
        // lock must still reach the store's finally/release path at deadline.
        let onAbort;
        const aborted = new Promise((_, reject) => {
          onAbort = () => reject(new WhoopOAuthError('TIMEOUT'));
          signal.addEventListener('abort', onAbort, { once: true });
          if (signal.aborted) onAbort();
        });
        try {
          // Promise.race observes late rejection of abandoned work. Existing
          // stop() checks and store CAS/abort fences still forbid late writes.
          return await Promise.race([
            Promise.resolve().then(() => { stop(signal); return work(); }),
            aborted,
          ]);
        } finally { signal.removeEventListener('abort', onAbort); }
      });
    } catch(e) { if (e instanceof WhoopOAuthError) throw e; stop(signal); fail(entered ? 'TRANSPORT_FAILURE' : 'STORE_FAILURE'); }
  }
  async function load(accountId, signal) { return stored(await db('loadConnection',{accountId},signal)); }
  async function save(accountId, previous, c, signal) {
    // CAS + abort fence MUST be atomic in production store, including after timeout.
    const ok = await db('saveConnection',{accountId, expectedEpoch: previous, nextEpoch: previous + 1, connection: c},signal);
    if (ok !== true) fail('STALE_CONNECTION');
  }
  async function secret(signal) {
    let s; try { s = await getClientSecret({signal}); } catch { stop(signal); fail('CREDENTIALS_UNAVAILABLE'); }
    stop(signal); if (!text(s,8192)) fail('CREDENTIALS_UNAVAILABLE'); return s;
  }
  async function read(response, signal, empty = false) {
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > (empty ? 0 : maxBodyBytes))) fail('BODY_LIMIT');
    if (!empty && !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) fail('INVALID_RESPONSE');
    if (!response.body) { if (empty) return; fail('INVALID_RESPONSE'); }
    const reader = response.body.getReader(); let total = 0; const chunks = []; let finished = false;
    const abort = () => { try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {} };
    signal.addEventListener('abort',abort,{once:true});
    try {
      stop(signal);
      for (;;) {
        const {value,done} = await reader.read(); stop(signal); if (done) break;
        if (!(value instanceof Uint8Array)) fail('INVALID_RESPONSE');
        total += value.byteLength; if (total > (empty ? 0 : maxBodyBytes)) fail('BODY_LIMIT'); chunks.push(value);
      }
      finished = true; if (empty) return;
      const bytes = new Uint8Array(total); let offset=0;
      for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
      try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); } catch { fail('INVALID_RESPONSE'); }
    } finally { signal.removeEventListener('abort',abort); if (!finished) abort(); try { reader.releaseLock(); } catch {} }
  }
  async function http(url, init, signal, empty = false) {
    let response;
    try {
      stop(signal);
      response = await fetchImpl(url,{...init,redirect:'error',signal});
      if (signal.aborted) { cancel(response?.body); fail('TIMEOUT'); }
      if (response.redirected || (response.url && response.url !== url) || response.status >= 300 && response.status < 400) fail('REDIRECT_REJECTED');
      if (response.status !== (empty ? 204 : 200)) fail(response.status === 400 || response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : response.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_FAILURE');
      return await read(response,signal,empty);
    } finally { if (response?.body && !response.body.locked) cancel(response.body); }
  }
  async function exchange(params, offline, signal) {
    const body = new URLSearchParams({...params,client_id:clientId,client_secret:await secret(signal)});
    // Anchor expiry before the request, after secret lookup. Network/body
    // latency must consume validity, not extend the provider's token lifetime.
    const requestedAt = time();
    const raw = await http(TOKEN,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:body.toString()},signal);
    stop(signal);
    const c = connection(raw,offline,requestedAt);
    if (c.expiresAt <= time()) fail('REAUTH_REQUIRED');
    return c;
  }
  return Object.freeze({
    async beginAuthorization({accountId,sessionBinding,redirectUri,offline=false} = {}) {
      account(accountId); redirect(redirectUri);
      if (!text(sessionBinding,512) || typeof offline !== 'boolean') fail('INVALID_INPUT');
      return bounded(signal => locked(accountId,signal,async () => {
        const snapshot = await load(accountId,signal);
        const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
        const state = Array.from(bytes,b => b.toString(16).padStart(2,'0')).join('');
        const stateHash = await digest(state);
        const bindingHash = await digest(JSON.stringify([accountId,sessionBinding]));
        const issuedAt = time(); const expiresAt = issuedAt + stateTtlMs;
        const record = {accountId,bindingHash,redirectUri,offline,epoch:snapshot.epoch,issuedAt,expiresAt};
        if (await db('putState',{stateHash,record},signal) !== true) fail('STORE_FAILURE');
        const url = new URL(AUTH);
        for (const [k,v] of Object.entries({response_type:'code',client_id:clientId,redirect_uri:redirectUri,scope:offline ? `${READ} offline` : READ,state})) url.searchParams.set(k,v);
        return {authorizationUrl:url.href,expiresAt};
      }));
    },
    async completeAuthorization({accountId,sessionBinding,redirectUri,state,code,error} = {}) {
      account(accountId); redirect(redirectUri);
      if (!text(sessionBinding,512) || typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) ||
          (error === undefined ? !text(code,4096) : !text(error,128) || code !== undefined)) fail('INVALID_INPUT');
      return bounded(signal => locked(accountId,signal,async () => {
        const stateHash = await digest(state); const bindingHash = await digest(JSON.stringify([accountId,sessionBinding]));
        const timestamp = time();
        const r = await db('consumeState',{stateHash,accountId,bindingHash,redirectUri,now:timestamp},signal);
        if (!obj(r) || r.accountId !== accountId || r.bindingHash !== bindingHash || r.redirectUri !== redirectUri ||
            typeof r.offline !== 'boolean' || !epoch(r.epoch) || !Number.isSafeInteger(r.issuedAt) || !Number.isSafeInteger(r.expiresAt) ||
            r.issuedAt > timestamp || r.expiresAt <= timestamp || r.expiresAt - r.issuedAt !== stateTtlMs) fail('INVALID_STATE');
        const snapshot = await load(accountId,signal);
        if (snapshot.epoch !== r.epoch) fail('INVALID_STATE');
        if (error !== undefined) fail('ACCESS_DENIED');
        const c = await exchange({grant_type:'authorization_code',code,redirect_uri:redirectUri},r.offline,signal);
        await save(accountId,snapshot.epoch,c,signal); return receipt(c);
      }));
    },
    async refresh({accountId} = {}) {
      account(accountId);
      return bounded(signal => locked(accountId,signal,async () => {
        const s = await load(accountId,signal); const old = s.connection;
        if (!old) fail('NOT_CONNECTED'); if (!old.offline) fail('OFFLINE_REQUIRED');
        const c = await exchange({grant_type:'refresh_token',refresh_token:old.refreshToken,scope:'offline'},true,signal);
        // Both tokens rotate; never keep the prior refresh token if provider omits one.
        if (c.refreshToken === old.refreshToken || c.accessToken === old.accessToken) fail('INVALID_RESPONSE');
        await save(accountId,s.epoch,c,signal); return receipt(c);
      }));
    },
    async revoke({accountId} = {}) {
      account(accountId);
      return bounded(signal => locked(accountId,signal,async () => {
        const s = await load(accountId,signal);
        if (s.connection) await http(REVOKE,{method:'DELETE',headers:{Authorization:`Bearer ${s.connection.accessToken}`,Accept:'application/json'}},signal,true);
        // Even a disconnected account increments epoch, invalidating pending consents.
        await save(accountId,s.epoch,null,signal);
        return {provider:'whoop',connected:false,providerRevoked:s.connection !== null};
      }));
    },
    async getReadonlyCredentials({accountId} = {}) {
      // SERVER ONLY: never serialize this result into an HTTP/browser response.
      account(accountId);
      return bounded(async signal => {
        const s = await load(accountId,signal); const c = s.connection;
        if (!c) fail('NOT_CONNECTED'); if (c.expiresAt <= time()) fail('REAUTH_REQUIRED');
        return {accessToken:c.accessToken,scopes:[READ]};
      });
    },
  });
}
