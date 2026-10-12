import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { archiveLegacyPlanForNewEntry, LEGACY_PLAN_ARCHIVE_KEY, readLegacyPlanArchives } from "./legacy-plan-archive"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { accountScopedStorageKey } from "./account/local-account-scope"
import { PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"

let locks: PropertyDescriptor | undefined
beforeEach(() => { localStorage.clear(); setActiveLocalAccount(null); locks = Object.getOwnPropertyDescriptor(navigator, "locks") })
afterEach(() => {
  vi.restoreAllMocks(); setActiveLocalAccount(null)
  if (locks) Object.defineProperty(navigator, "locks", locks)
  else Reflect.deleteProperty(navigator, "locks")
})

function legacy(version: 1 | 2 = 1) {
  const current = stateFixture()
  if (current.version !== 3) throw Error("Expected V3 fixture")
  const { eventDistanceM: _distance, selectedDetailedTemplateRef: _ref, ...intake } = current.intake
  const { pairId: _pair, selectedDetailedTemplateRef: _activeRef, ...activePlan } = current.activePlan
  const raw = JSON.stringify({ ...current, version, intake, activePlan }, null, 2)
  localStorage.setItem(activePlanBetaStorageKey(), raw)
  const read = readPlanBetaStateFromStorage()
  if (read.kind !== "loaded" || read.state.version !== 2) throw Error("Invalid legacy fixture")
  return { raw, state: read.state }
}
function holdLock() {
  let resume!: () => void
  const held = new Promise<void>(resolve => { resume = resolve })
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: async (name: string, _options: unknown, callback: (lock: object) => unknown) => {
      expect(name).toBe(PLAN_BETA_MUTATION_LOCK_NAME); await held; return callback({})
    },
  } })
  return resume
}

it.each([1, 2] as const)("archives V%s byte-for-byte before releasing the current key and leaves existing history untouched", async version => {
  const { state, raw } = legacy(version)
  localStorage.setItem("trainoracle.plan-beta.history.v1", "preserved historical bytes")
  expect(await archiveLegacyPlanForNewEntry(state)).toEqual({ kind: "archived" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  expect(readLegacyPlanArchives()).toEqual({ kind: "loaded", archives: [{ raw, archivedAt: expect.any(String) }] })
  expect(localStorage.getItem("trainoracle.plan-beta.history.v1")).toBe("preserved historical bytes")
})

it("keeps archives isolated to the current account scope", async () => {
  const guest = legacy()
  expect(await archiveLegacyPlanForNewEntry(guest.state)).toEqual({ kind: "archived" })
  setActiveLocalAccount("11111111-1111-4111-8111-111111111111")
  expect(readLegacyPlanArchives()).toEqual({ kind: "loaded", archives: [] })
  const account = legacy(2)
  expect(await archiveLegacyPlanForNewEntry(account.state)).toEqual({ kind: "archived" })
  expect(readLegacyPlanArchives()).toMatchObject({ archives: [{ raw: account.raw }] })
  expect(localStorage.getItem(accountScopedStorageKey(LEGACY_PLAN_ARCHIVE_KEY))).not.toBeNull()
  setActiveLocalAccount(null)
  expect(readLegacyPlanArchives()).toMatchObject({ archives: [{ raw: guest.raw }] })
})

it.each(["quota", "ignored-write", "ignored-remove"])("preserves the active original and existing archive on %s, then permits retry", async failure => {
  const prior = legacy(2)
  expect(await archiveLegacyPlanForNewEntry(prior.state)).toEqual({ kind: "archived" })
  const previousArchive = localStorage.getItem(LEGACY_PLAN_ARCHIVE_KEY)
  const { state, raw } = legacy()
  const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem
  let once = true
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === LEGACY_PLAN_ARCHIVE_KEY && once && failure !== "ignored-remove") {
      once = false
      if (failure === "quota") throw new DOMException("Synthetic quota", "QuotaExceededError")
      return
    }
    set.call(this, key, value)
  })
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
    if (key === activePlanBetaStorageKey() && once && failure === "ignored-remove") { once = false; return }
    remove.call(this, key)
  })
  expect(await archiveLegacyPlanForNewEntry(state)).toEqual({ kind: "failed", rollbackComplete: true })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
  expect(localStorage.getItem(LEGACY_PLAN_ARCHIVE_KEY)).toBe(previousArchive)
  expect(await archiveLegacyPlanForNewEntry(state)).toEqual({ kind: "archived" })
  expect(readLegacyPlanArchives()).toMatchObject({ archives: [{ raw: prior.raw }, { raw }] })
})

it.each(["scope", "aba", "changed-plan"])("performs zero writes after a %s change while waiting for the lock", async change => {
  const { state, raw } = legacy()
  const resume = holdLock()
  const pending = archiveLegacyPlanForNewEntry(state)
  if (change === "changed-plan") {
    localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify({ ...state,
      progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] }))
  } else {
    setActiveLocalAccount("11111111-1111-4111-8111-111111111111")
    if (change === "aba") setActiveLocalAccount(null)
  }
  const set = vi.spyOn(Storage.prototype, "setItem"), remove = vi.spyOn(Storage.prototype, "removeItem")
  resume()
  expect(await pending).toEqual({ kind: "rejected", code: "STALE_BASE" })
  expect(set).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled()
  if (change !== "changed-plan") expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBe(raw)
})

it("does not overwrite a concurrently changed active raw during archive rollback", async () => {
  const { state } = legacy()
  const changed = JSON.stringify({ ...state, progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] })
  const set = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    set.call(this, key, value)
    if (key === LEGACY_PLAN_ARCHIVE_KEY) set.call(this, activePlanBetaStorageKey(), changed)
  })
  expect(await archiveLegacyPlanForNewEntry(state)).toEqual({ kind: "failed", rollbackComplete: true })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(changed)
  expect(localStorage.getItem(LEGACY_PLAN_ARCHIVE_KEY)).toBeNull()
})

it.each(["invalid-archive", "unreadable-active"])("keeps active data untouched when %s prevents a complete snapshot", async failure => {
  const { state, raw } = legacy()
  if (failure === "invalid-archive") localStorage.setItem(LEGACY_PLAN_ARCHIVE_KEY, "{")
  else {
    const get = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
      if (key === activePlanBetaStorageKey()) throw Error("Synthetic read failure")
      return get.call(this, key)
    })
  }
  const set = vi.spyOn(Storage.prototype, "setItem"), remove = vi.spyOn(Storage.prototype, "removeItem")
  expect(await archiveLegacyPlanForNewEntry(state)).toEqual({ kind: "failed", rollbackComplete: true })
  expect(set).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled()
  vi.restoreAllMocks()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
})

it("reports uncertainty if active removal readback and restoration cannot be verified", async () => {
  const { state, raw } = legacy()
  const get = Storage.prototype.getItem, remove = Storage.prototype.removeItem
  let removed = false
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
    remove.call(this, key); if (key === activePlanBetaStorageKey()) removed = true
  })
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
    if (removed && key === activePlanBetaStorageKey()) throw Error("Synthetic unreadable state")
    return get.call(this, key)
  })
  expect(await archiveLegacyPlanForNewEntry(state)).toEqual({ kind: "failed", rollbackComplete: false })
  vi.restoreAllMocks()
  expect(readLegacyPlanArchives()).toMatchObject({ kind: "loaded", archives: [{ raw }] })
})

it("detects archive changes before staging and performs no write", async () => {
  const { state, raw } = legacy()
  const get = Storage.prototype.getItem, set = Storage.prototype.setItem
  const changed = JSON.stringify({ version: 1, archives: [{ raw, archivedAt: new Date().toISOString() }] })
  let reads = 0
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
    if (key === LEGACY_PLAN_ARCHIVE_KEY && ++reads === 2) set.call(this, key, changed)
    return get.call(this, key)
  })
  const writes = vi.spyOn(Storage.prototype, "setItem")
  expect(await archiveLegacyPlanForNewEntry(state)).toEqual({ kind: "rejected", code: "STALE_BASE" })
  expect(writes).not.toHaveBeenCalled()
  expect(localStorage.getItem(LEGACY_PLAN_ARCHIVE_KEY)).toBe(changed)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
})

it("preserves a different writer's archive when readback fails", async () => {
  const { state, raw } = legacy()
  const set = Storage.prototype.setItem
  const changed = JSON.stringify({ version: 1, archives: [{ raw, archivedAt: "2026-08-01T00:00:00.000Z" }] })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    set.call(this, key, key === LEGACY_PLAN_ARCHIVE_KEY ? changed : value)
  })
  expect(await archiveLegacyPlanForNewEntry(state)).toEqual({ kind: "failed", rollbackComplete: false })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
  expect(localStorage.getItem(LEGACY_PLAN_ARCHIVE_KEY)).toBe(changed)
})

it("rolls back exact staged bytes when the archive write completes and then throws", async () => {
  const { state, raw } = legacy()
  const set = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    set.call(this, key, value)
    if (key === LEGACY_PLAN_ARCHIVE_KEY) throw Error("Synthetic post-write failure")
  })
  expect(await archiveLegacyPlanForNewEntry(state)).toEqual({ kind: "failed", rollbackComplete: true })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
  expect(localStorage.getItem(LEGACY_PLAN_ARCHIVE_KEY)).toBeNull()
})

it("keeps the active plan when a mutation lock cannot be acquired", async () => {
  const { state, raw } = legacy()
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: async (_name: string, _options: unknown, callback: (lock: null) => unknown) => callback(null),
  } })
  expect(await archiveLegacyPlanForNewEntry(state)).toEqual({ kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
  expect(localStorage.getItem(LEGACY_PLAN_ARCHIVE_KEY)).toBeNull()
})
