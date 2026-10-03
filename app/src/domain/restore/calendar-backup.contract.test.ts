import { beforeEach, afterEach, describe, it, expect, vi } from "vitest"
import { setActiveLocalAccount } from "../account/local-journal-ownership"
import { createEmptyDecorationState, loadDecorationState, saveDecorationState } from "../decorations"
import { createEmptyCalendarDecorationState, calendarDecorationStateSchema } from "../calendar-decoration-schema"
import { decorationStateSchema } from "../decoration-schema"
import { CALENDAR_DECORATION_STORAGE_KEY, loadCalendarDecorationState, saveCalendarDecorationStateIfCurrent } from "../calendar-decoration-store"
import { exportEntriesJSON, saveEntry, loadEntries } from "../journal-store"
import { JOURNAL_STORAGE_KEY } from "../journal-local-storage"
import { buildRestorePlan, readBackupFile, restoreBackupFile, FULL_FORMAT_V5 } from "./backup-file"
import * as decorationService from "../account/account-decoration-service"
import * as calendarService from "../account/account-calendar-decoration-service"
import * as calendarStore from "../calendar-decoration-store"

const calendar = { version: 1 as const, paperThemeId: null, items: [{ placementId: "4b4a2f50-321a-49cd-b413-4290dbcb7992", itemId: "STICKER_WEATHER_SUN" as const, region: "HEADER_MARGIN" as const, transform: { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 } }] }
const entry = { id: "synthetic-restore", kind: "post-session" as const, date: "2026-10-02", savedAt: "2026-10-02T01:00:00.000Z", syncState: "local" as const, system: "base" as const, title: "합성 기록", distanceKm: "5", durationMin: "30", avgPace: "6:00", memo: "", rpe: 4 }
beforeEach(() => { setActiveLocalAccount(null); localStorage.clear(); sessionStorage.clear() })
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })
const read = (cal: unknown = calendar, entries: unknown[] = []) => readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT_V5, entries, decorations: createEmptyDecorationState(), calendarDecorations: cal }))

describe("calendar full backup v5", () => {
  it("accepts a calendar-only v5 file without a journal-decoration section", async () => {
    const parsed = readBackupFile(JSON.stringify({
      app: "TRAINORACLE", format: FULL_FORMAT_V5, entries: [], calendarDecorations: calendar,
    }))
    expect(parsed.recognized).toBe(true)
    expect(parsed.decorationStatus).toBe("not-included")
    expect(parsed.calendarDecorationStatus).toBe("included")

    const outcome = await restoreBackupFile(parsed, buildRestorePlan(parsed.entries), "keep-existing", "keep-existing", "replace")
    expect(outcome).toMatchObject({ restored: 0, decorationRestore: "NOT_INCLUDED", calendarDecorationRestore: "RESTORED", commit: "COMMITTED" })
    expect(loadCalendarDecorationState()).toEqual(calendar)
  })

  it("keeps an existing calendar by default even when v5 includes a different setting", async () => {
    expect(saveCalendarDecorationStateIfCurrent(calendar).ok).toBe(true)
    const parsed = read(createEmptyCalendarDecorationState())
    const outcome = await restoreBackupFile(parsed, buildRestorePlan(parsed.entries))
    expect(outcome.calendarDecorationRestore).toBe("KEPT_EXISTING")
    expect(loadCalendarDecorationState()).toEqual(calendar)
  })

  it("refuses an inventory replacement that would unown the calendar being kept", async () => {
    const owned = decorationStateSchema.parse({ ...createEmptyDecorationState(), spentPoints: 12,
      ownedItemIds: [...createEmptyDecorationState().ownedItemIds, "THEME_SKY_JOURNAL"] })
    const currentCalendar = calendarDecorationStateSchema.parse({ version: 1, paperThemeId: "THEME_SKY_JOURNAL", items: [] })
    expect(saveDecorationState(owned).ok).toBe(true)
    expect(saveCalendarDecorationStateIfCurrent(currentCalendar).ok).toBe(true)
    const parsed = readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT_V5,
      entries: [], decorations: createEmptyDecorationState(), calendarDecorations: createEmptyCalendarDecorationState() }))

    const outcome = await restoreBackupFile(parsed, buildRestorePlan([]), "keep-existing", "replace", "keep-existing")
    expect(outcome).toMatchObject({ commit: "FAILED", failureReason: "CALENDAR_DEPENDENCY_UNVERIFIED",
      decorationRestore: "SAVE_FAILED", calendarDecorationRestore: "KEPT_EXISTING" })
    expect(loadDecorationState().spentPoints).toBe(owned.spentPoints)
    expect([...loadDecorationState().ownedItemIds].sort()).toEqual([...owned.ownedItemIds].sort())
    expect(loadCalendarDecorationState()).toEqual(currentCalendar)
  })

  it("exports only into explicit full backup and round trips the entire global setting", async () => {
    expect(saveCalendarDecorationStateIfCurrent(calendar).ok).toBe(true)
    const raw = exportEntriesJSON({ includeRawMemos: true })
    expect(raw).toContain(FULL_FORMAT_V5)
    expect(exportEntriesJSON()).not.toContain("calendarDecorations")
    localStorage.clear()
    const parsed = readBackupFile(raw)
    const outcome = await restoreBackupFile(parsed, buildRestorePlan(parsed.entries), "keep-existing", "keep-existing", "replace")
    expect(outcome.calendarDecorationRestore).toBe("RESTORED")
    expect(loadCalendarDecorationState()).toEqual(calendar)
    expect(loadEntries()).toHaveLength(0)
  })
  it.each([1, 2, 3, 4])("old v%s backup keeps current calendar bytes", async version => {
    saveCalendarDecorationStateIfCurrent(calendar)
    const before = localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY)
    const parsed = readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: `trainoracle.journal.full-backup.v${version}`, entries: [], decorations: createEmptyDecorationState() }))
    await restoreBackupFile(parsed, buildRestorePlan(parsed.entries), "keep-existing", "replace")
    expect(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY)).toBe(before)
  })
  it("unchecked calendar keeps the current setting instead of merging items", async () => {
    saveCalendarDecorationStateIfCurrent(calendar)
    const parsed = read(createEmptyCalendarDecorationState())
    const outcome = await restoreBackupFile(parsed, buildRestorePlan([]), "keep-existing", "keep-existing", "keep-existing")
    expect(outcome.calendarDecorationRestore).toBe("KEPT_EXISTING")
    expect(loadCalendarDecorationState()).toEqual(calendar)
  })
  it("skips damaged calendar alone and still restores valid journals", async () => {
    saveCalendarDecorationStateIfCurrent(calendar)
    const parsed = read({ ...calendar, version: 99 }, [entry])
    const outcome = await restoreBackupFile(parsed, buildRestorePlan(parsed.entries), "keep-existing", "keep-existing", "replace")
    expect(outcome.calendarDecorationRestore).toBe("INVALID_SKIPPED")
    expect(outcome.restored).toBe(1)
    expect(loadCalendarDecorationState()).toEqual(calendar)
  })
  it("rolls calendar back when journal storage fails", async () => {
    saveEntry({ ...entry, id: "keep" }); saveDecorationState(createEmptyDecorationState()); saveCalendarDecorationStateIfCurrent(calendar)
    const before = localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY)
    const parsed = read(createEmptyCalendarDecorationState(), [entry])
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) { if (key === JOURNAL_STORAGE_KEY) throw new DOMException("quota"); original.call(this, key, value) })
    const outcome = await restoreBackupFile(parsed, buildRestorePlan(parsed.entries), "keep-existing", "keep-existing", "replace")
    expect(outcome.calendarDecorationRestore).toBe("ROLLED_BACK")
    expect(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY)).toBe(before)
    expect(loadEntries().map(item => item.id)).toEqual(["keep"])
  })
  it("preserves an unsupported stored version and refuses a misleading full export", () => {
    localStorage.setItem(CALENDAR_DECORATION_STORAGE_KEY, '{"version":99,"items":[]}')
    expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("CALENDAR_BACKUP_NOT_READY")
    expect(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY)).toContain('"version":99')
  })
  it("guest calendar read failure cannot become an empty full backup or change the preserved bytes", () => {
    expect(saveCalendarDecorationStateIfCurrent(calendar).ok).toBe(true)
    const original = Storage.prototype.getItem
    const before = original.call(localStorage, CALENDAR_DECORATION_STORAGE_KEY)
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key) {
      if (key === CALENDAR_DECORATION_STORAGE_KEY) throw new DOMException("synthetic blocked calendar read", "SecurityError")
      return original.call(this, key)
    })
    expect(calendarStore.calendarDecorationReadStatus()).toBe("FAILED")
    expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("CALENDAR_BACKUP_NOT_READY")
    expect(original.call(localStorage, CALENDAR_DECORATION_STORAGE_KEY)).toBe(before)
    expect(exportEntriesJSON()).not.toContain("calendarDecorations")
  })
  it("unsupported account calendar server exports explicit v4 exclusion while failed or unreadable READY states remain blocked", () => {
    setActiveLocalAccount("synthetic-account")
    const decorations = createEmptyDecorationState()
    const unsupported = '{"version":99,"items":[],"future":"preserve"}'
    localStorage.setItem(CALENDAR_DECORATION_STORAGE_KEY, unsupported)
    vi.spyOn(decorationService, "accountDecorationsEnabled").mockReturnValue(true)
    vi.spyOn(decorationService, "accountDecorationStatus").mockReturnValue("READY")
    vi.spyOn(decorationService, "readAccountDecorationState").mockReturnValue(decorations)
    const status = vi.spyOn(calendarService, "accountCalendarDecorationStatus").mockReturnValue("UNSUPPORTED")
    const source = vi.spyOn(calendarStore, "readCalendarDecorationStateSerialized").mockReturnValue(unsupported)
    const writes = vi.spyOn(Storage.prototype, "setItem")
    const full = JSON.parse(exportEntriesJSON({ includeRawMemos: true }))
    expect(full.format).toBe("trainoracle.journal.full-backup.v4")
    expect(full.excludedSections).toEqual(["calendarDecorations"])
    expect(full).not.toHaveProperty("calendarDecorations")
    expect(full.decorations).toEqual(decorations)
    expect(readBackupFile(JSON.stringify(full)).calendarDecorationStatus).toBe("not-included")
    expect(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY)).toBe(unsupported)
    expect(writes.mock.calls.filter(([key]) => key !== "__to_probe__")).toEqual([])
    status.mockReturnValue("FAILED")
    expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("CALENDAR_BACKUP_NOT_READY")
    status.mockReturnValue("READY")
    expect(() => exportEntriesJSON({ includeRawMemos: true })).toThrow("CALENDAR_BACKUP_NOT_READY")
    source.mockReturnValue(JSON.stringify(createEmptyCalendarDecorationState()))
    expect(JSON.parse(exportEntriesJSON({ includeRawMemos: true })).format).toBe(FULL_FORMAT_V5)
    expect(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY)).toBe(unsupported)
  })
})
