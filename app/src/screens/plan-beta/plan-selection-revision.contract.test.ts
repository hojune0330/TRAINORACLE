import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import * as mutationLock from "../../domain/plan-mutation-lock"
import { saveSelectedPlanCandidate } from "./plan-selection"

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
