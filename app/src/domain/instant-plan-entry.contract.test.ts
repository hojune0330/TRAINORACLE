import { beforeEach, expect, it, vi } from "vitest"
import { loadAthleteRecords } from "./athlete-records"
import { prepareInstantPlanEntry, readInstantPlanEntry } from "./instant-plan-entry"

const now = new Date("2026-09-20T03:00:00.000Z")
const record = { kind: "CURRENT_RECORD", eventDistanceM: 800, performanceSeconds: 121.5, achievedOn: "2026-09-19" } as const
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

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
  expect(loadAthleteRecords(now)).toHaveLength(0)
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
