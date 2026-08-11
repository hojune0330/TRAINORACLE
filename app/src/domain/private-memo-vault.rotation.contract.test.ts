import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createRecoveryCode, decryptPrivateNote, encryptPrivateNote } from "./account/private-note-crypto"
import { rotatePrivateMemoVault, saveSessionRecoveryCode } from "./account/private-note-sync"
import { loadEntriesWithPrivateMemos, savePrivateEntry } from "./journal-store"
import { JOURNAL_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import { privateEntry } from "./private-memo-test-fixtures"

const vaultSchema = z.object({ version: z.literal(1), records: z.record(z.string(), z.object({ encrypted: z.object({
  version: z.literal(1), algorithm: z.literal("AES-GCM"), derivation: z.literal("PBKDF2-SHA-256"),
  iterations: z.number(), salt: z.string(), iv: z.string(), ciphertext: z.string(),
}) })) })

type StorageOverrides = Partial<Pick<Storage, "getItem" | "setItem">>

function storageWith(overrides: StorageOverrides): Storage {
  return {
    get length(): number { return window.localStorage.length },
    clear(): void { window.localStorage.clear() },
    getItem(key: string): string | null {
      return overrides.getItem === undefined ? window.localStorage.getItem(key) : overrides.getItem(key)
    },
    key(index: number): string | null { return window.localStorage.key(index) },
    removeItem(key: string): void { window.localStorage.removeItem(key) },
    setItem(key: string, value: string): void {
      if (overrides.setItem === undefined) window.localStorage.setItem(key, value)
      else overrides.setItem(key, value)
    },
  }
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("private memo vault rotation", () => {
  it("keeps all entries decryptable with the old code when the second rotation write fails", async () => {
    const originalCode = createRecoveryCode()
    const intermediateCode = createRecoveryCode()
    const rejectedCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(originalCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("one", "PRIVATE-LUNA-731-A"))).resolves.toEqual({ ok: true, total: 1 })
    await expect(savePrivateEntry(privateEntry("two", "PRIVATE-LUNA-731-B"))).resolves.toEqual({ ok: true, total: 2 })
    let writeCount = 0
    const storage = storageWith({ setItem(key, value) {
      writeCount += 1
      if (writeCount === 2) throw new DOMException("Injected final vault write failure", "QuotaExceededError")
      window.localStorage.setItem(key, value)
    } })
    await expect(rotatePrivateMemoVault(originalCode, intermediateCode, storage)).resolves.toEqual({ ok: true })
    expect(saveSessionRecoveryCode(intermediateCode)).toBe(true)

    await expect(rotatePrivateMemoVault(intermediateCode, rejectedCode, storage)).resolves.toEqual({ ok: false })

    await expect(loadEntriesWithPrivateMemos()).resolves.toEqual([
      privateEntry("one", "PRIVATE-LUNA-731-A"), privateEntry("two", "PRIVATE-LUNA-731-B"),
    ])
  })

  it("restores the prior vault after a partial rotation write and allows a retry", async () => {
    const originalCode = createRecoveryCode()
    const nextCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(originalCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("rotate-partial", "PRIVATE-LUNA-ROTATE"))).resolves.toEqual({ ok: true, total: 1 })
    const originalVault = window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    let partialNextVaultWrite = true
    const storage = storageWith({ setItem(key, value) {
      if (key === PRIVATE_MEMO_VAULT_STORAGE_KEY && partialNextVaultWrite) {
        partialNextVaultWrite = false
        window.localStorage.setItem(key, "{partial")
        return
      }
      window.localStorage.setItem(key, value)
    } })

    await expect(rotatePrivateMemoVault(originalCode, nextCode, storage)).resolves.toEqual({ ok: false })
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(originalVault)
    await expect(rotatePrivateMemoVault(originalCode, nextCode, storage)).resolves.toEqual({ ok: true })
  })

  it("restores the prior vault when rotation confirmation throws", async () => {
    const originalCode = createRecoveryCode()
    const nextCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(originalCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("rotate-readback", "PRIVATE-LUNA-ROTATE"))).resolves.toEqual({ ok: true, total: 1 })
    const originalVault = window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    let wroteVault = false
    let throwNextReadback = true
    const storage = storageWith({
      getItem(key) {
        if (key === PRIVATE_MEMO_VAULT_STORAGE_KEY && wroteVault && throwNextReadback) {
          throwNextReadback = false
          throw new Error("ReadbackError")
        }
        return window.localStorage.getItem(key)
      },
      setItem(key, value) {
        window.localStorage.setItem(key, value)
        if (key === PRIVATE_MEMO_VAULT_STORAGE_KEY) wroteVault = true
      },
    })

    await expect(rotatePrivateMemoVault(originalCode, nextCode, storage)).resolves.toEqual({ ok: false })
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(originalVault)
  })

  it("returns failure without mutation when rotation cannot read the vault", async () => {
    const originalCode = createRecoveryCode()
    const nextCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(originalCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("rotate-read", "PRIVATE-LUNA-ROTATE"))).resolves.toEqual({ ok: true, total: 1 })
    const originalVault = window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    const storage = storageWith({ getItem(key) {
      if (key === PRIVATE_MEMO_VAULT_STORAGE_KEY) throw new Error("VaultReadError")
      return window.localStorage.getItem(key)
    } })

    await expect(rotatePrivateMemoVault(originalCode, nextCode, storage)).resolves.toEqual({ ok: false })
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(originalVault)
  })

  it("does not overwrite a vault changed while rotating a recovery code", async () => {
    const originalCode = createRecoveryCode()
    const nextCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(originalCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("original", "PRIVATE-LUNA-ORIGINAL"))).resolves.toEqual({ ok: true, total: 1 })
    const originalVault = window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    if (originalVault === null) throw new Error("Expected the original vault")
    const updatedVault = vaultSchema.parse(JSON.parse(originalVault))
    updatedVault.records.concurrent = { encrypted: await encryptPrivateNote("PRIVATE-LUNA-CONCURRENT", originalCode) }
    const rawUpdatedVault = JSON.stringify(updatedVault)
    const realGetItem = Storage.prototype.getItem
    const realSetItem = Storage.prototype.setItem
    let vaultReadCount = 0
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (this === window.localStorage && key === PRIVATE_MEMO_VAULT_STORAGE_KEY && vaultReadCount++ === 1) {
        realSetItem.call(this, key, rawUpdatedVault)
      }
      return realGetItem.call(this, key)
    })

    await expect(rotatePrivateMemoVault(originalCode, nextCode)).resolves.toEqual({ ok: false })
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(rawUpdatedVault)
    await expect(decryptPrivateNote(updatedVault.records.concurrent.encrypted, originalCode))
      .resolves.toBe("PRIVATE-LUNA-CONCURRENT")
  })

  it("never writes a journal record while rotating a vault", async () => {
    const code = createRecoveryCode()
    expect(saveSessionRecoveryCode(code)).toBe(true)
    await expect(savePrivateEntry(privateEntry("rotation-scope", "PRIVATE-LUNA-SCOPE"))).resolves.toEqual({ ok: true, total: 1 })
    const originalJournal = window.localStorage.getItem(JOURNAL_STORAGE_KEY)

    await expect(rotatePrivateMemoVault(code, createRecoveryCode())).resolves.toEqual({ ok: true })

    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(originalJournal)
  })
})
