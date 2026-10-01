import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { planBetaStateV3Schema } from "../../domain/plan-beta-schema"
import { savePlanBetaState, activePlanBetaStorageKey, readPlanBetaStateFromStorage } from "../../domain/plan-beta-store"
import { createInitialPeriodizationContext } from "../../domain/periodization-lineage"
import * as mutationLock from "../../domain/plan-mutation-lock"
import { saveSelectedPlanCandidate } from "./plan-selection"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

const HISTORY = "trainoracle.plan-beta.history.v1"
const CONTEXT = "trainoracle.plan-adaptation-context.v1"
const INTAKE = "trainoracle.plan-beta.previous-intake.v1"
const PENDING = "trainoracle.plan-beta.adaptation.v1"
function predecessor() {
  const state = stateFixture()
  return planBetaStateV3Schema.parse({ ...state,
    periodization: createInitialPeriodizationContext(state.activePlan.candidateId, state.generatedAt),
    progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] })
}
function setup() {
  const base = predecessor()
  savePlanBetaState(base)
  const plan = generatePlanFromDraft(base.intake, "NO_KNOWN_RISK", undefined, undefined, undefined, base)
  if (plan.kind !== "generated") throw Error(`Missing fixture: ${plan.kind}`)
  const select = () => saveSelectedPlanCandidate({ candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-10-01" },
    plan.generated, plan.gate, plan.intake, plan.athleteEvidence, () => true, base, plan.cycleDraft)
  return { base, plan, select }
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-01T03:00:00.000Z"))
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setActiveLocalAccount(null) })

describe("next selection retains exact predecessor until accepted", () => {
  it("uses the visible predecessor progress for continuity without first archiving it", () => {
    const { base, plan } = setup()
    expect(plan.generated.candidates[0].continuityContext).toMatchObject({ kind: "PREVIOUS_FRAME_CONTEXT_RETAINED",
      previousCandidateKind: base.activePlan.candidateKind,
      progressStateCounts: expect.arrayContaining([{ state: "COMPLETED", count: 1 }]) })
    expect(localStorage.getItem(HISTORY)).toBeNull()
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: "loaded", state: base })
  })
  it("replays an exact accepted selection without a second archive or lineage advance", async () => {
    const { select } = setup()
    const first = await select()
    expect(first.kind).toBe("saved")
    const saved = Object.entries(localStorage)
    expect(await select()).toEqual(first)
    expect(Object.entries(localStorage)).toEqual(saved)
    expect(JSON.parse(localStorage.getItem(HISTORY)!)).toHaveLength(1)
  })
  it("does not call a current state a confirmed replay when its predecessor original was removed", async () => {
    const { select } = setup()
    expect((await select()).kind).toBe("saved")
    localStorage.removeItem(HISTORY)
    const before = Object.entries(localStorage)
    expect(await select()).toMatchObject({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
    expect(Object.entries(localStorage)).toEqual(before)
  })
  it("refuses a changed predecessor after the draft opened even when its candidate ID is unchanged", async () => {
    const { base, select } = setup()
    savePlanBetaState({ ...base, progress: [{ sessionDay: 1, sessionSlot: "AM", state: "SKIPPED" }] })
    const before = Object.entries(localStorage)
    expect(await select()).toMatchObject({ kind: "rejected", code: "STALE_BASE" })
    expect(Object.entries(localStorage)).toEqual(before)
  })
  it("does not let an ordinary new-selection call replace the current plan without continuation intent", async () => {
    const { plan } = setup()
    const before = Object.entries(localStorage)
    expect(await saveSelectedPlanCandidate({ candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-10-01" },
      plan.generated, plan.gate, plan.intake, plan.athleteEvidence)).toMatchObject({ kind: "rejected", code: "STALE_BASE" })
    expect(Object.entries(localStorage)).toEqual(before)
  })
  it.each([{ progress: [] }, { progress: [{ sessionDay: 1, sessionSlot: "AM", state: "PAIN_CHECKIN" }] }] as const)("rejects incomplete or pain-held predecessors without writes: $progress", async ({ progress }) => {
    const { base, plan } = setup()
    const current = planBetaStateV3Schema.parse({ ...base, progress })
    savePlanBetaState(current)
    const before = Object.entries(localStorage)
    const result = await saveSelectedPlanCandidate({ candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-10-01" },
      plan.generated, plan.gate, plan.intake, plan.athleteEvidence, () => true, current)
    expect(result).toMatchObject({ kind: "rejected", code: "CURRENT_CHECK_REQUIRES_REVIEW" })
    expect(Object.entries(localStorage)).toEqual(before)
  })
  it("rechecks account scope after waiting for the plan lock", async () => {
    const { select } = setup()
    let release: (() => void) | undefined
    vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({ request: <T,>(_n: string, _o: unknown, callback: (lock: object | null) => T | Promise<T>) =>
      new Promise<T>(resolve => { release = () => resolve(callback({})) }) })
    const result = select()
    setActiveLocalAccount("22222222-2222-4222-8222-222222222222")
    release!()
    expect(await result).toMatchObject({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
    expect(localStorage.getItem(HISTORY)).toBeNull()
  })
  it.each([HISTORY, INTAKE, CONTEXT, "trainoracle.plan-beta.v1", PENDING])("rolls back the full local selection if writing %s fails", async key => {
    const { select } = setup()
    localStorage.setItem(CONTEXT, "old-context")
    sessionStorage.setItem(INTAKE, "old-intake")
    const before = Object.entries(localStorage), intakeBefore = Object.entries(sessionStorage)
    const originalSet = Storage.prototype.setItem, originalRemove = Storage.prototype.removeItem
    let failed = false
    const fail = (candidate: string) => { if (candidate === key && !failed) { failed = true; throw Error("Injected one-time storage failure") } }
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, name, value) { fail(name); originalSet.call(this, name, value) })
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, name) { fail(name); originalRemove.call(this, name) })
    expect(await select()).toMatchObject({ kind: "rejected", code: "PLAN_STORAGE_WRITE_FAILED" })
    expect(failed).toBe(true)
    expect(Object.fromEntries(Object.entries(localStorage))).toEqual(Object.fromEntries(before))
    expect(Object.fromEntries(Object.entries(sessionStorage))).toEqual(Object.fromEntries(intakeBefore))
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before.find(([name]) => name === activePlanBetaStorageKey())![1])
  })

  it("does not erase unreadable pending storage while accepting an ordinary successor", async () => {
    const { select } = setup()
    localStorage.setItem(PENDING, "unreadable-pending")
    const before = Object.fromEntries(Object.entries(localStorage))
    expect(await select()).toEqual({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
    expect(Object.fromEntries(Object.entries(localStorage))).toEqual(before)
  })
})
