import test from "node:test"
import assert from "node:assert/strict"
import {
  corosMcpEndpoints, validateCorosMcpDiscovery, createCorosMcpPkce,
  createCorosMcpAuthorizationUrl, createCorosMcpTokenRequest,
  createCorosMcpReadClient, COROS_MCP_PROTOCOL, COROS_MCP_MAX_RESPONSE_BYTES,
} from "../functions/_shared/coros-mcp.mjs"
const owner = "synthetic-account"
const token = "synthetic-token-not-real"
const redirect = "https://trainoracle.io/test-coros-callback"
function discovery(region = "us") {
  const e = corosMcpEndpoints(region)
  return [{ resource: e.resource, authorization_servers: [e.issuer] }, {
    issuer: e.issuer, authorization_endpoint: e.authorization, token_endpoint: e.token,
    registration_endpoint: e.registration, code_challenge_methods_supported: ["S256"],
    response_types_supported: ["code"], token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp.tools"],
  }]
}
function rpc(request, result, headers = {}) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }), {
    headers: { "content-type": "application/json", ...headers },
  })
}
function fixture(options = {}) {
  const calls = []; let current = true
  const client = createCorosMcpReadClient({ region: "us", ownerId: owner, enabled: true,
    tokenProvider: async () => token, isCurrent: () => current,
    fetchImpl: async (url, init) => {
      const request = JSON.parse(init.body); calls.push({ url, init, request })
      if (options.respond) { const response = await options.respond(request, calls.length, init); if (response) return response }
      if (request.method === "initialize") return rpc(request, { protocolVersion: COROS_MCP_PROTOCOL, capabilities: { tools: {} } }, { "Mcp-Session-Id": "synthetic-session" })
      if (request.method === "notifications/initialized") return new Response(null, { status: 202 })
      if (request.method === "tools/list") return rpc(request, { tools: [
        { name: "querySportRecords", inputSchema: { type: "object" } },
        { name: "getActivityDetail", inputSchema: { type: "object" } },
        { name: "queryActivityLapData", inputSchema: { type: "object" } },
        { name: "createTrainingPlan", inputSchema: { type: "object" } },
        { name: "queryMenstruationCycles", inputSchema: { type: "object" } },
      ] })
      return rpc(request, { content: [{ type: "text", text: "synthetic unreviewed result" }] })
    }, ...options.client })
  return { client, calls, revoke: () => { current = false } }
}
async function ready(f) { await f.client.initialize(owner); await f.client.listReadTools(owner) }
const range = { startDate: "20261001", endDate: "20261029", limit: 20 }
test("regional metadata pins issuer/resource/credentials endpoints and rejects foreign or mixed regions", () => {
  for (const region of ["us", "eu", "cn"]) assert.equal(validateCorosMcpDiscovery(region, ...discovery(region)).issuer, corosMcpEndpoints(region).issuer)
  assert.throws(() => corosMcpEndpoints("auto"), /REGION_REQUIRED/u)
  assert.throws(() => corosMcpEndpoints("__proto__"), /REGION_REQUIRED/u)
  const [r, a] = discovery(); a.token_endpoint = "https://attacker.invalid/token"
  assert.throws(() => validateCorosMcpDiscovery("us", r, a), /DISCOVERY_REJECTED/u)
  assert.throws(() => validateCorosMcpDiscovery("eu", ...discovery("us")), /DISCOVERY_REJECTED/u)
})
test("PKCE uses fresh 256-bit state and S256 without offline or write-specific scope requests", async () => {
  const first = await createCorosMcpPkce(); const second = await createCorosMcpPkce()
  assert.notEqual(first.state, second.state); assert.notEqual(first.verifier, second.verifier)
  assert.match(first.verifier, /^[A-Za-z0-9_-]{43}$/u)
  const expected = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(first.verifier))).toString("base64url")
  assert.equal(first.challenge, expected)
  const url = new URL(createCorosMcpAuthorizationUrl({ region: "eu", clientId: "synthetic-client", redirect, ...first }))
  assert.equal(url.origin, "https://mcpeu.coros.com")
  assert.equal(url.searchParams.get("resource"), "https://mcpeu.coros.com/mcp")
  assert.equal(url.searchParams.get("scope"), "mcp.tools")
  assert.equal(url.searchParams.get("code_challenge_method"), "S256")
  assert.equal(url.searchParams.has("code_verifier"), false)
})
test("token request is region/resource-bound, secret-free public client PKCE and never follows redirects", async () => {
  const pkce = await createCorosMcpPkce()
  const request = createCorosMcpTokenRequest({ region: "us", clientId: "synthetic-client", redirect, code: "synthetic-code", verifier: pkce.verifier })
  assert.equal(request.redirect, "error"); assert.equal(request.cache, "no-store")
  const params = new URLSearchParams(request.body)
  assert.equal(params.get("resource"), "https://mcpus.coros.com/mcp")
  assert.equal(params.get("code_verifier"), pkce.verifier)
  assert.equal(params.has("client_secret"), false)
  for (const bad of ["http://trainoracle.io/callback", "https://user:pass@trainoracle.io/callback", "https://trainoracle.io/callback#x", "https://trainoracle.io/callback?x=1"]) {
    assert.throws(() => createCorosMcpTokenRequest({ region: "us", clientId: "x", redirect: bad, code: "x", verifier: pkce.verifier }))
  }
})
test("disabled, wrong owner, stale and closed clients do not fetch", async () => {
  for (const extra of [{ enabled: false }, { enabled: undefined }]) {
    const f = fixture({ client: extra })
    await assert.rejects(f.client.initialize(owner), /DISABLED_OR_STALE/u); assert.equal(f.calls.length, 0)
  }
  const f = fixture()
  await assert.rejects(f.client.initialize("another-account"), /DISABLED_OR_STALE/u)
  f.revoke(); await assert.rejects(f.client.initialize(owner), /DISABLED_OR_STALE/u)
  assert.equal(f.calls.length, 0)
  const closed = fixture(); closed.client.close(); await assert.rejects(closed.client.initialize(owner), /DISABLED_OR_STALE/u)
})
test("initialization, notification, session header and local read allowlist work without enabling writes", async () => {
  const f = fixture(); await f.client.initialize(owner)
  const tools = await f.client.listReadTools(owner)
  assert.deepEqual(tools.map(t => t.name), ["querySportRecords", "getActivityDetail", "queryActivityLapData"])
  const result = await f.client.read(owner, "querySportRecords", range)
  assert.equal(result.kind, "UNREVIEWED_PROVIDER_RESULT")
  assert.equal(result.result.content[0].text, "synthetic unreviewed result")
  assert.equal(f.calls[1].request.id, undefined)
  for (const [index, call] of f.calls.entries()) {
    assert.equal(call.url, "https://mcpus.coros.com/mcp")
    assert.equal(call.init.redirect, "error")
    assert.equal(call.init.headers.authorization, `Bearer ${token}`)
    assert.equal(call.init.headers["Mcp-Session-Id"], index === 0 ? undefined : "synthetic-session")
  }
  const count = f.calls.length
  for (const name of ["createTrainingPlan", "createScheduledWorkout", "queryMenstruationCycles", "downloadActivityFitFiles"]) await assert.rejects(f.client.read(owner, name, {}), /TOOL_FORBIDDEN/u)
  assert.equal(f.calls.length, count)
})
test("read requires discovery, rejects calendar invalidity, extra fields and fabricated defaults", async () => {
  const f = fixture(); await f.client.initialize(owner)
  await assert.rejects(f.client.read(owner, "querySportRecords", range), /TOOL_NOT_DISCOVERED/u)
  await f.client.listReadTools(owner)
  const count = f.calls.length
  for (const args of [{ ...range, startDate: "20260230" }, { ...range, limit: 0 }, { ...range, endDate: "20260901" }, { ...range, notes: "private" }, { limit: 20 }]) await assert.rejects(f.client.read(owner, "querySportRecords", args))
  assert.equal(f.calls.length, count)
  const detail = await f.client.read(owner, "getActivityDetail", { labelId: "synthetic-activity", sportType: 1 })
  assert.equal(detail.kind, "UNREVIEWED_PROVIDER_RESULT")
})
test("tool discovery follows pagination and rejects cursor loops instead of claiming a complete list", async () => {
  const f = fixture({ respond: req => req.method !== "tools/list" ? null : rpc(req, req.params.cursor
    ? { tools: [{ name: "querySportRecords", inputSchema: { type: "object" } }] }
    : { tools: [], nextCursor: "synthetic-cursor" }) })
  await f.client.initialize(owner)
  assert.equal((await f.client.listReadTools(owner)).length, 1)
  assert.equal(f.calls.at(-1).request.params.cursor, "synthetic-cursor")
  const loop = fixture({ respond: req => req.method === "tools/list" ? rpc(req, { tools: [], nextCursor: "repeated" }) : null })
  await loop.client.initialize(owner)
  await assert.rejects(loop.client.listReadTools(owner), /CURSOR_LOOP/u)
})
test("SSE replies are matched to the request, accept multiline data and close after a complete result", async () => {
  let cancelled = false
  const f = fixture({ respond: req => {
    if (req.method !== "tools/list") return null
    const message = JSON.stringify({ jsonrpc: "2.0", id: req.id, result: { tools: [] } })
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(': keepalive\r\ndata: {"jsonrpc":"2.0",\r\ndata: "method":"notifications/progress"}\r\n\r\n'))
      controller.enqueue(new TextEncoder().encode(`data: ${message}\r\n\r\n`))
    }, cancel() { cancelled = true } })
    return new Response(stream, { headers: { "content-type": "text/event-stream" } })
  } })
  await f.client.initialize(owner); assert.deepEqual(await f.client.listReadTools(owner), []); assert.equal(cancelled, true)
})
test("HTTP, RPC, protocol and tool errors never echo response details or credentials", async () => {
  for (const responseFactory of [
    req => new Response(`credential=${token}`, { status: 401 }),
    req => new Response(JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { message: token } }), { headers: { "content-type": "application/json" } }),
    req => rpc(req, { protocolVersion: "unsupported", capabilities: { tools: {} } }),
    req => new Response(token, { headers: { "content-type": "text/plain" } }),
    req => { throw new Error(`network failure ${token}`) },
  ]) {
    const f = fixture({ respond: responseFactory })
    await assert.rejects(f.client.initialize(owner), error => error.message.startsWith("COROS_MCP_") && !error.message.includes(token))
  }
  const f = fixture({ respond: req => req.method === "tools/call" ? rpc(req, { isError: true, content: [{ type: "text", text: token }] }) : null })
  await ready(f); await assert.rejects(f.client.read(owner, "querySportRecords", range), /TOOL_FAILED/u)
})
test("late responses after disconnect are rejected and never returned as activity data", async () => {
  let f
  f = fixture({ respond: req => { if (req.method === "tools/call") { f.revoke(); return rpc(req, { content: [] }) } return null } })
  await ready(f); await assert.rejects(f.client.read(owner, "querySportRecords", range), /DISABLED_OR_STALE/u)
})
test("oversized JSON and SSE responses fail closed", async () => {
  for (const contentType of ["application/json", "text/event-stream"]) {
    const f = fixture({ respond: () => new Response("x".repeat(COROS_MCP_MAX_RESPONSE_BYTES + 1), { headers: { "content-type": contentType } }) })
    await assert.rejects(f.client.initialize(owner), /RESPONSE_TOO_LARGE/u)
  }
})
test("timeout sanitizes abort errors and overlapping initialization is rejected", async () => {
  const f = fixture({ client: { timeoutMs: 10, fetchImpl: async (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error(token)), { once: true })
  }) } })
  const pending = f.client.initialize(owner)
  await assert.rejects(f.client.initialize(owner), /BUSY/u)
  await assert.rejects(pending, /COROS_MCP_REQUEST_FAILED/u)
})

test("credential and connection adapters cannot leak their raw exceptions", async () => {
  const credentials = fixture({ client: { tokenProvider: async () => { throw new Error(token) } } })
  await assert.rejects(credentials.client.initialize(owner), /^Error: COROS_MCP_CREDENTIAL_UNAVAILABLE$/u)
  assert.equal(credentials.calls.length, 0)
  const scope = fixture({ client: { isCurrent: () => { throw new Error(token) } } })
  await assert.rejects(scope.client.initialize(owner), /^Error: COROS_MCP_DISABLED_OR_STALE$/u)
  assert.equal(scope.calls.length, 0)
})

test("malformed discovery arrays fail closed instead of substring matching", () => {
  for (const [field, value] of [["code_challenge_methods_supported", "not-S256"], ["response_types_supported", "not-code"], ["token_endpoint_auth_methods_supported", "not-none"], ["scopes_supported", "not-mcp.tools"]]) {
    const [resource, auth] = discovery(); auth[field] = value
    assert.throws(() => validateCorosMcpDiscovery("us", resource, auth), /DISCOVERY_REJECTED/u)
  }
})
test("deadline also bounds stalled credential callbacks and uncooperative body reads", async () => {
  const credential = fixture({ client: { timeoutMs: 10, tokenProvider: () => new Promise(() => {}) } })
  const started = Date.now()
  await assert.rejects(credential.client.initialize(owner), /REQUEST_FAILED/u)
  assert.ok(Date.now() - started < 1000)
  await assert.rejects(credential.client.initialize(owner), /REQUEST_FAILED/u)
  const body = fixture({ client: { timeoutMs: 10 }, respond: () => new Response(new ReadableStream({ start() {}, cancel() { return new Promise(() => {}) } }), { headers: { "content-type": "application/json" } }) })
  await assert.rejects(body.client.initialize(owner), /REQUEST_FAILED/u)
})
test("stale received responses and complete SSE with stalled cancel are cleaned up without hanging", async () => {
  let stale; let cancelled = false
  stale = fixture({ respond: () => {
    stale.revoke()
    return new Response(new ReadableStream({ cancel() { cancelled = true } }), { headers: { "content-type": "application/json" } })
  } })
  await assert.rejects(stale.client.initialize(owner), /DISABLED_OR_STALE/u)
  assert.equal(cancelled, true)
  const f = fixture({ respond: req => req.method !== "tools/list" ? null : new Response(new ReadableStream({ start(c) {
    c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ jsonrpc: "2.0", id: req.id, result: { tools: [] } })}\n\n`))
  }, cancel() { return new Promise(() => {}) } }), { headers: { "content-type": "text/event-stream" } }) })
  await f.client.initialize(owner); assert.deepEqual(await f.client.listReadTools(owner), [])
})
test("SSE supports CR-only lines and CRLF split across every chunk boundary", async () => {
  for (const delimiter of ["\r", "\r\n", "\n"]) {
    const f = fixture({ respond: req => {
      if (req.method !== "tools/list") return null
      const source = `: comment${delimiter}data: ${JSON.stringify({ jsonrpc: "2.0", id: req.id, result: { tools: [] } })}${delimiter}${delimiter}`
      return new Response(new ReadableStream({ start(c) { for (const char of source) c.enqueue(new TextEncoder().encode(char)) } }), { headers: { "content-type": "text/event-stream" } })
    } })
    await f.client.initialize(owner); assert.deepEqual(await f.client.listReadTools(owner), [])
  }
})
test("browser contexts cannot construct the server-only COROS client", () => {
  const previous = globalThis.window
  globalThis.window = {}
  try { assert.throws(() => fixture(), /SERVER_ONLY/u) }
  finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous }
})
