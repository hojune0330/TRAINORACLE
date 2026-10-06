import { describe, expect, it, vi } from "vitest"
import { createTrainOracleLoungeClient as createAdapter, LOUNGE_REQUEST_TIMEOUT_MS, parseLoungeGrant, parseLoungeParticipation, parseLoungeStatus } from "./adapter"
import { resolveLoungeConfig } from "./config"
import { captureLoungeEntryIntent } from "./entry-intent"

const config = { realtimeUrl: "https://runtime.example/", pageUrl: "https://lounge.example/lounge" }
const status = { version: 1, noticeVersion: "lounge-v1-2026-09-30", roomId: "synthetic-room", trainoracleEntryEnabled: true, readiness: { writesReady: true, reason: null } }
const reply = (value: unknown, code = 200) => new Response(JSON.stringify(value), { status: code })
const session = () => Promise.resolve({ userId: "synthetic-A" })
const grant = () => Promise.resolve({ version: 1, grant: "lg1_" + "a".repeat(64), expiresAt: new Date(Date.now() + 60_000).toISOString() })
const createTrainOracleLoungeClient = (options: Parameters<typeof createAdapter>[0]) => createAdapter({ getGrant: grant, ...options })
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), abort: vi.fn() }))
vi.mock("../account/supabase-client", () => ({ supabase: async () => ({ rpc: (name: string) => ({ abortSignal: (signal: AbortSignal) => { mocks.abort(signal); return mocks.rpc(name) } }) }) }))

describe("default-off public lounge configuration", () => {
  it("requires explicit release and both public HTTPS destinations", () => {
    expect(resolveLoungeConfig({})).toBeNull()
    const enabled = { VITE_LOUNGE_PUBLIC_ENABLED: "true", VITE_LOUNGE_REALTIME_URL: config.realtimeUrl, VITE_LOUNGE_PAGE_URL: config.pageUrl }
    expect(resolveLoungeConfig(enabled)).toEqual(config)
    expect(resolveLoungeConfig({ ...enabled, VITE_LOUNGE_PUBLIC_ENABLED: "false" })).toBeNull()
    expect(resolveLoungeConfig({ ...enabled, VITE_LOUNGE_PAGE_URL: "" })).toBeNull()
  })
  it.each(["http://lounge.example", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://[::ffff:127.0.0.1]", "https://name:secret@lounge.example", "https://lounge.example/?token=x", "https://lounge.example/#token"])("rejects unsafe public URL %s", unsafe => {
    expect(resolveLoungeConfig({ VITE_LOUNGE_PUBLIC_ENABLED: "true", VITE_LOUNGE_REALTIME_URL: unsafe, VITE_LOUNGE_PAGE_URL: config.pageUrl })).toBeNull()
  })
})

describe("memory-only lounge link intent", () => {
  it("scrubs the fragment immediately and preserves the base path and unrelated auth fields", () => {
    const replace = vi.fn()
    const token = "l".repeat(43)
    const intent = captureLoungeEntryIntent(`https://trainoracle.example/TRAINORACLE/?from=account#lounge_link=${token}&type=callback`, replace)
    expect(intent).toEqual({ requested: true, linkRequested: true, linkToken: token })
    expect(replace).toHaveBeenCalledWith("/TRAINORACLE/?from=account&lounge=1&lounge-link-restart=1#type=callback")
    expect(replace.mock.calls[0]?.[0]).not.toContain(token)
  })
  it("does not recover a link from storage or an OAuth return marker", () => {
    expect(captureLoungeEntryIntent("https://trainoracle.example/?account=1&lounge=1&lounge-link-restart=1", vi.fn()))
      .toEqual({ requested: true, linkRequested: true, linkToken: null })
  })
  it("removes malformed link input without treating it as authority", () => {
    const replace = vi.fn()
    expect(captureLoungeEntryIntent("https://trainoracle.example/#lounge_link=invalid", replace).linkToken).toBeNull()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(captureLoungeEntryIntent("https://trainoracle.example/#type=callback", vi.fn()).requested).toBe(false)
  })
})

describe("TrainOracle lounge auth adapter", () => {
  it("retains the versioned server ticket expiry without adding it to the destination", async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    const fetchImpl = vi.fn().mockResolvedValue(reply({ ticket: "t".repeat(43), expiresAt }, 201))
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl })
    const ticket = await client.enterTicket({ accepted: true, noticeVersion: status.noticeVersion, signal: new AbortController().signal, requireExpiry: true })
    expect(ticket.expiresAt).toBe(expiresAt)
    expect(new URL(ticket.url).search).toBe("")
    expect(ticket.url).not.toContain(expiresAt)
    expect(parseLoungeStatus({ ...status, trainoracleTicketExpiryVersion: 1 }).ticketExpiryVersion).toBe(1)
    expect(() => parseLoungeStatus({ ...status, trainoracleTicketExpiryVersion: 2 })).toThrow("LOUNGE_STATUS_INVALID")
  })
  it.each([undefined, null, "2100-02-30T00:00:00Z", "2100-01-01T00:00:00+09:00", "2100-01-01T00:00:00Z\n", "1970-01-01T00:00:00Z"])("rejects advertised missing, malformed or expired ticket expiry %s without retry", async expiresAt => {
    const fetchImpl = vi.fn().mockResolvedValue(reply({ ticket: "t".repeat(43), expiresAt }))
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl })
    await expect(client.enterTicket({ accepted: true, noticeVersion: status.noticeVersion, signal: new AbortController().signal, requireExpiry: true }))
      .rejects.toThrow(expiresAt === "1970-01-01T00:00:00Z" ? "TICKET_EXPIRED" : "TICKET_INVALID")
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
  it("issues the scoped grant through the existing TrainOracle SDK RPC with no arguments", async () => {
    const proof = await grant()
    mocks.rpc.mockResolvedValue({ data: proof, error: null })
    const fetchImpl = vi.fn().mockResolvedValue(reply({ ticket: "t".repeat(43) }))
    const client = createAdapter({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl })
    await client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal: new AbortController().signal })
    expect(mocks.rpc).toHaveBeenLastCalledWith("issue_lounge_grant")
    expect(mocks.abort).toHaveBeenLastCalledWith(expect.any(AbortSignal))
    expect(fetchImpl.mock.calls[0]?.[1].headers.Authorization).toBe(`Bearer ${proof.grant}`)
    expect(parseLoungeGrant({ ...proof, expiresAt: proof.expiresAt.replace("Z", "000Z") })).toEqual({ ...proof, expiresAt: proof.expiresAt.replace("Z", "000Z") })
    expect(parseLoungeGrant({ ...proof, expiresAt: proof.expiresAt.replace("Z", "+00:00") })).toEqual({ ...proof, expiresAt: proof.expiresAt.replace("Z", "+00:00") })
  })
  it.each([
    { version: 2 }, { grant: "lg1_" + "A".repeat(64) }, { grant: "lg1_" + "a".repeat(64) + "\n" },
    { grant: "synthetic-raw-jwt" }, { expiresAt: "1970-01-01T00:00:00Z" },
    { expiresAt: "2100-02-30T00:00:00Z" }, { expiresAt: "2100-01-01T00:00:00+09:00" },
    { expiresAt: "2100-01-01T00:00:00Z\n" }, { email: "synthetic@example.invalid" },
  ])("rejects malformed or privacy-bearing grant DTO before any lounge POST", async malformed => {
    const fetchImpl = vi.fn()
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, getGrant: async () => ({ ...await grant(), ...malformed }), fetchImpl })
    await expect(client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal: new AbortController().signal })).rejects.toThrow("LOUNGE_GRANT_INVALID")
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it("rejects RPC failure without any fallback to a raw authentication JWT", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("synthetic RPC unavailable") })
    const fetchImpl = vi.fn()
    const client = createAdapter({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl })
    await expect(client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal: new AbortController().signal })).rejects.toThrow("LOUNGE_GRANT_UNAVAILABLE")
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it("aborts the existing SDK grant request within the same deadline without a lounge POST", async () => {
    vi.useFakeTimers()
    try {
      mocks.rpc.mockReturnValueOnce(new Promise(() => {}))
      const fetchImpl = vi.fn()
      const client = createAdapter({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl })
      const pending = client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal: new AbortController().signal })
      const rejected = expect(pending).rejects.toThrow("LOUNGE_REQUEST_UNAVAILABLE")
      await vi.advanceTimersByTimeAsync(LOUNGE_REQUEST_TIMEOUT_MS)
      await rejected
      expect(mocks.abort.mock.calls.at(-1)?.[0].aborted).toBe(true)
      expect(fetchImpl).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
  it("discards an issued grant if the account changes while its RPC is outstanding", async () => {
    const getSession = vi.fn().mockResolvedValueOnce({ userId: "synthetic-A" }).mockResolvedValueOnce({ userId: "synthetic-B" })
    const fetchImpl = vi.fn()
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession, fetchImpl })
    await expect(client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal: new AbortController().signal })).rejects.toThrow("LOGIN_REQUIRED")
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it("reads strict public status without a credential and separates unprepared from failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(status))
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl })
    const signal = new AbortController().signal
    await expect(client.status(signal)).resolves.toEqual({ noticeVersion: status.noticeVersion, prepared: true, accepted: false })
    expect(fetchImpl).toHaveBeenCalledWith(new URL("/api/lounge/status", config.realtimeUrl), {
      method: "GET", credentials: "omit", redirect: "error", cache: "no-store", signal: expect.any(AbortSignal),
    })
    expect(parseLoungeStatus({ ...status, readiness: { writesReady: false, reason: "RETENTION_BUSY" } }).prepared).toBe(false)
    expect(parseLoungeStatus({ ...status, roomId: null }).prepared).toBe(false)
    expect(parseLoungeStatus({ ...status, trainoracleEntryEnabled: false }).prepared).toBe(false)
    expect(parseLoungeStatus({ ...status, trainoracleEntryEnabled: undefined }).prepared).toBe(false)
  })
  it.each([
    { ...status, version: 2 }, { ...status, noticeVersion: null }, { ...status, noticeVersion: "" },
    { ...status, noticeVersion: "untrusted notice text" }, { ...status, readiness: null },
    { ...status, readiness: { writesReady: "true", reason: null } }, { ...status, roomId: undefined },
    { ...status, trainoracleEntryEnabled: "true" },
    { ...status, trainoracleParticipationVersion: null }, { ...status, trainoracleParticipationVersion: 2 },
  ])("rejects malformed status rather than enabling entry", malformed => {
    expect(() => parseLoungeStatus(malformed)).toThrow("LOUNGE_STATUS_INVALID")
  })
  it("requires explicit notice confirmation before requesting a ticket", async () => {
    const fetchImpl = vi.fn()
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl })
    await expect(client.enter({ accepted: false, noticeVersion: status.noticeVersion, signal: new AbortController().signal })).rejects.toThrow("NOTICE_REQUIRED")
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it("reads authenticated existing participation and reuses only the memory grant for server-checked reentry", async () => {
    const getGrant = vi.fn(grant)
    const fetchImpl = vi.fn<typeof fetch>(async url => reply(new URL(String(url)).pathname === "/api/lounge/status"
      ? { ...status, trainoracleParticipationVersion: 1 } : new URL(String(url)).pathname === "/api/lounge/participation/trainoracle"
        ? { version: 1, noticeVersion: status.noticeVersion, accepted: true } : { ticket: "t".repeat(43) }))
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, getGrant, fetchImpl })
    const signal = new AbortController().signal
    await expect(client.status(signal)).resolves.toEqual({ noticeVersion: status.noticeVersion, prepared: true, accepted: true })
    expect(fetchImpl.mock.calls[1]?.[1]?.body).toBe("{}")
    await client.enter({ accepted: false, noticeVersion: status.noticeVersion, signal })
    expect(getGrant).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({ noticeVersion: status.noticeVersion, resume: true }))
    expect(fetchImpl.mock.calls[2]?.[1]?.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer lg1_" + "a".repeat(64) })
  })
  it("does not turn a negative, legacy, or unprepared read into resume authority", async () => {
    for (const runtimeStatus of [status, { ...status, trainoracleParticipationVersion: 1 }, { ...status, trainoracleParticipationVersion: 1, roomId: null }]) {
      const getGrant = vi.fn(grant)
      const fetchImpl = vi.fn<typeof fetch>(async url => reply(new URL(String(url)).pathname === "/api/lounge/status" ? runtimeStatus : { version: 1, noticeVersion: status.noticeVersion, accepted: false }))
      const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, getGrant, fetchImpl })
      const signal = new AbortController().signal
      expect((await client.status(signal)).accepted).toBe(false)
      await expect(client.enter({ accepted: false, noticeVersion: status.noticeVersion, signal })).rejects.toThrow("NOTICE_REQUIRED")
      expect(fetchImpl.mock.calls.some(call => String(call[0]).includes("/entry/"))).toBe(false)
      expect(getGrant).toHaveBeenCalledTimes(runtimeStatus === status || runtimeStatus.roomId === null ? 0 : 1)
    }
  })
  it.each([null, [], {}, { version: 2, noticeVersion: status.noticeVersion, accepted: true },
    { version: 1, noticeVersion: "changed-version", accepted: true }, { version: 1, noticeVersion: status.noticeVersion, accepted: "true" },
    { version: 1, noticeVersion: status.noticeVersion, accepted: true, subject: "synthetic-A" },
  ])("rejects malformed or mismatched authenticated acceptance %j", malformed => {
    expect(() => parseLoungeParticipation(malformed, status.noticeVersion)).toThrow("LOUNGE_PARTICIPATION_INVALID")
  })
  it("refreshes acceptance on each status read and discards memory proof after a denial", async () => {
    const getGrant = vi.fn(grant)
    let reads = 0
    const fetchImpl = vi.fn<typeof fetch>(async url => reply(new URL(String(url)).pathname === "/api/lounge/status" ? { ...status, trainoracleParticipationVersion: 1 }
      : { version: 1, noticeVersion: status.noticeVersion, accepted: ++reads === 1 }))
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, getGrant, fetchImpl })
    const signal = new AbortController().signal
    expect((await client.status(signal)).accepted).toBe(true)
    expect((await client.status(signal)).accepted).toBe(false)
    await expect(client.enter({ accepted: false, noticeVersion: status.noticeVersion, signal })).rejects.toThrow("NOTICE_REQUIRED")
    await client.status(signal)
    expect(reads).toBe(3)
    expect(getGrant).toHaveBeenCalledTimes(2)
  })
  it("surfaces server notice races and requires a fresh read after invalidation or grant expiry", async () => {
    const getGrant = vi.fn(grant)
    const fetchImpl = vi.fn<typeof fetch>(async url => new URL(String(url)).pathname === "/api/lounge/status" ? reply({ ...status, trainoracleParticipationVersion: 1 })
      : new URL(String(url)).pathname === "/api/lounge/participation/trainoracle" ? reply({ version: 1, noticeVersion: status.noticeVersion, accepted: true }) : reply({ code: "NOTICE_REQUIRED" }, 409))
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, getGrant, fetchImpl })
    const signal = new AbortController().signal
    await client.status(signal)
    await expect(client.enter({ accepted: false, noticeVersion: status.noticeVersion, signal })).rejects.toThrow("NOTICE_REQUIRED")
    await client.status(signal)
    expect(getGrant).toHaveBeenCalledTimes(2)
    client.invalidate()
    await expect(client.enter({ accepted: false, noticeVersion: status.noticeVersion, signal })).rejects.toThrow("NOTICE_REQUIRED")
    await client.status(signal)
    vi.useFakeTimers()
    try {
      vi.setSystemTime(Date.now() + 61_000)
      await expect(client.enter({ accepted: false, noticeVersion: status.noticeVersion, signal })).rejects.toThrow("NOTICE_REQUIRED")
    } finally { vi.useRealTimers() }
  })
  it("sends only noticeVersion with a scoped grant and returns a fragment-only ticket", async () => {
    const token = "t".repeat(43)
    const fetchImpl = vi.fn().mockResolvedValue(reply({ ticket: token }, 201))
    const getSession = vi.fn(session)
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession, fetchImpl })
    const signal = new AbortController().signal
    const destination = new URL(await client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal }))
    expect(destination.search).toBe("")
    expect(destination.hash).toBe(`#lounge_ticket=${token}`)
    expect(fetchImpl).toHaveBeenCalledWith(new URL("/api/lounge/entry/trainoracle", config.realtimeUrl), {
      method: "POST", credentials: "omit", redirect: "error", cache: "no-store", signal: expect.any(AbortSignal),
      headers: { "Content-Type": "application/json", Authorization: "Bearer lg1_" + "a".repeat(64) },
      body: JSON.stringify({ noticeVersion: status.noticeVersion }),
    })
    expect(getSession).toHaveBeenCalledTimes(3)
  })
  it("requires separate explicit account-link confirmation and sends only the one-use link token", async () => {
    const token = "l".repeat(43)
    const fetchImpl = vi.fn().mockResolvedValue(reply({ linked: true }))
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl })
    const signal = new AbortController().signal
    await expect(client.link({ token, confirmed: false, signal })).rejects.toThrow("LINK_CONFIRMATION_REQUIRED")
    expect(fetchImpl).not.toHaveBeenCalled()
    await expect(client.link({ token, confirmed: true, signal })).resolves.toBeUndefined()
    expect(fetchImpl.mock.calls[0]?.[1].body).toBe(JSON.stringify({ token }))
    expect(String(fetchImpl.mock.calls[0]?.[0])).not.toContain(token)
  })
  it("rejects a different session owner before any POST", async () => {
    const fetchImpl = vi.fn()
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: async () => ({ userId: "synthetic-B" }), fetchImpl })
    await expect(client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal: new AbortController().signal })).rejects.toThrow("LOGIN_REQUIRED")
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it("rechecks ownership after the POST, rejecting a late response for a switched account", async () => {
    const getSession = vi.fn().mockResolvedValueOnce({ userId: "synthetic-A" }).mockResolvedValueOnce({ userId: "synthetic-A" }).mockResolvedValueOnce({ userId: "synthetic-B" })
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession, fetchImpl: vi.fn().mockResolvedValue(reply({ ticket: "t".repeat(43) })) })
    await expect(client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal: new AbortController().signal })).rejects.toThrow("LOGIN_REQUIRED")
  })
  it("does not reuse a late result when cancelled after operation", async () => {
    const controller = new AbortController()
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl: vi.fn(async () => {
      controller.abort()
      return reply({ ticket: "t".repeat(43) })
    }) })
    await expect(client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal: controller.signal })).rejects.toThrow()
  })
  it.each([null, {}, { ticket: "bad" }, { ticket: "t".repeat(44) }, { ticket: "t".repeat(43) + "\n" }])("rejects invalid ticket replies", async result => {
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl: vi.fn().mockResolvedValue(reply(result)) })
    await expect(client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal: new AbortController().signal })).rejects.toThrow("TICKET_INVALID")
  })
  it("rejects trailing newline link and notice values before any POST", async () => {
    const fetchImpl = vi.fn()
    const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session, fetchImpl })
    await expect(client.link({ token: "l".repeat(43) + "\n", confirmed: true, signal: new AbortController().signal })).rejects.toThrow("LINK_CONFIRMATION_REQUIRED")
    await expect(client.enter({ accepted: true, noticeVersion: status.noticeVersion + "\n", signal: new AbortController().signal })).rejects.toThrow("NOTICE_REQUIRED")
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(captureLoungeEntryIntent(`https://trainoracle.example/#lounge_link=${"l".repeat(43)}%0A`, vi.fn()).linkToken).toBeNull()
  })
  it.each(["status", "enter", "grant"] as const)("bounds an unresponsive %s request and aborts the transport", async kind => {
    vi.useFakeTimers()
    try {
      const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}))
      const client = createTrainOracleLoungeClient({ config, expectedUserId: "synthetic-A", getSession: session,
        getGrant: kind === "grant" ? () => new Promise(() => {}) : grant, fetchImpl })
      const signal = new AbortController().signal
      const pending = kind === "status" ? client.status(signal) : client.enter({ accepted: true, noticeVersion: status.noticeVersion, signal })
      const rejected = expect(pending).rejects.toThrow("LOUNGE_REQUEST_UNAVAILABLE")
      await vi.advanceTimersByTimeAsync(LOUNGE_REQUEST_TIMEOUT_MS)
      await rejected
      if (kind === "grant") expect(fetchImpl).not.toHaveBeenCalled()
      else expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
