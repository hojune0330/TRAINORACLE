import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PostSessionEntry } from "../journal-schema"
import { loadEntriesOwnedBy, saveEntry } from "../journal-store"
import { SYNC_RECOVERY_STORAGE_KEY } from "../journal-storage-keys"
import { accountScopedStorageKeyFor } from "./local-account-scope"
import { assignJournalsToAccount, setActiveLocalAccount } from "./local-journal-ownership"
import { loadSyncConsent, saveSyncConsent } from "./sync-local"
import { recordTombstone } from "./tombstone"
import { syncNow } from "./sync-run"
import { previewSync } from "./sync-preview"

type Phase = "schema" | "journal-select" | "tombstone-select" | "journal-upsert" | "tombstone-upsert" | "journal-delete" | "pre-upload-session"
type Cancellation = "logout" | "account-switch" | "consent-off" | "account-journal-on"
type Row = { user_id: string; entry_id: string; entry: PostSessionEntry }

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

let paused: Phase | null
let entered: ReturnType<typeof deferred>
let released: ReturnType<typeof deferred>
let sessionUserId: string | null
let entries: Row[]
let events: Phase[]
let pushFails: boolean

async function pause(phase: Phase) {
  events.push(phase)
  if (paused === phase) {
    entered.resolve()
    await released.promise
  }
}

function table(name: string) {
  const journal = name === "journal_entries"
  return {
    select() {
      return { async eq() {
        const data = journal ? entries.map(row => ({ entry: row.entry })) : []
        await pause(journal ? "journal-select" : "tombstone-select")
        return { data, error: null }
      } }
    },
    async upsert(rows: Row[]) {
      if (journal && !pushFails) {
        for (const row of rows) {
          const index = entries.findIndex(existing => existing.entry_id === row.entry_id)
          if (index < 0) entries.push(row)
          else entries[index] = row
        }
      }
      // A write may already be committed while its acknowledgement is delayed.
      await pause(journal ? "journal-upsert" : "tombstone-upsert")
      return { error: journal && pushFails ? { message: "synthetic write failure" } : null }
    },
    delete() {
      return { eq() { return { async in(_column: string, ids: string[]) {
        entries = entries.filter(row => !ids.includes(row.entry_id))
        await pause("journal-delete")
        return { error: null }
      } } } }
    },
  }
}

vi.mock("./supabase-client", () => ({
  supabase: async () => ({
    auth: { getSession: async () => {
      const session = sessionUserId === null ? null : { user: { id: sessionUserId } }
      if (paused === "pre-upload-session" && loadEntriesOwnedBy("account-a").some(entry => entry.id === "remote-live")) {
        await pause("pre-upload-session")
      }
      return { data: { session }, error: null }
    } },
    rpc: async () => { await pause("schema"); return { data: 17, error: null } },
    from: (name: string) => table(name),
  }),
}))

function post(id: string): PostSessionEntry {
  return {
    id, kind: "post-session", date: "2026-09-08", savedAt: "2026-09-08T01:00:00.000Z",
    syncState: "local", system: "base", title: "Synthetic session", distanceKm: "1",
    durationMin: "10", avgPace: "10:00", rpe: 2, memo: "",
    fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" } },
  }
}

const checkpointKey = accountScopedStorageKeyFor(SYNC_RECOVERY_STORAGE_KEY, "account-a")
const consent = { enabled: true, shareTrainingNotes: false }
const cancellations: Cancellation[] = ["logout", "account-switch", "consent-off", "account-journal-on"]

function cancel(reason: Cancellation) {
  if (reason === "account-journal-on") vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
  else if (reason === "consent-off") saveSyncConsent({ ...consent, enabled: false }, "account-a")
  else {
    sessionUserId = reason === "logout" ? null : "account-b"
    setActiveLocalAccount(sessionUserId)
  }
}

beforeEach(() => {
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "false")
  vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
  window.localStorage.clear()
  window.sessionStorage.clear()
  paused = null
  entered = deferred()
  released = deferred()
  sessionUserId = "account-a"
  events = []
  pushFails = false
  for (const owner of ["account-b", "account-a"]) {
    setActiveLocalAccount(owner)
    const entry = post(`${owner}-local`)
    expect(saveEntry(entry).ok).toBe(true)
    expect(assignJournalsToAccount([entry.id], owner)).toBe(true)
    expect(saveSyncConsent(consent, owner)).toBe(true)
  }
  expect(assignJournalsToAccount(["remote-deleted"], "account-a")).toBe(true)
  expect(recordTombstone("remote-deleted")).toBe(true)
  entries = ["remote-live", "remote-deleted"].map(id => ({ user_id: "account-a", entry_id: id, entry: post(id) }))
})

afterEach(() => vi.unstubAllEnvs())

describe("sync asynchronous cancellation", () => {
  it("blocks direct old sync and preview before any server activity or storage mutation", async () => {
    cancel("account-journal-on")
    const before = { ...window.localStorage }
    expect(await syncNow("account-a")).toMatchObject({ ok: false, pushed: 0, deleted: 0 })
    expect(await previewSync("account-a")).toMatchObject({ ok: false, remoteJournalCount: 0 })
    expect(events).toEqual([])
    expect({ ...window.localStorage }).toEqual(before)
  })

  it.each(["schema", "journal-select"] as const)("rejects stale preview after delayed %s", async phase => {
    paused = phase
    const running = previewSync("account-a")
    await entered.promise
    const before = { ...window.localStorage }
    cancel("account-journal-on")
    released.resolve()
    expect(await running).toMatchObject({ ok: false, remoteJournalCount: 0 })
    expect(events.at(-1)).toBe(phase)
    expect({ ...window.localStorage }).toEqual(before)
  })
  it("completes an authorized positive roundtrip and clears only its recovery checkpoint", async () => {
    const result = await syncNow("account-a")
    expect(result).toMatchObject({ ok: true, pulled: 2, pushed: 2, deleted: 1, total: 2 })
    expect(loadEntriesOwnedBy("account-a").map(entry => entry.id).sort()).toEqual(["account-a-local", "remote-live"])
    expect(loadEntriesOwnedBy("account-b").map(entry => entry.id)).toEqual(["account-b-local"])
    expect(entries.map(row => row.entry_id).sort()).toEqual(["account-a-local", "remote-live"])
    expect(window.localStorage.getItem(checkpointKey)).toBeNull()
  })

  for (const phase of ["schema", "journal-select", "tombstone-select"] as const) {
    it.each(cancellations)(`stops after delayed ${phase} on %s before local merge or upload`, async reason => {
      paused = phase
      const running = syncNow("account-a")
      await entered.promise
      const beforeA = loadEntriesOwnedBy("account-a")
      const beforeB = loadEntriesOwnedBy("account-b")
      cancel(reason)
      released.resolve()
      const result = await running
      expect(result.ok).toBe(false)
      expect(result.pushed).toBe(0)
      expect(result.deleted).toBe(0)
      expect(events.at(-1)).toBe(phase)
      expect(loadEntriesOwnedBy("account-a")).toEqual(beforeA)
      expect(loadEntriesOwnedBy("account-b")).toEqual(beforeB)
      expect(loadSyncConsent("account-b")).toEqual(consent)
      expect(window.localStorage.getItem(checkpointKey)).toBeNull()
    })
  }

  for (const phase of ["journal-upsert", "tombstone-upsert", "journal-delete"] as const) {
    it.each(cancellations)(`reports partial work after delayed ${phase} on %s without continuing or clearing data`, async reason => {
      paused = phase
      const running = syncNow("account-a")
      await entered.promise
      const beforeA = loadEntriesOwnedBy("account-a")
      const beforeB = loadEntriesOwnedBy("account-b")
      const checkpoint = window.localStorage.getItem(checkpointKey)
      expect(checkpoint).not.toBeNull()
      cancel(reason)
      released.resolve()
      const result = await running
      expect(result).toMatchObject({ ok: false, pulled: 2, pushed: 2, deleted: phase === "journal-delete" ? 1 : 0, total: 2 })
      expect(result.message).toContain("중단")
      expect(events.at(-1)).toBe(phase)
      expect(loadEntriesOwnedBy("account-a")).toEqual(beforeA)
      expect(loadEntriesOwnedBy("account-b")).toEqual(beforeB)
      expect(window.localStorage.getItem(checkpointKey)).toBe(checkpoint)
      expect(entries.some(row => row.entry_id === "account-a-local")).toBe(true)
    })
  }

  it.each(cancellations)("rechecks local scope and consent after a delayed session check on %s before uploading", async reason => {
    paused = "pre-upload-session"
    const running = syncNow("account-a")
    await entered.promise
    const merged = loadEntriesOwnedBy("account-a")
    const checkpoint = window.localStorage.getItem(checkpointKey)
    expect(merged.map(entry => entry.id)).toContain("remote-live")
    expect(checkpoint).not.toBeNull()
    cancel(reason)
    released.resolve()
    const result = await running
    expect(result).toMatchObject({ ok: false, pulled: 2, pushed: 0, deleted: 0, total: 2 })
    expect(result.message).toContain("중단")
    expect(events.at(-1)).toBe("pre-upload-session")
    expect(events).not.toContain("journal-upsert")
    expect(loadEntriesOwnedBy("account-a")).toEqual(merged)
    expect(window.localStorage.getItem(checkpointKey)).toBe(checkpoint)
  })

  it.each(["local-scope-only", "session-only"])("checks %s independently after a delayed query", async change => {
    paused = "journal-select"
    const running = syncNow("account-a")
    await entered.promise
    if (change === "local-scope-only") setActiveLocalAccount("account-b")
    else sessionUserId = "account-b"
    released.resolve()
    const result = await running
    expect(result).toMatchObject({ ok: false, failureCode: "SESSION_TARGET_MISMATCH", pushed: 0, total: 1 })
    expect(events.at(-1)).toBe("journal-select")
    expect(loadEntriesOwnedBy("account-a").map(entry => entry.id)).toEqual(["account-a-local"])
  })

  it("can explicitly retry acknowledged partial work without duplicating or losing either account's data", async () => {
    paused = "journal-upsert"
    const running = syncNow("account-a")
    await entered.promise
    cancel("consent-off")
    released.resolve()
    expect(await running).toMatchObject({ ok: false, pushed: 2, deleted: 0 })
    expect(window.localStorage.getItem(checkpointKey)).not.toBeNull()
    paused = null
    saveSyncConsent(consent, "account-a")
    expect(await syncNow("account-a")).toMatchObject({ ok: true, total: 2, deleted: 1 })
    expect(entries.map(row => row.entry_id).sort()).toEqual(["account-a-local", "remote-live"])
    expect(loadEntriesOwnedBy("account-b").map(entry => entry.id)).toEqual(["account-b-local"])
    expect(window.localStorage.getItem(checkpointKey)).toBeNull()
  })

  it("does not count a failed in-flight upload as confirmed partial success", async () => {
    paused = "journal-upsert"
    pushFails = true
    const running = syncNow("account-a")
    await entered.promise
    cancel("consent-off")
    released.resolve()
    const result = await running
    expect(result).toMatchObject({ ok: false, pushed: 0, deleted: 0, total: 2 })
    expect(events.at(-1)).toBe("journal-upsert")
    expect(window.localStorage.getItem(checkpointKey)).not.toBeNull()
  })
})
