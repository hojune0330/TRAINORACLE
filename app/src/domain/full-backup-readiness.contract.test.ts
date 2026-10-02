import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { exportEntriesJSON } from "./journal-store"
import { JOURNAL_STORAGE_KEY } from "./journal-local-storage"
import { createEmptyDecorationState } from "./decoration-schema"
import { DECORATION_STORAGE_KEY_V3 } from "./decoration-store"
import { LOCAL_JOURNAL_OWNERSHIP_KEY, setActiveLocalAccount } from "./account/local-journal-ownership"
import * as journalApi from "./account/account-journal-api"
import * as journalProjection from "./account/account-journal-projection"
import * as decorationService from "./account/account-decoration-service"
import * as calendarService from "./account/account-calendar-decoration-service"

beforeEach(() => {
  setActiveLocalAccount(null)
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => { vi.restoreAllMocks(); setActiveLocalAccount(null); localStorage.clear() })

describe("export read completeness", () => {
  it.each(["IDLE", "LOADING", "PENDING", "REJECTED", "FAILED", "CONFLICT"] as const)(
    "blocks both export modes when account journals are %s", status => {
      setActiveLocalAccount("synthetic-account")
      vi.spyOn(journalApi, "accountJournalPreviewEnabled").mockReturnValue(true)
      journalProjection.resetAccountJournalProjection("synthetic-account")
      journalProjection.setAccountJournalProjectionStatus("synthetic-account", status)

      expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("JOURNAL_BACKUP_NOT_READY")
      expect(() => exportEntriesJSON()).toThrow("JOURNAL_BACKUP_NOT_READY")
    },
  )

  it("accepts a confirmed empty account journal list", () => {
    setActiveLocalAccount("synthetic-account")
    vi.spyOn(journalApi, "accountJournalPreviewEnabled").mockReturnValue(true)
    journalProjection.resetAccountJournalProjection("synthetic-account")
    journalProjection.setAccountJournalProjectionStatus("synthetic-account", "READY")
    vi.spyOn(decorationService, "accountDecorationsEnabled").mockReturnValue(false)

    // A single-document save may be READY without having fetched the whole list.
    expect(() => exportEntriesJSON()).toThrow("JOURNAL_BACKUP_NOT_READY")
    expect(journalProjection.markAccountJournalFullListConfirmed("synthetic-account")).toBe(true)
    expect(JSON.parse(exportEntriesJSON({ includeRawMemos: true })).entries).toEqual([])
    expect(JSON.parse(exportEntriesJSON()).entries).toEqual([])
  })

  it("revokes full-list proof on failed hydration and an ABA account switch", () => {
    setActiveLocalAccount("synthetic-account")
    vi.spyOn(journalApi, "accountJournalPreviewEnabled").mockReturnValue(true)
    journalProjection.resetAccountJournalProjection("synthetic-account")
    journalProjection.setAccountJournalProjectionStatus("synthetic-account", "READY")
    journalProjection.markAccountJournalFullListConfirmed("synthetic-account")
    expect(journalProjection.accountJournalBackupReady()).toBe(true)
    journalProjection.setAccountJournalProjectionStatus("synthetic-account", "FAILED")
    journalProjection.setAccountJournalProjectionStatus("synthetic-account", "READY")
    expect(journalProjection.accountJournalBackupReady()).toBe(false)
    journalProjection.markAccountJournalFullListConfirmed("synthetic-account")
    setActiveLocalAccount("other-account")
    setActiveLocalAccount("synthetic-account")
    expect(journalProjection.accountJournalBackupReady()).toBe(false)
    expect(() => exportEntriesJSON()).toThrow("JOURNAL_BACKUP_NOT_READY")
  })

  it("blocks an unreadable local journal instead of exporting the surviving subset", () => {
    localStorage.setItem(JOURNAL_STORAGE_KEY, "not-json")
    expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("JOURNAL_BACKUP_NOT_READY")
    expect(() => exportEntriesJSON()).toThrow("JOURNAL_BACKUP_NOT_READY")
  })

  it("keeps normal unbound records in both exports but rejects an unreadable ownership ledger", () => {
    const entry = {
      id: "synthetic-unbound", kind: "race", date: "2026-07-14",
      savedAt: "2026-07-14T00:01:00.000Z", syncState: "local",
      stage: "post", record: "4:08.21", rank: "", result: "", memo: "",
    }
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([entry]))
    expect(JSON.parse(exportEntriesJSON({ includeRawMemos: true })).entries).toHaveLength(1)
    expect(JSON.parse(exportEntriesJSON()).entries).toHaveLength(1)

    localStorage.setItem(LOCAL_JOURNAL_OWNERSHIP_KEY, "not-json")
    expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("JOURNAL_BACKUP_NOT_READY")
    expect(() => exportEntriesJSON()).toThrow("JOURNAL_BACKUP_NOT_READY")

    localStorage.removeItem(LOCAL_JOURNAL_OWNERSHIP_KEY)
    const original = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key) {
      if (key === LOCAL_JOURNAL_OWNERSHIP_KEY) throw new DOMException("synthetic denied", "SecurityError")
      return original.call(this, key)
    })
    expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("JOURNAL_BACKUP_NOT_READY")
    expect(() => exportEntriesJSON()).toThrow("JOURNAL_BACKUP_NOT_READY")
  })

  it.each(["IDLE", "AUTH_REQUIRED", "LOADING", "PENDING", "CONFLICT", "DELETED", "FAILED"] as const)(
    "blocks full backup when account decorations are %s", status => {
      setActiveLocalAccount("synthetic-account")
      vi.spyOn(decorationService, "accountDecorationsEnabled").mockReturnValue(true)
      vi.spyOn(decorationService, "accountDecorationStatus").mockReturnValue(status)
      vi.spyOn(decorationService, "readAccountDecorationState").mockReturnValue(createEmptyDecorationState())

      expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("DECORATION_BACKUP_NOT_READY")
      expect(() => exportEntriesJSON()).not.toThrow()
    },
  )

  it.each(["READY", "EMPTY"] as const)("exports verified %s account decorations", status => {
    setActiveLocalAccount("synthetic-account")
    const state = createEmptyDecorationState()
    vi.spyOn(decorationService, "accountDecorationsEnabled").mockReturnValue(true)
    vi.spyOn(decorationService, "accountDecorationStatus").mockReturnValue(status)
    vi.spyOn(decorationService, "readAccountDecorationState").mockReturnValue(state)
    vi.spyOn(calendarService, "accountCalendarDecorationStatus").mockReturnValue("UNSUPPORTED")

    const backup = JSON.parse(exportEntriesJSON({ includeRawMemos: true }))
    expect(backup.decorations).toEqual(state)
    expect(backup.excludedSections).toEqual(["calendarDecorations"])
  })

  it.each(["READY", "EMPTY"] as const)("rejects %s without a decoration state", status => {
    setActiveLocalAccount("synthetic-account")
    vi.spyOn(decorationService, "accountDecorationsEnabled").mockReturnValue(true)
    vi.spyOn(decorationService, "accountDecorationStatus").mockReturnValue(status)
    vi.spyOn(decorationService, "readAccountDecorationState").mockReturnValue(null)
    expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("DECORATION_BACKUP_NOT_READY")
  })

  it("distinguishes an empty local decoration store from unreadable and malformed data", () => {
    expect(JSON.parse(exportEntriesJSON({ includeRawMemos: true })).decorations).toEqual(createEmptyDecorationState())
    localStorage.setItem(DECORATION_STORAGE_KEY_V3, "not-json")
    expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("DECORATION_BACKUP_NOT_READY")
    localStorage.removeItem(DECORATION_STORAGE_KEY_V3)
    const original = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key) {
      if (key === DECORATION_STORAGE_KEY_V3) throw new DOMException("synthetic denied", "SecurityError")
      return original.call(this, key)
    })
    expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("DECORATION_BACKUP_NOT_READY")
  })
})
