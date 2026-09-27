import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { LOCAL_JOURNALS_CHANGED } from "./journal-change-events"
import { JOURNAL_STORAGE_KEY, writeJournalEntries } from "./journal-local-storage"
import { writeVaultAndJournalAtomically } from "./private-memo-vault-storage"
import { PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"

beforeEach(() => localStorage.clear())
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

it("notifies only after confirmed plain or private-shell transactions, without record payloads", () => {
  const events: Event[] = []
  const listener = (event: Event) => {
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe("[]")
    events.push(event)
  }
  window.addEventListener(LOCAL_JOURNALS_CHANGED, listener)
  try {
    expect(writeJournalEntries(localStorage, [])).toBe(true)
    expect(events).toHaveLength(1)
    expect(writeVaultAndJournalAtomically(localStorage, { version: 1, records: {} }, [])).toBe(true)
    expect(events).toHaveLength(2)
    expect(events.every(event => !("detail" in event))).toBe(true)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("synthetic write failure") })
    expect(writeJournalEntries(localStorage, [])).toBe(false)
    expect(writeVaultAndJournalAtomically(localStorage, { version: 1, records: {} }, [])).toBe(false)
    expect(events).toHaveLength(2)
  } finally { window.removeEventListener(LOCAL_JOURNALS_CHANGED, listener) }
})

it("does not announce a partially written private transaction", () => {
  const events = vi.spyOn(window, "dispatchEvent")
  const original = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === JOURNAL_STORAGE_KEY) throw Error("synthetic journal failure after vault write")
    return original.call(this, key, value)
  })
  expect(writeVaultAndJournalAtomically(localStorage, { version: 1, records: {} }, [])).toBe(false)
  expect(events.mock.calls.filter(([event]) => event.type === LOCAL_JOURNALS_CHANGED)).toHaveLength(0)
  expect(localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBeNull()
})

it("keeps a confirmed write successful even if UI notification fails", () => {
  vi.spyOn(window, "dispatchEvent").mockImplementation(() => { throw Error("synthetic UI event failure") })
  expect(writeJournalEntries(localStorage, [])).toBe(true)
  expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe("[]")
})
