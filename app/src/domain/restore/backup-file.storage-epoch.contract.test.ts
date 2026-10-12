import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initializeCanonicalJournalStorage, CANONICAL_JOURNAL_MANIFEST_KEY } from "../canonical-journal-storage"
import { eraseAllLocalData } from "../erase-local-data"
import { setActiveLocalAccount } from "../account/local-journal-ownership"
import { JOURNAL_STORAGE_KEY } from "../journal-storage-keys"
import type { PostSessionEntry } from "../journal-schema"
import { buildRestorePlan, restoreEntries } from "./backup-file"

const backupEntry: PostSessionEntry = {
  id: "synthetic-deferred-backup-entry", kind: "post-session", date: "2026-10-12",
  savedAt: "2026-10-12T03:00:00Z", syncState: "local", system: "base", title: "Synthetic reviewed backup",
  distanceKm: "4", durationMin: "25", avgPace: "6:15", rpe: 3,
  memo: "SYNTHETIC-ERASED-BACKUP-PAYLOAD", memoPurpose: "ANALYZABLE_TRAINING_NOTE",
}

function deferRestoreLock(): () => void {
  let release: (() => void) | undefined
  vi.stubGlobal("navigator", {
    locks: {
      request<T>(name: string, _options: unknown, callback: () => T | Promise<T>): Promise<T> {
        if (name !== "trainoracle-local-profile-restore:v1") return Promise.resolve(callback())
        return new Promise<T>((resolve, reject) => {
          release = () => { Promise.resolve().then(callback).then(resolve, reject) }
        })
      },
    },
  })
  return () => {
    if (release === undefined) throw new Error("Restore did not request its lock")
    release()
  }
}

beforeEach(async () => {
  setActiveLocalAccount(null)
  localStorage.clear()
  sessionStorage.clear()
  expect(await initializeCanonicalJournalStorage(localStorage, sessionStorage)).toEqual({ status: "ready" })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear() })

describe("backup restore binds the storage epoch before waiting for a lock", () => {
  it("restores a queued reviewed backup when the storage epoch remains unchanged", async () => {
    const release = deferRestoreLock()
    const work = restoreEntries(buildRestorePlan([backupEntry]))
    release()
    expect(await work).toMatchObject({ restored: 1, failed: 0, commit: "COMMITTED" })
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toContain(backupEntry.id)
  })

  it.each([false, true])("does not resurrect a reviewed backup after explicit device erase (full trace=%s)", async includeDeletionRecord => {
    const epoch = localStorage.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
    const release = deferRestoreLock()
    const work = restoreEntries(buildRestorePlan([backupEntry]))
    expect(eraseAllLocalData({ includeDeletionRecord }).ok).toBe(true)
    expect(localStorage.getItem(CANONICAL_JOURNAL_MANIFEST_KEY)).not.toBe(epoch)
    release()
    expect(await work).toMatchObject({ restored: 0, failed: 1, commit: "FAILED", failureReason: "STATE_CHANGED" })
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
    const values = Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)
      return key === null ? "" : localStorage.getItem(key) ?? ""
    }).join("\n")
    expect(values).not.toContain(backupEntry.memo)
    expect(values).not.toContain(backupEntry.id)
  })
})
