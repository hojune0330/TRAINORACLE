import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  DECORATION_STORAGE_KEY_V2,
  loadDecorationState,
  saveDecorationState,
  toggleFavoriteDecoration,
} from "../decorations"
import { eraseAllLocalData, erasableKeys } from "../erase-local-data"
import { accountScopedStorageKeyFor } from "./local-account-scope"
import { setActiveLocalAccount } from "./local-journal-ownership"

beforeEach(() => {
  window.localStorage.clear()
  setActiveLocalAccount(null)
})

afterEach(() => setActiveLocalAccount(null))

describe("account-scoped decorations", () => {
  it("keeps device, account A, and account B decoration choices separate", () => {
    const device = toggleFavoriteDecoration(loadDecorationState(), "STICKER_WEATHER_SUN")
    expect(saveDecorationState(device)).toEqual({ ok: true })

    setActiveLocalAccount("account-a")
    expect(loadDecorationState().library.favoriteItemIds).toEqual([])
    const accountA = toggleFavoriteDecoration(loadDecorationState(), "STAMP_REST_DAY")
    expect(saveDecorationState(accountA)).toEqual({ ok: true })

    setActiveLocalAccount("account-b")
    expect(loadDecorationState().library.favoriteItemIds).toEqual([])

    setActiveLocalAccount("account-a")
    expect(loadDecorationState().library.favoriteItemIds).toEqual(["STAMP_REST_DAY"])
    setActiveLocalAccount(null)
    expect(loadDecorationState().library.favoriteItemIds).toEqual(["STICKER_WEATHER_SUN"])
  })

  it("discovers and erases decoration data for every account on a shared device", () => {
    const accountAKey = accountScopedStorageKeyFor(DECORATION_STORAGE_KEY_V2, "account-a")
    const accountBKey = accountScopedStorageKeyFor(DECORATION_STORAGE_KEY_V2, "account-b")
    window.localStorage.setItem(accountAKey, "{}")
    window.localStorage.setItem(accountBKey, "{}")

    expect(erasableKeys()).toEqual(expect.arrayContaining([accountAKey, accountBKey]))
    expect(eraseAllLocalData()).toMatchObject({ ok: true, cleared: 2 })
    expect(window.localStorage.getItem(accountAKey)).toBeNull()
    expect(window.localStorage.getItem(accountBKey)).toBeNull()
  })
})
