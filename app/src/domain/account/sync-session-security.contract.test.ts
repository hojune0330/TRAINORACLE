import { beforeEach, describe, expect, it, vi } from "vitest"

let journalSelectCount = 0

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
        data: { session: { user: { id: "athlete-b" } } },
      }),
    },
    from: (name: string) => table(name),
  }),
  __resetSupabaseForTest: () => {},
}))

import { saveSyncConsent, syncNow } from "./sync"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  journalSelectCount = 0
  saveSyncConsent({ enabled: true, shareTrainingNotes: false })
})

describe("sync session ownership boundary", () => {
  it("stops an empty target identifier before the first remote select", async () => {
    await syncNow("")

    expect(journalSelectCount).toBe(0)
  })

  it("stops a session B request for target A before the first remote select", async () => {
    await syncNow("athlete-a")

    expect(journalSelectCount).toBe(0)
  })
})
