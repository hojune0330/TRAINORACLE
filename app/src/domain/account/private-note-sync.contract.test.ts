import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PostSessionEntry } from "../journal-schema"
import {
  decryptPrivateJournalEntry,
  encryptPrivateJournalEntry,
  loadSessionRecoveryCode,
  rotateSessionRecoveryCode,
  saveSessionRecoveryCode,
} from "./private-note-sync"
import { createRecoveryCode } from "./private-note-crypto"
import { loadEntriesWithPrivateMemos, savePrivateEntry } from "../journal-store"

const privateEntry: PostSessionEntry = {
  id: "private-1",
  kind: "post-session",
  date: "2026-08-01",
  savedAt: "2026-08-01T00:00:00.000Z",
  syncState: "local",
  system: "recovery",
  title: "쉼",
  distanceKm: "",
  durationMin: "",
  avgPace: "",
  rpe: 0,
  memo: "오늘의 개인 일기",
  memoPurpose: "PRIVATE_SELF_ONLY",
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("private memo encrypted sync", () => {
  it("encrypts and restores the complete private journal entry", async () => {
    const code = createRecoveryCode()
    const encrypted = await encryptPrivateJournalEntry(privateEntry, code)

    expect(encrypted).not.toBeNull()
    expect(JSON.stringify(encrypted)).not.toContain("오늘의 개인 일기")
    await expect(decryptPrivateJournalEntry(encrypted, code)).resolves.toEqual(privateEntry)
  })

  it("does not create a private ciphertext for a training note", async () => {
    await expect(encryptPrivateJournalEntry({
      ...privateEntry,
      memoPurpose: "ANALYZABLE_TRAINING_NOTE",
    }, createRecoveryCode())).resolves.toBeNull()
  })

  it("keeps the recovery code in session storage and never local storage", () => {
    const code = createRecoveryCode()
    expect(saveSessionRecoveryCode(code)).toBe(true)
    expect(loadSessionRecoveryCode()).toBe(code)
    expect([...Array(window.localStorage.length)].map((_, index) => window.localStorage.key(index)))
      .not.toContain("trainoracle.private-note.recovery.v1")
  })

  it("rotates the session recovery code and keeps a real private memo decryptable", async () => {
    const previousCode = createRecoveryCode()
    const nextCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(previousCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry)).resolves.toEqual({ ok: true, total: 1 })

    await expect(rotateSessionRecoveryCode(previousCode, nextCode)).resolves.toEqual({ ok: true })

    expect(loadSessionRecoveryCode()).toBe(nextCode)
    await expect(loadEntriesWithPrivateMemos()).resolves.toEqual([privateEntry])
  })

  it("keeps the old session and vault decryptable when saving a rotated code fails", async () => {
    const previousCode = createRecoveryCode()
    const nextCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(previousCode)).toBe(true)
    await expect(savePrivateEntry(privateEntry)).resolves.toEqual({ ok: true, total: 1 })
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === window.sessionStorage && key === "trainoracle.private-note.recovery.v1") {
        throw new DOMException("Injected session write failure", "QuotaExceededError")
      }
      return realSetItem.call(this, key, value)
    })

    await expect(rotateSessionRecoveryCode(previousCode, nextCode)).resolves.toEqual({ ok: false })

    expect(loadSessionRecoveryCode()).toBe(previousCode)
    await expect(loadEntriesWithPrivateMemos()).resolves.toEqual([privateEntry])
  })
})
