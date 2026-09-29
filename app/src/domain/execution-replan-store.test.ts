import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { replanFixture } from "./execution-replan.test-fixture"
import { prepareExecutionReplan } from "./execution-replan"
import { applyExecutionReplan } from "./execution-replan-store"
import { loadVersionedPlanBetaState, readArchivedOriginalPlans, loadPlanMethodHistorySnapshot } from "./plan-beta-store"
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
  const result = prepareExecutionReplan({ ...f, journalGuard: null })
  if (result.kind !== "ready") throw Error("ready")
  return { ...f, proposal: result.proposals[0]! }
}
describe("execution replan writes", () => {
  it("reports an uncertain acknowledgement without rolling back an already written plan", async () => {
    const f = prepared(), write = Storage.prototype.setItem, read = Storage.prototype.getItem
    let written = false
    const writer = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
      write.call(this, key, value)
      if (key === "trainoracle.plan-beta.v1") written = true
    })
    const reader = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key) {
      if (written && key === "trainoracle.plan-beta.v1") throw new DOMException("synthetic lost read", "SecurityError")
      return read.call(this, key)
    })
    expect((await applyExecutionReplan(f.proposal, f.today, true)).kind).toBe("uncertain")
    reader.mockRestore(); writer.mockRestore()
    expect(loadVersionedPlanBetaState()).toEqual(f.proposal.after)
    expect(readJournalOriginalPlan(f.entries[0]!)).toMatchObject({ kind: "matched", source: "ARCHIVED" })
  })
  it("applies and reloads the new schedule while the original journal still resolves", async () => {
    const f = prepared(), journal = localStorage.getItem("trainoracle.journal.v1")
    expect(await applyExecutionReplan(f.proposal, f.today, true)).toEqual({ kind: "applied" })
    expect(loadVersionedPlanBetaState()).toEqual(f.proposal.after)
    expect(localStorage.getItem("trainoracle.journal.v1")).toBe(journal)
    const originals = readArchivedOriginalPlans()
    expect(originals.kind === "loaded" && originals.plans[0]).toEqual(f.state)
    expect(readJournalOriginalPlan(f.entries[0]!)).toMatchObject({ kind: "matched", source: "ARCHIVED" })
    expect(loadPlanMethodHistorySnapshot().coverage?.retainedPlans).toBe(0)
    expect((await applyExecutionReplan(f.proposal,f.today,true)).kind).toBe("blocked")
    expect(readArchivedOriginalPlans()).toEqual(originals)
  })
  it.each(["journal", "plan", "pain", "midnight", "confirmation"])("rejects changed %s before writing", async reason => {
    const f = prepared()
    if (reason === "journal") localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{ ...f.entries[0], activityOutcome: "RESTED" }]))
    if (reason === "pain") localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{ ...f.entries[0], painCheckStatus: "SIGNAL_REPORTED" }]))
    if (reason === "plan") localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify({ ...f.state, progress: [] }))
    if (reason === "midnight") vi.setSystemTime(new Date("2026-09-30T03:00:00.000Z"))
    const before = localStorage.getItem("trainoracle.plan-beta.v1")
    expect((await applyExecutionReplan(f.proposal, f.today, reason !== "confirmation")).kind).toBe("blocked")
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBe(before)
    expect(localStorage.getItem("trainoracle.plan-beta.history.v1")).toBeNull()
  })
  it("does not discard originals when the active-plan write fails", async () => {
    const f = prepared(), write = Storage.prototype.setItem
    const spy = vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this: Storage,key,value) {
      if (key === "trainoracle.plan-beta.v1") throw new DOMException("synthetic capacity", "QuotaExceededError")
      write.call(this,key,value)
    })
    expect((await applyExecutionReplan(f.proposal,f.today,true)).kind).toBe("blocked")
    expect(loadVersionedPlanBetaState()).toEqual(f.state)
    expect(readArchivedOriginalPlans().kind).toBe("loaded")
    spy.mockRestore()
    expect((await applyExecutionReplan(f.proposal,f.today,true)).kind).toBe("applied")
    const archive = readArchivedOriginalPlans()
    expect(archive.kind === "loaded" && archive.plans.length).toBe(1)
  })
})
