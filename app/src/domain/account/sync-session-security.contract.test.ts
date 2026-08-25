import { beforeEach, describe, expect, it, vi } from "vitest"

let journalSelectCount = 0
let localReplacementCount = 0
let sessionUserId: string | null = "athlete-b"

function table(name: string) {
  return {
    select(_projection: string) {
      if (name === "journal_entries") journalSelectCount += 1
      return {
        eq(_column: string, _value: string) {
          return Promise.resolve({ data: [], error: null })
        },
      }
    },
  }
}

vi.mock("./supabase-client", () => ({
  supabase: () => Promise.resolve({
    auth: {
      getSession: () => Promise.resolve({
        data: {
          session: sessionUserId === null ? null : { user: { id: sessionUserId } },
        },
        error: null,
      }),
    },
    rpc: () => Promise.resolve({ data: 17, error: null }),
    from: (name: string) => table(name),
  }),
  __resetSupabaseForTest: () => {},
}))

vi.mock("../journal-store", () => ({
  loadEntries: () => [],
  loadEntriesOwnedBy: () => [],
  replaceAllEntries: () => {
    localReplacementCount += 1
    return { ok: true, total: 0 }
  },
  replaceEntriesOwnedBy: () => {
    localReplacementCount += 1
    return { ok: true, total: 0 }
  },
  replaceEntriesOwnedByWithPrivateMemos: () => Promise.resolve({ ok: true, total: 0 }),
}))

import { previewSync, saveSyncConsent, syncNow } from "./sync"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  journalSelectCount = 0
  localReplacementCount = 0
  sessionUserId = "athlete-b"
  saveSyncConsent({ enabled: true, shareTrainingNotes: false })
})

describe("sync session ownership boundary", () => {
  it("stops an empty target identifier before the first remote select", async () => {
    await syncNow("")

    expect(journalSelectCount).toBe(0)
    expect(localReplacementCount).toBe(0)
  })

  it("stops a session B request for target A before remote reads or local replacement", async () => {
    const outcome = await syncNow("athlete-a")

    expect(outcome.ok).toBe(false)
    expect(outcome.failureCode).toBe("SESSION_TARGET_MISMATCH")
    expect(journalSelectCount).toBe(0)
    expect(localReplacementCount).toBe(0)
  })

  it("stops preview when the requested target differs from the signed-in user", async () => {
    const outcome = await previewSync("athlete-a")

    expect(outcome.ok).toBe(false)
    expect(outcome.failureCode).toBe("SESSION_TARGET_MISMATCH")
    expect(journalSelectCount).toBe(0)
  })

  it("stops preview when no authenticated session exists", async () => {
    sessionUserId = null

    const outcome = await previewSync("athlete-a")

    expect(outcome.ok).toBe(false)
    expect(outcome.failureCode).toBe("NO_AUTH_SESSION")
    expect(journalSelectCount).toBe(0)
  })

  it("stops execution when no authenticated session exists", async () => {
    sessionUserId = null

    const outcome = await syncNow("athlete-a")

    expect(outcome.ok).toBe(false)
    expect(outcome.failureCode).toBe("NO_AUTH_SESSION")
    expect(journalSelectCount).toBe(0)
    expect(localReplacementCount).toBe(0)
  })
})
