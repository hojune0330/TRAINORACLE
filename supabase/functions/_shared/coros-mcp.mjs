// Server-only COROS MCP protocol boundary. Not wired to public linking or storage.
// Sources: COROS Build on MCP / coroslab/COROS-MCP and MCP 2025-03-26.
export const COROS_MCP_REGIONS = Object.freeze({
  us: "https://mcpus.coros.com",
  eu: "https://mcpeu.coros.com",
  cn: "https://mcpcn.coros.com",
})
export const COROS_MCP_READ_TOOLS = Object.freeze([
  "querySportRecords", "getActivityDetail", "queryActivityLapData",
])
export const COROS_MCP_PROTOCOL = "2025-03-26"
export const COROS_MCP_MAX_RESPONSE_BYTES = 1024 * 1024
const encoder = new TextEncoder()
const fail = (code = "COROS_MCP_INVALID") => new Error(code)
const object = value => value !== null && typeof value === "object" && !Array.isArray(value)
function text(value, max = 2048) {
  if (typeof value !== "string" || !/^[\x21-\x7e]+$/u.test(value) || value.length > max) throw fail()
  return value
}
export function corosMcpEndpoints(region) {
  const issuer = Object.hasOwn(COROS_MCP_REGIONS, region) ? COROS_MCP_REGIONS[region] : null
  if (!issuer) throw fail("COROS_MCP_REGION_REQUIRED")
  return Object.freeze({ issuer, resource: `${issuer}/mcp`,
    resourceMetadata: `${issuer}/.well-known/oauth-protected-resource/mcp`,
    authorizationMetadata: `${issuer}/.well-known/oauth-authorization-server`,
    authorization: `${issuer}/oauth2/authorize`, token: `${issuer}/oauth2/token`,
    registration: `${issuer}/connect/register`, revocation: `${issuer}/oauth2/revoke` })
}
export function validateCorosMcpDiscovery(region, resource, authorization) {
  const endpoints = corosMcpEndpoints(region)
  if (!object(resource) || !object(authorization) || resource.resource !== endpoints.resource
    || !Array.isArray(resource.authorization_servers) || resource.authorization_servers.length !== 1
    || resource.authorization_servers[0] !== endpoints.issuer || authorization.issuer !== endpoints.issuer
    || authorization.authorization_endpoint !== endpoints.authorization
    || authorization.token_endpoint !== endpoints.token
    || authorization.registration_endpoint !== endpoints.registration
    || !Array.isArray(authorization.code_challenge_methods_supported) || !authorization.code_challenge_methods_supported.includes("S256")
    || !Array.isArray(authorization.response_types_supported) || !authorization.response_types_supported.includes("code")
    || !Array.isArray(authorization.token_endpoint_auth_methods_supported) || !authorization.token_endpoint_auth_methods_supported.includes("none")
    || !Array.isArray(authorization.scopes_supported) || !authorization.scopes_supported.includes("mcp.tools")) throw fail("COROS_MCP_DISCOVERY_REJECTED")
  return endpoints
}
function base64url(bytes) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}
export async function createCorosMcpPkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))))
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)))
  return { verifier, challenge, state }
}
function redirectUri(value) {
  text(value)
  const url = new URL(value)
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || url.href !== value) throw fail()
  return value
}
function verifierValue(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/u.test(value)) throw fail()
  return value
}
export function createCorosMcpAuthorizationUrl({ region, clientId, redirect, state, challenge }) {
  const endpoints = corosMcpEndpoints(region)
  text(clientId, 256); redirectUri(redirect); verifierValue(state); verifierValue(challenge)
  const url = new URL(endpoints.authorization)
  for (const [key, value] of Object.entries({ response_type: "code", client_id: clientId,
    redirect_uri: redirect, scope: "mcp.tools", state, code_challenge: challenge,
    code_challenge_method: "S256", resource: endpoints.resource })) url.searchParams.set(key, value)
  return url.href
}
// Caller must atomically consume a short-lived, account/region/client/redirect-bound
// transaction before using this builder. This function does not implement a callback.
export function createCorosMcpTokenRequest({ region, clientId, redirect, code, verifier }) {
  const endpoints = corosMcpEndpoints(region)
  text(clientId, 256); redirectUri(redirect); text(code, 4096); verifierValue(verifier)
  return { url: endpoints.token, method: "POST", redirect: "error", cache: "no-store",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId,
      redirect_uri: redirect, code, code_verifier: verifier, resource: endpoints.resource }).toString() }
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{8}$/u.test(value)) throw fail()
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) throw fail()
  return value
}
function readArguments(name, args) {
  if (!COROS_MCP_READ_TOOLS.includes(name) || !object(args)) throw fail("COROS_MCP_TOOL_FORBIDDEN")
  const keys = name === "querySportRecords" ? ["startDate", "endDate", "limit"] : ["labelId", "sportType"]
  if (Object.keys(args).some(key => !keys.includes(key))) throw fail()
  if (name === "querySportRecords") {
    validDate(args.startDate); validDate(args.endDate)
    if (args.startDate > args.endDate || !Number.isSafeInteger(args.limit) || args.limit < 1 || args.limit > 100) throw fail()
  } else {
    text(args.labelId, 256)
    if (!Number.isSafeInteger(args.sportType) || args.sportType < 0) throw fail()
  }
  return { ...args }
}
function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(fail("COROS_MCP_REQUEST_FAILED"))
    if (signal.aborted) { Promise.resolve(promise).catch(() => {}); abort(); return }
    signal.addEventListener("abort", abort, { once: true })
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort)).catch(() => {})
  })
}
function cancelBody(body) {
  try { body?.cancel().catch(() => {}) } catch { /* Cleanup must not extend the deadline. */ }
}
function releaseReader(reader) {
  try { reader.cancel().catch(() => {}) } catch { /* Best effort. */ }
  try { reader.releaseLock() } catch { /* Pending reads are abandoned without retaining the owner. */ }
}
async function boundedJson(response, signal) {
  const reader = response.body?.getReader()
  if (!reader) throw fail("COROS_MCP_RESPONSE_INVALID")
  const parts = []; let size = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await abortable(reader.read(), signal)
      if (done) break
      size += value.byteLength
      if (size > COROS_MCP_MAX_RESPONSE_BYTES) throw fail("COROS_MCP_RESPONSE_TOO_LARGE")
      parts.push(value)
    }
    const bytes = new Uint8Array(size); let offset = 0
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } finally { releaseReader(reader) }
}
async function sseRpc(response, id, signal) {
  const reader = response.body?.getReader()
  if (!reader) throw fail("COROS_MCP_RESPONSE_INVALID")
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let pending = ""; let size = 0; let data = []; let skipLF = false
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await abortable(reader.read(), signal)
      if (!done) {
        size += value.byteLength
        if (size > COROS_MCP_MAX_RESPONSE_BYTES) throw fail("COROS_MCP_RESPONSE_TOO_LARGE")
        pending += decoder.decode(value, { stream: true })
      } else pending += decoder.decode()
      if (skipLF && pending.length) {
        if (pending[0] === "\n") pending = pending.slice(1)
        skipLF = false
      }
      let newline
      while ((newline = pending.search(/[\r\n]/u)) >= 0) {
        const isCR = pending[newline] === "\r"
        const line = pending.slice(0, newline)
        pending = pending.slice(newline + 1)
        if (isCR) {
          if (pending[0] === "\n") pending = pending.slice(1)
          else if (pending.length === 0) skipLF = true
        }
        if (line === "") {
          if (data.length) {
            const message = JSON.parse(data.join("\n")); data = []
            if (message.id === id) return message
            if (Object.hasOwn(message, "id")) throw fail("COROS_MCP_RPC_ID_MISMATCH")
          }
        } else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /u, ""))
      }
      if (done) throw fail("COROS_MCP_RESPONSE_INVALID")
    }
  } finally { releaseReader(reader) }
}
// Opt-in protocol client, not a data-import service. Raw tool results remain transient
// and MUST pass a separate reviewed field normalizer before storage or UI delivery.
// No writes, downloads, health/profile queries, automatic retries or background polling.
export function createCorosMcpReadClient({ region, ownerId, tokenProvider, isCurrent,
  fetchImpl = fetch, enabled = false, timeoutMs = 15000 }) {
  if (typeof window !== "undefined" || typeof document !== "undefined") throw fail("COROS_MCP_SERVER_ONLY")
  const endpoints = corosMcpEndpoints(region)
  text(ownerId, 256)
  if (typeof tokenProvider !== "function" || typeof isCurrent !== "function"
    || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw fail()
  let ready = false; let sessionId = null; let counter = 0; let busy = false; let closed = false
  let toolNames = null
  function guard(accountId) {
    let current = false
    try { current = isCurrent() === true } catch { /* Fail closed without adapter errors. */ }
    if (typeof window !== "undefined" || typeof document !== "undefined" || enabled !== true || closed || accountId !== ownerId || !current) throw fail("COROS_MCP_DISABLED_OR_STALE")
  }
  async function post(accountId, method, params, notification = false) {
    guard(accountId)
    const id = ++counter
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response
    try {
      let accessToken
      try { accessToken = text(await abortable(Promise.resolve().then(() => tokenProvider(ownerId)), controller.signal), 8192) }
      catch { throw fail(controller.signal.aborted ? "COROS_MCP_REQUEST_FAILED" : "COROS_MCP_CREDENTIAL_UNAVAILABLE") }
      guard(accountId)
      const headers = { authorization: `Bearer ${accessToken}`, accept: "application/json, text/event-stream",
        "content-type": "application/json", "MCP-Protocol-Version": COROS_MCP_PROTOCOL }
      if (sessionId) headers["Mcp-Session-Id"] = sessionId
      response = await abortable(fetchImpl(endpoints.resource, { method: "POST", redirect: "error", cache: "no-store",
        signal: controller.signal, headers,
        body: JSON.stringify({ jsonrpc: "2.0", ...(notification ? {} : { id }), method, ...(params === undefined ? {} : { params }) }) }).then(value => { if (controller.signal.aborted) cancelBody(value.body); return value }), controller.signal)
      guard(accountId)
      if (!response.ok) {
        cancelBody(response.body)
        if (response.status === 401) throw fail("COROS_MCP_REAUTH_REQUIRED")
        if (response.status === 404) { ready = false; sessionId = null; toolNames = null }
        throw fail("COROS_MCP_HTTP_FAILED")
      }
      if (notification) {
        cancelBody(response.body)
        if (response.status !== 202) throw fail("COROS_MCP_RESPONSE_INVALID")
        return null
      }
      const type = response.headers.get("content-type")?.split(";")[0].trim()
      let message
      if (type === "application/json") message = await boundedJson(response, controller.signal)
      else if (type === "text/event-stream") message = await sseRpc(response, id, controller.signal)
      else { cancelBody(response.body); throw fail("COROS_MCP_RESPONSE_INVALID") }
      guard(accountId)
      if (!object(message) || message.jsonrpc !== "2.0" || message.id !== id || !object(message.result)
        || Object.hasOwn(message, "error")) throw fail("COROS_MCP_RPC_REJECTED")
      if (method === "initialize") {
        if (message.result.protocolVersion !== COROS_MCP_PROTOCOL || !object(message.result.capabilities?.tools)) throw fail("COROS_MCP_PROTOCOL_UNSUPPORTED")
        const newSession = response.headers.get("mcp-session-id")
        if (newSession !== null) sessionId = text(newSession, 1024)
      }
      return message.result
    } catch (error) {
      if (error instanceof Error && /^COROS_MCP_[A-Z_]+$/u.test(error.message)) throw error
      throw fail("COROS_MCP_REQUEST_FAILED")
    } finally { clearTimeout(timer); controller.abort(); cancelBody(response?.body) }
  }
  async function exclusive(accountId, task) {
    guard(accountId)
    if (busy) throw fail("COROS_MCP_BUSY")
    busy = true
    try { return await task() } finally { busy = false }
  }
  return Object.freeze({
    initialize(accountId) { return exclusive(accountId, async () => {
      if (ready) return { ready: true }
      sessionId = null; toolNames = null
      await post(accountId, "initialize", { protocolVersion: COROS_MCP_PROTOCOL, capabilities: {},
        clientInfo: { name: "TrainOracle", version: "0.1.0" } })
      await post(accountId, "notifications/initialized", undefined, true)
      ready = true
      return { ready: true }
    }) },
    listReadTools(accountId) { return exclusive(accountId, async () => {
      if (!ready) throw fail("COROS_MCP_NOT_INITIALIZED")
      toolNames = null
      const tools = []; const cursors = new Set(); let cursor
      for (let page = 0; page < 10; page++) {
        const result = await post(accountId, "tools/list", cursor ? { cursor } : {})
        if (!Array.isArray(result.tools) || result.tools.length > 500) throw fail("COROS_MCP_RESPONSE_INVALID")
        for (const tool of result.tools) {
          if (!object(tool) || typeof tool.name !== "string") throw fail("COROS_MCP_RESPONSE_INVALID")
          if (COROS_MCP_READ_TOOLS.includes(tool.name)) {
            if (!object(tool.inputSchema) || tool.inputSchema.type !== "object" || tools.some(t => t.name === tool.name)) throw fail("COROS_MCP_RESPONSE_INVALID")
            tools.push({ name: tool.name, inputSchema: tool.inputSchema })
          }
        }
        if (result.nextCursor === undefined) { toolNames = new Set(tools.map(t => t.name)); return tools }
        cursor = text(result.nextCursor, 2048)
        if (cursors.has(cursor)) throw fail("COROS_MCP_CURSOR_LOOP")
        cursors.add(cursor)
      }
      throw fail("COROS_MCP_TOOL_LIST_INCOMPLETE")
    }) },
    read(accountId, name, args) { return exclusive(accountId, async () => {
      const checked = readArguments(name, args)
      if (!ready || !toolNames?.has(name)) throw fail("COROS_MCP_TOOL_NOT_DISCOVERED")
      const result = await post(accountId, "tools/call", { name, arguments: checked })
      if (result.isError === true) throw fail("COROS_MCP_TOOL_FAILED")
      // A bounded transport result is NOT validated or adopted training data.
      return { kind: "UNREVIEWED_PROVIDER_RESULT", provider: "COROS_MCP", result }
    }) },
    close() { closed = true; ready = false; sessionId = null; toolNames = null },
  })
}
