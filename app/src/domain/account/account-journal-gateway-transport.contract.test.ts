import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { accountJournalGatewayUrl, invokeAccountJournalGateway } from "./account-journal-gateway-transport"
import { rememberStorageConsentRevision } from "./storage-consent-revision"
import { FILE_MUTATION_MAX_BYTES } from "./account-file-document-codec"
import { holdStorageTransmission, releaseStorageTransmissionHold } from "./storage-transmission-hold"
import { activeLocalAccount, setActiveLocalAccount } from "./local-journal-ownership"
import { requestAccountDocument } from "./account-journal-api"
import { accountJournalRecordSchema } from "./account-journal-record-schema"
import type { SupabaseClient } from "@supabase/supabase-js"

const owner = "a1111111-1111-4111-8111-111111111111"
const other = "b2222222-2222-4222-8222-222222222222"
const serviceUrl = "https://synthetic.supabase.co", gatewayUrl = "https://company.example/api/account-journal"
const consentUrl = `${serviceUrl}/rest/v1/rpc/get_account_storage_consent`
const token = `header.${btoa(JSON.stringify({ sub: owner, session_id: other })).replace(/=/gu, "").replace(/\+/gu, "-").replace(/\//gu, "_")}.signature`
const consent = { userId: owner, revision: 7, purposeVersion: "2026-10-05", healthStorage: true, journalTextStorage: true, operationsReady: true }
const options = () => ({ gatewayUrl, serviceUrl, anonKey: "synthetic-public", ownerId: owner, token,
  body: { action: "save", syntheticDocument: "never-in-consent-rpc" }, headers: { "x-trainoracle-storage-revision": "7" },
  signal: new AbortController().signal, current: () => true })
beforeEach(() => { localStorage.clear(); setActiveLocalAccount(owner); rememberStorageConsentRevision(owner, 7) })
afterEach(() => { releaseStorageTransmissionHold(owner); setActiveLocalAccount(null); localStorage.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("company account gateway transport", () => {
  it("accepts only a configured exact HTTPS endpoint and does not reinterpret malformed routes", () => {
    expect(accountJournalGatewayUrl({})).toBeNull()
    expect(accountJournalGatewayUrl({ VITE_ACCOUNT_JOURNAL_GATEWAY_URL: gatewayUrl })).toBe(gatewayUrl)
    for (const invalid of ["http://company.example/api/account-journal", `${gatewayUrl}/`, `${gatewayUrl}?q=1`, `${gatewayUrl}#x`,
      "https://user:pass@company.example/api/account-journal", "https://company.example/api/../api/account-journal", ` ${gatewayUrl}`, true])
      expect(() => accountJournalGatewayUrl({ VITE_ACCOUNT_JOURNAL_GATEWAY_URL: invalid })).toThrow()
  })
  it("checks fresh pinned consent at Supabase before sending the same owner body only to the company route", async () => {
    const transport = vi.fn<typeof fetch>(async input => Response.json(String(input) === consentUrl ? consent : { kind: "saved" }))
    const result = await invokeAccountJournalGateway({ ...options(), transport })
    expect(result).toEqual({ data: { kind: "saved" }, error: null })
    expect(transport.mock.calls.map(call => String(call[0]))).toEqual([consentUrl, gatewayUrl])
    const check = transport.mock.calls[0]![1]!, sent = transport.mock.calls[1]![1]!
    expect(JSON.parse(String(check.body))).toEqual({ expected_user_id_input: owner })
    expect(JSON.parse(String(sent.body))).toEqual(options().body)
    for (const init of [check, sent]) {
      expect(new Headers(init.headers).get("Authorization")).toBe(`Bearer ${token}`)
      expect(init.redirect).toBe("error"); expect(init.credentials).toBe("omit")
    }
    expect(new Headers(sent.headers).get("x-trainoracle-storage-revision")).toBe("7")
  })
  it("never sends a journal body for revoked, mismatched or stale consent", async () => {
    for (const change of [{ healthStorage: false }, { revision: 8 }, { userId: other }, { operationsReady: false }]) {
      const transport = vi.fn<typeof fetch>(async () => Response.json({ ...consent, ...change }))
      const result = await invokeAccountJournalGateway({ ...options(), transport })
      expect(result.error?.context.status).toBe(403)
      expect(transport).toHaveBeenCalledTimes(1)
      expect(String(transport.mock.calls[0]![0])).toBe(consentUrl)
    }
  })
  it("does not send after owner/generation is invalidated during the consent read", async () => {
    let current = true
    const transport = vi.fn<typeof fetch>(async () => { current = false; return Response.json(consent) })
    await expect(invokeAccountJournalGateway({ ...options(), current: () => current, transport })).rejects.toThrow("STALE_ACCOUNT_GATEWAY")
    expect(transport).toHaveBeenCalledTimes(1)
    const mismatched = vi.fn<typeof fetch>()
    await expect(invokeAccountJournalGateway({ ...options(), ownerId: other, transport: mismatched })).rejects.toThrow()
    expect(mismatched).not.toHaveBeenCalled()
  })
  it("blocks a withdrawal introduced while fresh consent is in flight", async () => {
    const transport = vi.fn<typeof fetch>(async () => { holdStorageTransmission(owner); return Response.json(consent) })
    const result = await invokeAccountJournalGateway({ ...options(), transport })
    expect(result.error?.context.status).toBe(403)
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it("routes the actual account API through the guarded company path and never falls back from bad configuration", async () => {
    for (const [key, value] of Object.entries({ VITE_ACCOUNT_JOURNAL_GATEWAY_URL: gatewayUrl,
      VITE_ACCOUNT_PUBLIC_ENABLED: "true", VITE_SUPABASE_URL: serviceUrl, VITE_SUPABASE_ANON_KEY: `sb_publishable_${"a".repeat(24)}`,
      VITE_PRIVACY_POLICY_URL: "https://company.example/privacy", VITE_PRIVACY_POLICY_VERSION: "2026-11-04",
      VITE_TERMS_OF_SERVICE_URL: "https://company.example/terms", VITE_TERMS_OF_SERVICE_VERSION: "2026-11-04" })) vi.stubEnv(key, value)
    const invoke = vi.fn(), transport = vi.fn<typeof fetch>(async input => Response.json(String(input) === consentUrl ? consent : { kind: "ready" }))
    vi.stubGlobal("fetch", transport)
    const client = { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: token } }, error: null }) }, functions: { invoke } }
    const deps = { client: async () => client as unknown as SupabaseClient, owner: activeLocalAccount }
    expect(await requestAccountDocument(owner, { action: "status" }, () => true, accountJournalRecordSchema, deps)).toEqual({ ok: true, data: { kind: "ready" } })
    expect(transport).toHaveBeenCalledTimes(2); expect(invoke).not.toHaveBeenCalled()
    vi.stubEnv("VITE_ACCOUNT_JOURNAL_GATEWAY_URL", `${gatewayUrl}?bad=1`)
    expect(await requestAccountDocument(owner, { action: "status" }, () => true, accountJournalRecordSchema, deps)).toEqual({ ok: false, code: "UNAVAILABLE" })
    expect(transport).toHaveBeenCalledTimes(2); expect(invoke).not.toHaveBeenCalled()
  })
  it("retains server refusal status and bounds response expansion", async () => {
    const transport = vi.fn<typeof fetch>(async input => String(input) === consentUrl ? Response.json(consent)
      : Response.json({ error: "DOCUMENT_CAPACITY_EXCEEDED" }, { status: 413 }))
    const result = await invokeAccountJournalGateway({ ...options(), transport })
    expect(result.error?.context.status).toBe(413)
    expect(await result.error?.context.json()).toEqual({ error: "DOCUMENT_CAPACITY_EXCEEDED" })
    transport.mockImplementation(async input => String(input) === consentUrl ? Response.json(consent)
      : new Response("x".repeat(FILE_MUTATION_MAX_BYTES + 65_537)))
    await expect(invokeAccountJournalGateway({ ...options(), transport })).rejects.toThrow("INVALID_ACCOUNT_GATEWAY_RESPONSE")
  })
})
