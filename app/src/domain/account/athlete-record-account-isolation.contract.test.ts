import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  ATHLETE_RECORDS_STORAGE_KEY,
  createSelfReportedAthleteRecord,
  loadAthleteRecords,
  loadAthleteRecordsForAccount,
  saveAthleteRecord,
} from "../athlete-records"
import { eraseAllLocalData, erasableKeys } from "../erase-local-data"
import { setActiveLocalAccount } from "./local-journal-ownership"

const TODAY = new Date("2026-08-25T12:00:00.000Z")

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  setActiveLocalAccount(null)
})

afterEach(() => {
  setActiveLocalAccount(null)
})

function record(performanceSeconds: number) {
  const value = createSelfReportedAthleteRecord({
    id: "pb-5000",
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds,
    achievedOn: "2026-08-01",
    seasonId: null,
  }, TODAY)
  if (value === null) throw new TypeError("Expected valid athlete record fixture")
  return value
}

describe("account-scoped athlete records", () => {
  it("keeps device, account A, and account B records separate", () => {
    expect(saveAthleteRecord(record(1110), TODAY)).toEqual({ ok: true, total: 1 })

    setActiveLocalAccount("account-a")
    expect(loadAthleteRecords(TODAY)).toEqual([])
    expect(saveAthleteRecord(record(1090), TODAY)).toEqual({ ok: true, total: 1 })

    setActiveLocalAccount("account-b")
    expect(loadAthleteRecords(TODAY)).toEqual([])
    expect(saveAthleteRecord(record(1150), TODAY)).toEqual({ ok: true, total: 1 })
    expect(loadAthleteRecords(TODAY)[0]?.performanceSeconds).toBe(1150)

    setActiveLocalAccount("account-a")
    expect(loadAthleteRecords(TODAY)[0]?.performanceSeconds).toBe(1090)

    setActiveLocalAccount(null)
    expect(loadAthleteRecords(TODAY)[0]?.performanceSeconds).toBe(1110)
  })

  it("can re-read the captured account scope without consulting the current account", () => {
    setActiveLocalAccount("account-a")
    expect(saveAthleteRecord(record(1090), TODAY)).toEqual({ ok: true, total: 1 })
    setActiveLocalAccount("account-b")

    expect(loadAthleteRecordsForAccount("account-a", TODAY)[0]?.performanceSeconds).toBe(1090)
    expect(loadAthleteRecordsForAccount("account-b", TODAY)).toEqual([])
  })

  it("erases athlete records belonging to every account on the device", () => {
    const accountAKey = `${ATHLETE_RECORDS_STORAGE_KEY}.account.account-a`
    const accountBKey = `${ATHLETE_RECORDS_STORAGE_KEY}.account.account-b`
    window.localStorage.setItem(accountAKey, "[]")
    window.localStorage.setItem(accountBKey, "[]")

    expect(erasableKeys()).toEqual(expect.arrayContaining([accountAKey, accountBKey]))
    expect(eraseAllLocalData()).toMatchObject({ ok: true, cleared: 2 })
    expect(window.localStorage.getItem(accountAKey)).toBeNull()
    expect(window.localStorage.getItem(accountBKey)).toBeNull()
  })
})
