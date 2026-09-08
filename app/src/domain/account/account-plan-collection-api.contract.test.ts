import { afterEach, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAccountPlanCollectionClient } from "./account-plan-collection-api"
import { emptyAccountPlanDocument, accountPlanEntry } from "./account-plan-document-schema"
import { splitAccountPlanCollection } from "./account-plan-collection-schema"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
const OWNER = "11111111-1111-4111-8111-111111111111", OTHER = "22222222-2222-4222-8222-222222222222"
afterEach(() => vi.restoreAllMocks())
function dependencies(data: unknown, error: unknown = null) {
  const invoke = vi.fn().mockResolvedValue({ data, error })
  const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: OWNER } } }, error: null }) }
  return { client: vi.fn().mockResolvedValue({ auth, functions: { invoke } } as unknown as SupabaseClient),
    owner: () => OWNER, invoke, auth }
}
it("reads the compact index without downloading all plan bodies", async () => {
  const index = splitAccountPlanCollection(emptyAccountPlanDocument()).index
  const deps = dependencies({ kind: "index", revision: 1, index })
  expect(await createAccountPlanCollectionClient(OWNER, () => true, deps).readIndex()).toEqual({ revision: 1, index })
  expect(deps.invoke).toHaveBeenCalledExactlyOnceWith("account-plan-collection", { body: { action: "readIndex" } })
})
it("only explicit missing is empty; outages and wrong success shapes are not", async () => {
  expect(await createAccountPlanCollectionClient(OWNER, () => true, dependencies({ kind: "missing" })).readIndex()).toBeNull()
  for (const deps of [dependencies(null, { context: new Response(null, { status: 503 }) }),
    dependencies({ kind: "staged" }), dependencies({ kind: "index", revision: 0, index: {} })]) {
    await expect(createAccountPlanCollectionClient(OWNER, () => true, deps).readIndex()).rejects.toThrow()
  }
})
it("does not send without the matching account session", async () => {
  const deps = dependencies({ kind: "missing" })
  deps.auth.getSession.mockResolvedValue({ data: { session: { user: { id: OTHER } } }, error: null })
  await expect(createAccountPlanCollectionClient(OWNER, () => true, deps).readIndex()).rejects.toMatchObject({ code: "AUTH_REQUIRED" })
  expect(deps.invoke).not.toHaveBeenCalled()
})
it("drops a response after account scope changes during transport", async () => {
  const deps = dependencies(null)
  let current = true
  deps.invoke.mockImplementation(async () => { current = false; return { data: { kind: "missing" }, error: null } })
  await expect(createAccountPlanCollectionClient(OWNER, () => current, deps).readIndex()).rejects.toMatchObject({ code: "STALE" })
})
it("rejects another owner before any network access", async () => {
  const deps = dependencies(null), client = createAccountPlanCollectionClient(OWNER, () => true, deps)
  await expect(client.receipt(OTHER, OWNER)).rejects.toMatchObject({ code: "STALE" })
  expect(deps.client).not.toHaveBeenCalled()
})
it("rejects valid but unrelated part responses", async () => {
  const document = emptyAccountPlanDocument(); document.data.plans.push(accountPlanEntry(accountPlanPacketFixture(3)))
  const part = splitAccountPlanCollection(document).snapshots[0]!
  const deps = dependencies({ kind: "part", part }), client = createAccountPlanCollectionClient(OWNER, () => true, deps)
  expect(await client.readPart(OWNER, part.kind, part.id)).toEqual(part)
  await expect(client.readPart(OWNER, "PLAN_PROGRESS", part.id)).rejects.toMatchObject({ code: "INVALID" })
})
it("freezes stage content before session acquisition awaits", async () => {
  const document = emptyAccountPlanDocument(); document.data.plans.push(accountPlanEntry(accountPlanPacketFixture(3)))
  const part = splitAccountPlanCollection(document).snapshots[0]!, original = structuredClone(part)
  const deps = dependencies({ kind: "staged" }), client = createAccountPlanCollectionClient(OWNER, () => true, deps)
  const write = client.stage(OWNER, part)
  part.planId = "changed"
  await write
  expect(deps.invoke).toHaveBeenCalledWith("account-plan-collection", { body: { action: "stage", part: original } })
})
it("does not treat a missing receipt property as an acknowledged write", async () => {
  const deps = dependencies({ kind: "receipt" })
  // The transfer core also verifies exact receipt fields before accepting a save.
  await expect(createAccountPlanCollectionClient(OWNER, () => true, deps).receipt(OWNER, OWNER)).rejects.toMatchObject({ code: "INVALID" })
})
it.each([400, 405, 413, 415, 422])("HTTP %s rejection is invalid, not an endlessly retryable network outage", async status => {
  const deps = dependencies(null, { context: new Response(null, { status }) })
  await expect(createAccountPlanCollectionClient(OWNER, () => true, deps).readIndex()).rejects.toMatchObject({ code: "INVALID" })
})
it("an immutable-part conflict is a rejection, not an outage", async () => {
  const document = emptyAccountPlanDocument(); document.data.plans.push(accountPlanEntry(accountPlanPacketFixture(3)))
  const part = splitAccountPlanCollection(document).snapshots[0]!
  const deps = dependencies(null, { context: new Response(null, { status: 409 }) })
  await expect(createAccountPlanCollectionClient(OWNER, () => true, deps).stage(OWNER, part)).rejects.toMatchObject({ code: "REJECTED" })
})
