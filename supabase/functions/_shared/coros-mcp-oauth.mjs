// Server-only lifecycle orchestration. No production storage or encryption implementation.
import {
  corosMcpEndpoints, validateCorosMcpDiscovery, createCorosMcpPkce,
  createCorosMcpAuthorizationUrl, createCorosMcpTokenRequest,
} from './coros-mcp.mjs'

const PREFIX = 'COROS_OAUTH_'
const SAFE_CODES = new Set(['INVALID_INPUT', 'SCOPE_REJECTED', 'TOKEN_REJECTED', 'SERVER_ONLY', 'INVALID_CONFIG',
  'DISABLED', 'FAILED', 'STORE_INVALID', 'REQUEST_FAILED', 'HTTP_FAILED', 'RESPONSE_REJECTED', 'DISCOVERY_REJECTED',
  'REGISTRATION_REJECTED', 'REDIRECT_REJECTED', 'BUSY', 'STALE', 'CALLBACK_REJECTED', 'TRANSACTION_EXPIRED', 'REAUTH_REQUIRED'])
const fail = code => new Error(PREFIX + code)
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
function text(v, max = 8192) {
  if (typeof v !== 'string' || !v.length || v.length > max || !/^[\x21-\x7e]+$/u.test(v)) throw fail('INVALID_INPUT')
  return v
}
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let n = 0
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return n === 0
}
function scope(value) {
  if (value !== 'mcp.tools') throw fail('SCOPE_REJECTED')
  return value
}
function exactList(value, expected) {
  return Array.isArray(value) && value.length === expected.length && new Set(value).size === value.length && expected.every(x => value.includes(x))
}
function cancel(body) { try { body?.cancel().catch(() => {}) } catch {} }
function wait(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(fail('REQUEST_FAILED'))
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort)).catch(() => {})
    if (signal.aborted) abort()
  })
}
function initial() {
  return { generation: 0, status: 'disconnected', region: null, client: null, pending: null, credential: null, operation: null }
}
function view(s) {
  return { provider: 'COROS_MCP', generation: s.generation, region: s.region,
    connected: s.status === 'connected', pending: ['registering', 'authorizing', 'exchanging', 'refreshing'].includes(s.status),
    reauthRequired: s.status === 'reauth_required' }
}
function empty(s, status = 'reauth_required') {
  s.status = status; s.pending = null; s.credential = null; s.operation = null
}
function tokenResponse(value, previous, requestedAt) {
  if (!object(value) || typeof value.token_type !== 'string' || value.token_type.toLowerCase() !== 'bearer'
      || !Number.isSafeInteger(value.expires_in) || value.expires_in < 1 || value.expires_in > 2592000
      || Object.hasOwn(value, 'error')) throw fail('TOKEN_REJECTED')
  const accessToken = text(value.access_token)
  const grantedScope = scope(value.scope === undefined && previous ? previous.scope : value.scope)
  const refreshToken = value.refresh_token === undefined ? previous?.refreshToken ?? null : text(value.refresh_token)
  // Conservative lower bound: never add transport/body latency to token lifetime.
  return { accessToken, refreshToken, scope: grantedScope, expiresAt: requestedAt + value.expires_in * 1000 }
}

/**
 * store.atomic(accountId, callback): cross-process SERIALIZABLE transaction.
 * Callback receives a mutable account record (null on first use); returns
 * {record, result}. Store must persist record and return ONLY result atomically.
 * It MUST isolate/rollback mutations, encrypt all secrets at rest, bind ciphertext
 * to accountId/provider, and never expose/log callback values. See README.
 * Not a DB/encryption implementation. No network call is inside a transaction.
 */
export function createCorosMcpOAuth({ store, redirectUris, fetchImpl = fetch,
  enabled = false, now = () => Date.now(), timeoutMs = 10000, transactionTtlMs = 300000,
  maxResponseBytes = 65536 } = {}) {
  if (typeof window !== 'undefined' || typeof document !== 'undefined') throw fail('SERVER_ONLY')
  if (typeof store?.atomic !== 'function' || typeof fetchImpl !== 'function' || typeof now !== 'function'
      || !Array.isArray(redirectUris) || !redirectUris.length || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000
      || !Number.isInteger(transactionTtlMs) || transactionTtlMs < 1000 || transactionTtlMs > 600000
      || !Number.isInteger(maxResponseBytes) || maxResponseBytes < 256 || maxResponseBytes > 262144) throw fail('INVALID_CONFIG')
  const allowed = new Set(redirectUris.map(v => {
    try {
      text(v, 2048); const u = new URL(v)
      if (u.protocol !== 'https:' || u.username || u.password || v.includes('?') || v.includes('#') || u.search || u.hash || u.href !== v) throw fail('INVALID_CONFIG')
      return v
    } catch { throw fail('INVALID_CONFIG') }
  }))
  function guard() {
    if (enabled !== true || typeof window !== 'undefined' || typeof document !== 'undefined') throw fail('DISABLED')
  }
  async function boundary(fn) {
    try { guard(); return await fn() }
    catch (e) {
      // Never preserve adapter, provider, fetch or parsing error text/causes.
      if (e instanceof Error && e.message.startsWith(PREFIX) && SAFE_CODES.has(e.message.slice(PREFIX.length))) throw fail(e.message.slice(PREFIX.length))
      throw fail('FAILED')
    }
  }
  async function atomic(accountId, fn) {
    text(accountId, 256)
    return store.atomic(accountId, record => {
      const s = record ?? initial()
      if (!Number.isSafeInteger(s.generation) || s.generation < 0) throw fail('STORE_INVALID')
      const result = fn(s)
      return { record: s, result }
    })
  }
  async function request(url, options = {}, allowEmpty = false) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response, reader
    try {
      response = await wait(Promise.resolve().then(() => fetchImpl(url, { ...options, redirect: 'error', cache: 'no-store',
        credentials: 'omit', signal: controller.signal })).then(r => { if (controller.signal.aborted) cancel(r.body); return r }), controller.signal)
      if (!response.ok || response.status < 200 || response.status >= 300 || response.redirected === true) throw fail('HTTP_FAILED')
      if (allowEmpty) { cancel(response.body); return null }
      if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw fail('RESPONSE_REJECTED')
      const length = response.headers.get('content-length')
      if (length !== null && (!/^\d+$/u.test(length) || Number(length) > maxResponseBytes)) throw fail('RESPONSE_REJECTED')
      reader = response.body?.getReader()
      if (!reader) throw fail('RESPONSE_REJECTED')
      const chunks = []; let size = 0
      while (true) {
        const { done, value } = await wait(reader.read(), controller.signal)
        if (done) break
        size += value.byteLength
        if (size > maxResponseBytes) throw fail('RESPONSE_REJECTED')
        chunks.push(value)
      }
      const bytes = new Uint8Array(size); let at = 0
      for (const c of chunks) { bytes.set(c, at); at += c.byteLength }
      const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (!object(value)) throw fail('RESPONSE_REJECTED')
      return value
    } catch (e) {
      if (e instanceof Error && e.message.startsWith(PREFIX) && SAFE_CODES.has(e.message.slice(PREFIX.length))) throw fail(e.message.slice(PREFIX.length))
      throw fail('REQUEST_FAILED')
    } finally {
      clearTimeout(timer); controller.abort()
      try { reader?.cancel().catch(() => {}); reader?.releaseLock() } catch {}
      cancel(response?.body)
    }
  }
  async function discovery(region) {
    const ep = corosMcpEndpoints(region)
    const headers = { accept: 'application/json' }
    const resource = await request(ep.resourceMetadata, { headers })
    const auth = await request(ep.authorizationMetadata, { headers })
    validateCorosMcpDiscovery(region, resource, auth)
    // Public client only; require refresh capability for this lifecycle.
    if (!Array.isArray(auth.grant_types_supported) || !auth.grant_types_supported.includes('authorization_code')
      || !auth.grant_types_supported.includes('refresh_token')
      || (auth.revocation_endpoint !== undefined && auth.revocation_endpoint !== ep.revocation)) throw fail('DISCOVERY_REJECTED')
    return { ...ep, canRevoke: auth.revocation_endpoint === ep.revocation }
  }
  async function register(ep, redirect) {
    const value = await request(ep.registration, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ client_name: 'TrainOracle', redirect_uris: [redirect], grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'], token_endpoint_auth_method: 'none', scope: 'mcp.tools' }) })
    if (Object.hasOwn(value, 'client_secret') || Object.hasOwn(value, 'error')
      || value.token_endpoint_auth_method !== 'none' || !exactList(value.redirect_uris, [redirect])
      || !exactList(value.grant_types, ['authorization_code', 'refresh_token']) || !exactList(value.response_types, ['code'])
      || (value.scope !== undefined && scope(value.scope) !== 'mcp.tools')) throw fail('REGISTRATION_REJECTED')
    return { id: text(value.client_id, 256), redirect, canRevoke: ep.canRevoke }
  }
  function formRequest(body) {
    return { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams(body).toString() }
  }
  async function revokeTokens(region, client, credential) {
    if (!credential) return 'not_needed'
    if (!client?.canRevoke) return 'unsupported'
    let failed = false
    for (const [token, hint] of [[credential.refreshToken, 'refresh_token'], [credential.accessToken, 'access_token']]) {
      if (!token) continue
      try { await request(corosMcpEndpoints(region).revocation, formRequest({ token, token_type_hint: hint, client_id: client.id }), true) }
      catch { failed = true }
    }
    return failed ? 'failed' : 'accepted' // RFC7009 success does not prove provider-side invalidation.
  }
  async function failOperation(accountId, generation, id) {
    await atomic(accountId, s => {
      if (s.generation === generation && s.operation?.id === id) empty(s)
      return null
    })
  }
  async function beforeTokenRequest(accountId, claim, id, status) {
    await atomic(accountId, s => {
      if (s.generation !== claim.generation || s.operation?.id !== id || s.status !== status
        || s.operation.expiresAt !== claim.expiresAt || now() >= claim.expiresAt
        || s.region !== claim.region || s.client?.id !== claim.client.id) throw fail('STALE')
      return null
    })
    // A DB adapter may delay returning an already-committed result.
    if (now() >= claim.expiresAt) throw fail('STALE')
  }
  async function cleanupFailure(accountId, generation, id, region, client, credential) {
    // Independent best efforts: a rejected (or slow) DB cleanup must not prevent
    // starting revocation of credentials we already know. Preserve original error.
    await Promise.allSettled([
      failOperation(accountId, generation, id),
      ...(credential ? [revokeTokens(region, client, credential)] : []),
    ])
  }
  return Object.freeze({
    status(accountId) { return boundary(() => atomic(accountId, view)) },
    begin({ accountId, region, redirectUri }) { return boundary(async () => {
      corosMcpEndpoints(region)
      if (!allowed.has(redirectUri)) throw fail('REDIRECT_REJECTED')
      const pkce = await createCorosMcpPkce()
      const binding = await atomic(accountId, s => {
        if (!['disconnected', 'reauth_required'].includes(s.status)) throw fail('BUSY')
        if (s.generation >= Number.MAX_SAFE_INTEGER) throw fail('STORE_INVALID')
        s.generation++; empty(s, 'registering'); s.region = region; s.client = null
        s.operation = { id: pkce.state, expiresAt: now() + transactionTtlMs }
        return { generation: s.generation }
      })
      try {
        const ep = await discovery(region)
        // Recheck before creating an external client. No automatic DCR retries.
        await atomic(accountId, s => {
          if (s.generation !== binding.generation || s.operation?.id !== pkce.state || now() >= s.operation.expiresAt) throw fail('STALE')
          return null
        })
        const client = await register(ep, redirectUri)
        return await atomic(accountId, s => {
          if (s.generation !== binding.generation || s.operation?.id !== pkce.state || now() >= s.operation.expiresAt) throw fail('STALE')
          s.client = client; s.operation = null; s.status = 'authorizing'
          s.pending = { state: pkce.state, verifier: pkce.verifier, accountId, region, clientId: client.id,
            redirect: redirectUri, generation: s.generation, expiresAt: now() + transactionTtlMs }
          return { ...view(s), authorizationUrl: createCorosMcpAuthorizationUrl({ region, clientId: client.id, redirect: redirectUri,
            state: pkce.state, challenge: pkce.challenge }) }
        })
      } catch (e) { await failOperation(accountId, binding.generation, pkce.state); throw e }
    }) },
    complete({ accountId, region, clientId, redirectUri, generation, state, code, error }) { return boundary(async () => {
      text(state, 128)
      if (error === undefined) text(code, 4096)
      else { text(error, 256); if (code !== undefined) throw fail('INVALID_INPUT') }
      const claim = await atomic(accountId, s => {
        const p = s.pending
        if (s.status !== 'authorizing' || !p || !same(state, p.state) || p.accountId !== accountId || p.region !== region
          || p.clientId !== clientId || p.redirect !== redirectUri || p.generation !== generation || s.generation !== generation
          || s.region !== region || s.client?.id !== clientId || s.client.redirect !== redirectUri) throw fail('CALLBACK_REJECTED')
        if (now() >= p.expiresAt) { empty(s); return { expired: true } }
        s.pending = null // One atomic consume BEFORE token exchange; never restored.
        if (error !== undefined) { empty(s, 'disconnected'); return { denied: true, result: view(s) } }
        s.status = 'exchanging'; s.operation = { id: state, expiresAt: now() + timeoutMs + 1000 }
        return { verifier: p.verifier, client: { ...s.client }, generation, region, expiresAt: s.operation.expiresAt }
      })
      if (claim.expired) throw fail('TRANSACTION_EXPIRED')
      if (claim.denied) return claim.result
      let credential
      try {
        const req = createCorosMcpTokenRequest({ region, clientId, redirect: redirectUri, code, verifier: claim.verifier })
        await beforeTokenRequest(accountId, claim, state, 'exchanging')
        const requestedAt = now()
        credential = tokenResponse(await request(req.url, req), null, requestedAt)
        if (now() >= credential.expiresAt) throw fail('TOKEN_REJECTED')
        return await atomic(accountId, s => {
          if (s.generation !== generation || s.operation?.id !== state || s.status !== 'exchanging' || now() >= s.operation.expiresAt) throw fail('STALE')
          if (now() >= credential.expiresAt) throw fail('TOKEN_REJECTED')
          s.credential = credential; s.operation = null; s.status = 'connected'
          return view(s)
        })
      } catch (e) {
        await cleanupFailure(accountId, generation, state, region, claim.client, credential)
        throw e
      }
    }) },
    refresh(accountId) { return boundary(async () => {
      const id = (await createCorosMcpPkce()).state
      const claim = await atomic(accountId, s => {
        if (s.status === 'refreshing') {
          // Never reuse an old refresh token after an ambiguous/expired lease.
          if (now() >= s.operation.expiresAt) { empty(s); return { lost: true } }
          throw fail('BUSY')
        }
        if (s.status !== 'connected') throw fail('REAUTH_REQUIRED')
        if (!s.credential?.refreshToken) { empty(s); return { lost: true } }
        s.status = 'refreshing'; s.operation = { id, expiresAt: now() + timeoutMs + 1000 }
        return { generation: s.generation, region: s.region, client: { ...s.client }, credential: { ...s.credential }, expiresAt: s.operation.expiresAt }
      })
      if (claim.lost) throw fail('REAUTH_REQUIRED')
      let credential
      try {
        const ep = corosMcpEndpoints(claim.region)
        const options = formRequest({ grant_type: 'refresh_token', refresh_token: claim.credential.refreshToken,
          client_id: claim.client.id, resource: ep.resource, scope: 'mcp.tools' })
        await beforeTokenRequest(accountId, claim, id, 'refreshing')
        const requestedAt = now()
        const value = await request(ep.token, options)
        credential = tokenResponse(value, claim.credential, requestedAt)
        if (now() >= credential.expiresAt) throw fail('TOKEN_REJECTED')
        return await atomic(accountId, s => {
          if (s.generation !== claim.generation || s.operation?.id !== id || s.status !== 'refreshing' || now() >= s.operation.expiresAt) throw fail('STALE')
          if (now() >= credential.expiresAt) throw fail('TOKEN_REJECTED')
          s.credential = credential; s.operation = null; s.status = 'connected'
          return view(s)
        })
      } catch (e) {
        await cleanupFailure(accountId, claim.generation, id, claim.region, claim.client, credential)
        throw e
      }
    }) },
    disconnect(accountId) { return boundary(async () => {
      const detached = await atomic(accountId, s => {
        if (s.generation >= Number.MAX_SAFE_INTEGER) throw fail('STORE_INVALID')
        const snapshot = { region: s.region, client: s.client, credential: s.credential }
        s.generation++; empty(s, 'disconnected'); s.client = null; s.region = null
        return { snapshot, result: view(s) }
      })
      const revocation = await revokeTokens(detached.snapshot.region, detached.snapshot.client, detached.snapshot.credential)
      return { ...detached.result, revocation }
    }) },
  })
}
