import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { saveSelectedPlanCandidate } from "../screens/plan-beta/plan-selection"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage, savePlanBetaState, updateStoredProgress } from "./plan-beta-store"
import { PLAN_ADAPTATION_CONTEXT_STORAGE_KEY } from "./plan-adaptation-ui-context"
import { activeAthleteRecordsStorageKey } from "./athlete-records"
import { RUNTIME_CASES, draftFor, saveCurrentRecord, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import * as mutationLock from "./plan-mutation-lock"

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({
    request: async (_name, _options, callback) => callback({}),
  })
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

function setup(index = 0) {
  const fixture = RUNTIME_CASES[index]!
  const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
  const plan = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
  if (plan.kind !== "generated") throw new Error("Expected generated fixture")
  const selection = { candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-08-17" }
  const save = () => saveSelectedPlanCandidate(selection, plan.generated, plan.gate, plan.intake, plan.athleteEvidence)
  return { plan, selection, save }
}

it.each([0, 1, 2, 3])("returns the exact saved %i baseline on a later retry without any plan writes", async index => {
  const { save } = setup(index)
  const first = await save()
  expect(first.kind).toBe("saved")
  const before = Object.entries(localStorage)
  vi.setSystemTime(new Date(TODAY.getTime() + 60_000))
  const write = vi.spyOn(Storage.prototype, "setItem")
  const remove = vi.spyOn(Storage.prototype, "removeItem")
  expect(await save()).toEqual(first)
  expect(write.mock.calls.filter(([key]) => key !== "__to_probe__")).toEqual([])
  expect(remove.mock.calls.filter(([key]) => key !== "__to_probe__")).toEqual([])
  expect(Object.entries(localStorage)).toEqual(before)
})

it("replays an RPE-only marathon selection without inventing an adaptation context", async () => {
  const plan = generatePlanFromDraft({ eventDistanceM: 42195, eventGroup: "GENERAL_ENDURANCE",
    competitionDivision: "OPEN", experienceBand: "NEW_TO_RUNNING", availableDayCount: 3,
    requestedFrameLength: 9, trainingFocus: "BASE_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (plan.kind !== "generated") throw new Error("Expected generated fixture")
  const save = () => saveSelectedPlanCandidate({ candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-08-17" },
    plan.generated, plan.gate, plan.intake, plan.athleteEvidence)
  const first = await save()
  expect(first.kind).toBe("saved")
  const write = vi.spyOn(Storage.prototype, "setItem")
  expect(await save()).toEqual(first)
  expect(write.mock.calls.filter(([key]) => key !== "__to_probe__")).toEqual([])
  expect(localStorage.getItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY)).toBeNull()
})

it.each(["date", "candidate", "evidence"] as const)("rejects a changed %s without replacing the saved plan", async change => {
  const { plan, selection, save } = setup()
  expect((await save()).kind).toBe("saved")
  const before = Object.entries(localStorage)
  const result = await saveSelectedPlanCandidate({ ...selection,
    ...(change === "date" ? { startDate: "2026-08-18" } : {}),
    ...(change === "candidate" ? { candidateId: plan.generated.candidates[1].candidateId } : {}),
  }, plan.generated, plan.gate, plan.intake,
  change === "evidence" ? { ...plan.athleteEvidence, storedRecordCount: plan.athleteEvidence.storedRecordCount + 1 } : plan.athleteEvidence)
  expect(result).toEqual({ kind: "rejected", code: "STALE_BASE" })
  expect(Object.entries(localStorage)).toEqual(before)
})

it("never resets progress when the original selection is retried", async () => {
  const { save } = setup()
  const first = await save()
  if (first.kind !== "saved") throw new Error("Expected saved fixture")
  const session = first.state.activePlan.sessions.find(item => item.role !== "REST")!
  const changed = updateStoredProgress(first.state, { sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED" })
  expect(savePlanBetaState(changed).ok).toBe(true)
  const before = Object.entries(localStorage)
  expect(await save()).toEqual({ kind: "rejected", code: "STALE_BASE" })
  expect(Object.entries(localStorage)).toEqual(before)
})

it.each(["missing", "invalid", "other-candidate"] as const)("does not claim success for %s adaptation context", async change => {
  const { plan, save } = setup()
  expect((await save()).kind).toBe("saved")
  if (change === "missing") localStorage.removeItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY)
  else if (change === "invalid") localStorage.setItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY, "{broken")
  else {
    const raw = JSON.parse(localStorage.getItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY)!)
    raw.activeCandidateId = plan.generated.candidates[1].candidateId
    localStorage.setItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY, JSON.stringify(raw))
  }
  const before = Object.entries(localStorage)
  expect(await save()).toEqual({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
  expect(Object.entries(localStorage)).toEqual(before)
})

it("rechecks the live anchor before acknowledging a saved retry", async () => {
  const { save } = setup()
  expect((await save()).kind).toBe("saved")
  localStorage.removeItem(activeAthleteRecordsStorageKey())
  const before = Object.entries(localStorage)
  expect(await save()).toEqual({ kind: "rejected", code: "PACE_ANCHOR_RECONFIRMATION_REQUIRED" })
  expect(Object.entries(localStorage)).toEqual(before)
})

it("does not turn invalid storage into a successful retry", async () => {
  const { save } = setup()
  expect((await save()).kind).toBe("saved")
  localStorage.setItem(activePlanBetaStorageKey(), "{broken")
  const before = Object.entries(localStorage)
  expect(await save()).toEqual({ kind: "rejected", code: "INVALID_STORED_PLAN" })
  expect(Object.entries(localStorage)).toEqual(before)
  expect(readPlanBetaStateFromStorage().kind).toBe("invalid")
})

it("does not acknowledge a cancelled draft even when its saved copy exists", async () => {
  const { plan, selection, save } = setup()
  expect((await save()).kind).toBe("saved")
  const before = Object.entries(localStorage)
  expect(await saveSelectedPlanCandidate(selection, plan.generated, plan.gate, plan.intake, plan.athleteEvidence,
    () => false)).toEqual({ kind: "rejected", code: "STALE_CANDIDATE_SELECTION" })
  expect(Object.entries(localStorage)).toEqual(before)
})

it("rechecks the account after waiting for the lock on a retry", async () => {
  const { save } = setup()
  expect((await save()).kind).toBe("saved")
  vi.mocked(mutationLock.getPlanMutationLockManager).mockReturnValue({
    request: async (_name, _options, callback) => {
      setActiveLocalAccount("another-account")
      return callback({})
    },
  })
  const originalPlan = localStorage.getItem(activePlanBetaStorageKey())
  expect(await save()).toEqual({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  setActiveLocalAccount(null)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(originalPlan)
})

it("does not let replay bypass expired runtime template authority", async () => {
  const { save } = setup()
  expect((await save()).kind).toBe("saved")
  vi.setSystemTime(new Date("2028-09-06T03:00:00Z"))
  const before = Object.entries(localStorage)
  expect(await save()).toEqual({ kind: "rejected", code: "DETAILED_TEMPLATE_AUTHORITY_UNAVAILABLE" })
  expect(Object.entries(localStorage)).toEqual(before)
})

it("rejects a self-consistent but future-dated stored selection", async () => {
  const { plan, selection, save } = setup()
  const first = await save()
  if (first.kind !== "saved") throw new Error("Expected saved fixture")
  const future = selectPlanForActivation(selection.candidateId, plan.generated, plan.gate,
    { ...plan.intake, startDate: selection.startDate }, plan.athleteEvidence,
    new Date(TODAY.getTime() + 86_400_000))
  if (future.kind !== "selected") throw new Error("Expected future fixture")
  expect(savePlanBetaState({ ...future.state, adaptationScope: first.state.adaptationScope }).ok).toBe(true)
  const before = Object.entries(localStorage)
  expect(await save()).toEqual({ kind: "rejected", code: "STALE_BASE" })
  expect(Object.entries(localStorage)).toEqual(before)
})
