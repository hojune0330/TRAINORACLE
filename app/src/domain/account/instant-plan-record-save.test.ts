import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AthleteRecord } from "../athlete-records"
import * as records from "../athlete-records"
import { setActiveLocalAccount } from "./local-journal-ownership"
import { accountScopedStorageKeyFor } from "./local-account-scope"
import { accountAthleteRecordsEnabled, addAccountAthleteRecord, loadAccountAthleteRecords } from "./account-athlete-record-service"
import type { AccountAthleteRecordsState, AccountAthleteRecordsStatus } from "./account-athlete-record-service"
import { prepareAccountInstantPlanEntry } from "./instant-plan-record-save"

vi.mock("./account-athlete-record-service", () => ({ accountAthleteRecordsEnabled: vi.fn(),
  loadAccountAthleteRecords: vi.fn(), addAccountAthleteRecord: vi.fn(), readAccountAthleteRecordsState: vi.fn() }))

const A = "account-a", B = "account-b", now = new Date("2026-10-02T03:00:00.000Z")
const entry = { kind: "CURRENT_RECORD" as const, eventDistanceM: 5000 as const,
  performanceSeconds: 1000, achievedOn: "2026-10-01" }
function actual(id = "existing"): AthleteRecord {
  const record = records.createSelfReportedAthleteRecord({ id, purpose: "RECENT_RESULT", eventDistanceM: 5000,
    performanceSeconds: 1000, achievedOn: entry.achievedOn, seasonId: null }, now)
  if (!record) throw Error("Invalid synthetic record fixture")
  return record
}
let state: AccountAthleteRecordsState
function ready(rows: AthleteRecord[]): AccountAthleteRecordsState {
  return { ownerId: A, documentId: "document-a", serverRevision: 1, status: "READY", confirmed: true, records: rows }
}
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  setActiveLocalAccount(A)
  state = { ...ready([]), status: "EMPTY", confirmed: false, serverRevision: 0 }
  vi.mocked(accountAthleteRecordsEnabled).mockReturnValue(true)
  vi.mocked(loadAccountAthleteRecords).mockImplementation(async () => state)
  vi.mocked(addAccountAthleteRecord).mockImplementation(async candidate => {
    const row = records.parseAthleteRecord(candidate, now)
    if (!row) return { ok: false, code: "INVALID_RECORD" }
    state = { ...ready([...state.records, row]), serverRevision: (state.serverRevision ?? 0) + 1 }
    return { ok: true, storage: "ACCOUNT", state, snapshot: null }
  })
})
afterEach(() => { setActiveLocalAccount(null); vi.restoreAllMocks() })

describe("account first-entry record saving", () => {
  it("saves a new actual only after a confirmed account acknowledgement", async () => {
    const result = await prepareAccountInstantPlanEntry(entry, now)
    expect(result).toMatchObject({ kind: "ready", entry, recordId: expect.any(String) })
    expect(addAccountAthleteRecord).toHaveBeenCalledTimes(1)
    expect(records.loadAthleteRecords(now)).toEqual(state.records)
  })
  it("reuses a verified or self-reported server record without a second addition", async () => {
    for (const verificationState of ["VERIFIED", "SELF_REPORTED"] as const) {
      state = ready([{ ...actual(), verificationState,
        enteredBy: verificationState === "VERIFIED" ? "VERIFIED_IMPORT" : "ATHLETE" }])
      localStorage.clear()
      expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual({ kind: "ready", entry, recordId: "existing" })
    }
    expect(addAccountAthleteRecord).not.toHaveBeenCalled()
  })
  it("does not reuse an unverified match and reuses the new self-report on retry", async () => {
    state = ready([{ ...actual("unverified"), verificationState: "UNVERIFIED" }])
    const first = await prepareAccountInstantPlanEntry(entry, now)
    expect(first).toMatchObject({ kind: "ready", recordId: expect.not.stringMatching(/^unverified$/) })
    expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual(first)
    expect(addAccountAthleteRecord).toHaveBeenCalledTimes(1)
    expect(state.records).toHaveLength(2)
  })
  it("canonicalizes a legacy half-distance match without adding a duplicate", async () => {
    state = ready([{ ...actual(), eventDistanceM: 21097.5 }])
    const half = { ...entry, eventDistanceM: 21097 as const }
    expect(await prepareAccountInstantPlanEntry(half, now)).toEqual({ kind: "ready", entry: half, recordId: "existing" })
    expect(addAccountAthleteRecord).not.toHaveBeenCalled()
  })
  it("stores a goal without turning it into an actual pace anchor", async () => {
    const goal = { kind: "GOAL_ONLY" as const, eventDistanceM: 5000 as const, performanceSeconds: 900 }
    const first = await prepareAccountInstantPlanEntry(goal, now)
    expect(first).toEqual({ kind: "ready", entry: goal, recordId: null })
    expect(state.records[0]).toMatchObject({ purpose: "RACE_GOAL", achievedOn: null })
    expect(await prepareAccountInstantPlanEntry(goal, now)).toEqual(first)
    expect(addAccountAthleteRecord).toHaveBeenCalledTimes(1)
  })
  it("never reuses a goal as the matching actual", async () => {
    state = ready([{ ...actual("goal"), purpose: "RACE_GOAL", achievedOn: null, seasonId: null }])
    expect(await prepareAccountInstantPlanEntry(entry, now)).toMatchObject({ kind: "ready" })
    expect(addAccountAthleteRecord).toHaveBeenCalledTimes(1)
  })
  it("no-record entry needs neither an account read nor a write", async () => {
    const none = { kind: "NO_RECORD" as const, eventDistanceM: 5000 as const }
    expect(await prepareAccountInstantPlanEntry(none, now)).toEqual({ kind: "ready", entry: none, recordId: null })
    expect(loadAccountAthleteRecords).not.toHaveBeenCalled()
    expect(addAccountAthleteRecord).not.toHaveBeenCalled()
  })
  it("reports cache failure after ACK and never adds again during failed or successful retries", async () => {
    const cache = vi.spyOn(records, "cacheConfirmedAthleteRecords").mockReturnValue(false)
    const first = await prepareAccountInstantPlanEntry(entry, now)
    expect(first).toMatchObject({ kind: "cache_failed", entry, recordId: expect.any(String) })
    expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual(first)
    cache.mockReturnValue(true)
    const retry = await prepareAccountInstantPlanEntry(entry, now)
    expect(retry).toEqual({ ...first, kind: "ready" })
    expect(addAccountAthleteRecord).toHaveBeenCalledTimes(1)
    expect(state.records).toHaveLength(1)
  })
  it("a same-ID device conflict preserves bytes and does not trigger another account addition", async () => {
    state = ready([actual()])
    const key = accountScopedStorageKeyFor(records.ATHLETE_RECORDS_STORAGE_KEY, A)
    const raw = JSON.stringify([{ ...actual(), performanceSeconds: 900 }])
    localStorage.setItem(key, raw)
    expect(await prepareAccountInstantPlanEntry(entry, now)).toMatchObject({ kind: "cache_failed", recordId: "existing" })
    expect(await prepareAccountInstantPlanEntry(entry, now)).toMatchObject({ kind: "cache_failed" })
    expect(localStorage.getItem(key)).toBe(raw)
    expect(addAccountAthleteRecord).not.toHaveBeenCalled()
  })
  it("preserves unrelated device records when the confirmed record is cached", async () => {
    const key = accountScopedStorageKeyFor(records.ATHLETE_RECORDS_STORAGE_KEY, A)
    const device = actual("device-only")
    localStorage.setItem(key, JSON.stringify([device]))
    await prepareAccountInstantPlanEntry(entry, now)
    expect(records.loadAthleteRecords(now)).toEqual([device, ...state.records])
  })
  it.each<AccountAthleteRecordsStatus>(["DELETED", "FAILED", "CONFLICT", "LOADING", "IDLE", "AUTH_REQUIRED"])(
    "blocks %s without a cache fallback or addition", async status => {
      state = { ...ready([actual()]), status }
      expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual({ kind: "storage_failed" })
      expect(addAccountAthleteRecord).not.toHaveBeenCalled()
    })
  it("retains pending status without adding or caching another record", async () => {
    state = { ...ready([actual()]), status: "PENDING", confirmed: false }
    expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual({ kind: "pending" })
    expect(addAccountAthleteRecord).not.toHaveBeenCalled()
    expect(records.loadAthleteRecords(now)).toEqual([])
  })
  it("rejects an unconfirmed READY or wrong-owner snapshot", async () => {
    state = { ...ready([actual()]), confirmed: false }
    expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual({ kind: "storage_failed" })
    state = { ...ready([actual()]), ownerId: B }
    expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual({ kind: "storage_failed" })
    expect(addAccountAthleteRecord).not.toHaveBeenCalled()
  })
  it("account change while reading rejects the old response without writing", async () => {
    vi.mocked(loadAccountAthleteRecords).mockImplementation(async () => { setActiveLocalAccount(B); return ready([actual()]) })
    expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual({ kind: "storage_failed" })
    expect(addAccountAthleteRecord).not.toHaveBeenCalled()
    expect(records.loadAthleteRecords(now)).toEqual([])
  })
  it("account change after ACK cannot cache the old owner's record into the new account", async () => {
    vi.mocked(addAccountAthleteRecord).mockImplementation(async () => {
      setActiveLocalAccount(B)
      return { ok: true, storage: "ACCOUNT", state: ready([actual()]), snapshot: null }
    })
    expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual({ kind: "storage_failed" })
    expect(records.loadAthleteRecords(now)).toEqual([])
  })
  it("unacknowledged writes remain pending and cannot populate the pace cache", async () => {
    vi.mocked(addAccountAthleteRecord).mockResolvedValue({ ok: true, storage: "PENDING",
      state: { ...ready([actual()]), status: "PENDING", confirmed: false }, snapshot: null })
    expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual({ kind: "pending" })
    expect(records.loadAthleteRecords(now)).toEqual([])
  })
  it("rejects an ACCOUNT response without a confirmed matching source record", async () => {
    vi.mocked(addAccountAthleteRecord).mockResolvedValue({ ok: true, storage: "ACCOUNT", state: ready([]), snapshot: null })
    expect(await prepareAccountInstantPlanEntry(entry, now)).toEqual({ kind: "storage_failed" })
    expect(records.loadAthleteRecords(now)).toEqual([])
  })
  it("guest input stays in the device-only path", async () => {
    setActiveLocalAccount(null)
    expect(await prepareAccountInstantPlanEntry(entry, now)).toMatchObject({ kind: "ready" })
    expect(loadAccountAthleteRecords).not.toHaveBeenCalled()
    expect(addAccountAthleteRecord).not.toHaveBeenCalled()
    expect(records.loadAthleteRecords(now)).toHaveLength(1)
  })
})
