import type { SupabaseClient } from "@supabase/supabase-js"
import { beforeEach, expect, it, vi } from "vitest"
import { requestAccountDocument } from "./account-journal-api"
import { accountGoalProgramDocumentSchema } from "./account-goal-program-schema"

const owner = "a1111111-1111-4111-8111-111111111111", documentId = "b2222222-2222-4222-8222-222222222222"
beforeEach(() => localStorage.clear())
function dependency(data: unknown, error: unknown = null) {
  const invoke = vi.fn().mockResolvedValue({ data, error })
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: "synthetic-monthly-token" } }, error: null }) },
    functions: { invoke } } as unknown as SupabaseClient
  return { client: async () => client, owner: () => owner, invoke }
}
it("accepts only the exact monthly capability kind/version and freezes the authenticated owner token", async () => {
  for (const response of [{ kind: "ready" }, { kind: "running-profile-support", version: 1 }, { kind: "goal-program-support", version: 2 }]) {
    expect(await requestAccountDocument(owner, { action: "goalProgramSupport" }, () => true, accountGoalProgramDocumentSchema, dependency(response)))
      .toEqual({ ok: false, code: "INVALID_RESPONSE" })
  }
  const deps = dependency({ kind: "goal-program-support", version: 1 })
  expect(await requestAccountDocument(owner, { action: "goalProgramSupport" }, () => true, accountGoalProgramDocumentSchema, deps))
    .toEqual({ ok: true, data: { kind: "goal-program-support", version: 1 } })
  expect(deps.invoke.mock.calls[0]?.[1].headers.Authorization).toBe("Bearer synthetic-monthly-token")
})
it("allows only the additive probe to interpret an old route/action as unsupported, never a document read", async () => {
  for (const status of [400, 404, 501]) {
    const error = { context: new Response(JSON.stringify({ error: "GOAL_PROGRAM_UNSUPPORTED" }), { status }) }
    expect(await requestAccountDocument(owner, { action: "goalProgramSupport" }, () => true, accountGoalProgramDocumentSchema, dependency(null, error)))
      .toEqual({ ok: false, code: "GOAL_PROGRAM_UNSUPPORTED" })
    expect(await requestAccountDocument(owner, { action: "read", documentId }, () => true, accountGoalProgramDocumentSchema, dependency(null, error)))
      .toEqual({ ok: false, code: status === 404 ? "NOT_FOUND" : "UNAVAILABLE" })
  }
})
it("never treats capability outages, authentication failures or malformed data as an empty program", async () => {
  for (const [status, code] of [[401, "AUTH_REQUIRED"], [503, "UNAVAILABLE"]] as const) {
    expect(await requestAccountDocument(owner, { action: "goalProgramSupport" }, () => true, accountGoalProgramDocumentSchema,
      dependency(null, { context: new Response("{}", { status }) }))).toEqual({ ok: false, code })
  }
  expect(await requestAccountDocument(owner, { action: "read", documentId }, () => true, accountGoalProgramDocumentSchema,
    dependency({ kind: "document", documentId, revision: 1, document: { version: 4, state: "ACCOUNT_STATE", kind: "GOAL_PROGRAM_INDEX" } })))
    .toEqual({ ok: false, code: "INVALID_RESPONSE" })
})
