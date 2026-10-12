import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { todayISO } from "../../domain/journal-store"
import { readPlanBetaStateFromStorage } from "../../domain/plan-beta-store"
import * as mutationLock from "../../domain/plan-mutation-lock"
import { saveSelectedPlanCandidate } from "./plan-selection"

// Construct local civil midnight, so the same contract runs in both UTC and KST CI.
const midnight = () => new Date(2026, 8, 7, 0, 0, 0, 0)
const beforeMidnight = () => new Date(midnight().getTime() - 1_000)
const afterMidnight = () => new Date(midnight().getTime() + 1_000)

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(beforeMidnight())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  setActiveLocalAccount(null)
})

function candidate() {
  const result = generatePlanFromDraft({
    eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: 3, requestedFrameLength: 9,
    trainingFocus: "VO2_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "EVENING", selectedDetailedTemplateRef: null,
  }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new Error("Expected a real plan candidate")
  return result
}

function save(plan: ReturnType<typeof candidate>, startDate: string) {
  return saveSelectedPlanCandidate(
    { candidateId: plan.generated.candidates[0]!.candidateId, startDate },
    plan.generated, plan.gate, plan.intake, plan.athleteEvidence,
  )
}

describe("new personal plan selection at the local civil-day boundary", () => {
  it.each([
    ["before", beforeMidnight, "2026-09-06"],
    ["after", afterMidnight, "2026-09-07"],
  ] as const)("saves a plan selected on the local date %s midnight", async (_label, instant, expectedDate) => {
    vi.setSystemTime(instant())
    expect(todayISO()).toBe(expectedDate)
    const plan = candidate()
    const result = await save(plan, expectedDate)
    expect(result.kind).toBe("saved")
    if (result.kind !== "saved") return
    expect(result.state.intake.startDate).toBe(expectedDate)
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: "loaded", state: result.state })
  })

  it("rejects yesterday's unsaved selection if the mutation lock opens after local midnight", async () => {
    const plan = candidate()
    const startDate = todayISO()
    let release: (() => void) | undefined
    vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({
      request: <T,>(_name: string, _options: unknown, callback: (lock: object | null) => T | Promise<T>) =>
        new Promise<T>(resolve => { release = () => { resolve(callback({})) } }),
    })
    const pending = save(plan, startDate)
    expect(release).toBeTypeOf("function")
    vi.setSystemTime(afterMidnight())
    expect(todayISO()).toBe("2026-09-07")
    const before = Object.entries(localStorage)
    release!()
    await expect(pending).resolves.toEqual({ kind: "rejected", code: "PLAN_START_DATE_PAST" })
    expect(Object.entries(localStorage)).toEqual(before)
    expect(readPlanBetaStateFromStorage().kind).toBe("missing")
  })

  it("acknowledges an identical next-day retry without rewriting the already saved plan", async () => {
    const plan = candidate()
    const startDate = todayISO()
    const first = await save(plan, startDate)
    expect(first.kind).toBe("saved")
    const storedBefore = Object.entries(localStorage)
    vi.setSystemTime(afterMidnight())
    const replay = await save(plan, startDate)
    expect(replay).toEqual(first)
    expect(Object.entries(localStorage)).toEqual(storedBefore)
  })
})
