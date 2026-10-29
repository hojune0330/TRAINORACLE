import test from 'node:test'
import assert from 'node:assert/strict'
import { createCorosMcpOAuth } from '../functions/_shared/coros-mcp-oauth.mjs'

const REDIRECT = 'https://trainoracle.example/oauth/coros/callback'
const ORIGINS = { us: 'https://mcpus.coros.com', eu: 'https://mcpeu.coros.com', cn: 'https://mcpcn.coros.com' }
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
// TEST DOUBLE ONLY. Plaintext memory, not production encryption or durable transactions.
function memoryStore() {
  const records = new Map(); const queues = new Map()
  return {
    records,
    atomic(account, fn) {
      const prior = queues.get(account) ?? Promise.resolve()
      const next = prior.catch(() => {}).then(() => {
        const { record, result } = fn(structuredClone(records.get(account) ?? null))
        records.set(account, structuredClone(record))
        return structuredClone(result)
      })
      queues.set(account, next.catch(() => {})); return next
    },
  }
}
function harness(options = {}) {
  const store = memoryStore(); const calls = []; let time = 1000000
  const h = { store, calls, token: null, registration: null, resource: null, authorization: null, revoke: null }
  h.fetch = async (url, opts) => {
    calls.push({ url, opts })
    const origin = new URL(url).origin
    assert.ok(Object.values(ORIGINS).includes(origin), 'No external URL outside fixed regions')
    assert.equal(opts.redirect, 'error'); assert.equal(opts.credentials, 'omit'); assert.equal(opts.cache, 'no-store')
    if (url.endsWith('/.well-known/oauth-protected-resource/mcp')) return json(h.resource ?? { resource: origin + '/mcp', authorization_servers: [origin] })
    if (url.endsWith('/.well-known/oauth-authorization-server')) return json(h.authorization ?? {
      issuer: origin, authorization_endpoint: origin + '/oauth2/authorize', token_endpoint: origin + '/oauth2/token',
      registration_endpoint: origin + '/connect/register', revocation_endpoint: origin + '/oauth2/revoke',
      code_challenge_methods_supported: ['S256'], response_types_supported: ['code'], token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp.tools'], grant_types_supported: ['authorization_code', 'refresh_token'],
    })
    if (url.endsWith('/connect/register')) return h.registration ? h.registration(url, opts) : json({ ...JSON.parse(opts.body), client_id: 'client-test' })
    if (url.endsWith('/oauth2/token')) return h.token ? h.token(url, opts) : json({ access_token: 'test-access', refresh_token: 'test-refresh', token_type: 'Bearer', expires_in: 3600, scope: 'mcp.tools' })
    if (url.endsWith('/oauth2/revoke')) return h.revoke ? h.revoke(url, opts) : new Response(null, { status: 200 })
    throw new Error('unexpected endpoint')
  }
  h.api = createCorosMcpOAuth({ store, redirectUris: [REDIRECT], enabled: true, now: () => time, fetchImpl: h.fetch, ...options })
  h.advance = ms => { time += ms }
  h.begin = async (accountId = 'alice', region = 'eu') => {
    const result = await h.api.begin({ accountId, region, redirectUri: REDIRECT })
    const url = new URL(result.authorizationUrl)
    return { accountId, region, redirectUri: REDIRECT, generation: result.generation, clientId: url.searchParams.get('client_id'), state: url.searchParams.get('state'), code: 'test-code' }
  }
  h.connect = async () => { const args = await h.begin(); await h.api.complete(args); return args }
  return h
}
const rejects = (promise, code) => assert.rejects(promise, { message: `COROS_OAUTH_${code}` })
const assertSanitized = value => {
  const serialized = JSON.stringify(value)
  for (const key of ['accessToken', 'refreshToken', 'verifier', 'client_secret', 'test-access', 'test-refresh']) assert.ok(!serialized.includes(key), key)
}

test('disabled by default: no network and no store writes', async () => {
  const h = harness({ enabled: false }); await rejects(h.begin(), 'DISABLED'); assert.equal(h.calls.length, 0); assert.equal(h.store.records.size, 0)
})
test('reject non-HTTPS configured redirect', () => {
  assert.throws(() => harness({ redirectUris: ['http://localhost/cb'] }), /COROS_OAUTH_INVALID_CONFIG/u)
})
test('require explicit valid region and configured exact redirect', async () => {
  const h = harness()
  await rejects(h.begin('alice', 'auto'), 'FAILED')
  await rejects(h.api.begin({ accountId: 'alice', region: 'us', redirectUri: REDIRECT + '?next=evil' }), 'REDIRECT_REJECTED')
  assert.equal(h.calls.length, 0)
})
test('validated region discovery precedes DCR and authorization uses PKCE + resource', async () => {
  const h = harness(); const args = await h.begin('alice', 'cn')
  assert.equal(h.calls.length, 3)
  assert.ok(h.calls[0].url.startsWith(ORIGINS.cn)); assert.ok(h.calls[1].url.endsWith('oauth-authorization-server')); assert.ok(h.calls[2].url.endsWith('/connect/register'))
  const pending = h.store.records.get('alice').pending
  assert.equal(pending.region, 'cn'); assert.equal(pending.accountId, 'alice'); assert.equal(pending.clientId, args.clientId)
  assert.equal(pending.redirect, REDIRECT); assert.equal(pending.generation, args.generation)
  assert.equal(pending.state.length, 43); assert.equal(pending.verifier.length, 43)
  const r = await h.api.status('alice'); assertSanitized(r)
})
test('cross-region discovery is rejected before DCR', async () => {
  const h = harness(); h.resource = { resource: ORIGINS.us + '/mcp', authorization_servers: [ORIGINS.us] }
  await rejects(h.begin(), 'FAILED'); assert.equal(h.calls.filter(c => c.url.endsWith('/connect/register')).length, 0)
})
test('missing S256 discovery fails closed', async () => {
  const h = harness(); h.authorization = { issuer: ORIGINS.eu }
  await rejects(h.begin(), 'FAILED'); assert.equal(h.calls.length, 2)
})
test('DCR refuses unexpected client_secret and mismatched redirects', async () => {
  for (const extra of [{ client_secret: 'DO_NOT_OUTPUT' }, { redirect_uris: ['https://evil.example/cb'] }, { token_endpoint_auth_method: 'client_secret_post' }]) {
    const h = harness(); h.registration = async (_, o) => json({ ...JSON.parse(o.body), client_id: 'client-test', ...extra })
    await rejects(h.begin(), 'REGISTRATION_REJECTED'); assert.equal((await h.api.status('alice')).reauthRequired, true)
  }
})
test('successful exchange persists credentials only in store and sends exact bindings', async () => {
  const h = harness(); const args = await h.begin(); const verifier = h.store.records.get('alice').pending.verifier
  const result = await h.api.complete(args); assert.equal(result.connected, true); assertSanitized(result)
  const req = new URLSearchParams(h.calls.find(c => c.url.endsWith('/oauth2/token')).opts.body)
  assert.equal(req.get('code_verifier'), verifier); assert.equal(req.get('redirect_uri'), REDIRECT)
  assert.equal(req.get('client_id'), args.clientId); assert.equal(req.get('resource'), ORIGINS.eu + '/mcp')
  assert.equal(h.store.records.get('alice').pending, null)
})
test('all callback bindings reject mismatch without consuming valid pending transaction', async () => {
  const h = harness(); const args = await h.begin()
  for (const patch of [{ accountId: 'bob' }, { region: 'us' }, { clientId: 'other' }, { redirectUri: REDIRECT + '/x' }, { generation: 99 }, { state: 'z'.repeat(43) }]) {
    await rejects(h.api.complete({ ...args, ...patch }), 'CALLBACK_REJECTED')
    assert.ok(h.store.records.get('alice').pending)
  }
  assert.equal(h.calls.filter(c => c.url.endsWith('/oauth2/token')).length, 0)
  await h.api.complete(args)
})
test('TTL expiry atomically removes transaction, no token call', async () => {
  const h = harness({ transactionTtlMs: 1000 }); const args = await h.begin(); h.advance(1000)
  await rejects(h.api.complete(args), 'TRANSACTION_EXPIRED'); assert.equal(h.store.records.get('alice').pending, null)
  assert.equal(h.calls.length, 3)
})
test('concurrent/replayed callback gets exactly one code exchange', async () => {
  const h = harness(); const args = await h.begin()
  const results = await Promise.allSettled([h.api.complete(args), h.api.complete(args)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(h.calls.filter(c => c.url.endsWith('/oauth2/token')).length, 1)
  await rejects(h.api.complete(args), 'CALLBACK_REJECTED')
})
test('provider denial consumes state without returning provider error', async () => {
  const h = harness(); const args = await h.begin()
  const result = await h.api.complete({ ...args, code: undefined, error: 'arbitrary-provider-private-text' })
  assert.equal(result.connected, false); assert.ok(!JSON.stringify(result).includes('private'))
  await rejects(h.api.complete(args), 'CALLBACK_REJECTED'); assert.equal(h.calls.length, 3)
})
test('token validation rejects missing scope, expanded scope, token type, expiry, and empty refresh', async () => {
  for (const patch of [{ scope: undefined }, { scope: 'mcp.tools write' }, { scope: 'profile' }, { token_type: 'MAC' }, { expires_in: 0 }, { expires_in: '3600' }, { refresh_token: '' }]) {
    const h = harness(); const args = await h.begin()
    h.token = async () => json({ access_token: 'private', refresh_token: 'private-refresh', token_type: 'Bearer', expires_in: 3600, scope: 'mcp.tools', ...patch })
    await assert.rejects(h.api.complete(args), /^Error: COROS_OAUTH_[A-Z_]+$/u)
    assert.equal(h.store.records.get('alice').credential, null); assert.equal((await h.api.status('alice')).reauthRequired, true)
    await rejects(h.api.complete(args), 'CALLBACK_REJECTED')
  }
})
test('refresh rotates credentials and omitted scope/refresh inherit previous grant', async () => {
  const h = harness(); await h.connect()
  h.token = async () => json({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer', expires_in: 1200, scope: 'mcp.tools' })
  assertSanitized(await h.api.refresh('alice'))
  assert.equal(h.store.records.get('alice').credential.refreshToken, 'new-refresh')
  h.token = async () => json({ access_token: 'third-access', token_type: 'Bearer', expires_in: 600 })
  await h.api.refresh('alice'); assert.equal(h.store.records.get('alice').credential.refreshToken, 'new-refresh')
  const bodies = h.calls.filter(c => c.url.endsWith('/oauth2/token')).map(c => new URLSearchParams(c.opts.body))
  assert.equal(bodies[1].get('refresh_token'), 'test-refresh'); assert.equal(bodies[2].get('refresh_token'), 'new-refresh')
})
test('refresh race is serialized across lifecycle instances sharing store', async () => {
  const h = harness(); await h.connect(); const gate = deferred(); const entered = deferred()
  h.token = async () => { entered.resolve(); return gate.promise }
  const first = h.api.refresh('alice'); await entered.promise
  const secondApi = createCorosMcpOAuth({ store: h.store, redirectUris: [REDIRECT], enabled: true, now: () => 1000000, fetchImpl: h.fetch })
  await rejects(secondApi.refresh('alice'), 'BUSY')
  gate.resolve(json({ access_token: 'rotated', refresh_token: 'rotated-refresh', token_type: 'Bearer', expires_in: 3600 }))
  await first; assert.equal(h.calls.filter(c => c.url.endsWith('/oauth2/token')).length, 2)
})
test('ambiguous refresh failure clears credentials and never retries old token', async () => {
  const h = harness(); await h.connect(); h.token = async () => { throw new Error('private-token-text') }
  await rejects(h.api.refresh('alice'), 'REQUEST_FAILED')
  assert.equal(h.store.records.get('alice').credential, null)
  await rejects(h.api.refresh('alice'), 'REAUTH_REQUIRED')
})
test('disconnect during code exchange invalidates late success and revokes late token', async () => {
  const h = harness(); const args = await h.begin(); const gate = deferred(); const entered = deferred()
  h.token = async () => { entered.resolve(); return gate.promise }
  const completion = h.api.complete(args); await entered.promise
  const result = await h.api.disconnect('alice'); assert.equal(result.generation, args.generation + 1); assertSanitized(result)
  gate.resolve(json({ access_token: 'late-access', refresh_token: 'late-refresh', token_type: 'Bearer', expires_in: 3600, scope: 'mcp.tools' }))
  await rejects(completion, 'STALE'); assert.equal((await h.api.status('alice')).connected, false)
  assert.equal(h.store.records.get('alice').credential, null)
  assert.equal(h.calls.filter(c => c.url.endsWith('/oauth2/revoke')).length, 2)
})
test('disconnect during rotation cannot resurrect connection; revokes old and late new credentials', async () => {
  const h = harness(); await h.connect(); const gate = deferred(); const entered = deferred()
  h.token = async () => { entered.resolve(); return gate.promise }
  const refreshing = h.api.refresh('alice'); await entered.promise
  await h.api.disconnect('alice')
  gate.resolve(json({ access_token: 'late-new', refresh_token: 'late-new-refresh', token_type: 'Bearer', expires_in: 3600 }))
  await rejects(refreshing, 'STALE'); assert.equal((await h.api.status('alice')).connected, false)
  assert.equal(h.calls.filter(c => c.url.endsWith('/oauth2/revoke')).length, 4)
})
test('old callback cannot target a newer connection generation', async () => {
  const h = harness(); const old = await h.begin(); await h.api.disconnect('alice'); const current = await h.begin()
  await rejects(h.api.complete(old), 'CALLBACK_REJECTED'); await h.api.complete(current)
})
test('disconnect locally commits before revocation failure and does not disclose provider body', async () => {
  const h = harness(); await h.connect(); h.revoke = async () => { assert.equal(h.store.records.get('alice').credential, null); return new Response('provider-secret', { status: 500 }) }
  const result = await h.api.disconnect('alice'); assert.equal(result.revocation, 'failed'); assert.equal(result.connected, false); assertSanitized(result)
})
test('response size bounded even without content-length', async () => {
  const h = harness({ maxResponseBytes: 1024 }); const args = await h.begin(); h.token = async () => json({ junk: 'x'.repeat(2000) })
  await rejects(h.api.complete(args), 'RESPONSE_REJECTED')
})
test('content type and redirect responses rejected', async () => {
  for (const response of [new Response('{}', { headers: { 'content-type': 'text/html' } }), new Response('private', { status: 302, headers: { location: 'https://evil.example' } })]) {
    const h = harness(); const args = await h.begin(); h.token = async () => response
    await assert.rejects(h.api.complete(args), /^Error: COROS_OAUTH_[A-Z_]+$/u)
    assert.equal((await h.api.status('alice')).reauthRequired, true)
  }
})
test('timeout bounds non-cooperative fetch and body stream', async () => {
  for (const bodyOnly of [false, true]) {
    const h = harness({ timeoutMs: 20 }); const args = await h.begin()
    h.token = async () => bodyOnly ? new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } }) : new Promise(() => {})
    const start = Date.now(); await rejects(h.api.complete(args), 'REQUEST_FAILED'); assert.ok(Date.now() - start < 1500)
    assert.equal(h.store.records.get('alice').credential, null)
  }
})
test('adapter and provider exceptions are redacted', async () => {
  const h = harness(); const args = await h.begin(); h.token = async () => { throw new Error('VERY_PRIVATE_TOKEN') }
  await assert.rejects(h.api.complete(args), e => e.message === 'COROS_OAUTH_REQUEST_FAILED' && e.cause === undefined)
  const api = createCorosMcpOAuth({ store: { atomic() { throw new Error('database password private') } }, enabled: true, redirectUris: [REDIRECT] })
  await rejects(api.status('alice'), 'FAILED')
})
test('expired refresh operation cannot reuse potentially rotated old token', async () => {
  const h = harness(); await h.connect(); const gate = deferred(); const entered = deferred()
  h.token = async () => { entered.resolve(); return gate.promise }
  const first = h.api.refresh('alice'); await entered.promise; h.advance(11001)
  await rejects(h.api.refresh('alice'), 'REAUTH_REQUIRED')
  gate.resolve(json({ access_token: 'late', token_type: 'Bearer', expires_in: 30 }))
  await rejects(first, 'STALE'); assert.equal(h.store.records.get('alice').credential, null)
})
test('disconnect while DCR is pending cannot publish authorization transaction', async () => {
  const h = harness(); const gate = deferred(); const entered = deferred()
  h.registration = async (_, o) => { entered.resolve(); await gate.promise; return json({ ...JSON.parse(o.body), client_id: 'orphan' }) }
  const begin = h.begin(); await entered.promise; await h.api.disconnect('alice'); gate.resolve()
  await rejects(begin, 'STALE'); assert.equal(h.store.records.get('alice').pending, null)
})

test('missing refresh token becomes explicit reauthorization when refresh is requested', async () => {
  const h = harness(); const args = await h.begin()
  h.token = async () => json({ access_token: 'short-lived', token_type: 'Bearer', expires_in: 60, scope: 'mcp.tools' })
  await h.api.complete(args); await rejects(h.api.refresh('alice'), 'REAUTH_REQUIRED')
  assert.equal((await h.api.status('alice')).reauthRequired, true)
})
test('expanded refresh scope is rejected and old refresh token is not reused', async () => {
  const h = harness(); await h.connect()
  h.token = async () => json({ access_token: 'expanded', refresh_token: 'rotated', token_type: 'Bearer', expires_in: 60, scope: 'mcp.tools admin' })
  await rejects(h.api.refresh('alice'), 'SCOPE_REJECTED')
  assert.equal(h.store.records.get('alice').credential, null)
})
test('malformed combined code/error callback does not consume transaction', async () => {
  const h = harness(); const args = await h.begin()
  await rejects(h.api.complete({ ...args, error: 'access_denied' }), 'INVALID_INPUT')
  assert.ok(h.store.records.get('alice').pending); await h.api.complete(args)
})
test('prefix-shaped secret exception cannot escape redaction allowlist', async () => {
  const api = createCorosMcpOAuth({ store: { atomic() { throw new Error('COROS_OAUTH_PRIVATE_SECRET_VALUE') } }, enabled: true, redirectUris: [REDIRECT] })
  await rejects(api.status('alice'), 'FAILED')
})
test('authorization URL contains state/challenge, never verifier or credentials', async () => {
  const h = harness(); const result = await h.api.begin({ accountId: 'alice', region: 'us', redirectUri: REDIRECT })
  const url = new URL(result.authorizationUrl); const stored = h.store.records.get('alice')
  assert.equal(url.searchParams.get('state'), stored.pending.state)
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  const expected = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stored.pending.verifier))).toString('base64url')
  assert.equal(url.searchParams.get('code_challenge'), expected)
  assert.equal(url.searchParams.get('resource'), ORIGINS.us + '/mcp')
  assert.ok(!result.authorizationUrl.includes(stored.pending.verifier)); assertSanitized(result)
})

// Independent-review regressions. Added and run RED before implementation fixes.
for (const flow of ['complete', 'refresh']) {
  test(`review: ${flow} revokes known credentials even if commit AND failure cleanup DB calls fail`, async () => {
    const h = harness(); const args = flow === 'complete' ? await h.begin() : await h.connect()
    const original = h.store.atomic.bind(h.store); let databaseDown = false
    h.store.atomic = (account, fn) => {
      if (databaseDown) return Promise.reject(new Error('private-cleanup-db-error'))
      return original(account, record => {
        const next = fn(record)
        if (next.record.status === 'connected' && next.result?.connected === true) {
          databaseDown = true; throw new Error('private-commit-db-error')
        }
        return next
      })
    }
    await rejects(flow === 'complete' ? h.api.complete(args) : h.api.refresh('alice'), 'FAILED')
    assert.equal(h.calls.filter(c => c.url.endsWith('/oauth2/revoke')).length, 2)
  })
}
for (const change of ['lease-expiry', 'lease-cleanup', 'disconnect']) {
  test(`review: delayed refresh claim cannot send old refresh token after ${change}`, async () => {
    const h = harness(); await h.connect(); const claimed = deferred(); const release = deferred()
    const original = h.store.atomic.bind(h.store); let delayOnce = true
    h.store.atomic = (account, fn) => original(account, fn).then(async result => {
      if (delayOnce && result?.credential?.refreshToken && result.region) {
        delayOnce = false; claimed.resolve(); await release.promise
      }
      return result
    })
    const operation = h.api.refresh('alice'); await claimed.promise
    if (change === 'disconnect') await h.api.disconnect('alice')
    else {
      h.advance(11001)
      if (change === 'lease-cleanup') await rejects(h.api.refresh('alice'), 'REAUTH_REQUIRED')
    }
    release.resolve(); await rejects(operation, 'STALE')
    // The only token HTTP call must remain the initial code exchange.
    assert.equal(h.calls.filter(c => c.url.endsWith('/oauth2/token')).length, 1)
  })
}
for (const delimiter of ['#', '?']) {
  test(`review: raw empty redirect delimiter ${delimiter} is rejected at construction`, () => {
    assert.throws(() => harness({ redirectUris: [REDIRECT + delimiter] }), { message: 'COROS_OAUTH_INVALID_CONFIG' })
  })
}
function delayedTokenBody(h, delayMs, expiresIn) {
  const bytes = new TextEncoder().encode(JSON.stringify({ access_token: 'delayed-access', refresh_token: 'delayed-refresh',
    token_type: 'Bearer', scope: 'mcp.tools', expires_in: expiresIn }))
  return new Response(new ReadableStream({ pull(controller) {
    h.advance(delayMs); controller.enqueue(bytes); controller.close()
  } }), { headers: { 'content-type': 'application/json' } })
}
for (const flow of ['complete', 'refresh']) {
  test(`review: ${flow} expiry is based on time BEFORE token HTTP, not body completion`, async () => {
    const h = harness(); const args = flow === 'complete' ? await h.begin() : await h.connect()
    h.token = async () => delayedTokenBody(h, 1500, 60)
    assertSanitized(await (flow === 'complete' ? h.api.complete(args) : h.api.refresh('alice')))
    assert.equal(h.store.records.get('alice').credential.expiresAt, 1000000 + 60000)
  })
  test(`review: ${flow} token already expired at body completion is rejected and revoked`, async () => {
    const h = harness(); const args = flow === 'complete' ? await h.begin() : await h.connect()
    h.token = async () => delayedTokenBody(h, 1000, 1)
    await rejects(flow === 'complete' ? h.api.complete(args) : h.api.refresh('alice'), 'TOKEN_REJECTED')
    assert.equal(h.store.records.get('alice').credential, null)
    assert.equal(h.calls.filter(c => c.url.endsWith('/oauth2/revoke')).length, 2)
  })
}
