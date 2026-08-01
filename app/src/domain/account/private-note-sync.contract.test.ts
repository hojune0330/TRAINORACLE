import { beforeEach, describe, expect, it } from "vitest"
import type { PostSessionEntry } from "../journal-schema"
import {
  decryptPrivateJournalEntry,
  encryptPrivateJournalEntry,
  loadSessionRecoveryCode,
  saveSessionRecoveryCode,
} from "./private-note-sync"
import { createRecoveryCode } from "./private-note-crypto"

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
})
