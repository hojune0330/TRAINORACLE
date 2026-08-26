import { beforeEach, describe, expect, it } from "vitest"
import type { PostSessionEntry } from "../journal-schema"
import {
  connectUnboundDeviceJournals,
  deleteEntry,
  loadEntries,
  loadEntriesOwnedBy,
  replaceAllEntries,
  replaceEntriesOwnedBy,
  restoreDeletedEntry,
  saveEntry,
  unboundDeviceJournalCount,
} from "../journal-store"
import { updateEntry } from "../journal-update"
import {
  LOCAL_JOURNAL_OWNERSHIP_KEY,
  setActiveLocalAccount,
} from "./local-journal-ownership"

const JOURNAL_KEY = "trainoracle.journal.v1"

function post(id: string, savedAt = "2026-08-25T10:00:00.000Z"): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-08-25",
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
  setActiveLocalAccount(null)
})

describe("local journal account isolation", () => {
  it("keeps anonymous journals unbound until explicit account connection", () => {
    expect(saveEntry(post("device")).ok).toBe(true)
    setActiveLocalAccount("account-a")

    expect(unboundDeviceJournalCount()).toBe(1)
    expect(loadEntriesOwnedBy("account-a")).toEqual([])

    const connected = connectUnboundDeviceJournals("account-a")
    expect(connected).toEqual({ ok: true, total: 1 })
    expect(loadEntriesOwnedBy("account-a").map((entry) => entry.id)).toEqual(["device"])
  })

  it("shows only unbound data and the currently signed-in account data", () => {
    expect(saveEntry(post("unbound")).ok).toBe(true)
    setActiveLocalAccount("account-a")
    expect(saveEntry(post("a")).ok).toBe(true)
    setActiveLocalAccount("account-b")
    expect(saveEntry(post("b")).ok).toBe(true)

    expect(loadEntries().map((entry) => entry.id).sort()).toEqual(["b", "unbound"])
    setActiveLocalAccount("account-a")
    expect(loadEntries().map((entry) => entry.id).sort()).toEqual(["a", "unbound"])
    setActiveLocalAccount(null)
    expect(loadEntries().map((entry) => entry.id)).toEqual(["unbound"])
    expect(JSON.parse(window.localStorage.getItem(JOURNAL_KEY) ?? "[]")).toHaveLength(3)
  })

  it("preserves another account's hidden journals and leaves imported replacements unbound", () => {
    setActiveLocalAccount("account-a")
    expect(saveEntry(post("a")).ok).toBe(true)
    setActiveLocalAccount("account-b")
    expect(saveEntry(post("b")).ok).toBe(true)
    expect(replaceAllEntries([post("b-next")]).ok).toBe(true)

    setActiveLocalAccount("account-a")
    expect(loadEntriesOwnedBy("account-a").map((entry) => entry.id)).toEqual(["a"])
    expect(loadEntries().map((entry) => entry.id).sort()).toEqual(["a", "b-next"])
    setActiveLocalAccount("account-b")
    expect(loadEntriesOwnedBy("account-b")).toEqual([])
    expect(loadEntries().map((entry) => entry.id)).toEqual(["b-next"])
  })

  it("assigns server merge results only to the requested account", () => {
    setActiveLocalAccount("account-a")
    expect(saveEntry(post("a")).ok).toBe(true)
    setActiveLocalAccount("account-b")
    expect(saveEntry(post("b")).ok).toBe(true)

    expect(replaceEntriesOwnedBy("account-b", [post("b-remote")]).ok).toBe(true)
    expect(loadEntriesOwnedBy("account-b").map((entry) => entry.id)).toEqual(["b-remote"])
    setActiveLocalAccount("account-a")
    expect(loadEntriesOwnedBy("account-a").map((entry) => entry.id)).toEqual(["a"])
  })

  it("rejects update, delete, and restore attempts against another account", () => {
    setActiveLocalAccount("account-a")
    const original = post("a")
    expect(saveEntry(original).ok).toBe(true)
    expect(deleteEntry("a").ok).toBe(true)

    setActiveLocalAccount("account-b")
    expect(restoreDeletedEntry("a").ok).toBe(false)
    setActiveLocalAccount("account-a")
    const restored = restoreDeletedEntry("a")
    expect(restored.ok).toBe(true)
    const restoredEntry = loadEntries()[0]
    expect(restoredEntry).toBeDefined()

    setActiveLocalAccount("account-b")
    expect(deleteEntry(restored.restoredId ?? "").ok).toBe(false)
    expect(updateEntry({
      ...restoredEntry,
      savedAt: "2026-08-25T11:00:00.000Z",
      title: "침범",
    }, restoredEntry?.savedAt ?? "").ok).toBe(false)
  })

  it("fails closed when the ownership ledger is malformed", () => {
    expect(saveEntry(post("legacy-unbound")).ok).toBe(true)
    window.localStorage.setItem(LOCAL_JOURNAL_OWNERSHIP_KEY, "{broken")
    setActiveLocalAccount("account-a")

    expect(loadEntries()).toEqual([])
    expect(saveEntry(post("must-not-leak")).ok).toBe(false)
    expect(JSON.parse(window.localStorage.getItem(JOURNAL_KEY) ?? "[]")).toHaveLength(1)
  })

  it("does not let another account take over an existing journal by reusing its id", () => {
    setActiveLocalAccount("account-a")
    expect(saveEntry(post("same-id")).ok).toBe(true)
    setActiveLocalAccount("account-b")

    expect(saveEntry(post("same-id", "2026-08-25T11:00:00.000Z")).ok).toBe(false)
    expect(loadEntriesOwnedBy("account-b")).toEqual([])
    setActiveLocalAccount("account-a")
    expect(loadEntriesOwnedBy("account-a")).toHaveLength(1)
  })
})
