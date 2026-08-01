import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import {
  loadEntries,
  loadEntriesWithPrivateMemos,
  saveEntry,
  savePrivateEntry,
  updateEntry,
  deleteEntry,
  restoreDeletedEntry,
} from "./journal-store"
import type { JournalEntry, PostSessionEntry } from "./journal-schema"
import { createRecoveryCode, decryptPrivateNote } from "./account/private-note-crypto"
import { rotatePrivateMemoVault, saveSessionRecoveryCode } from "./account/private-note-sync"
import { purgeExpiredTrash } from "./journal-trash"

const vaultSchema = z.object({
  version: z.literal(1),
  records: z.record(z.string(), z.object({
    encrypted: z.object({
      version: z.literal(1),
      algorithm: z.literal("AES-GCM"),
      derivation: z.literal("PBKDF2-SHA-256"),
      iterations: z.number(),
      salt: z.string(),
      iv: z.string(),
      ciphertext: z.string(),
    }),
  })),
})

function privateEntry(id: string, memo: string): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-08-01",
    savedAt: `2026-08-01T00:00:0${id.length}.000Z`,
    syncState: "local",
    system: "recovery",
    title: "",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 0,
    memo,
    memoPurpose: "PRIVATE_SELF_ONLY",
  }
}

class SecondRotationPersistenceFails implements Storage {
  private writeCount = 0

  get length(): number {
    return window.localStorage.length
  }

  clear(): void {
    window.localStorage.clear()
  }

  getItem(key: string): string | null {
    return window.localStorage.getItem(key)
  }

  key(index: number): string | null {
    return window.localStorage.key(index)
  }

  removeItem(key: string): void {
    window.localStorage.removeItem(key)
  }

  setItem(key: string, value: string): void {
    this.writeCount += 1
    if (this.writeCount === 2) throw new DOMException("Injected final vault write failure", "QuotaExceededError")
    window.localStorage.setItem(key, value)
  }
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("private memo local vault", () => {
  it("keeps non-private journal saves synchronous", () => {
    // Given
    const entry = {
      ...privateEntry("training-note", "ANALYZABLE-LUNA-731"),
      memoPurpose: "ANALYZABLE_TRAINING_NOTE" as const,
    }

    // When
    const result = saveEntry(entry)

    // Then
    expect(result).toEqual({ ok: true, total: 1 })
    expect(loadEntries()).toEqual([entry])
  })

  it("removes PRIVATE-LUNA-731 from every local-storage value and restores it only with the session code", async () => {
    // Given
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)

    // When
    const result = await savePrivateEntry(privateEntry("private-luna", "PRIVATE-LUNA-731"))

    // Then
    expect(result).toEqual({ ok: true, total: 1 })
    const values = [...Array(window.localStorage.length)]
      .flatMap((_, index) => {
        const key = window.localStorage.key(index)
        return key === null ? [] : [window.localStorage.getItem(key) ?? ""]
      })
    expect(values.join("\n")).not.toContain("PRIVATE-LUNA-731")
    const rawVault = window.localStorage.getItem("trainoracle.private-memo.v1")
    expect(rawVault).not.toBeNull()
    if (rawVault === null) throw new Error("Expected the private memo vault")
    const vault = vaultSchema.parse(JSON.parse(rawVault))
    const record = vault.records["private-luna"]
    expect(record).toBeDefined()
    if (record === undefined) throw new Error("Expected encrypted private memo record")
    await expect(decryptPrivateNote(record.encrypted, recoveryCode)).resolves.toBe("PRIVATE-LUNA-731")
    await expect(loadEntriesWithPrivateMemos()).resolves.toEqual([privateEntry("private-luna", "PRIVATE-LUNA-731")])
  })

  it("keeps all entries decryptable with the old code when the second rotation persistence fails", async () => {
    // Given
    const originalCode = createRecoveryCode()
    const intermediateCode = createRecoveryCode()
    const rejectedCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(originalCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("one", "PRIVATE-LUNA-731-A"))).resolves.toEqual({ ok: true, total: 1 })
    await expect(savePrivateEntry(privateEntry("two", "PRIVATE-LUNA-731-B"))).resolves.toEqual({ ok: true, total: 2 })
    const storage = new SecondRotationPersistenceFails()
    await expect(rotatePrivateMemoVault(originalCode, intermediateCode, storage)).resolves.toEqual({ ok: true })
    expect(saveSessionRecoveryCode(intermediateCode)).toBe(true)

    // When
    const result = await rotatePrivateMemoVault(intermediateCode, rejectedCode, storage)

    // Then
    expect(result).toEqual({ ok: false })
    await expect(loadEntriesWithPrivateMemos()).resolves.toEqual([
      privateEntry("one", "PRIVATE-LUNA-731-A"),
      privateEntry("two", "PRIVATE-LUNA-731-B"),
    ])
  })

  it("removes ciphertext when a private memo is cleared", async () => {
    // Given
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    const saved = privateEntry("clear-private", "PRIVATE-LUNA-CLEAR")
    await expect(savePrivateEntry(saved)).resolves.toEqual({ ok: true, total: 1 })

    // When
    const result = updateEntry({ ...saved, memo: "", savedAt: "2026-08-01T00:01:00.000Z" }, saved.savedAt)

    // Then
    expect(result).toEqual({ ok: true, total: 1 })
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-CLEAR")
    expect(window.localStorage.getItem("trainoracle.private-memo.v1")).not.toContain("clear-private")
  })

  it("removes ciphertext when a private journal entry is deleted", async () => {
    // Given
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("delete-private", "PRIVATE-LUNA-DELETE"))).resolves.toEqual({ ok: true, total: 1 })

    // When
    const result = deleteEntry("delete-private")

    // Then
    expect(result.ok).toBe(true)
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-DELETE")
    expect(window.localStorage.getItem("trainoracle.private-memo.v1")).not.toContain("delete-private")
  })

  it("hydrates a fresh session before creating a full private backup", async () => {
    // Given
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("fresh-export", "PRIVATE-LUNA-FRESH-EXPORT"))).resolves.toEqual({ ok: true, total: 1 })

    // When
    vi.resetModules()
    const reloadedStore = await import("./journal-store")
    expect(() => reloadedStore.exportEntriesJSON({ includeRawMemos: true }))
      .toThrow("PRIVATE_MEMO_UNLOCK_REQUIRED")
    await reloadedStore.loadEntriesWithPrivateMemos()
    const fullExport = reloadedStore.exportEntriesJSON({ includeRawMemos: true })
    const safeExport = reloadedStore.exportEntriesJSON()

    // Then
    expect(fullExport).toContain("PRIVATE-LUNA-FRESH-EXPORT")
    expect(safeExport).not.toContain("PRIVATE-LUNA-FRESH-EXPORT")
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-FRESH-EXPORT")
  })

  it("restores a private trash entry from ciphertext under its new id", async () => {
    // Given
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("trash-private", "PRIVATE-LUNA-TRASH"))).resolves.toEqual({ ok: true, total: 1 })

    // When
    expect(deleteEntry("trash-private").ok).toBe(true)
    const restored = restoreDeletedEntry("trash-private")

    // Then
    expect(restored.ok).toBe(true)
    const entries = await loadEntriesWithPrivateMemos()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(expect.objectContaining({ id: restored.restoredId, memo: "PRIVATE-LUNA-TRASH" }))
    expect(allLocalStorageValues()).not.toContain("PRIVATE-LUNA-TRASH")
  })

  it("removes expired private-trash ciphertext without persisting plaintext", async () => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry("expired-private", "PRIVATE-LUNA-EXPIRED"))).resolves.toEqual({ ok: true, total: 1 })
    expect(deleteEntry("expired-private").ok).toBe(true)

    expect(purgeExpiredTrash(Date.now() + 31 * 24 * 60 * 60 * 1000)).toBe(1)

    expect(window.localStorage.getItem("trainoracle.journal.trash.v1")).not.toContain("expired-private")
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
