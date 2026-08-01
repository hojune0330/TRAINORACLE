import { describe, expect, it } from "vitest"
import { createSupportInvitationCode, hashSupportInvitationCode } from "./support-invitations"

describe("support invitation code", () => {
  it("creates a shareable code and stores only its hash", async () => {
    const code = createSupportInvitationCode()
    const hash = await hashSupportInvitationCode(code)

    expect(code).toMatch(/^(?:[A-Z0-9]{4}-){2}[A-Z0-9]{4}$/u)
    expect(hash).toMatch(/^[a-f0-9]{64}$/u)
    expect(hash).not.toContain(code.replaceAll("-", "").toLowerCase())
  })

  it("normalizes lowercase and spaces before hashing", async () => {
    await expect(hashSupportInvitationCode("abcd efgh ijkl"))
      .resolves.toBe(await hashSupportInvitationCode("ABCD-EFGH-IJKL"))
  })

  it("rejects malformed codes", async () => {
    await expect(hashSupportInvitationCode("short")).rejects.toThrow()
  })
})
