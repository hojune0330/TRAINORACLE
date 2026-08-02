import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createGuardianInvitation,
  createGuardianInvitationCode,
  hashGuardianInvitationCode,
} from "./guardian-invitations"

type RecordedRpcCall = {
  readonly functionName: string
  readonly payload: unknown
}

const supabaseCalls = vi.hoisted((): {
  readonly inserts: unknown[]
  readonly rpcCalls: RecordedRpcCall[]
} => ({ inserts: [], rpcCalls: [] }))

vi.mock("./supabase-client", () => ({
  supabase: async () => ({
    from: (_table: string) => ({
      insert: async (payload: unknown) => {
        supabaseCalls.inserts.push(payload)
        return { error: null }
      },
    }),
    rpc: async (functionName: string, payload: unknown) => {
      supabaseCalls.rpcCalls.push({ functionName, payload })
      return { error: null }
    },
  }),
}))

describe("guardian confirmation code", () => {
  beforeEach(() => {
    supabaseCalls.inserts.length = 0
    supabaseCalls.rpcCalls.length = 0
  })

  it("creates a readable one-time code while producing only a SHA-256 server value", async () => {
    const code = createGuardianInvitationCode()
    const hash = await hashGuardianInvitationCode(code)

    expect(code).toMatch(/^(?:[A-Z0-9]{4}-){2}[A-Z0-9]{4}$/u)
    expect(hash).toMatch(/^[a-f0-9]{64}$/u)
    expect(hash).not.toContain(code.replaceAll("-", "").toLowerCase())
  })

  it("pins the existing valid guardian invitation creation result", async () => {
    const result = await createGuardianInvitation("child-a")

    expect(result.ok).toBe(true)
    expect(result.code).toMatch(/^(?:[A-Z0-9]{4}-){2}[A-Z0-9]{4}$/u)
  })

  it("does not let the client set guardian invitation expiry or insert the invitation directly", async () => {
    const result = await createGuardianInvitation("child-a")

    expect(result.ok).toBe(true)
    expect(supabaseCalls.inserts).toEqual([])
    expect(supabaseCalls.rpcCalls).toEqual([
      {
        functionName: "create_guardian_invitation",
        payload: { invitation_code_hash: expect.stringMatching(/^[a-f0-9]{64}$/u) },
      },
    ])
  })
})
