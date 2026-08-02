import { describe, expect, it } from "vitest"
import {
  createRecoveryCode,
  decryptPrivateNote,
  encryptPrivateNote,
} from "./private-note-crypto"

describe("private memo end-to-end encryption", () => {
  it("round-trips a private memo with the user recovery code", async () => {
    const code = createRecoveryCode()
    const encrypted = await encryptPrivateNote("오늘은 마음이 복잡했다.", code)

    expect(encrypted.ciphertext).not.toContain("마음이 복잡")
    await expect(decryptPrivateNote(encrypted, code)).resolves.toBe("오늘은 마음이 복잡했다.")
  })

  it("cannot decrypt with a different recovery code", async () => {
    const encrypted = await encryptPrivateNote("나만 보는 글", createRecoveryCode())

    await expect(decryptPrivateNote(encrypted, createRecoveryCode())).rejects.toThrow()
  })

  it("rejects an invalid recovery code before encryption", async () => {
    await expect(encryptPrivateNote("나만 보는 글", "short")).rejects.toThrow(/복구 코드/u)
  })

  it("rejects malformed ciphertext without returning private text", async () => {
    const code = createRecoveryCode()

    await expect(decryptPrivateNote({
      version: 1,
      algorithm: "AES-GCM",
      derivation: "PBKDF2-SHA-256",
      iterations: 210_000,
      salt: "not-base64",
      iv: "not-base64",
      ciphertext: "not-base64",
    }, code)).rejects.toThrow()
  })
})
