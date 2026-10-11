import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { syntheticGoalProgram } from "./account/account-goal-program.test-fixtures"
import { applyGoalTrainingProgramCycle, goalTrainingProgramStorageStatus, readGoalTrainingProgram } from "./goal-training-program-store"
import { setActiveLocalAccount, localJournalScopeGeneration } from "./account/local-journal-ownership"
import type { AccountGoalProgramSnapshot } from "./account/account-goal-program-service"
import type { StoredGoalTrainingProgram, GoalTrainingProgramHistory } from "./goal-training-program-document"
import type { PlanBetaStateV3 } from "./plan-beta-schema"

vi.setConfig({ testTimeout: 30_000 })
const owner = "a1111111-1111-4111-8111-111111111111"
const f = vi.hoisted(() => ({ snapshot: null as AccountGoalProgramSnapshot | null,
  active: null as PlanBetaStateV3 | null, failSave: false, monthlySave: vi.fn(), planSave: vi.fn() }))
vi.mock("./account/account-plan-service", async original => ({
  ...await original<typeof import("./account/account-plan-service")>(), accountPlansEnabled: () => true,
  accountPlanService: () => ({ snapshot: () => ({ historyLoaded: true, confirmedDocument: { data: { plans: [] } } }) }),
}))
vi.mock("./account/account-goal-program-service", async original => ({
  ...await original<typeof import("./account/account-goal-program-service")>(),
  createAccountGoalProgramService: () => ({
    snapshot: () => structuredClone(f.snapshot!),
    hydrate: async () => true,
    loadHistory: async () => { f.snapshot!.status = "READY"; return true },
    save: async (document: StoredGoalTrainingProgram, history: GoalTrainingProgramHistory, _token: string, fresh: () => boolean) => {
      f.monthlySave(document, history)
      if (!fresh()) return false
      if (f.failSave) { f.failSave = false; f.snapshot!.status = "FAILED"; return false }
      f.snapshot = { ...f.snapshot!, status: "READY", document: structuredClone(document), history,
        revision: f.snapshot!.revision + 1, sequence: f.snapshot!.sequence + 1 }
      return true
    },
    acceptRemote: async () => false, pendingBackup: async () => null, close: () => undefined,
  }),
}))
vi.mock("./account/account-plan-domain", async original => ({
  ...await original<typeof import("./account/account-plan-domain")>(), ensureAccountPlanHistory: async () => true,
  captureAccountPlanWrite: () => ({ save: async (state: PlanBetaStateV3) => { f.planSave(state); f.active = structuredClone(state); return null } }),
}))
vi.mock("./plan-beta-store", async original => ({
  ...await original<typeof import("./plan-beta-store")>(), readPlanBetaStateFromStorage: () => f.active
    ? { kind: "loaded", state: structuredClone(f.active) } : { kind: "missing" },
}))
vi.mock("./plan-mutation-lock", () => ({ PLAN_BETA_MUTATION_LOCK_NAME: "goal-account-test",
  getPlanMutationLockManager: () => ({ request: async (_name: string, _options: unknown, work: (held: object) => unknown) => work({}) }) }))

beforeEach(() => {
  localStorage.clear(); setActiveLocalAccount(owner); vi.stubGlobal("crypto", webcrypto)
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-11T00:00:00.000Z"))
  const document = syntheticGoalProgram()
  document.revision = 2
  document.application = { appliedAt: "2026-10-10T01:00:00.000Z", currentCycleIndex: 1 }
  document.cycles[0] = { ...document.cycles[0], status: "ENDED", latestPlan: document.program.frames[0]!.plan }
  f.snapshot = { ownerId: owner, sessionGeneration: localJournalScopeGeneration(), status: "READY", revision: 3, sequence: 3,
    historyLoaded: true, document, history: { version: 1, entries: [] }, pendingDocument: null, remoteRevision: null }
  f.active = null; f.failSave = false; f.monthlySave.mockClear(); f.planSave.mockClear()
})
afterEach(() => { setActiveLocalAccount(null); vi.useRealTimers(); vi.unstubAllGlobals() })

it("recovers the exact selected successor after PLAN ack but monthly atomic staging fails, without selecting it twice", async () => {
  const document = structuredClone(f.snapshot!.document!), input = { programId: document.program.programId,
    expectedRevision: document.revision, cycle: 2 as const, confirmsNoKnownRisk: true }
  f.failSave = true
  expect(await applyGoalTrainingProgramCycle(input)).toEqual({ kind: "rejected", code: "ACCOUNT_PROGRAM_FAILED" })
  expect(f.planSave).toHaveBeenCalledOnce()
  expect(f.active).toEqual(document.program.frames[1]!.plan)
  expect(f.snapshot!.document!.application!.currentCycleIndex).toBe(1)
  expect(await applyGoalTrainingProgramCycle(input)).toMatchObject({ kind: "applied", document: { revision: 3,
    application: { currentCycleIndex: 2 } }, state: document.program.frames[1]!.plan })
  expect(f.planSave).toHaveBeenCalledOnce()
  expect(readGoalTrainingProgram()).toMatchObject({ kind: "loaded", currentCycleStatus: "CURRENT" })
  expect(goalTrainingProgramStorageStatus()).toBe("READY")
})

it("does not broaden recovery to an unrelated active plan or a predecessor that was not ended", async () => {
  const document = f.snapshot!.document!
  f.active = document.program.frames[2]!.plan
  const input = { programId: document.program.programId, expectedRevision: document.revision, cycle: 2 as const, confirmsNoKnownRisk: true }
  expect(await applyGoalTrainingProgramCycle(input)).toEqual({ kind: "rejected", code: "EXISTING_ACTIVE_PLAN_REQUIRES_REVIEW" })
  f.active = document.program.frames[1]!.plan; document.cycles[0].status = "CURRENT"
  expect(await applyGoalTrainingProgramCycle(input)).toEqual({ kind: "rejected", code: "EXISTING_ACTIVE_PLAN_REQUIRES_REVIEW" })
  expect(f.planSave).not.toHaveBeenCalled(); expect(f.monthlySave).not.toHaveBeenCalled()
})
