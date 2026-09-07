import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { adjustedSuccessorFixture } from "./adjusted-plan-successor.test-fixtures"
import { exportAdjustedPlanBackup } from "./adjusted-plan-backup"
import { importAdjustedPlanHistory } from "./adjusted-plan-import"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { readAdjustedOriginalPlans, ADJUSTED_PLAN_ARCHIVE_KEY, prepareAdjustedOriginalArchive } from "./adjusted-plan-archive"
import { encodeStoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
async function fixture() {
  const value = await adjustedSuccessorFixture(date => vi.setSystemTime(date))
  const exported = exportAdjustedPlanBackup(value.old.state.contentFingerprint, value.retained, value.now)
  if (exported.kind !== "exported") throw Error("Expected file")
  return { ...value, raw: exported.raw, request: { raw: exported.raw, confirmsOwnFile: true,
    isCurrentRequest: () => true, readEvidence: () => value.retained, locks: value.input.locks } }
}
it("restores a file as history, never activates it, and preserves existing copies on replay", async () => {
  const { request, old, retained } = await fixture()
  localStorage.removeItem(activePlanBetaStorageKey())
  expect(await importAdjustedPlanHistory(request)).toMatchObject({ kind: "restored_history", added: 1, activePlanChanged: false })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  expect(readAdjustedOriginalPlans(retained)).toMatchObject({ kind: "loaded", entries: [{ state: old.state }] })
  const archive = localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)
  expect(await importAdjustedPlanHistory(request)).toMatchObject({ kind: "restored_history", added: 0, keptExisting: 1 })
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)).toBe(archive)
})
it("keeps the current active original and requires explicit ownership and trusted evidence", async () => {
  const { request, old } = await fixture()
  expect(await importAdjustedPlanHistory(request)).toMatchObject({ kind: "restored_history", added: 0, keptExisting: 1 })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(old.raw)
  expect(await importAdjustedPlanHistory({ ...request, confirmsOwnFile: false })).toMatchObject({ kind: "rejected" })
  expect(await importAdjustedPlanHistory({ ...request, readEvidence: () => [] })).toMatchObject({ kind: "rejected" })
  expect(await importAdjustedPlanHistory({ ...request, locks: null })).toMatchObject({ kind: "rejected" })
  expect(await importAdjustedPlanHistory({ ...request, isCurrentRequest: () => false })).toMatchObject({ kind: "rejected" })
})
it("preserves corruption and reports write failure without creating an active plan", async () => {
  const { request } = await fixture()
  localStorage.removeItem(activePlanBetaStorageKey())
  localStorage.setItem(ADJUSTED_PLAN_ARCHIVE_KEY, "{broken")
  expect(await importAdjustedPlanHistory(request)).toMatchObject({ kind: "rejected", code: "INVALID_EXISTING_PLAN" })
  expect(localStorage.getItem(ADJUSTED_PLAN_ARCHIVE_KEY)).toBe("{broken")
  localStorage.removeItem(ADJUSTED_PLAN_ARCHIVE_KEY)
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota") })
  expect(await importAdjustedPlanHistory(request)).toMatchObject({ kind: "rejected", code: "IMPORT_WRITE_FAILED" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})
it("prefers the file's active progress over its older retained copy, but never overwrites a local copy", async () => {
  const { request, old, retained, now } = await fixture()
  const archived = prepareAdjustedOriginalArchive(null, old.state, retained, now)
  if (archived.kind !== "prepared") throw Error("Expected archive")
  const newer = encodeStoredAdjustedPlanState(old.state.selection,
    old.state.progress.map((entry, index) => index === 0 ? { ...entry, state: "RESTED" as const } : entry), now.toISOString(), retained, now)
  if (newer.kind !== "encoded") throw Error("Expected newer progress")
  localStorage.setItem(activePlanBetaStorageKey(), newer.raw)
  localStorage.setItem(ADJUSTED_PLAN_ARCHIVE_KEY, archived.raw)
  const exported = exportAdjustedPlanBackup(newer.state.contentFingerprint, retained, now)
  if (exported.kind !== "exported") throw Error("Expected file")
  localStorage.removeItem(activePlanBetaStorageKey())
  expect(await importAdjustedPlanHistory({ ...request, raw: exported.raw })).toMatchObject({ kind: "restored_history", added: 0 })
  expect(readAdjustedOriginalPlans(retained)).toMatchObject({ kind: "loaded", entries: [{ state: old.state }] })
  localStorage.removeItem(ADJUSTED_PLAN_ARCHIVE_KEY)
  expect(await importAdjustedPlanHistory({ ...request, raw: exported.raw })).toMatchObject({ kind: "restored_history", added: 1 })
  expect(readAdjustedOriginalPlans(retained)).toMatchObject({ kind: "loaded", entries: [{ state: newer.state }] })
})
