import { describe, expect, it, vi } from "vitest"
import { verifyReturnedAuthSession } from "./verified-auth-session"

const userId = "athlete-a"
const sessionId = "11111111-1111-4111-8111-111111111111"
const accessToken = "signed-access-token-".padEnd(40, "x")

function client(claims: unknown, confirmedUserId: string | null = userId) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({ data: { claims }, error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: confirmedUserId === null ? null : { id: confirmedUserId } },
        error: null,
      }),
    },
  }
}

describe("returned auth session proof", () => {
  it("binds a server-verified user to the signed session id", async () => {
    const authClient = client({ sub: userId, session_id: sessionId })
    await expect(verifyReturnedAuthSession(authClient, { accessToken, expectedUserId: userId }))
      .resolves.toBe(sessionId)
    expect(authClient.auth.getClaims).toHaveBeenCalledWith(accessToken)
    expect(authClient.auth.getUser).toHaveBeenCalledWith(accessToken)
  })

  it.each([
    [{ sub: "athlete-b", session_id: sessionId }, userId],
    [{ sub: userId }, userId],
    [{ sub: userId, session_id: "not-a-uuid" }, userId],
    [{ sub: userId, session_id: sessionId }, "athlete-b"],
  ])("rejects mismatched or incomplete claims %#", async (claims, confirmedUserId) => {
    await expect(verifyReturnedAuthSession(client(claims, confirmedUserId), { accessToken, expectedUserId: userId }))
      .resolves.toBeNull()
  })
})
