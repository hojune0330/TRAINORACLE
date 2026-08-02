import { beforeEach, describe, expect, it } from "vitest"
import { loadDailyContext, saveDailyContext } from "./daily-context"

beforeEach(() => window.localStorage.clear())

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

  it("rejects malformed storage rather than inventing tags", () => {
    window.localStorage.setItem("trainoracle.daily-context.v1", JSON.stringify({ "2026-08-01": { mood: "PERFECT" } }))

    expect(loadDailyContext("2026-08-01")).toBeNull()
  })
})
