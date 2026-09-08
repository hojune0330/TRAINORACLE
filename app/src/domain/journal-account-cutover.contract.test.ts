import { afterEach, beforeEach, expect, it, vi } from "vitest"
import * as store from "./journal-store"
import { privateEntry } from "./private-memo-test-fixtures"
import { createRecoveryCode } from "./account/private-note-crypto"
import { saveSessionRecoveryCode } from "./account/private-note-sync"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { resetAccountJournalProjection, putAccountJournalProjection, removeAccountJournalProjection,
  setAccountJournalProjectionStatus } from "./account/account-journal-projection"
import { buildRestorePlan, restoreEntries } from "./restore/backup-file"
import { buildImportDrafts, confirmImportDrafts } from "./import/import-draft"
import { waitingJournal, watchActivity, addToJournal } from "../test/progressive-journal-fixture"

const local = () => ({ ...privateEntry("a", ""), memoPurpose: "ANALYZABLE_TRAINING_NOTE" as const, distanceKm: "1" })
const enable = () => vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "false")
  vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
  setActiveLocalAccount("owner")
  resetAccountJournalProjection(null)
})
afterEach(() => {
  resetAccountJournalProjection(null)
  setActiveLocalAccount(null)
  vi.unstubAllEnvs()
})

it("rejects every legacy journal mutation without changing originals, ownership, vault or trash", async () => {
  const entry = local()
  expect(store.saveEntry(entry).ok).toBe(true)
  const code = createRecoveryCode()
  expect(saveSessionRecoveryCode(code)).toBe(true)
  const secret = privateEntry("p", "SYNTHETIC_OLD")
  expect((await store.savePrivateEntry(secret)).ok).toBe(true)
  expect(store.saveEntry({ ...entry, id: "trash" }).ok).toBe(true)
  expect(store.deleteEntry("trash").ok).toBe(true)
  const before = { ...window.localStorage }
  enable()
  const next = { ...entry, savedAt: "2026-08-02T00:00:00.000Z" }
  const results = [
    store.saveEntry({ ...entry, id: "new" }),
    await store.savePrivateEntry(privateEntry("q", "SYNTHETIC_NEW")),
    store.updateEntry(next, entry.savedAt),
    store.updateEntryPreservingMemo(next, entry.savedAt),
    await store.updatePrivateEntry({ ...secret, savedAt: next.savedAt }, secret.savedAt),
    store.replaceAllEntries([]), store.replaceEntriesOwnedBy("owner", []),
    await store.replaceEntriesOwnedByWithPrivateMemos("owner", [], [], code),
    store.deleteEntry(entry.id), store.restoreDeletedEntry("trash"),
  ]
  expect(results.every(result => !result.ok)).toBe(true)
  expect({ ...window.localStorage }).toEqual(before)
})

it.each(["off", "kill", "anonymous"])("preserves legacy save/update/replace/delete/restore with %s", mode => {
  if (mode !== "off") enable()
  if (mode === "kill") vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "true")
  if (mode === "anonymous") setActiveLocalAccount(null)
  const entry = local()
  expect(store.saveEntry(entry).ok).toBe(true)
  expect(store.updateEntry({ ...entry, savedAt: "2026-08-02T00:00:00.000Z" }, entry.savedAt).ok).toBe(true)
  expect(store.replaceAllEntries([entry]).ok).toBe(true)
  expect(store.deleteEntry(entry.id).ok).toBe(true)
  expect(store.restoreDeletedEntry(entry.id).ok).toBe(true)
})

it("blocks explicit account replacement even without an active local account", () => {
  enable()
  setActiveLocalAccount(null)
  expect(store.replaceEntriesOwnedBy("owner", [local()]).ok).toBe(false)
  expect(store.loadEntries()).toEqual([])
})

it("suppresses a shadowed local fallback after deletion without removing originals and keeps safety uncertain while loading", () => {
  const entry = local()
  expect(store.saveEntry(entry).ok).toBe(true)
  const before = { ...window.localStorage }
  enable()
  resetAccountJournalProjection("owner")
  expect(store.loadEntriesForPlanSafety()).toEqual({ status: "uncertain" })
  expect(putAccountJournalProjection("owner", { ...entry, title: "Online" })).toBe(true)
  expect(store.loadEntries()).toMatchObject([{ id: "a", title: "Online" }])
  removeAccountJournalProjection("owner", "a")
  expect(store.loadEntries()).toEqual([])
  setAccountJournalProjectionStatus("owner", "FAILED")
  expect(store.loadEntriesForPlanSafety()).toEqual({ status: "uncertain" })
  setAccountJournalProjectionStatus("owner", "CONFLICT")
  expect(store.loadEntriesForPlanSafety()).toEqual({ status: "uncertain" })
  setAccountJournalProjectionStatus("owner", "READY")
  expect(store.loadEntriesForPlanSafety()).toEqual({ status: "complete", entries: [] })
  expect({ ...window.localStorage }).toEqual(before)
  resetAccountJournalProjection(null)
  expect(store.loadEntries()).toMatchObject([{ id: "a" }])
})

it("never hydrates or exports stale legacy vault/cache text over the online private record", async () => {
  expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
  expect((await store.savePrivateEntry(privateEntry("p", "SYNTHETIC_OLD"))).ok).toBe(true)
  await store.loadEntriesWithPrivateMemos()
  expect(JSON.parse(store.exportEntriesJSON({ includeRawMemos: true })).entries).toMatchObject([{ memo: "SYNTHETIC_OLD" }])
  const before = { ...window.localStorage }
  enable()
  resetAccountJournalProjection("owner")
  const online = privateEntry("p", "SYNTHETIC_ACCOUNT_NEW")
  putAccountJournalProjection("owner", online)
  expect(store.loadEntries()).toMatchObject([{ memo: "" }])
  expect(await store.loadEntriesWithPrivateMemos()).toEqual([online])
  expect(JSON.parse(store.exportEntriesJSON({ includeRawMemos: true })).entries).toEqual([online])
  window.sessionStorage.clear()
  expect(await store.loadEntriesWithPrivateMemos()).toEqual([online])
  expect(JSON.parse(store.exportEntriesJSON({ includeRawMemos: true })).entries).toEqual([online])
  expect({ ...window.localStorage }).toEqual(before)
})

it.each([false, true])("reports import and nonprivate backup outcomes honestly with account flag %s", async enabled => {
  expect(store.saveEntry(local()).ok).toBe(true)
  const before = { ...window.localStorage }
  if (enabled) enable()
  const drafts = buildImportDrafts([{ date: "2026-08-02", name: "Synthetic", sport: "Running",
    distanceKm: "5", durationMin: "25", avgPace: "5:00" }])
  const imported = confirmImportDrafts(drafts.map(draft => ({ draft, intent: { kind: "SAVE_SEPARATE" as const } })), "csv")
  expect(imported).toMatchObject({ saved: enabled ? 0 : 1, failed: enabled ? 1 : 0 })
  const restored = await restoreEntries(buildRestorePlan([{ ...local(), id: "backup" }]))
  expect(restored).toMatchObject({ restored: enabled ? 0 : 1, failed: enabled ? 1 : 0 })
  if (enabled) expect({ ...window.localStorage }).toEqual(before)
})

it.each([false, true])("reports imported activity reconciliation honestly with account flag %s", enabled => {
  const entry = waitingJournal()
  expect(store.saveEntry(entry).ok).toBe(true)
  const [draft] = buildImportDrafts([watchActivity])
  expect(draft).toBeDefined()
  const before = { ...window.localStorage }
  if (enabled) enable()
  const result = confirmImportDrafts([addToJournal(draft!, entry)], "csv")
  expect(result).toMatchObject({ merged: enabled ? 0 : 1, failed: enabled ? 1 : 0 })
  if (enabled) expect({ ...window.localStorage }).toEqual(before)
})

it("blocks private backup restoration before it writes the legacy vault", async () => {
  const code = createRecoveryCode()
  expect(saveSessionRecoveryCode(code)).toBe(true)
  const before = { ...window.localStorage }
  enable()
  const outcome = await restoreEntries(buildRestorePlan([privateEntry("private-backup", "SYNTHETIC_BACKUP")]))
  expect(outcome).toMatchObject({ restored: 0, failed: 1, commit: "FAILED" })
  expect({ ...window.localStorage }).toEqual(before)
})
