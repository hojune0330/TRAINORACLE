import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadEntries, loadEntriesForPlanSafety } from "./journal-store"
import type { EveningEntry } from "./journal-schema"
import { JOURNAL_STORAGE_KEY } from "./journal-local-storage"
import { LOCAL_JOURNAL_OWNERSHIP_KEY, setActiveLocalAccount } from "./account/local-journal-ownership"
import { putAccountJournalProjection, removeAccountJournalProjection, resetAccountJournalProjection,
  setAccountJournalProjectionStatus } from "./account/account-journal-projection"
import { evaluatePlanSafety } from "./plan-beta-flow"

function entry(id: string, painParts: Readonly<Record<string, number>> = {}): EveningEntry {
  return { id, kind: "evening", date: "2026-10-07", savedAt: "2026-10-07T00:00:00.000Z", syncState: "local",
    sleepH: 8, sleepQuality: 4, weightKg: "", restingHr: "", painParts, mood: 4, note: "" }
}
function seed(entries: readonly EveningEntry[], ownerByEntryId: Readonly<Record<string, string>> = {}) {
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries))
  localStorage.setItem(LOCAL_JOURNAL_OWNERSHIP_KEY, JSON.stringify({ schemaVersion: 1, ownerByEntryId }))
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); resetAccountJournalProjection(null) })
afterEach(() => { vi.restoreAllMocks(); setActiveLocalAccount(null); resetAccountJournalProjection(null) })

describe("journal reads use one current ownership snapshot", () => {
  it("bounds safety-read storage work as the journal grows while preserving owner-visible order", () => {
    const entries = Array.from({ length: 200 }, (_, index) => entry(`entry-${index}`))
    seed(entries, Object.fromEntries(entries.filter((_, index) => index % 3 !== 0)
      .map((item, index) => [item.id, index % 2 === 0 ? "owner-a" : "owner-b"])))
    setActiveLocalAccount("owner-a")
    const expected = loadEntries()
    const reads = vi.spyOn(Storage.prototype, "getItem")

    expect(loadEntriesForPlanSafety()).toEqual({ status: "complete", entries: expected })
    expect({ journal: reads.mock.calls.filter(([key]) => key === JOURNAL_STORAGE_KEY).length,
      ownership: reads.mock.calls.filter(([key]) => key === LOCAL_JOURNAL_OWNERSHIP_KEY).length })
      .toEqual({ journal: 1, ownership: 1 })
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.length).toBeLessThan(entries.length)
  })

  it("rereads ownership after both account changes and same-account ledger changes", () => {
    seed([entry("unbound"), entry("a"), entry("b")], { a: "owner-a", b: "owner-b" })
    setActiveLocalAccount("owner-a")
    expect(loadEntries().map(item => item.id)).toEqual(["unbound", "a"])
    setActiveLocalAccount("owner-b")
    expect(loadEntries().map(item => item.id)).toEqual(["unbound", "b"])
    setActiveLocalAccount("owner-a")
    seed([entry("unbound"), entry("a"), entry("b"), entry("new")], { a: "owner-b", b: "owner-a" })
    expect(loadEntriesForPlanSafety()).toEqual({ status: "complete", entries: [entry("unbound"), entry("b"), entry("new")] })
  })

  it.each(["malformed", "unreadable"])("keeps local entries hidden when ownership is %s", failure => {
    seed([entry("unbound"), entry("owned")], { owned: "owner-a" })
    setActiveLocalAccount("owner-a")
    expect(loadEntries()).toHaveLength(2)
    if (failure === "malformed") localStorage.setItem(LOCAL_JOURNAL_OWNERSHIP_KEY, "{broken")
    else {
      const read = Storage.prototype.getItem
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
        if (key === LOCAL_JOURNAL_OWNERSHIP_KEY) throw new Error("synthetic unavailable ledger")
        return read.call(this, key)
      })
    }
    expect(loadEntries()).toEqual([])
    // Preserve the existing status contract; unknown owners grant no visibility.
    expect(loadEntriesForPlanSafety()).toEqual({ status: "complete", entries: [] })
  })

  it("preserves online precedence, deletion shadows and private-note redaction", () => {
    seed([entry("local"), entry("shadowed"), entry("replaced"), entry("other")],
      { local: "owner-a", shadowed: "owner-a", replaced: "owner-a", other: "owner-b" })
    setActiveLocalAccount("owner-a"); resetAccountJournalProjection("owner-a")
    expect(loadEntriesForPlanSafety()).toEqual({ status: "uncertain" })
    putAccountJournalProjection("owner-a", { ...entry("replaced"), mood: 5, note: "SYNTHETIC_PRIVATE", memoPurpose: "PRIVATE_SELF_ONLY" })
    removeAccountJournalProjection("owner-a", "shadowed")
    setAccountJournalProjectionStatus("owner-a", "READY")
    const result = loadEntriesForPlanSafety()
    expect(result).toEqual({ status: "complete", entries: [entry("local"),
      { ...entry("replaced"), mood: 5, note: "", memoPurpose: "PRIVATE_SELF_ONLY" }] })
    expect(JSON.stringify(result)).not.toContain("SYNTHETIC_PRIVATE")
    setAccountJournalProjectionStatus("owner-a", "CONFLICT")
    expect(loadEntriesForPlanSafety()).toEqual({ status: "uncertain" })
  })

  it("keeps visible pain and incomplete local journals blocked without using another account's pain", () => {
    seed([entry("pain", { calf: 4 }), entry("clear")], { pain: "owner-a", clear: "owner-b" })
    const evaluatedAt = new Date("2026-10-07T12:00:00+09:00")
    setActiveLocalAccount("owner-a")
    expect(evaluatePlanSafety("NO_KNOWN_RISK", evaluatedAt).kind).toBe("blocked")
    setActiveLocalAccount("owner-b")
    expect(evaluatePlanSafety("NO_KNOWN_RISK", evaluatedAt).kind).toBe("passed")
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([entry("clear"), {}]))
    expect(loadEntriesForPlanSafety()).toEqual({ status: "uncertain" })
    expect(evaluatePlanSafety("NO_KNOWN_RISK", evaluatedAt).kind).toBe("blocked")
  })
})
