import { beforeEach, expect, it, vi } from "vitest"
import { loadAthleteRecords } from "./athlete-records"
import { prepareInstantPlanEntry, readInstantPlanEntry } from "./instant-plan-entry"

const now = new Date("2026-09-20T03:00:00.000Z")
const record = { kind: "CURRENT_RECORD", eventDistanceM: 800, performanceSeconds: 121.5, achievedOn: "2026-09-19" } as const
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

it("preserves an unknown achieved date as null", () => {
  expect(prepareInstantPlanEntry({ ...record, achievedOn: null }, now).kind).toBe("ready")
  expect(loadAthleteRecords(now)[0]?.achievedOn).toBeNull()
})

it("preserves fractional seconds, explicit date and self-reported provenance without duplicate records", () => {
  const first = prepareInstantPlanEntry(record, now)
  expect(first.kind).toBe("ready")
  expect(prepareInstantPlanEntry(record, now)).toEqual(first)
  expect(loadAthleteRecords(now)).toHaveLength(1)
  expect(loadAthleteRecords(now)[0]).toMatchObject({ performanceSeconds: 121.5, achievedOn: "2026-09-19", verificationState: "SELF_REPORTED" })
})

it.each(["GOAL_ONLY", "NO_RECORD"] as const)("does not create a current record for %s", kind => {
  const entry = kind === "GOAL_ONLY" ? { kind, eventDistanceM: 5000, performanceSeconds: 1200 } : { kind, eventDistanceM: 5000 }
  expect(prepareInstantPlanEntry(entry, now)).toMatchObject({ kind: "ready", recordId: null })
  const saved = loadAthleteRecords(now)
  expect(saved).toHaveLength(kind === "GOAL_ONLY" ? 1 : 0)
  if (kind === "GOAL_ONLY") {
    expect(saved[0]).toMatchObject({ purpose: "RACE_GOAL", achievedOn: null, performanceSeconds: 1200 })
    prepareInstantPlanEntry(entry, now)
    expect(loadAthleteRecords(now)).toHaveLength(1)
  }
})

it("stores a new half record at the exact distance while accepting the legacy intake alias", () => {
  expect(prepareInstantPlanEntry({ ...record, eventDistanceM: 21097, performanceSeconds: 5400 }, now).kind).toBe("ready")
  expect(loadAthleteRecords(now)[0]).toMatchObject({ eventDistanceM: 21097.5, performanceSeconds: 5400 })
})

it("keeps an actual and a goal with the same time as separate records", () => {
  prepareInstantPlanEntry(record, now)
  prepareInstantPlanEntry({ kind: "GOAL_ONLY", eventDistanceM: 800, performanceSeconds: record.performanceSeconds }, now)
  expect(loadAthleteRecords(now).map(row => row.purpose).sort()).toEqual(["RACE_GOAL", "RECENT_RESULT"])
})

it.each([
  { ...record, performanceSeconds: NaN }, { ...record, performanceSeconds: Infinity },
  { ...record, performanceSeconds: 0 }, { ...record, achievedOn: "2026-09-21" },
  { ...record, achievedOn: "2026-02-30" }, { ...record, eventDistanceM: 400 },
  { ...record, memo: "not accepted" }, { ...record, kind: "GOAL_ONLY" },
])("rejects invalid, future, unsupported or extra input %j", value => {
  expect(readInstantPlanEntry(value, now)).toBeNull()
  expect(loadAthleteRecords(now)).toHaveLength(0)
})

it("does not claim readiness when the existing record store fails", () => {
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota") })
  try { expect(prepareInstantPlanEntry(record, now)).toEqual({ kind: "storage_failed" }) }
  finally { spy.mockRestore() }
})
