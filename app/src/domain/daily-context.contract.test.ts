import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { loadDailyContext, readDailyContexts, saveDailyContext } from "./daily-context"
import { setActiveLocalAccount } from "./account/local-journal-ownership"

beforeEach(() => window.localStorage.clear())
afterEach(() => setActiveLocalAccount(null))

describe("daily context tags", () => {
  it("stores only manual mood, body, and weather choices for one date", () => {
    expect(saveDailyContext({ date: "2026-08-01", mood: "GOOD", body: "NORMAL", weather: "SUNNY" })).toBe(true)

    expect(loadDailyContext("2026-08-01")).toEqual({
      date: "2026-08-01",
      mood: "GOOD",
      body: "NORMAL",
      weather: "SUNNY",
    })
    expect(loadDailyContext("2026-08-02")).toBeNull()
  })

  it("lists validated saved dates in newest-first order without writing", () => {
    saveDailyContext({ date: "2026-08-01", mood: "GOOD", body: "NORMAL", weather: "SUNNY" })
    saveDailyContext({ date: "2026-08-03", mood: null, body: "TIRED", weather: null })
    const key = "trainoracle.daily-context.v1"
    const stored = window.localStorage.getItem(key)

    expect(readDailyContexts()).toEqual({ kind: "loaded", contexts: [
      { date: "2026-08-03", mood: null, body: "TIRED", weather: null },
      { date: "2026-08-01", mood: "GOOD", body: "NORMAL", weather: "SUNNY" },
    ] })
    expect(window.localStorage.getItem(key)).toBe(stored)
  })

  it("lists only the active account's validated dates", () => {
    setActiveLocalAccount("daily-context-account-a")
    saveDailyContext({ date: "2026-08-01", mood: "GOOD", body: null, weather: null })
    setActiveLocalAccount("daily-context-account-b")
    saveDailyContext({ date: "2026-08-02", mood: "LOW", body: null, weather: null })

    expect(readDailyContexts()).toEqual({ kind: "loaded", contexts: [
      { date: "2026-08-02", mood: "LOW", body: null, weather: null },
    ] })
    setActiveLocalAccount("daily-context-account-a")
    expect(readDailyContexts()).toEqual({ kind: "loaded", contexts: [
      { date: "2026-08-01", mood: "GOOD", body: null, weather: null },
    ] })
  })

  it("rejects malformed storage rather than inventing tags", () => {
    window.localStorage.setItem("trainoracle.daily-context.v1", JSON.stringify({ "2026-08-01": { mood: "PERFECT" } }))

    expect(loadDailyContext("2026-08-01")).toBeNull()
  })

  it("does not replace an unreadable context map when saving another date", () => {
    const original = "{invalid-json"
    window.localStorage.setItem("trainoracle.daily-context.v1", original)

    expect(saveDailyContext({ date: "2026-08-02", mood: "GOOD", body: "NORMAL", weather: "SUNNY" })).toBe(false)
    expect(window.localStorage.getItem("trainoracle.daily-context.v1")).toBe(original)
  })

  it("does not treat a context stored under the wrong date as a valid map", () => {
    const original = JSON.stringify({
      "2026-08-01": { date: "2026-08-02", mood: "GOOD", body: "NORMAL", weather: "SUNNY" },
    })
    window.localStorage.setItem("trainoracle.daily-context.v1", original)

    expect(saveDailyContext({ date: "2026-08-03", mood: "LOW", body: "TIRED", weather: "RAINY" })).toBe(false)
    expect(window.localStorage.getItem("trainoracle.daily-context.v1")).toBe(original)
  })
})
