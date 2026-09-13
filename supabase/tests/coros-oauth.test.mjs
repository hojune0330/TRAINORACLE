import test from "node:test"
import assert from "node:assert/strict"
import {
  COROS_ACCESS_TOKEN_ENDPOINT,
  COROS_AUTHORIZE_ENDPOINT,
  COROS_DEAUTHORIZE_ENDPOINT,
  COROS_OAUTH_STATE_LENGTH,
  COROS_OAUTH_STATE_TTL_MS,
  COROS_REFRESH_TOKEN_ENDPOINT,
  MAX_COROS_OAUTH_RESPONSE_BYTES,
  completeCorosOAuthCallback,
  createCorosAuthorizationUrl,
  createCorosCodeExchangeRequest,
  createCorosDeauthorizationRequest,
  createCorosOAuthState,
  createCorosRefreshRequest,
  generateCorosOAuthState,
  hashCorosOAuthState,
  parseCorosAuthorizationCallback,
  parseCorosDeauthorizationResponse,
  parseCorosRefreshResponse,
  parseCorosTokenResponse,
  startCorosOAuthConsent,
} from "../functions/_shared/coros-oauth.mjs"

const clientId = "a".repeat(32)
const clientSecret = "synthetic-secret-value"
const redirectUri = "https://texspxlpjungyarkvtkc.supabase.co/functions/v1/coros-oauth-callback"
const accessToken = "a".repeat(32)
const documentedAccessToken = `rg1-${"a".repeat(32)}`
const refreshToken = "r".repeat(64)
const openId = "o".repeat(32)
const authenticatedUserId = "a1111111-1111-4111-8111-111111111111"

test("credential-bearing requests never follow redirects", () => {
  for (const request of [
    createCorosCodeExchangeRequest({ clientId, clientSecret, redirectUri, code: "synthetic-code" }),
    createCorosRefreshRequest({ clientId, clientSecret, refreshToken }),
    createCorosDeauthorizationRequest({ accessToken }),
  ]) assert.equal(request.redirect, "error")
})

function jsonResponse(payload, options = {}) {
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": options.contentType ?? "application/json; charset=utf-8" },
  })
}

function snakeTokenPayload(overrides = {}) {
  return {
    expires_in: 2_592_000,
    refresh_token: refreshToken,
    access_token: accessToken,
    openId,
    ...overrides,
  }
}

test("state uses unbiased cryptographic bytes, the documented alphabet, and SHA-256", async () => {
  const first = generateCorosOAuthState()
  const second = generateCorosOAuthState()
  assert.equal(first.length, COROS_OAUTH_STATE_LENGTH)
  assert.match(first, /^[A-Za-z0-9]+$/u)
  assert.notEqual(first, second)
  assert.match(await hashCorosOAuthState(first), /^[0-9a-f]{64}$/u)
  const created = await createCorosOAuthState()
  assert.equal(created.stateHash, await hashCorosOAuthState(created.state))
  await assert.rejects(hashCorosOAuthState("not_allowed!"), { message: "COROS_OAUTH_INVALID" })
})

test("authorization URL is fixed to COROS and preserves the exact configured HTTPS callback", () => {
  const state = "S".repeat(64)
  const authorization = new URL(createCorosAuthorizationUrl({ clientId, redirectUri, state }))
  assert.equal(COROS_AUTHORIZE_ENDPOINT, "https://open.coros.com/oauth2/authorize")
  assert.equal(`${authorization.origin}${authorization.pathname}`, "https://open.coros.com/oauth2/authorize")
  assert.deepEqual(Object.fromEntries(authorization.searchParams), {
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
  })
  assert.throws(() => createCorosAuthorizationUrl({ clientId, redirectUri: redirectUri.replace("https:", "http:"), state }))
  assert.throws(() => createCorosAuthorizationUrl({ clientId, redirectUri: "https://example.test/callback#fragment", state }))
  assert.throws(() => createCorosAuthorizationUrl({ clientId, redirectUri: "https://example.test/callback?state=fixed", state }))
})

test("matching callback state yields only the bounded authorization code", async () => {
  const state = "A1b2".repeat(16)
  const result = await parseCorosAuthorizationCallback({
    callbackUrl: `${redirectUri}?code=rg1-synthetic_code.1&state=${state}`,
    redirectUri,
    expectedStateHash: await hashCorosOAuthState(state),
  })
  assert.deepEqual(result, { kind: "authorized", code: "rg1-synthetic_code.1" })
  assert.equal(result.state, undefined)
})

test("state-only callback represents user denial without inventing an error or code", async () => {
  const state = "DeniedState123"
  const result = await parseCorosAuthorizationCallback({
    callbackUrl: `${redirectUri}?state=${state}`,
    redirectUri,
    expectedStateHash: await hashCorosOAuthState(state),
  })
  assert.deepEqual(result, { kind: "denied" })
  assert.equal(result.code, undefined)
  assert.equal(result.error, undefined)
})

test("callback rejects missing, empty, unknown, and duplicate protocol parameters", async () => {
  const state = "CallbackState123"
  const expectedStateHash = await hashCorosOAuthState(state)
  const invalidCallbacks = [
    `${redirectUri}?code=code-only`,
    `${redirectUri}?code=&state=${state}`,
    `${redirectUri}?code=one&code=two&state=${state}`,
    `${redirectUri}?code=one&state=${state}&state=${state}`,
    `${redirectUri}?state=`,
    `${redirectUri}?state=${state}&error=access_denied`,
  ]
  for (const callbackUrl of invalidCallbacks) {
    await assert.rejects(parseCorosAuthorizationCallback({ callbackUrl, redirectUri, expectedStateHash }),
      { message: "COROS_OAUTH_CALLBACK_INVALID" })
  }
})

test("callback rejects state mismatch and any origin, path, or fragment drift", async () => {
  const state = "BoundState123"
  const expectedStateHash = await hashCorosOAuthState(state)
  await assert.rejects(parseCorosAuthorizationCallback({
    callbackUrl: `${redirectUri}?state=DifferentState123`, redirectUri, expectedStateHash,
  }), { message: "COROS_OAUTH_STATE_MISMATCH" })
  for (const callbackUrl of [
    `https://example.test/callback?state=${state}`,
    `${redirectUri}/other?state=${state}`,
    `${redirectUri}?state=${state}#fragment`,
  ]) {
    await assert.rejects(parseCorosAuthorizationCallback({ callbackUrl, redirectUri, expectedStateHash }),
      { message: "COROS_OAUTH_CALLBACK_INVALID" })
  }
})

test("configured callback query is preserved exactly before OAuth parameters", async () => {
  const configured = `${redirectUri}?flow=coros`
  const state = "QueryState123"
  const expectedStateHash = await hashCorosOAuthState(state)
  assert.equal(new URL(createCorosAuthorizationUrl({ clientId, redirectUri: configured, state }))
    .searchParams.get("redirect_uri"), configured)
  assert.deepEqual(await parseCorosAuthorizationCallback({
    callbackUrl: `${configured}&code=valid-code&state=${state}`,
    redirectUri: configured,
    expectedStateHash,
  }), { kind: "authorized", code: "valid-code" })
  await assert.rejects(parseCorosAuthorizationCallback({
    callbackUrl: `${redirectUri}?flow=changed&state=${state}`,
    redirectUri: configured,
    expectedStateHash,
  }), { message: "COROS_OAUTH_CALLBACK_INVALID" })
})

test("code exchange is a fixed form request with the same callback and no undocumented user_id", async () => {
  const request = createCorosCodeExchangeRequest({
    clientId, clientSecret, redirectUri, code: "rg1-synthetic-code",
  })
  assert.equal(COROS_ACCESS_TOKEN_ENDPOINT, "https://open.coros.com/oauth2/accesstoken")
  assert.equal(request.url, "https://open.coros.com/oauth2/accesstoken")
  assert.equal(request.method, "POST")
  assert.equal(request.headers.get("content-type"), "application/x-www-form-urlencoded")
  const form = new URLSearchParams(await request.text())
  assert.deepEqual(Object.fromEntries(form), {
    client_id: clientId,
    redirect_uri: redirectUri,
    code: "rg1-synthetic-code",
    client_secret: clientSecret,
    grant_type: "authorization_code",
  })
  assert.equal(form.has("user_id"), false)
  assert.throws(() => createCorosCodeExchangeRequest({
    clientId, clientSecret, redirectUri, code: "x".repeat(65),
  }))
})

test("token response accepts the documented snake and camel spellings", async () => {
  assert.deepEqual(await parseCorosTokenResponse(jsonResponse(snakeTokenPayload())), {
    accessToken, refreshToken, openId, expiresInSeconds: 2_592_000,
  })
  assert.deepEqual(await parseCorosTokenResponse(jsonResponse({
    expiresIn: 60,
    refreshToken,
    accessToken,
    openId,
  })), { accessToken, refreshToken, openId, expiresInSeconds: 60 })
  assert.deepEqual(await parseCorosTokenResponse(jsonResponse({
    ...snakeTokenPayload(),
    expiresIn: 2_592_000,
    refreshToken,
    accessToken,
  })), { accessToken, refreshToken, openId, expiresInSeconds: 2_592_000 })
})

test("token response rejects conflicting aliases, unknown fields, and malformed values", async () => {
  const invalidPayloads = [
    snakeTokenPayload({ expiresIn: 1 }),
    snakeTokenPayload({ accessToken: "different" }),
    snakeTokenPayload({ token_type: "Bearer" }),
    snakeTokenPayload({ expires_in: 0 }),
    snakeTokenPayload({ expires_in: 2_147_483_648 }),
    snakeTokenPayload({ access_token: "a".repeat(65) }),
    snakeTokenPayload({ refresh_token: "r".repeat(65) }),
    snakeTokenPayload({ openId: "o".repeat(33) }),
    { expires_in: 60, access_token: accessToken, openId },
    [],
  ]
  for (const payload of invalidPayloads) {
    await assert.rejects(parseCorosTokenResponse(jsonResponse(payload)),
      { message: "COROS_OAUTH_RESPONSE_INVALID" })
  }
})

test("token response enforces HTTP, JSON, UTF-8, and streamed byte bounds", async () => {
  await assert.rejects(parseCorosTokenResponse(jsonResponse(snakeTokenPayload(), { status: 500 })),
    { message: "COROS_OAUTH_HTTP_ERROR" })
  await assert.rejects(parseCorosTokenResponse(jsonResponse(snakeTokenPayload(), { contentType: "text/plain" })),
    { message: "COROS_OAUTH_RESPONSE_INVALID" })
  await assert.rejects(parseCorosTokenResponse(jsonResponse("{")),
    { message: "COROS_OAUTH_RESPONSE_INVALID" })
  await assert.rejects(parseCorosTokenResponse(new Response(new Uint8Array([0xff]), {
    headers: { "content-type": "application/json" },
  })), { message: "COROS_OAUTH_RESPONSE_INVALID" })
  await assert.rejects(parseCorosTokenResponse(jsonResponse(" ".repeat(MAX_COROS_OAUTH_RESPONSE_BYTES + 1))),
    { message: "COROS_OAUTH_RESPONSE_TOO_LARGE" })
})

test("refresh request is fixed and acknowledgement does not fabricate rotated credentials", async () => {
  const request = createCorosRefreshRequest({ clientId, clientSecret, refreshToken })
  assert.equal(COROS_REFRESH_TOKEN_ENDPOINT, "https://open.coros.com/oauth2/refresh-token")
  assert.equal(request.url, "https://open.coros.com/oauth2/refresh-token")
  assert.deepEqual(Object.fromEntries(new URLSearchParams(await request.text())), {
    client_id: clientId,
    refresh_token: refreshToken,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  })
  const acknowledged = await parseCorosRefreshResponse(jsonResponse({ result: "0000", message: "OK" }))
  assert.deepEqual(acknowledged, { kind: "acknowledged", result: "0000", message: "OK" })
  assert.equal(acknowledged.accessToken, undefined)
  assert.equal(acknowledged.expiresInSeconds, undefined)
  assert.deepEqual(await parseCorosRefreshResponse(jsonResponse({ result: "1001", message: "Denied" })), {
    kind: "rejected", result: "1001", message: "Denied",
  })
})

test("refresh reports rotated credentials only when a complete token payload is returned", async () => {
  assert.deepEqual(await parseCorosRefreshResponse(jsonResponse(snakeTokenPayload())), {
    kind: "rotated", accessToken, refreshToken, openId, expiresInSeconds: 2_592_000,
  })
  await assert.rejects(parseCorosRefreshResponse(jsonResponse({
    ...snakeTokenPayload(), result: "0000", message: "OK",
  })), { message: "COROS_OAUTH_RESPONSE_INVALID" })
  await assert.rejects(parseCorosRefreshResponse(jsonResponse({ result: "0000" })),
    { message: "COROS_OAUTH_RESPONSE_INVALID" })
})

test("deauthorization sends the access token only in the table-specified header", async () => {
  const request = createCorosDeauthorizationRequest({ accessToken: documentedAccessToken })
  assert.equal(COROS_DEAUTHORIZE_ENDPOINT, "https://open.coros.com/oauth2/deauthorize")
  assert.equal(request.url, "https://open.coros.com/oauth2/deauthorize")
  assert.equal(new URL(request.url).search, "")
  assert.equal(request.method, "POST")
  assert.equal(request.headers.get("token"), documentedAccessToken)
  assert.equal(request.headers.has("authorization"), false)
  assert.equal(await request.text(), "")
  assert.deepEqual(await parseCorosDeauthorizationResponse(jsonResponse({ result: "0000", message: "OK" })), {
    kind: "acknowledged", result: "0000", message: "OK",
  })
  assert.throws(() => createCorosDeauthorizationRequest({ accessToken: "x".repeat(65) }))
})

test("documented rg1 access-token shape is accepted within the official 64-byte bound", async () => {
  assert.equal(documentedAccessToken.length, 36)
  assert.deepEqual(await parseCorosTokenResponse(jsonResponse(snakeTokenPayload({
    access_token: documentedAccessToken,
  }))), {
    accessToken: documentedAccessToken,
    refreshToken,
    openId,
    expiresInSeconds: 2_592_000,
  })
})

test("consent start stores only a user-bound state hash before returning authorization URL", async () => {
  let record
  const nowMs = Date.parse("2026-09-12T00:00:00.000Z")
  const result = await startCorosOAuthConsent({
    authenticatedUserId,
    clientId,
    redirectUri,
    nowMs,
    repository: { createPendingState: async value => { record = value; return true } },
  })
  assert.equal(result.status, "authorization_required")
  assert.equal(Object.keys(result).sort().join(","), "authorizationUrl,status")
  const authorization = new URL(result.authorizationUrl)
  const rawState = authorization.searchParams.get("state")
  assert.equal(`${authorization.origin}${authorization.pathname}`, "https://open.coros.com/oauth2/authorize")
  assert.equal(record.provider, "COROS")
  assert.equal(record.userId, authenticatedUserId)
  assert.equal(record.stateHash, await hashCorosOAuthState(rawState))
  assert.equal(record.redirectUri, redirectUri)
  assert.equal(record.createdAtMs, nowMs)
  assert.equal(record.expiresAtMs, nowMs + COROS_OAUTH_STATE_TTL_MS)
  assert.equal(record.state, undefined)
  assert.equal(JSON.stringify(record).includes(rawState), false)
  assert.equal(JSON.stringify(record).includes(clientSecret), false)
})

test("consent start fails closed when repository does not create the state record", async () => {
  for (const createPendingState of [async () => false, async () => { throw new Error("synthetic private failure") }]) {
    const result = await startCorosOAuthConsent({
      authenticatedUserId, clientId, redirectUri,
      repository: { createPendingState },
    })
    assert.deepEqual(result, { status: "state_creation_failed" })
  }
  assert.deepEqual(await startCorosOAuthConsent({
    authenticatedUserId: "not-authenticated", clientId, redirectUri, repository: {},
  }), { status: "invalid_request" })
})

test("callback claims repository state before exchange and returns no browser credentials", async () => {
  const state = "LifecycleState123"
  const calls = []
  let storedRecord
  const result = await completeCorosOAuthCallback({
    authenticatedUserId,
    clientId,
    clientSecret,
    redirectUri,
    callbackUrl: `${redirectUri}?code=rg1-lifecycle-code&state=${state}`,
    nowMs: 123456,
    repository: {
      claimPendingState: async record => { calls.push(["claim", record]); return true },
      storeTokenSet: async record => { calls.push(["store", record]); storedRecord = record; return true },
    },
    transport: {
      exchangeCode: async request => {
        calls.push(["exchange", request])
        return jsonResponse(snakeTokenPayload())
      },
    },
  })
  assert.deepEqual(result, { status: "authorization_persisted" })
  assert.deepEqual(calls.map(([name]) => name), ["claim", "exchange", "store"])
  assert.equal(calls[0][1].stateHash, await hashCorosOAuthState(state))
  assert.equal(calls[0][1].userId, authenticatedUserId)
  assert.equal(calls[0][1].claimedAtMs, 123456)
  assert.equal(storedRecord.stateHash, calls[0][1].stateHash)
  assert.equal(storedRecord.redirectUri, calls[0][1].redirectUri)
  assert.equal(storedRecord.userId, calls[0][1].userId)
  assert.equal(storedRecord.tokenSet.accessToken, accessToken)
  assert.equal(storedRecord.tokenSet.refreshToken, refreshToken)
  assert.deepEqual(Object.keys(result), ["status"])
  assert.equal(JSON.stringify(result).includes(accessToken), false)
  assert.equal(JSON.stringify(result).includes(refreshToken), false)
  assert.equal(JSON.stringify(result).includes(openId), false)
  assert.equal(JSON.stringify(result).includes("rg1-lifecycle-code"), false)
})

test("failed state claim never exchanges a code or stores credentials", async () => {
  let exchanges = 0
  let stores = 0
  for (const claimPendingState of [async () => false, async () => { throw new Error("synthetic race loss") }]) {
    const state = generateCorosOAuthState()
    const result = await completeCorosOAuthCallback({
      authenticatedUserId, clientId, clientSecret, redirectUri,
      callbackUrl: `${redirectUri}?code=rg1-never-exchange&state=${state}`,
      repository: {
        claimPendingState,
        storeTokenSet: async () => { stores += 1; return true },
      },
      transport: {
        exchangeCode: async () => { exchanges += 1; return jsonResponse(snakeTokenPayload()) },
      },
    })
    assert.deepEqual(result, { status: "state_rejected" })
  }
  assert.equal(exchanges, 0)
  assert.equal(stores, 0)
})

test("repository atomic claim is the explicit callback race boundary", async () => {
  const state = generateCorosOAuthState()
  let alreadyClaimed = false
  let exchanges = 0
  const repository = {
    claimPendingState: async () => {
      if (alreadyClaimed) return false
      alreadyClaimed = true
      await Promise.resolve()
      return true
    },
    storeTokenSet: async () => true,
  }
  const transport = {
    exchangeCode: async () => { exchanges += 1; return jsonResponse(snakeTokenPayload()) },
  }
  const input = {
    authenticatedUserId, clientId, clientSecret, redirectUri, repository, transport,
    callbackUrl: `${redirectUri}?code=rg1-race&state=${state}`,
  }
  const results = await Promise.all([
    completeCorosOAuthCallback(input),
    completeCorosOAuthCallback(input),
  ])
  assert.deepEqual(results.map(result => result.status).sort(), ["authorization_persisted", "state_rejected"])
  assert.equal(exchanges, 1)
})

test("denial consumes state but performs no exchange and returns only a safe status", async () => {
  const state = generateCorosOAuthState()
  let claims = 0
  let exchanges = 0
  let stores = 0
  const result = await completeCorosOAuthCallback({
    authenticatedUserId, clientId, clientSecret, redirectUri,
    callbackUrl: `${redirectUri}?state=${state}`,
    repository: {
      claimPendingState: async () => { claims += 1; return true },
      storeTokenSet: async () => { stores += 1; return true },
    },
    transport: {
      exchangeCode: async () => { exchanges += 1; return jsonResponse(snakeTokenPayload()) },
    },
  })
  assert.deepEqual(result, { status: "authorization_denied" })
  assert.equal(claims, 1)
  assert.equal(exchanges, 0)
  assert.equal(stores, 0)
})

test("exchange and encrypted-storage adapter failures collapse to safe non-token statuses", async () => {
  const state = generateCorosOAuthState()
  const base = {
    authenticatedUserId, clientId, clientSecret, redirectUri,
    callbackUrl: `${redirectUri}?code=rg1-failure&state=${state}`,
  }
  assert.deepEqual(await completeCorosOAuthCallback({
    ...base,
    repository: { claimPendingState: async () => true, storeTokenSet: async () => true },
    transport: { exchangeCode: async () => jsonResponse({ result: "0000", message: "not a token set" }) },
  }), { status: "exchange_failed" })
  assert.deepEqual(await completeCorosOAuthCallback({
    ...base,
    repository: { claimPendingState: async () => true, storeTokenSet: async () => false },
    transport: { exchangeCode: async () => jsonResponse(snakeTokenPayload()) },
  }), { status: "storage_failed" })
})

test("lifecycle never writes repository or transport failures to console", async () => {
  const original = { log: console.log, warn: console.warn, error: console.error }
  let writes = 0
  console.log = console.warn = console.error = () => { writes += 1 }
  try {
    assert.deepEqual(await startCorosOAuthConsent({
      authenticatedUserId, clientId, redirectUri,
      repository: { createPendingState: async () => { throw new Error("private create detail") } },
    }), { status: "state_creation_failed" })

    const state = generateCorosOAuthState()
    const base = {
      authenticatedUserId, clientId, clientSecret, redirectUri,
      callbackUrl: `${redirectUri}?code=rg1-private-failure&state=${state}`,
    }
    assert.deepEqual(await completeCorosOAuthCallback({
      ...base,
      repository: {
        claimPendingState: async () => { throw new Error("private claim detail") },
        storeTokenSet: async () => true,
      },
      transport: { exchangeCode: async () => { throw new Error("must not run") } },
    }), { status: "state_rejected" })
    assert.deepEqual(await completeCorosOAuthCallback({
      ...base,
      repository: { claimPendingState: async () => true, storeTokenSet: async () => true },
      transport: { exchangeCode: async () => { throw new Error("private provider detail") } },
    }), { status: "exchange_failed" })
    assert.deepEqual(await completeCorosOAuthCallback({
      ...base,
      repository: {
        claimPendingState: async () => true,
        storeTokenSet: async () => { throw new Error("private storage detail") },
      },
      transport: { exchangeCode: async () => jsonResponse(snakeTokenPayload()) },
    }), { status: "storage_failed" })
  } finally {
    console.log = original.log
    console.warn = original.warn
    console.error = original.error
  }
  assert.equal(writes, 0)
})
