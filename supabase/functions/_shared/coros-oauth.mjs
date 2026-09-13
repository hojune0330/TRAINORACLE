// COROS Partner API V2.1.1 protocol primitives only. No fetch, storage, or logging.
export const COROS_AUTHORIZE_ENDPOINT = "https://open.coros.com/oauth2/authorize"
export const COROS_ACCESS_TOKEN_ENDPOINT = "https://open.coros.com/oauth2/accesstoken"
export const COROS_REFRESH_TOKEN_ENDPOINT = "https://open.coros.com/oauth2/refresh-token"
export const COROS_DEAUTHORIZE_ENDPOINT = "https://open.coros.com/oauth2/deauthorize"
export const COROS_OAUTH_STATE_LENGTH = 64
export const COROS_OAUTH_STATE_TTL_MS = 30 * 60 * 1000
export const MAX_COROS_OAUTH_RESPONSE_BYTES = 16 * 1024

const STATE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
const STATE_MAX_BYTES = 128
const REDIRECT_URI_MAX_BYTES = 200
const CLIENT_ID_MAX_BYTES = 32
const CLIENT_SECRET_MAX_BYTES = 128
const CODE_MAX_BYTES = 64
const ACCESS_TOKEN_MAX_BYTES = 64
const REFRESH_TOKEN_MAX_BYTES = 64
const OPEN_ID_MAX_BYTES = 32
const MAX_SIGNED_INT32 = 2_147_483_647
const encoder = new TextEncoder()
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function invalid(code = "COROS_OAUTH_INVALID") {
  return new Error(code)
}

function byteLength(value) {
  return encoder.encode(value).byteLength
}

function requirePattern(value, pattern, maxBytes) {
  if (typeof value !== "string" || byteLength(value) > maxBytes || !pattern.test(value)) {
    throw invalid()
  }
  return value
}

function requireClientId(value) {
  return requirePattern(value, /^[A-Za-z0-9]{1,32}$/u, CLIENT_ID_MAX_BYTES)
}

function requireClientSecret(value) {
  return requirePattern(value, /^[\x21-\x7e]{1,128}$/u, CLIENT_SECRET_MAX_BYTES)
}

function requireCode(value) {
  return requirePattern(value, /^[A-Za-z0-9._~-]{1,64}$/u, CODE_MAX_BYTES)
}

function requireState(value) {
  return requirePattern(value, /^[A-Za-z0-9]{1,128}$/u, STATE_MAX_BYTES)
}

function requireUserId(value) {
  if (typeof value !== "string" || !uuid.test(value)) throw invalid()
  return value.toLowerCase()
}

function requireNowMs(value) {
  if (!Number.isSafeInteger(value) || value < 0
    || value > 8_640_000_000_000_000 - COROS_OAUTH_STATE_TTL_MS) {
    throw invalid()
  }
  return value
}

function requireToken(value, maxBytes) {
  return requirePattern(value, /^[\x21-\x7e]+$/u, maxBytes)
}

function requireRedirectUri(value) {
  try {
    if (typeof value !== "string" || byteLength(value) > REDIRECT_URI_MAX_BYTES) throw invalid()
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hash !== ""
      || url.href !== value || url.searchParams.has("code") || url.searchParams.has("state")) {
      throw invalid()
    }
    return url
  } catch {
    throw invalid()
  }
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")
}

export function generateCorosOAuthState() {
  const result = []
  const unbiasedUpperBound = 256 - (256 % STATE_ALPHABET.length)
  while (result.length < COROS_OAUTH_STATE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(COROS_OAUTH_STATE_LENGTH))
    for (const byte of bytes) {
      if (byte < unbiasedUpperBound) result.push(STATE_ALPHABET[byte % STATE_ALPHABET.length])
      if (result.length === COROS_OAUTH_STATE_LENGTH) break
    }
  }
  return result.join("")
}

export async function hashCorosOAuthState(state) {
  return sha256Hex(requireState(state))
}

export async function createCorosOAuthState() {
  const state = generateCorosOAuthState()
  return Object.freeze({ state, stateHash: await hashCorosOAuthState(state) })
}

export function createCorosAuthorizationUrl({ clientId, redirectUri, state }) {
  const callback = requireRedirectUri(redirectUri)
  const url = new URL(COROS_AUTHORIZE_ENDPOINT)
  url.searchParams.set("client_id", requireClientId(clientId))
  url.searchParams.set("redirect_uri", callback.href)
  url.searchParams.set("state", requireState(state))
  url.searchParams.set("response_type", "code")
  return url.href
}

function remainingCallbackParameters(callbackUrl, redirectUri) {
  try {
    const expected = requireRedirectUri(redirectUri)
    const actual = callbackUrl instanceof URL ? new URL(callbackUrl.href) : new URL(callbackUrl)
    if (actual.protocol !== "https:" || actual.username !== "" || actual.password !== ""
      || actual.hash !== "" || actual.origin !== expected.origin || actual.pathname !== expected.pathname) {
      throw invalid("COROS_OAUTH_CALLBACK_INVALID")
    }

    const remaining = [...actual.searchParams.entries()]
    for (const pair of expected.searchParams.entries()) {
      const index = remaining.findIndex(candidate => candidate[0] === pair[0] && candidate[1] === pair[1])
      if (index === -1) throw invalid("COROS_OAUTH_CALLBACK_INVALID")
      remaining.splice(index, 1)
    }
    if (remaining.some(([key]) => key !== "code" && key !== "state")) {
      throw invalid("COROS_OAUTH_CALLBACK_INVALID")
    }
    return remaining
  } catch (error) {
    if (error?.message === "COROS_OAUTH_CALLBACK_INVALID") throw error
    throw invalid("COROS_OAUTH_CALLBACK_INVALID")
  }
}

function singleCallbackParameter(parameters, name, required) {
  const values = parameters.filter(([key]) => key === name).map(([, value]) => value)
  if (values.length > 1 || (required && values.length !== 1)) {
    throw invalid("COROS_OAUTH_CALLBACK_INVALID")
  }
  return values.length === 1 ? values[0] : null
}

function parseCallbackEnvelope(callbackUrl, redirectUri) {
  const parameters = remainingCallbackParameters(callbackUrl, redirectUri)
  const state = singleCallbackParameter(parameters, "state", true)
  try {
    requireState(state)
    const rawCode = singleCallbackParameter(parameters, "code", false)
    return Object.freeze({ state, code: rawCode === null ? null : requireCode(rawCode) })
  } catch {
    throw invalid("COROS_OAUTH_CALLBACK_INVALID")
  }
}

function equalHex(left, right) {
  if (!/^[0-9a-f]{64}$/u.test(left) || !/^[0-9a-f]{64}$/u.test(right)) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

// The caller must atomically consume the stored hash and enforce account/expiry binding.
export async function parseCorosAuthorizationCallback({ callbackUrl, redirectUri, expectedStateHash }) {
  const { state, code } = parseCallbackEnvelope(callbackUrl, redirectUri)
  const stateHash = await hashCorosOAuthState(state)
  if (typeof expectedStateHash !== "string" || !equalHex(stateHash, expectedStateHash)) {
    throw invalid("COROS_OAUTH_STATE_MISMATCH")
  }

  if (code === null) return Object.freeze({ kind: "denied" })
  return Object.freeze({ kind: "authorized", code })
}

function formRequest(endpoint, entries) {
  try {
    const body = new URLSearchParams(entries)
    return new Request(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    })
  } catch {
    throw invalid()
  }
}

export function createCorosCodeExchangeRequest({ clientId, clientSecret, redirectUri, code }) {
  const callback = requireRedirectUri(redirectUri)
  return formRequest(COROS_ACCESS_TOKEN_ENDPOINT, [
    ["client_id", requireClientId(clientId)],
    ["redirect_uri", callback.href],
    ["code", requireCode(code)],
    ["client_secret", requireClientSecret(clientSecret)],
    ["grant_type", "authorization_code"],
  ])
}

export function createCorosRefreshRequest({ clientId, clientSecret, refreshToken }) {
  return formRequest(COROS_REFRESH_TOKEN_ENDPOINT, [
    ["client_id", requireClientId(clientId)],
    ["refresh_token", requireToken(refreshToken, REFRESH_TOKEN_MAX_BYTES)],
    ["client_secret", requireClientSecret(clientSecret)],
    ["grant_type", "refresh_token"],
  ])
}

export function createCorosDeauthorizationRequest({ accessToken }) {
  try {
    return new Request(COROS_DEAUTHORIZE_ENDPOINT, {
      method: "POST",
      redirect: "error",
      headers: {
        accept: "application/json",
        token: requireToken(accessToken, ACCESS_TOKEN_MAX_BYTES),
      },
    })
  } catch {
    throw invalid()
  }
}

async function readBoundedJson(response) {
  if (!response || typeof response.status !== "number" || !response.headers
    || response.status < 200 || response.status > 299) {
    throw invalid("COROS_OAUTH_HTTP_ERROR")
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase()
  if (contentType !== "application/json" || !response.body?.getReader) {
    throw invalid("COROS_OAUTH_RESPONSE_INVALID")
  }

  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_COROS_OAUTH_RESPONSE_BYTES) {
        try { await reader.cancel() } catch { /* response is already rejected */ }
        throw invalid("COROS_OAUTH_RESPONSE_TOO_LARGE")
      }
      chunks.push(value)
    }
  } finally {
    try { reader.releaseLock() } catch { /* no sensitive error detail escapes */ }
  }

  try {
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch {
    throw invalid("COROS_OAUTH_RESPONSE_INVALID")
  }
}

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    throw invalid("COROS_OAUTH_RESPONSE_INVALID")
  }
  return value
}

function rejectUnknownKeys(value, allowed) {
  if (Object.keys(value).some(key => !allowed.has(key))) {
    throw invalid("COROS_OAUTH_RESPONSE_INVALID")
  }
}

function aliased(value, camel, snake) {
  const hasCamel = Object.hasOwn(value, camel)
  const hasSnake = Object.hasOwn(value, snake)
  if (!hasCamel && !hasSnake) throw invalid("COROS_OAUTH_RESPONSE_INVALID")
  if (hasCamel && hasSnake && !Object.is(value[camel], value[snake])) {
    throw invalid("COROS_OAUTH_RESPONSE_INVALID")
  }
  return hasCamel ? value[camel] : value[snake]
}

function normalizeTokenPayload(payload) {
  const value = requireObject(payload)
  rejectUnknownKeys(value, new Set([
    "expiresIn", "expires_in", "refreshToken", "refresh_token",
    "accessToken", "access_token", "openId",
  ]))
  const expiresInSeconds = aliased(value, "expiresIn", "expires_in")
  if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds < 1
    || expiresInSeconds > MAX_SIGNED_INT32) {
    throw invalid("COROS_OAUTH_RESPONSE_INVALID")
  }
  try {
    return Object.freeze({
      accessToken: requireToken(aliased(value, "accessToken", "access_token"), ACCESS_TOKEN_MAX_BYTES),
      refreshToken: requireToken(aliased(value, "refreshToken", "refresh_token"), REFRESH_TOKEN_MAX_BYTES),
      openId: requireToken(value.openId, OPEN_ID_MAX_BYTES),
      expiresInSeconds,
    })
  } catch {
    throw invalid("COROS_OAUTH_RESPONSE_INVALID")
  }
}

function normalizeAcknowledgement(payload) {
  const value = requireObject(payload)
  rejectUnknownKeys(value, new Set(["result", "message"]))
  if (!Object.hasOwn(value, "result") || !Object.hasOwn(value, "message")) {
    throw invalid("COROS_OAUTH_RESPONSE_INVALID")
  }
  try {
    const result = requirePattern(value.result, /^[A-Za-z0-9_-]{1,32}$/u, 32)
    if (typeof value.message !== "string" || byteLength(value.message) > 256
      || /[\u0000-\u001f\u007f]/u.test(value.message)) {
      throw invalid()
    }
    return Object.freeze({
      kind: result === "0000" ? "acknowledged" : "rejected",
      result,
      message: value.message,
    })
  } catch {
    throw invalid("COROS_OAUTH_RESPONSE_INVALID")
  }
}

export async function parseCorosTokenResponse(response) {
  return normalizeTokenPayload(await readBoundedJson(response))
}

export async function parseCorosRefreshResponse(response) {
  const payload = await readBoundedJson(response)
  const value = requireObject(payload)
  const keys = Object.keys(value)
  if (keys.every(key => key === "result" || key === "message")) {
    return normalizeAcknowledgement(value)
  }
  return Object.freeze({ kind: "rotated", ...normalizeTokenPayload(value) })
}

export async function parseCorosDeauthorizationResponse(response) {
  return normalizeAcknowledgement(await readBoundedJson(response))
}

function lifecycleStatus(status, authorizationUrl) {
  return Object.freeze(authorizationUrl === undefined ? { status } : { status, authorizationUrl })
}

/**
 * authenticatedUserId must come from a server-verified session, never client input.
 * repository.createPendingState(record) must bind the hash to the authenticated user.
 * Only the authorization URL carries the raw state; the repository record never does.
 */
export async function startCorosOAuthConsent({
  authenticatedUserId,
  clientId,
  redirectUri,
  repository,
  nowMs = Date.now(),
}) {
  let userId
  let callback
  let createdAtMs
  try {
    userId = requireUserId(authenticatedUserId)
    requireClientId(clientId)
    callback = requireRedirectUri(redirectUri).href
    createdAtMs = requireNowMs(nowMs)
    if (typeof repository?.createPendingState !== "function") throw invalid()
  } catch {
    return lifecycleStatus("invalid_request")
  }

  const { state, stateHash } = await createCorosOAuthState()
  let created = false
  try {
    created = await repository.createPendingState(Object.freeze({
      provider: "COROS",
      userId,
      stateHash,
      redirectUri: callback,
      createdAtMs,
      expiresAtMs: createdAtMs + COROS_OAUTH_STATE_TTL_MS,
    }))
  } catch {
    // Repository errors are intentionally collapsed; they may contain private database detail.
  }
  if (created !== true) return lifecycleStatus("state_creation_failed")

  return lifecycleStatus("authorization_required", createCorosAuthorizationUrl({
    clientId,
    redirectUri: callback,
    state,
  }))
}

/**
 * authenticatedUserId must come from a server-verified session, never client input.
 * repository.claimPendingState(record) is the race boundary. It must atomically claim
 * exactly one unexpired, unconsumed row bound to userId, stateHash, and redirectUri.
 * repository.storeTokenSet(record) must recheck that same claimed attempt immediately
 * before commit, reject a revoked or superseded attempt, and encrypt credentials.
 * transport.exchangeCode(request) must not log the request or response.
 */
export async function completeCorosOAuthCallback({
  authenticatedUserId,
  clientId,
  clientSecret,
  redirectUri,
  callbackUrl,
  repository,
  transport,
  nowMs = Date.now(),
}) {
  let userId
  let callback
  let claimedAtMs
  let envelope
  try {
    userId = requireUserId(authenticatedUserId)
    requireClientId(clientId)
    requireClientSecret(clientSecret)
    callback = requireRedirectUri(redirectUri).href
    claimedAtMs = requireNowMs(nowMs)
    if (typeof repository?.claimPendingState !== "function"
      || typeof repository?.storeTokenSet !== "function"
      || typeof transport?.exchangeCode !== "function") throw invalid()
    envelope = parseCallbackEnvelope(callbackUrl, callback)
  } catch {
    return lifecycleStatus("invalid_callback")
  }

  const stateHash = await hashCorosOAuthState(envelope.state)
  let claimed = false
  try {
    claimed = await repository.claimPendingState(Object.freeze({
      provider: "COROS",
      userId,
      stateHash,
      redirectUri: callback,
      claimedAtMs,
    }))
  } catch {
    // Expired, replayed, wrong-account, and repository failures share one public status.
  }
  if (claimed !== true) return lifecycleStatus("state_rejected")
  if (envelope.code === null) return lifecycleStatus("authorization_denied")

  let tokenSet
  try {
    const request = createCorosCodeExchangeRequest({
      clientId,
      clientSecret,
      redirectUri: callback,
      code: envelope.code,
    })
    tokenSet = await parseCorosTokenResponse(await transport.exchangeCode(request))
  } catch {
    return lifecycleStatus("exchange_failed")
  }

  let stored = false
  try {
    stored = await repository.storeTokenSet(Object.freeze({
      provider: "COROS",
      userId,
      stateHash,
      redirectUri: callback,
      tokenSet,
      authorizedAtMs: claimedAtMs,
    }))
  } catch {
    // The adapter owns encryption and transaction behavior; raw errors stay server-side.
  }
  return lifecycleStatus(stored === true ? "authorization_persisted" : "storage_failed")
}
