import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import * as mutationLock from "../../domain/plan-mutation-lock"
import { saveSelectedPlanCandidate } from "./plan-selection"
import { JOURNAL_STORAGE_KEY } from "../../domain/journal-local-storage"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => vi.restoreAllMocks())

function generated() {
  const result = generatePlanFromDraft({
    eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "HIGH_SCHOOL",
    experienceBand: "EXPERIENCED", availableDayCount: 3, requestedFrameLength: 9,
    trainingFocus: "VO2_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING",
    selectedDetailedTemplateRef: null,
  }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new Error("Expected generated fixture")
  return result
}

describe("candidate save revision inside the mutation lock", () => {
  for (const changedField of ["candidate", "evidence", "intake", "gate"] as const) {
    it(`rejects ${changedField} changes during lock wait even without a revision update`, async () => {
      const plan = generated()
      const selection = { candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-09-10" }
      const evidence = { ...plan.athleteEvidence }
      const intake = { ...plan.intake }
      const gate = structuredClone(plan.gate)
      let release: (() => void) | undefined
      vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({
        request: <T,>(_name: string, _options: unknown, callback: (lock: object | null) => T | Promise<T>) =>
          new Promise<T>(resolve => { release = () => { resolve(callback({})) } }),
      })
      const before = Object.entries(localStorage)
      const save = saveSelectedPlanCandidate(selection, plan.generated, gate, intake, evidence)
      if (changedField === "candidate") selection.candidateId = plan.generated.candidates[1].candidateId
      if (changedField === "evidence") evidence.storedRecordCount += 1
      if (changedField === "intake") intake.trainingTimePreference = "MORNING"
      if (changedField === "gate") Object.assign(gate, { planGenerationAllowed: false })
      release!()
      await expect(save).resolves.toEqual({ kind: "rejected", code: "STALE_CANDIDATE_SELECTION" })
      expect(Object.entries(localStorage)).toEqual(before)
    })
  }
  it("rechecks journal safety after the lock wait without writing any plan", async () => {
    const plan = generated()
    let release: (() => void) | undefined
    vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({
      request: <T,>(_name: string, _options: unknown, callback: (lock: object | null) => T | Promise<T>) =>
        new Promise<T>(resolve => { release = () => { resolve(callback({})) } }),
    })
    const save = saveSelectedPlanCandidate(
      { candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-09-10" },
      plan.generated, plan.gate, plan.intake, plan.athleteEvidence,
    )
    localStorage.setItem(JOURNAL_STORAGE_KEY, "{unreadable")
    const before = Object.entries(localStorage)
    release!()
    await expect(save).resolves.toEqual({ kind: "rejected", code: "RECENT_JOURNAL_REQUIRES_REVIEW" })
    expect(Object.entries(localStorage)).toEqual(before)
  })
  it("saves the current revision as a positive control", async () => {
    const plan = generated()
    const result = await saveSelectedPlanCandidate(
      { candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-09-10" },
      plan.generated, plan.gate, plan.intake, plan.athleteEvidence, () => true,
    )
    expect(result.kind).toBe("saved")
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).not.toBeNull()
  })
  it("rejects a stale draft before requesting a lock", async () => {
    const plan = generated()
    const locks = vi.spyOn(mutationLock, "getPlanMutationLockManager")
    await expect(saveSelectedPlanCandidate(
      { candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-09-10" },
      plan.generated, plan.gate, plan.intake, plan.athleteEvidence, () => false,
    )).resolves.toEqual({ kind: "rejected", code: "STALE_CANDIDATE_SELECTION" })
    expect(locks).not.toHaveBeenCalled()
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })
  it("does not save an old draft that changes while waiting for the lock", async () => {
    const plan = generated()
    let current = true
    let release: (() => void) | undefined
    const lock: mutationLock.PlanMutationLockManager = {
      request: <T,>(_name: string, _options: unknown, callback: (lock: object | null) => T | Promise<T>) =>
        new Promise<T>(resolve => { release = () => { resolve(callback({})) } }),
    }
    vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue(lock)
    const beforeStorage = Object.entries(localStorage)
    const save = saveSelectedPlanCandidate(
      { candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-09-10" },
      plan.generated, plan.gate, plan.intake, plan.athleteEvidence, () => current,
    )
    expect(release).toBeTypeOf("function")
    current = false
    release!()
    await expect(save).resolves.toEqual({ kind: "rejected", code: "STALE_CANDIDATE_SELECTION" })
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
    expect(Object.entries(localStorage)).toEqual(beforeStorage)
  })
  it("rejects changed candidate content even if a caller forgets to advance its revision", async () => {
    const plan = generated()
    const mutable = structuredClone(plan.generated)
    let release: (() => void) | undefined
    const lock: mutationLock.PlanMutationLockManager = {
      request: <T,>(_name: string, _options: unknown, callback: (lock: object | null) => T | Promise<T>) =>
        new Promise<T>(resolve => { release = () => { resolve(callback({})) } }),
    }
    vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue(lock)
    const save = saveSelectedPlanCandidate(
      { candidateId: mutable.candidates[0].candidateId, startDate: "2026-09-10" },
      mutable, plan.gate, plan.intake, plan.athleteEvidence, () => true,
    )
    expect(release).toBeTypeOf("function")
    const session = mutable.candidates[0].sessions.find(item => item.prescription.kind === "RPE_TIME_RANGE")!
    if (session.prescription.kind !== "RPE_TIME_RANGE") throw new Error("Missing duration fixture")
    Object.assign(session.prescription.durationMinutes, { maximum: 999 })
    release!()
    await expect(save).resolves.toEqual({ kind: "rejected", code: "STALE_CANDIDATE_SELECTION" })
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })
})
