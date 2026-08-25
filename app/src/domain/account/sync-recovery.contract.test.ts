import { beforeEach, describe, expect, it } from "vitest"
import type { PostSessionEntry } from "../journal-schema"
import { loadEntries, replaceAllEntries, saveEntry } from "../journal-store"
import {
  clearSyncRecoveryCheckpoint,
  createSyncRecoveryCheckpoint,
  recoverPendingSync,
} from "./sync-recovery"
import { loadTombstones, recordTombstone } from "./tombstone"
import { assignJournalsToAccount, setActiveLocalAccount } from "./local-journal-ownership"

const RECOVERY_KEY = "trainoracle.sync.recovery.v1"

function post(id: string, savedAt = "2026-08-02T08:00:00.000Z"): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-08-02",
    savedAt,
    syncState: "local",
    system: "base",
    title: "이지런",
    distanceKm: "8",
    durationMin: "45",
    avgPace: "5:30",
    rpe: 4,
    memo: "",
  }
}

beforeEach(() => {
  window.localStorage.clear()
  setActiveLocalAccount("user-1")
})

describe("interrupted journal sync recovery", () => {
  it("restores the checkpoint without dropping entries or deletions made after interruption", () => {
    saveEntry(post("before"))
    expect(assignJournalsToAccount(["deleted-before"], "user-1")).toBe(true)
    recordTombstone("deleted-before", "2026-08-02T08:10:00.000Z")
    expect(createSyncRecoveryCheckpoint("user-1", loadEntries(), loadTombstones())).toBe(true)

    replaceAllEntries([post("remote")])
    saveEntry(post("during-outage", "2026-08-02T09:00:00.000Z"))
    expect(assignJournalsToAccount(["deleted-during"], "user-1")).toBe(true)
    recordTombstone("deleted-during", "2026-08-02T09:10:00.000Z")

    expect(recoverPendingSync("user-1")).toEqual({ ok: true, recovered: true })
    expect(loadEntries().map((entry) => entry.id).sort()).toEqual(["before", "during-outage", "remote"])
    expect(loadTombstones().map((item) => item.id)).toEqual(["deleted-before", "deleted-during"])
    expect(window.localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it("discards another account's checkpoint without blocking the current account", () => {
    saveEntry(post("user-1-entry"))
    expect(createSyncRecoveryCheckpoint("user-1", loadEntries(), [])).toBe(true)
    replaceAllEntries([post("user-2-entry")])
    setActiveLocalAccount("user-2")

    expect(recoverPendingSync("user-2")).toEqual({ ok: true, recovered: false })
    expect(loadEntries().map((entry) => entry.id)).toEqual(["user-2-entry"])
    expect(window.localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it("keeps a deletion made after interruption stronger than the checkpoint copy", () => {
    saveEntry(post("delete-me"))
    expect(createSyncRecoveryCheckpoint("user-1", loadEntries(), [])).toBe(true)
    recordTombstone("delete-me", "2026-08-02T09:10:00.000Z")

    expect(recoverPendingSync("user-1")).toEqual({ ok: true, recovered: true })
    expect(loadEntries()).toEqual([])
  })

  it("discards a malformed checkpoint without changing current entries", () => {
    saveEntry(post("safe"))
    window.localStorage.setItem(RECOVERY_KEY, "{broken")

    expect(recoverPendingSync("user-1")).toEqual({ ok: true, recovered: false })
    expect(loadEntries().map((entry) => entry.id)).toEqual(["safe"])
    expect(window.localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it("discards an expired checkpoint instead of resurrecting old entries", () => {
    saveEntry(post("current"))
    window.localStorage.setItem(RECOVERY_KEY, JSON.stringify({
      version: 1,
      userId: "user-1",
      startedAt: "2026-07-01T00:00:00.000Z",
      entries: [post("expired")],
      tombstones: [],
    }))

    expect(recoverPendingSync("user-1", Date.parse("2026-08-02T00:00:00.000Z"))).toEqual({
      ok: true,
      recovered: false,
    })
    expect(loadEntries().map((entry) => entry.id)).toEqual(["current"])
    expect(window.localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it("refuses to checkpoint a private memo plaintext", () => {
    const privateEntry: PostSessionEntry = {
      ...post("private"),
      memo: "원문 비밀",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }

    expect(createSyncRecoveryCheckpoint("user-1", [privateEntry], [])).toBe(false)
    expect(window.localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it("discards a tampered checkpoint containing private memo plaintext", () => {
    saveEntry(post("safe"))
    window.localStorage.setItem(RECOVERY_KEY, JSON.stringify({
      version: 1,
      userId: "user-1",
      startedAt: "2026-08-02T00:00:00.000Z",
      entries: [{
        ...post("private"),
        memo: "원문 비밀",
        memoPurpose: "PRIVATE_SELF_ONLY",
      }],
      tombstones: [],
    }))

    expect(recoverPendingSync("user-1", Date.parse("2026-08-02T01:00:00.000Z"))).toEqual({
      ok: true,
      recovered: false,
    })
    expect(loadEntries().map((entry) => entry.id)).toEqual(["safe"])
    expect(window.localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it("clears a completed checkpoint idempotently", () => {
    expect(clearSyncRecoveryCheckpoint()).toBe(true)
    expect(createSyncRecoveryCheckpoint("user-1", [post("safe")], [])).toBe(true)
    expect(clearSyncRecoveryCheckpoint()).toBe(true)
    expect(clearSyncRecoveryCheckpoint()).toBe(true)
  })
})
