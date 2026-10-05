import { expect, it, vi } from "vitest"
import { requestProfileComparison } from "./oracle-profile-comparison-api"

const owner = "a1111111-1111-4111-8111-111111111111", id = "b2222222-2222-4222-8222-222222222222"
function fixture() {
  let active = owner, token = "fixture.jwt.token"
  const getSession = vi.fn(async () => ({ data: { session: { user: { id: active }, access_token: token } }, error: null }))
  const invoke = vi.fn(async (_name: string, _options: unknown) => ({ data: { kind: "revoked", comparisonId: id }, error: null as unknown }))
  const client = { auth: { getSession }, functions: { invoke } }
  return { invoke, changeOwner: () => { active = id }, changeSession: () => { token = "new.jwt.token" },
    dependencies: { client: async () => client as never, owner: () => active } }
}
it("pins the bearer to the request and returns only the matching server receipt", async () => {
  const f = fixture()
  expect(await requestProfileComparison(owner, { action: "revoke", comparisonId: id }, () => true, f.dependencies)).toMatchObject({ ok: true })
  expect(f.invoke).toHaveBeenCalledWith("oracle-profile-comparison", { body: { action: "revoke", comparisonId: id }, headers: { Authorization: "Bearer fixture.jwt.token" } })
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
