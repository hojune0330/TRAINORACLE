import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { filterOwnerBodyEntries } from "./body-record-scope"
import { setActiveLocalAccount, assignJournalsToAccount, LOCAL_JOURNAL_OWNERSHIP_KEY } from "./local-journal-ownership"
import { resetAccountJournalProjection, putAccountJournalProjection } from "./account-journal-projection"
import type { EveningEntry } from "../journal-schema"

const entry = (id: string): EveningEntry => ({ id, kind: "evening", date: "2026-10-12", savedAt: "2026-10-12T00:00:00Z", syncState: "local",
  sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "", mood: 0, note: "", painParts: { rKnee: 4 } })
beforeEach(() => { localStorage.clear(); setActiveLocalAccount(null); resetAccountJournalProjection(null) })
afterEach(() => { vi.restoreAllMocks(); setActiveLocalAccount(null); resetAccountJournalProjection(null); localStorage.clear() })

it("isolates guest body history and A/B owners while accepting projection-only account records", () => {
  const guest = entry("guest"), a = entry("a"), b = entry("b"), remote = entry("remote")
  expect(assignJournalsToAccount([a.id], "A")).toBe(true)
  expect(assignJournalsToAccount([b.id], "B")).toBe(true)
  expect(filterOwnerBodyEntries([guest, a, b])).toEqual([guest])
  setActiveLocalAccount("A"); resetAccountJournalProjection("A")
  expect(putAccountJournalProjection("A", remote)).toBe(true)
  expect(filterOwnerBodyEntries([guest, a, b, remote])).toEqual([a, remote])
  expect(filterOwnerBodyEntries([{ ...remote, savedAt: "2026-10-12T00:01:00Z" }])).toEqual([])
  setActiveLocalAccount("B")
  expect(filterOwnerBodyEntries([guest, a, b, remote])).toEqual([b])
})

it("excludes pending-only account drafts and fails closed on an unreadable ownership ledger", () => {
  setActiveLocalAccount("A"); resetAccountJournalProjection("A")
  const pending = entry("pending"), acknowledged = entry("acknowledged")
  putAccountJournalProjection("A", pending, false)
  putAccountJournalProjection("A", acknowledged, true)
  localStorage.setItem(LOCAL_JOURNAL_OWNERSHIP_KEY, "unreadable")
  expect(filterOwnerBodyEntries([entry("guest"), pending, acknowledged])).toEqual([acknowledged])
})
