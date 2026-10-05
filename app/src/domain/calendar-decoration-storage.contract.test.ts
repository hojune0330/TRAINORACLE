import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { calendarDecorationStateSchema, createEmptyCalendarDecorationState, parseStoredCalendarDecorationState,
  calendarDecorationsOwnedBy, type CalendarDecorationRegion } from "./calendar-decoration-schema"
import { createEmptyDecorationState } from "./decoration-schema"
import { CALENDAR_DECORATION_STORAGE_KEY, activeCalendarDecorationStorageKey, loadCalendarDecorationState,
  readCalendarDecorationStateSerialized, calendarDecorationReadStatus, saveCalendarDecorationStateIfCurrent } from "./calendar-decoration-store"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { accountScopedStorageKeyFor } from "./account/local-account-scope"
import { erasableKeys, eraseAllLocalData } from "./erase-local-data"
import { accountCalendarDecorationOwnershipMetadata, validateAccountStateDocument, validateAccountStateDocumentUpdate } from "./account/account-state-schema"
import { DECORATION_CATALOG } from "./decoration-catalog"

const item = (number: number, region: CalendarDecorationRegion = "HEADER_MARGIN") => ({
  placementId: `11111111-1111-4111-8111-${String(number).padStart(12, "0")}`, itemId: "EMOJI_SUN" as const, region,
  transform: { xPercent: 4, yPercent: 96, scale: 0.3, rotationDeg: -180 },
})
const empty = createEmptyCalendarDecorationState()
const calendar = <T,>(data: T) => ({ version: 3, state: "ACCOUNT_STATE", kind: "CALENDAR_DECORATIONS", data })
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { setActiveLocalAccount(null); vi.restoreAllMocks() })

it("strict global calendar schema shares transform boundaries and allows exactly 3 items per margin", () => {
  const six = { ...empty, items: [1, 2, 3].map(n => item(n)).concat([4, 5, 6].map(n => item(n, "FOOTER_MARGIN"))) }
  expect(calendarDecorationStateSchema.parse(six)).toEqual(six)
  for (const patch of [{ items: [...six.items, item(7)] }, { items: [1, 2, 3, 4].map(n => item(n)) },
    { items: [item(1), item(1)] }, { version: 2 }, { month: "2026-10" }, { date: "2026-10-02" },
    { ownedItemIds: [] }, { spentPoints: 0 }, { items: [{ ...item(1), text: "note" }] },
    { items: [{ ...item(1), itemId: "TEXT_FREEFORM" }] }, { items: [{ ...item(1), itemId: "INK_NAVY" }] },
    { items: [{ ...item(1), region: "DATE_CELL" }] }, { items: [{ ...item(1), placementId: "not-uuid" }] },
    { items: [{ ...item(1), transform: { ...item(1).transform, scale: 3.01 } }] }]) {
    expect(calendarDecorationStateSchema.safeParse({ ...empty, ...patch }).success).toBe(false)
  }
})

it("unknown or malformed stored calendars stay byte-identical and cannot be silently overwritten", () => {
  for (const raw of ['{"version":2,"items":[],"future":"preserve"}', '{broken', JSON.stringify({ ...empty, month: "2026-10" })]) {
    localStorage.setItem(CALENDAR_DECORATION_STORAGE_KEY, raw)
    expect(parseStoredCalendarDecorationState(raw)).toBeNull()
    expect(calendarDecorationReadStatus()).toBe("UNSUPPORTED")
    expect(loadCalendarDecorationState()).toEqual(empty)
    expect(readCalendarDecorationStateSerialized()).toBe(raw)
    expect(saveCalendarDecorationStateIfCurrent(empty, raw)).toEqual({ ok: false, code: "UNSUPPORTED" })
    expect(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY)).toBe(raw)
  }
})

it("local compare-and-swap refuses stale sessions and checks current owned non-text inventory", () => {
  expect(saveCalendarDecorationStateIfCurrent({ ...empty, items: [item(1)] }, null)).toEqual({ ok: true })
  const previous = readCalendarDecorationStateSerialized()
  expect(saveCalendarDecorationStateIfCurrent(empty, null)).toEqual({ ok: false, code: "STALE_STATE" })
  const paid = DECORATION_CATALOG.find(value => value.cost > 0 && value.category === "STICKER")!
  const unowned = { ...empty, items: [{ ...item(1), itemId: paid.id }] }
  expect(saveCalendarDecorationStateIfCurrent(unowned, previous)).toEqual({ ok: false, code: "OWNERSHIP_STATE_CHANGED" })
  expect(readCalendarDecorationStateSerialized()).toBe(previous)
})

it("write and readback failure preserve the exact previous local calendar", () => {
  const previous = JSON.stringify(empty)
  localStorage.setItem(CALENDAR_DECORATION_STORAGE_KEY, previous)
  const original = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === CALENDAR_DECORATION_STORAGE_KEY && value !== previous) throw new Error("synthetic quota")
    original.call(this, key, value)
  })
  expect(saveCalendarDecorationStateIfCurrent({ ...empty, items: [item(1)] }, previous)).toEqual({ ok: false, code: "WRITE_FAILED" })
  expect(readCalendarDecorationStateSerialized()).toBe(previous)
})

it("readback rollback never overwrites a newer valid same-key calendar", () => {
  const candidate = { ...empty, items: [item(1)] }
  const newer = { ...empty, items: [item(2, "FOOTER_MARGIN")] }
  const original = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === CALENDAR_DECORATION_STORAGE_KEY && value === JSON.stringify(candidate)) {
      original.call(this, key, JSON.stringify(newer))
      return
    }
    original.call(this, key, value)
  })

  expect(saveCalendarDecorationStateIfCurrent(candidate, null)).toEqual({ ok: false, code: "ROLLBACK_FAILED" })
  expect(readCalendarDecorationStateSerialized()).toBe(JSON.stringify(newer))
})

it("device and both local account calendars remain separate and erase discovers every scoped new key", () => {
  expect(saveCalendarDecorationStateIfCurrent(empty, null).ok).toBe(true)
  setActiveLocalAccount("account-a")
  expect(readCalendarDecorationStateSerialized()).toBeNull()
  expect(saveCalendarDecorationStateIfCurrent({ ...empty, items: [item(1)] }, null).ok).toBe(true)
  setActiveLocalAccount("account-b")
  expect(readCalendarDecorationStateSerialized()).toBeNull()
  expect(saveCalendarDecorationStateIfCurrent({ ...empty, items: [item(2, "FOOTER_MARGIN")] }, null).ok).toBe(true)
  expect(activeCalendarDecorationStorageKey()).toBe(accountScopedStorageKeyFor(CALENDAR_DECORATION_STORAGE_KEY, "account-b"))
  setActiveLocalAccount("account-a")
  expect(loadCalendarDecorationState().items[0]?.placementId).toBe(item(1).placementId)
  const keys = [CALENDAR_DECORATION_STORAGE_KEY, ...["account-a", "account-b"].map(id => accountScopedStorageKeyFor(CALENDAR_DECORATION_STORAGE_KEY, id))]
  expect(erasableKeys()).toEqual(expect.arrayContaining(keys))
  expect(eraseAllLocalData().ok).toBe(true)
  for (const key of keys) expect(localStorage.getItem(key)).toBeNull()
})

it("the new envelope is additive, cannot change document kind, and derives ownership only from canonical decorations", () => {
  const state = createEmptyDecorationState(), owned = { version: 3, state: "ACCOUNT_STATE", kind: "DECORATIONS", data: state }
  const proposal = calendar({ ...empty, items: [item(1)] })
  expect(validateAccountStateDocument(proposal)).toBe(true)
  expect(validateAccountStateDocument(owned)).toBe(true)
  expect(validateAccountStateDocumentUpdate(proposal, calendar(empty))).toBe(true)
  expect(validateAccountStateDocumentUpdate(proposal, owned)).toBe(false)
  expect(calendarDecorationsOwnedBy(proposal.data, state)).toBe(true)
  expect(accountCalendarDecorationOwnershipMetadata(proposal, owned)).toEqual({ paidReferenceItemIds: [] })
  const paid = DECORATION_CATALOG.find(value => value.cost > 0 && value.category === "STICKER")!
  const paidProposal = calendar({ ...empty, items: [{ ...item(1), itemId: paid.id }] })
  expect(() => accountCalendarDecorationOwnershipMetadata(paidProposal, owned)).toThrow("OWNERSHIP_STATE_CHANGED")
  const paidOwned = { ...owned, data: { ...state, spentPoints: paid.cost, ownedItemIds: [...state.ownedItemIds, paid.id] } }
  expect(accountCalendarDecorationOwnershipMetadata(paidProposal, paidOwned)).toEqual({ paidReferenceItemIds: [paid.id] })
})
