import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { adjustedSuccessorFixture } from "./adjusted-plan-successor.test-fixtures"
import { saveSelectedAdjustedSuccessor } from "./adjusted-plan-store"
import { exportAdjustedPlanBackup, readAdjustedPlanBackup } from "./adjusted-plan-backup"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { ADJUSTED_PLAN_ARCHIVE_KEY } from "./adjusted-plan-archive"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it("exports actual successor and predecessor together and reads without writing or granting authority", async () => {
  const { input, retained, old, now } = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
  const saved = await saveSelectedAdjustedSuccessor(input)
  if (saved.kind !== "saved") throw Error(saved.code)
  localStorage.setItem("unrelated-journal-memo", "PRIVATE-MEMO-NOT-EXPORTED")
  const before = Object.entries(localStorage)
  const result = exportAdjustedPlanBackup(saved.state.contentFingerprint, retained, now)
  if (result.kind !== "exported") throw Error("Expected export")
  expect(result.archivedCount).toBe(1)
  expect(result.raw).not.toContain("PRIVATE-MEMO-NOT-EXPORTED")
  expect(JSON.parse(result.raw)).not.toHaveProperty("retained")
  expect(readAdjustedPlanBackup(result.raw, retained, now)).toMatchObject({ kind: "read_only",
    active: saved.state, entries: [{ state: old.state }], executionAuthority: "NONE", storageState: "NOT_RESTORED" })
  expect(Object.entries(localStorage)).toEqual(before)
  expect(readAdjustedPlanBackup(result.raw, [], now).kind).toBe("invalid")
  const corrupt = JSON.parse(result.raw)
  corrupt.active.progress = [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }]
  expect(readAdjustedPlanBackup(JSON.stringify(corrupt), retained, now).kind).toBe("invalid")
  expect(readAdjustedPlanBackup(result.raw, retained, new Date(now.getTime() - 1)).kind).toBe("invalid")
}, 15000)

it("does not silently drop an unreadable archive or export a stale active state", async () => {
  const { old, retained, now } = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
  expect(exportAdjustedPlanBackup("stale", retained, now).kind).toBe("invalid")
  localStorage.setItem(ADJUSTED_PLAN_ARCHIVE_KEY, "{broken")
  expect(exportAdjustedPlanBackup(old.state.contentFingerprint, retained, now).kind).toBe("invalid")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
})

it("rejects a storage change during export instead of returning mixed generations", async () => {
  const { old, retained, now } = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
  const original = Storage.prototype.getItem
  let reads = 0
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
    if (key === activePlanBetaStorageKey() && ++reads === 2) return "changed"
    return original.call(this, key)
  })
  expect(exportAdjustedPlanBackup(old.state.contentFingerprint, retained, now).kind).toBe("invalid")
})
