import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import {
  deleteEntry,
  loadEntries,
  loadEntriesWithPrivateMemos,
  restoreDeletedEntry,
  saveEntry,
  savePrivateEntry,
  updateEntry,
} from "./journal-store"
import { createRecoveryCode, decryptPrivateNote } from "./account/private-note-crypto"
import { saveSessionRecoveryCode } from "./account/private-note-sync"
import { purgeExpiredTrash } from "./journal-trash"
import { privateEntry } from "./private-memo-test-fixtures"

const vaultSchema = z.object({
  version: z.literal(1),
  records: z.record(z.string(), z.object({ encrypted: z.object({
    version: z.literal(1),
    algorithm: z.literal("AES-GCM"),
    derivation: z.literal("PBKDF2-SHA-256"),
    iterations: z.number(),
    salt: z.string(),
    iv: z.string(),
    ciphertext: z.string(),
  }) })),
})

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("private memo local vault lifecycle", () => {
  it("keeps non-private journal saves synchronous", () => {
    const entry = { ...privateEntry("training-note", "ANALYZABLE-LUNA-731"), memoPurpose: "ANALYZABLE_TRAINING_NOTE" as const }

    expect(saveEntry(entry)).toEqual({ ok: true, total: 1 })
    expect(loadEntries()).toEqual([entry])
  })

  it("removes private text from local storage and restores it only with the session code", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)

    await expect(savePrivateEntry(privateEntry("private-luna", "PRIVATE-LUNA-731")))
      .resolves.toEqual({ ok: true, total: 1 })

    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-731")
    const rawVault = window.localStorage.getItem("trainoracle.private-memo.v1")
    if (rawVault === null) throw new Error("Expected the private memo vault")
    const record = vaultSchema.parse(JSON.parse(rawVault)).records["private-luna"]
    if (record === undefined) throw new Error("Expected encrypted private memo record")
    await expect(decryptPrivateNote(record.encrypted, recoveryCode)).resolves.toBe("PRIVATE-LUNA-731")
    await expect(loadEntriesWithPrivateMemos()).resolves.toEqual([privateEntry("private-luna", "PRIVATE-LUNA-731")])
  })

  it("removes ciphertext when a private memo is cleared", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    const saved = privateEntry("clear-private", "PRIVATE-LUNA-CLEAR")
    await expect(savePrivateEntry(saved)).resolves.toEqual({ ok: true, total: 1 })

    expect(updateEntry({ ...saved, memo: "", savedAt: "2026-08-01T00:01:00.000Z" }, saved.savedAt))
      .toEqual({ ok: true, total: 1 })
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-CLEAR")
  })

  it("removes ciphertext when a private journal entry is deleted", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("delete-private", "PRIVATE-LUNA-DELETE"))).resolves.toEqual({ ok: true, total: 1 })

    expect(deleteEntry("delete-private").ok).toBe(true)
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-DELETE")
  })

  it("hydrates a fresh session before creating an explicit full private backup", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("fresh-export", "PRIVATE-LUNA-FRESH-EXPORT"))).resolves.toEqual({ ok: true, total: 1 })

    vi.resetModules()
    const reloadedStore = await import("./journal-store")
    expect(() => reloadedStore.exportEntriesJSON({ includeRawMemos: true })).toThrow("PRIVATE_MEMO_UNLOCK_REQUIRED")
    await reloadedStore.loadEntriesWithPrivateMemos()

    expect(reloadedStore.exportEntriesJSON({ includeRawMemos: true })).toContain("PRIVATE-LUNA-FRESH-EXPORT")
    expect(reloadedStore.exportEntriesJSON()).not.toContain("PRIVATE-LUNA-FRESH-EXPORT")
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-FRESH-EXPORT")
  })

  it("restores a private trash entry from ciphertext under its new id", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("trash-private", "PRIVATE-LUNA-TRASH"))).resolves.toEqual({ ok: true, total: 1 })

    expect(deleteEntry("trash-private").ok).toBe(true)
    const restored = restoreDeletedEntry("trash-private")
    const entries = await loadEntriesWithPrivateMemos()

    expect(restored.ok).toBe(true)
    expect(entries[0]).toEqual(expect.objectContaining({ id: restored.restoredId, memo: "PRIVATE-LUNA-TRASH" }))
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-TRASH")
  })

  it("removes expired private-trash ciphertext without persisting plaintext", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("expired-private", "PRIVATE-LUNA-EXPIRED"))).resolves.toEqual({ ok: true, total: 1 })
    expect(deleteEntry("expired-private").ok).toBe(true)

    expect(purgeExpiredTrash(Date.now() + 31 * 24 * 60 * 60 * 1000)).toBe(1)
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-EXPIRED")
  })
})

function allLocalStorageValues(): string {
  return [...Array(window.localStorage.length)]
    .flatMap((_, index) => {
      const key = window.localStorage.key(index)
      return key === null ? [] : [window.localStorage.getItem(key) ?? ""]
    })
    .join("\n")
}
