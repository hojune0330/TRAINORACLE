import { expect, it, vi } from "vitest"
import { requestProfileComparison } from "./oracle-profile-comparison-api"
import { createClient } from "@supabase/supabase-js"
import { createConsentCheckedFetch } from "./consent-checked-fetch"
import { holdStorageTransmission, releaseStorageTransmissionHold } from "./storage-transmission-hold"

const owner = "a1111111-1111-4111-8111-111111111111", id = "b2222222-2222-4222-8222-222222222222"
const accessToken = "synthetic.jwt.token-longer-than-thirty-two-characters"
function fixture() {
  let active: string | null = owner, token = accessToken
  const getSession = vi.fn(async () => ({ data: { session: { user: { id: owner }, access_token: token } }, error: null }))
  const getClaims = vi.fn(async () => ({ data: { claims: { sub: owner, session_id: id } }, error: null as unknown }))
  const getUser = vi.fn(async () => ({ data: { user: { id: owner } }, error: null as unknown }))
  const invoke = vi.fn(async (_name: string, _options: unknown) => ({ data: { kind: "revoked", comparisonId: id }, error: null as unknown }))
  const client = { auth: { getSession, getClaims, getUser }, functions: { invoke } }
  return { invoke, getClaims, getUser, clearScope: () => { active = null }, changeOwner: () => { active = id }, changeSession: () => { token = "new.jwt.token" },
    dependencies: { client: async () => client as never, owner: () => active } }
}
it("pins the bearer to the request and returns only the matching server receipt", async () => {
  const f = fixture()
  expect(await requestProfileComparison(owner, { action: "revoke", comparisonId: id }, () => true, f.dependencies)).toMatchObject({ ok: true })
  expect(f.invoke).toHaveBeenCalledWith("oracle-profile-comparison", { body: { action: "revoke", comparisonId: id }, headers: { Authorization: `Bearer ${accessToken}` } })
  expect(f.getUser).toHaveBeenNthCalledWith(1, accessToken)
  expect(f.getClaims).toHaveBeenNthCalledWith(1, accessToken)
})

it.each(["revoke", "revokeExternal"] as const)("allows identity-verified %s with local admission closed, without granting new access", async action => {
  const f = fixture()
  f.clearScope()
  f.invoke.mockResolvedValue({ data: { kind: action === "revoke" ? "revoked" : "external-revoked", comparisonId: id }, error: null })
  expect(await requestProfileComparison(owner, { action, comparisonId: id }, () => true, f.dependencies)).toMatchObject({ ok: true })
  expect(f.getUser).toHaveBeenCalledTimes(2)
  for (const action of ["compare", "export", "status", "invitationStatus"] as const) {
    expect(await requestProfileComparison(owner, { action, comparisonId: id }, () => true, f.dependencies)).toEqual({ ok: false, code: "STALE_RESPONSE" })
  }
  expect(f.invoke).toHaveBeenCalledTimes(1)
})

it.each(["claims", "user", "rejected", "subject", "session"])("never trusts a cached session when exact-token proof fails: %s", async failure => {
  const f = fixture()
  f.clearScope()
  if (failure === "claims") f.getClaims.mockResolvedValue({ data: { claims: { sub: owner, session_id: id } }, error: new Error("denied") })
  if (failure === "user") f.getUser.mockResolvedValue({ data: { user: { id: owner } }, error: new Error("revoked") })
  if (failure === "rejected") f.getUser.mockRejectedValue(new Error("offline"))
  if (failure === "subject") f.getUser.mockResolvedValue({ data: { user: { id } }, error: null })
  if (failure === "session") f.getClaims.mockResolvedValue({ data: { claims: { sub: owner, session_id: "" } }, error: null })
  expect(await requestProfileComparison(owner, { action: "revoke", comparisonId: id }, () => true, f.dependencies)).toEqual({ ok: false, code: "AUTH_REQUIRED" })
  expect(f.invoke).not.toHaveBeenCalled()
})

it("does not transmit after owner changes during exact-token verification", async () => {
  const f = fixture()
  f.getUser.mockImplementation(async () => { f.changeOwner(); return { data: { user: { id: owner } }, error: null } })
  expect(await requestProfileComparison(owner, { action: "revoke", comparisonId: id }, () => true, f.dependencies)).toEqual({ ok: false, code: "STALE_RESPONSE" })
  expect(f.invoke).not.toHaveBeenCalled()
})

it("does not acknowledge withdrawal if server identity is revoked while in flight", async () => {
  const f = fixture()
  f.invoke.mockImplementation(async () => {
    f.getUser.mockResolvedValue({ data: { user: { id: owner } }, error: new Error("revoked") })
    return { data: { kind: "revoked", comparisonId: id }, error: null }
  })
  expect(await requestProfileComparison(owner, { action: "revoke", comparisonId: id }, () => true, f.dependencies)).toEqual({ ok: false, code: "STALE_RESPONSE" })
})

it.each(["revoke", "revokeExternal"] as const)("sends %s through the real SDK identity path while purpose consent and local admission are closed", async action => {
  const origin = "https://synthetic.supabase.co"
  const token = `x.${btoa(JSON.stringify({ sub: owner, session_id: id })).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "")}.x`
  const request = { action, comparisonId: id }
  const transport = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("true"))
    .mockResolvedValueOnce(new Response(JSON.stringify({ kind: action === "revoke" ? "revoked" : "external-revoked", comparisonId: id }), { headers: { "Content-Type": "application/json" } }))
  const client = createClient(origin, "synthetic-public", {
    global: { fetch: createConsentCheckedFetch(origin, transport) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `oracle-${action}` },
  })
  vi.spyOn(client.auth, "getSession").mockResolvedValue({ data: { session: { user: { id: owner }, access_token: token } }, error: null } as never)
  vi.spyOn(client.auth, "getClaims").mockResolvedValue({ data: { claims: { sub: owner, session_id: id } }, error: null } as never)
  vi.spyOn(client.auth, "getUser").mockResolvedValue({ data: { user: { id: owner } }, error: null } as never)
  holdStorageTransmission(owner)
  try {
    expect(await requestProfileComparison(owner, request, () => true, { client: async () => client, owner: () => null })).toMatchObject({ ok: true })
    expect(transport).toHaveBeenCalledTimes(2)
    expect(transport.mock.calls[0]?.[0]).toBe(origin + "/rest/v1/rpc/account_data_rights_identity")
    expect(JSON.parse(transport.mock.calls[0]?.[1]?.body as string)).toEqual({ expected_user_id_input: owner, expected_session_id_input: id })
    expect(transport.mock.calls[1]?.[0]).toBe(origin + "/functions/v1/oracle-profile-comparison")
    expect(JSON.parse(transport.mock.calls[1]?.[1]?.body as string)).toEqual(request)
  } finally { releaseStorageTransmissionHold(owner) }
})
it("drops responses after owner or session substitution", async () => {
  for (const change of ["changeOwner", "changeSession"] as const) {
    const f = fixture()
    f.invoke.mockImplementation(async () => { f[change](); return { data: { kind: "revoked", comparisonId: id }, error: null } })
    expect(await requestProfileComparison(owner, { action: "revoke", comparisonId: id }, () => true, f.dependencies)).toEqual({ ok: false, code: "STALE_RESPONSE" })
  }
})
it("does not accept a receipt for another comparison or fall back when the endpoint denies", async () => {
  const f = fixture()
  f.invoke.mockResolvedValue({ data: { kind: "revoked", comparisonId: owner }, error: null })
  expect(await requestProfileComparison(owner, { action: "revoke", comparisonId: id }, () => true, f.dependencies)).toEqual({ ok: false, code: "INVALID_RESPONSE" })
  f.invoke.mockResolvedValue({ data: { kind: "revoked", comparisonId: id }, error: { context: new Response(null, { status: 403 }) } })
  expect(await requestProfileComparison(owner, { action: "revoke", comparisonId: id }, () => true, f.dependencies)).toEqual({ ok: false, code: "ACCESS_DENIED" })
  expect(f.invoke).toHaveBeenCalledTimes(2)
})
