import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { JournalEntry, PostSessionEntry } from "../domain/journal-store"
import { canEditJournalEntry } from "../domain/journal-edit-policy"
import { putAccountJournalProjection, readAccountJournalPrivateEntry, resetAccountJournalProjection } from "../domain/account/account-journal-projection"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { toImportedEntry } from "../domain/import/import-draft"

const mocks = vi.hoisted(() => ({ entries: [] as JournalEntry[], enabled: true, persist: vi.fn() }))
vi.mock("../domain/journal-store", async importOriginal => ({
  ...await importOriginal<typeof import("../domain/journal-store")>(),
  entriesForDate: () => mocks.entries,
}))
vi.mock("../domain/account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: () => mocks.enabled,
  persistAccountJournalRecord: (...args: unknown[]) => mocks.persist(...args),
  deleteAccountJournalRecord: vi.fn(), undoAccountJournalDeletion: vi.fn(),
  accountJournalDeletedDocuments: () => [], accountJournalRecordHistory: vi.fn(),
  readAccountJournalRecordVersion: vi.fn(), restoreAccountJournalVersion: vi.fn(),
}))
import { LogDetail } from "./LogDetail"
import { LogEntry } from "./LogEntry"

const owner = "11111111-1111-4111-8111-111111111111"
const session: PostSessionEntry = { id: "account-edit-fixture", kind: "post-session", date: "2026-09-08",
  savedAt: "2026-09-08T00:00:00.000Z", syncState: "synced", system: "", title: "Synthetic session",
  distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" }
function seed(entry: JournalEntry) {
  mocks.entries = [entry]
  expect(putAccountJournalProjection(owner, entry)).toBe(true)
}
beforeEach(() => {
  window.localStorage.clear()
  mocks.entries = []; mocks.enabled = true; mocks.persist.mockReset()
  mocks.persist.mockResolvedValue({ ok: true, storage: "ACCOUNT" })
  setActiveLocalAccount(owner); resetAccountJournalProjection(owner)
})
afterEach(() => { cleanup(); resetAccountJournalProjection(null); setActiveLocalAccount(null) })

it("offers edit for an acknowledged current-account entry without changing the ACK or global policy", () => {
  seed(session)
  const edit = vi.fn()
  render(<LogDetail date={session.date} onEditEntry={edit} />)
  fireEvent.click(screen.getByTestId(`journal-edit-${session.id}`))
  expect(edit).toHaveBeenCalledExactlyOnceWith(session)
  expect(readAccountJournalPrivateEntry(session.id)?.syncState).toBe("synced")
  expect(canEditJournalEntry(session)).toBe(false)
})

it("passes the current-account private body to its editor without mutating the acknowledged projection", () => {
  const privateEntry: PostSessionEntry = { ...session, memo: "synthetic-private-edit", memoPurpose: "PRIVATE_SELF_ONLY" }
  seed(privateEntry)
  const edit = vi.fn()
  render(<LogDetail date={session.date} onEditEntry={edit} />)
  fireEvent.click(screen.getByTestId(`journal-edit-${session.id}`))
  expect(edit).toHaveBeenCalledExactlyOnceWith(privateEntry)
  expect(readAccountJournalPrivateEntry(session.id)).toEqual(privateEntry)
})

it("rechecks account ownership at click time rather than trusting a previously rendered action", () => {
  seed(session)
  const edit = vi.fn()
  render(<LogDetail date={session.date} onEditEntry={edit} />)
  const button = screen.getByTestId(`journal-edit-${session.id}`)
  act(() => setActiveLocalAccount("22222222-2222-4222-8222-222222222222"))
  fireEvent.click(button)
  expect(edit).not.toHaveBeenCalled()
})

it.each(["legacy", "other-account", "feature-off"])("does not open the %s synced entry", mode => {
  mocks.entries = [session]
  if (mode !== "legacy") seed(session)
  if (mode === "other-account") setActiveLocalAccount("22222222-2222-4222-8222-222222222222")
  if (mode === "feature-off") mocks.enabled = false
  const edit = vi.fn()
  render(<LogDetail date={session.date} onEditEntry={edit} />)
  expect(screen.queryByTestId(`journal-edit-${session.id}`)).toBeNull()
  expect(edit).not.toHaveBeenCalled()
})

it("continues rejecting arbitrary imported account records", () => {
  const imported = toImportedEntry({ date: session.date, name: "Synthetic imported", sport: "running",
    distanceKm: "5", durationMin: "25", avgPace: "5:00" }, "tcx")
  expect(canEditJournalEntry({ ...imported, syncState: "local" })).toBe(false)
  seed({ ...imported, syncState: "synced" })
  render(<LogDetail date={session.date} onEditEntry={vi.fn()} />)
  expect(screen.queryByTestId(`journal-edit-${imported.id}`)).toBeNull()
})

it.each(["quick-session", "post-session", "evening", "race"] as const)(
  "carries the acknowledged source into %s and saves a local draft against its savedAt", async form => {
    const entry: JournalEntry = form === "evening" ? { id: session.id, kind: "evening", date: session.date,
      savedAt: session.savedAt, syncState: "synced", sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "", painParts: {}, mood: 0, note: "" }
      : form === "race" ? { id: session.id, kind: "race", date: session.date, savedAt: session.savedAt,
        syncState: "synced", stage: "pre", record: "", rank: "", result: "", memo: "" } : session
    seed(entry)
    function Flow() {
      const [editing, setEditing] = React.useState<JournalEntry | null>(null)
      return editing ? <LogEntry entryType={form} initialEntry={editing} />
        : <LogDetail date={session.date} onEditEntry={setEditing} />
    }
    render(<Flow />)
    fireEvent.click(screen.getByTestId(`journal-edit-${session.id}`))
    fireEvent.click(screen.getByRole("button", { name: form === "quick-session" ? "오늘은 쉬었어요" : /^수정 저장/ }))
    await waitFor(() => expect(mocks.persist).toHaveBeenCalledOnce())
    expect(mocks.persist.mock.calls[0]![0]).toMatchObject({ id: session.id, kind: entry.kind, syncState: "local" })
    expect(mocks.persist.mock.calls[0]![1]).toBe(session.savedAt)
    await act(async () => {})
  },
)
