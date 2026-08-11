import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { JOURNAL_STORAGE_KEY, writeJournalEntries } from "./journal-local-storage"
import { MEMO_PURPOSE } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"

function entry(id: string): JournalEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-08-05",
    savedAt: "2026-08-05T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "가벼운 조깅",
    distanceKm: "8",
    durationMin: "45",
    avgPace: "5:30",
    rpe: 4,
    memo: "정상 기록",
    memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe("writeJournalEntries concurrent writers", () => {
  it("refuses a stale journal snapshot without overwriting the newer journal", () => {
    const original = JSON.stringify([entry("original")])
    const concurrent = JSON.stringify([entry("concurrent")])
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, original)

    window.localStorage.setItem(JOURNAL_STORAGE_KEY, concurrent)

    expect(writeJournalEntries(window.localStorage, [entry("stale")], original)).toBe(false)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(concurrent)
  })

  it("does not roll back over a valid journal written during failed confirmation", () => {
    const original = JSON.stringify([entry("original")])
    const concurrent = JSON.stringify([entry("concurrent")])
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, original)
    const realGet = Storage.prototype.getItem
    let journalReads = 0
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === JOURNAL_STORAGE_KEY && ++journalReads === 2) {
        window.localStorage.setItem(JOURNAL_STORAGE_KEY, concurrent)
      }
      return realGet.call(this, key)
    })

    expect(writeJournalEntries(window.localStorage, [entry("next")], original)).toBe(false)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(concurrent)
  })
})
