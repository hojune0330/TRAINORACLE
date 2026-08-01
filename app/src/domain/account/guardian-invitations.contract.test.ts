import { describe, expect, it } from "vitest"
import { createGuardianInvitationCode, hashGuardianInvitationCode } from "./guardian-invitations"

describe("guardian confirmation code", () => {
  it("creates a readable one-time code while producing only a SHA-256 server value", async () => {
    const code = createGuardianInvitationCode()
    const hash = await hashGuardianInvitationCode(code)

    expect(code).toMatch(/^(?:[A-Z0-9]{4}-){2}[A-Z0-9]{4}$/u)
    expect(hash).toMatch(/^[a-f0-9]{64}$/u)
    expect(hash).not.toContain(code.replaceAll("-", "").toLowerCase())
  })
})
