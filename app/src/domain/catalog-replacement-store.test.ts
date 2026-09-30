import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import { replanFixture } from "./execution-replan.test-fixture"
import { prepareCatalogReplacement } from "./catalog-replacement"
import { applyCatalogReplacement } from "./catalog-replacement-store"
import { loadVersionedPlanBetaState, readArchivedOriginalPlans } from "./plan-beta-store"
import { readJournalOriginalPlan } from "./journal-original-plan"

vi.mock("./plan-mutation-lock", () => ({ PLAN_BETA_MUTATION_LOCK_NAME: "test-plan-lock", getPlanMutationLockManager: () => ({
  request: async (_name: string, _options: unknown, run: (lock: object) => unknown) => run({}),
}) }))
beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-29T03:00:00.000Z")) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear() })
function prepared() {
  const f = replanFixture()
  localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(f.state))
  localStorage.setItem("trainoracle.journal.v1", JSON.stringify(f.entries))
  for (const entry of ALL_WORKOUT_CATALOG.filter(e => e.family === "BASE")) {
    const result = prepareCatalogReplacement({ ...f, address: { day: 4, slot: "AM" }, catalogId: entry.id,
      inputs: { eventDistanceM: 5000, experience: f.state.intake.experienceBand, availableSeconds: null,
        confirmedRequirements: [], fiveK: null, segmentPaces: [] }, acceptLonger: true, acceptStronger: false, journalGuard: null })
    if (result.kind === "ready") return { ...f, proposal: result.proposal }
  }
  throw Error("fixture has no eligible BASE replacement")
}
describe("future catalog change persistence", () => {
  it("archives the original, changes one slot and keeps an older journal resolvable", async () => {
    const f = prepared(), journal = localStorage.getItem("trainoracle.journal.v1")
    expect(await applyCatalogReplacement(f.proposal, true)).toEqual({ kind: "applied" })
    expect(loadVersionedPlanBetaState()).toEqual(f.proposal.after)
    expect(readJournalOriginalPlan(f.entries[0]!)).toMatchObject({ kind: "matched", source: "ARCHIVED" })
    expect(localStorage.getItem("trainoracle.journal.v1")).toBe(journal)
    const archive = readArchivedOriginalPlans()
    expect((await applyCatalogReplacement(f.proposal, true)).kind).toBe("blocked")
    expect(readArchivedOriginalPlans()).toEqual(archive)
  })
  it.each(["journal", "plan", "pain", "midnight", "confirmation", "forged"])("blocks stale or invalid %s without writes", async reason => {
    const f = prepared()
    if (reason === "journal") localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{ ...f.entries[0], activityOutcome: "RESTED" }]))
    if (reason === "plan") localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify({ ...f.state, progress: [] }))
    if (reason === "pain") localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{ ...f.entries[0], painCheckStatus: "SIGNAL_REPORTED" }]))
    if (reason === "midnight") vi.setSystemTime(new Date("2026-09-30T03:00:00.000Z"))
    if (reason === "forged") f.proposal.after.intake.availableDayCount = 5
    const before = localStorage.getItem("trainoracle.plan-beta.v1")
    expect((await applyCatalogReplacement(f.proposal, reason !== "confirmation")).kind).toBe("blocked")
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBe(before)
    expect(localStorage.getItem("trainoracle.plan-beta.history.v1")).toBeNull()
  })
  it("preserves the original when writing the new active plan fails", async () => {
    const f = prepared(), write = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
      if (key === "trainoracle.plan-beta.v1") throw new DOMException("synthetic capacity", "QuotaExceededError")
      write.call(this, key, value)
    })
    expect((await applyCatalogReplacement(f.proposal, true)).kind).toBe("blocked")
    expect(loadVersionedPlanBetaState()).toEqual(f.state)
    expect(readArchivedOriginalPlans().kind).toBe("loaded")
  })
  it("never rolls back or reports success after an unknown acknowledgement", async () => {
    const f = prepared(), write = Storage.prototype.setItem, read = Storage.prototype.getItem
    let written = false
    const writer = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
      write.call(this, key, value); if (key === "trainoracle.plan-beta.v1") written = true
    })
    const reader = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key) {
      if (written && key === "trainoracle.plan-beta.v1") throw new DOMException("synthetic lost read", "SecurityError")
      return read.call(this, key)
    })
    expect((await applyCatalogReplacement(f.proposal, true)).kind).toBe("uncertain")
    reader.mockRestore(); writer.mockRestore()
    expect(loadVersionedPlanBetaState()).toEqual(f.proposal.after)
  })
})
