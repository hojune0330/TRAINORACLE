import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { saveEntry } from "../journal-store"
import type { PostSessionEntry } from "../journal-schema"

type Row = Record<string, unknown>

type RecoveryTestServer = {
  entries: Row[]
  privateNotes: Row[]
  schemaVersion: number
  schemaRpcFails: boolean
  entryPushFails: boolean
  rpcCallCount: number
  journalSelectCount: number
}

const server: RecoveryTestServer = {
  entries: [],
  privateNotes: [],
  schemaVersion: 17,
  schemaRpcFails: false,
  entryPushFails: false,
  rpcCallCount: 0,
  journalSelectCount: 0,
}

function table(name: string) {
  return {
    select() {
      return {
        eq() {
          if (name === "journal_tombstones") return Promise.resolve({ data: [], error: null })
          if (name === "encrypted_private_notes") {
            return Promise.resolve({ data: server.privateNotes, error: null })
          }
          server.journalSelectCount += 1
          return Promise.resolve({
            data: server.entries.map((row) => ({ entry: row.entry })),
            error: null,
          })
        },
      }
    },
    upsert(rows: Row[]) {
      if (name === "journal_tombstones") return Promise.resolve({ data: null, error: null })
      if (name === "encrypted_private_notes") {
        server.privateNotes = rows
        return Promise.resolve({ data: null, error: null })
      }
      if (server.entryPushFails) {
        return Promise.resolve({ data: null, error: { message: "network interrupted" } })
      }
      for (const row of rows) {
        const index = server.entries.findIndex((entry) => entry.entry_id === row.entry_id)
        if (index === -1) server.entries.push(row)
        else server.entries[index] = row
      }
      return Promise.resolve({ data: null, error: null })
    },
    delete() {
      return {
        eq() {
          return {
            in(_column: string, ids: readonly string[]) {
              if (name === "encrypted_private_notes") {
                server.privateNotes = server.privateNotes.filter(
                  (row) => typeof row.entry_id !== "string" || !ids.includes(row.entry_id),
                )
              } else {
                server.entries = server.entries.filter(
                  (row) => typeof row.entry_id !== "string" || !ids.includes(row.entry_id),
                )
              }
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
      }
    },
  }
}

vi.mock("./supabase-client", () => ({
  supabase: () => Promise.resolve({
    auth: {
      getSession: () => Promise.resolve({
        data: { session: { user: { id: "user-1" } } },
        error: null,
      }),
    },
    rpc: (name: string) => {
      server.rpcCallCount += 1
      return Promise.resolve(name === "get_sync_schema_version" && !server.schemaRpcFails
        ? { data: server.schemaVersion, error: null }
        : { data: null, error: { message: "schema contract unavailable" } })
    },
    from: (name: string) => table(name),
  }),
  __resetSupabaseForTest: () => {},
}))

import { previewSync, saveSyncConsent, syncNow } from "./sync"
import { encryptPrivateJournalEntry, saveSessionRecoveryCode } from "./private-note-sync"
import { createRecoveryCode } from "./private-note-crypto"

const JOURNAL_KEY = "trainoracle.journal.v1"

function post(id: string, savedAt = "2026-07-20T10:00:00.000Z"): PostSessionEntry {
  return {
    id, kind: "post-session", date: "2026-07-20",
    savedAt, syncState: "local",
    system: "base", title: "이지런", distanceKm: "8",
    durationMin: "45", avgPace: "5:30", rpe: 4, memo: "",
  }
}

function memoOnlyPost(id: string): PostSessionEntry {
  return {
    ...post(id),
    title: "",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 0,
    memo: "private",
  }
}

function localIds(): string[] {
  const raw = window.localStorage.getItem(JOURNAL_KEY) ?? "[]"
  const parsed: unknown = JSON.parse(raw)
  const result = z.array(z.object({ id: z.string() }).passthrough()).safeParse(parsed)
  return result.success ? result.data.map((entry) => entry.id) : []
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  server.entries = []
  server.privateNotes = []
  server.schemaVersion = 17
  server.schemaRpcFails = false
  server.entryPushFails = false
  server.rpcCallCount = 0
  server.journalSelectCount = 0
  saveSyncConsent({ enabled: true, shareTrainingNotes: false })
})

describe("sync schema and recovery orchestration", () => {
  it("blocks old server schemas before remote journal reads", async () => {
    server.schemaVersion = 16
    saveEntry(post("local-safe"))

    const outcome = await syncNow("user-1")

    expect(outcome.failureCode).toBe("SERVER_SCHEMA_OUTDATED")
    expect(server.rpcCallCount).toBe(1)
    expect(server.journalSelectCount).toBe(0)
    expect(localIds()).toEqual(["local-safe"])
  })

  it("blocks sync previews on old server schemas", async () => {
    server.schemaVersion = 16
    const outcome = await previewSync("user-1")
    expect(outcome.failureCode).toBe("SERVER_SCHEMA_OUTDATED")
    expect(server.journalSelectCount).toBe(0)
  })

  it("blocks remote reads when the schema action fails", async () => {
    server.schemaRpcFails = true
    saveEntry(post("local-safe"))
    const outcome = await syncNow("user-1")
    expect(outcome.failureCode).toBe("SERVER_SCHEMA_OUTDATED")
    expect(server.journalSelectCount).toBe(0)
    expect(localIds()).toEqual(["local-safe"])
  })

  it("blocks remote reads when the schema version is not a number", async () => {
    server.schemaVersion = Number.NaN
    saveEntry(post("local-safe"))
    const outcome = await syncNow("user-1")
    expect(outcome.failureCode).toBe("SERVER_SCHEMA_OUTDATED")
    expect(server.journalSelectCount).toBe(0)
    expect(localIds()).toEqual(["local-safe"])
  })

  it("continues with a forward-compatible schema version", async () => {
    server.schemaVersion = 18
    saveEntry(post("forward-compatible"))
    expect((await syncNow("user-1")).ok).toBe(true)
    expect(server.journalSelectCount).toBe(1)
  })

  it("finishes the normal path without a failure message", async () => {
    saveEntry(post("ok-1"))
    const outcome = await syncNow("user-1")
    expect(outcome.ok).toBe(true)
    expect(outcome.message).not.toMatch(/못했어요/u)
  })

  it("does not upload this device's journal through another account", async () => {
    saveEntry(post("owned-local"))
    expect((await syncNow("user-1")).ok).toBe(true)
    server.entries = []

    const outcome = await syncNow("user-2")

    expect(outcome.ok).toBe(false)
    expect(outcome.message).toContain("matching signed-in account")
    expect(server.entries).toHaveLength(0)
  })

  it("removes a remote memo-only entry when memo sharing is disabled", async () => {
    const memoOnly = memoOnlyPost("memo-only")
    server.entries = [{
      entry_id: memoOnly.id,
      entry: memoOnly,
    }]

    expect((await syncNow("user-1")).ok).toBe(true)
    expect(server.entries).toHaveLength(0)
  })

  it("preserves entries written after an interrupted upload", async () => {
    saveEntry(post("before"))
    server.entries = [{ entry_id: "remote", entry: post("remote") }]
    server.entryPushFails = true
    expect((await syncNow("user-1")).ok).toBe(false)

    saveEntry(post("during-outage", "2026-08-02T09:00:00.000Z"))
    server.entryPushFails = false

    expect((await syncNow("user-1")).ok).toBe(true)
    expect(localIds().sort()).toEqual(["before", "during-outage", "remote"])
    expect(window.localStorage.getItem("trainoracle.sync.recovery.v1")).toBeNull()
  })

  it("keeps syncing after pulling an encrypted private memo", async () => {
    const code = createRecoveryCode()
    saveSessionRecoveryCode(code)
    const privateEntry: PostSessionEntry = {
      ...memoOnlyPost("remote-private"),
      memo: "다른 기기에서 쓴 원문",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }
    const encrypted = await encryptPrivateJournalEntry(privateEntry, code)
    if (encrypted === null) throw new Error("private-note test fixture encryption failed")
    server.privateNotes = [{ entry_id: privateEntry.id, encrypted_payload: encrypted }]

    expect((await syncNow("user-1")).ok).toBe(true)
    expect(window.localStorage.getItem(JOURNAL_KEY)).not.toContain(privateEntry.memo)
    expect((await syncNow("user-1")).ok).toBe(true)
  })
})
