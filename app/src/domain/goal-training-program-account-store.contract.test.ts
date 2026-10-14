import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture";
import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { syntheticGoalProgram } from "./account/account-goal-program.test-fixtures"
import { applyGoalTrainingProgramCycle, goalTrainingProgramStorageStatus, readGoalTrainingProgram, saveGoalTrainingProgram } from "./goal-training-program-store"
import { setActiveLocalAccount, localJournalScopeGeneration } from "./account/local-journal-ownership"
import type { AccountGoalProgramSnapshot } from "./account/account-goal-program-service"
import type { StoredGoalTrainingProgram, GoalTrainingProgramHistory } from "./goal-training-program-document"
import type { PlanBetaStateV3 } from "./plan-beta-schema"
import { generateGoalTrainingProgram } from "./goal-training-program"
import { evaluatePlanSafety } from "./plan-beta-flow"

vi.setConfig({ testTimeout: 30_000 })
const owner = "a1111111-1111-4111-8111-111111111111"
const f = vi.hoisted(() => ({ snapshot: null as AccountGoalProgramSnapshot | null,
  active: null as PlanBetaStateV3 | null, failSave: false, monthlySave: vi.fn(), planSave: vi.fn(), planArchive: vi.fn(),
  beforeLock: null as (() => void) | null, beforeArchive: null as (() => void) | null,
  beforeLoadHistory: null as (() => Promise<void>) | null }))
vi.mock("./account/account-plan-service", async original => ({
  ...await original<typeof import("./account/account-plan-service")>(), accountPlansEnabled: () => true,
  accountPlanService: () => ({ snapshot: () => ({ historyLoaded: true, confirmedDocument: { data: { plans: [] } } }) }),
}))
vi.mock("./account/account-goal-program-service", async original => ({
  ...await original<typeof import("./account/account-goal-program-service")>(),
  createAccountGoalProgramService: () => ({
    snapshot: () => structuredClone(f.snapshot!),
    hydrate: async () => true,
    loadHistory: async () => { await f.beforeLoadHistory?.(); if (f.snapshot!.status === "PENDING") return false; f.snapshot!.status = "READY"; return true },
    save: async (document: StoredGoalTrainingProgram, history: GoalTrainingProgramHistory, _token: string, fresh: () => boolean,
      options?: { goalStartDateReviewRequired?: true; replaceExpiredPending?: true }) => {
      f.monthlySave(document, history, options)
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
  captureAccountPlanWrite: () => ({
    save: async (state: PlanBetaStateV3) => { f.planSave(state); f.active = structuredClone(state); return null },
    archive: async (freshReview?: () => boolean) => {
      f.beforeArchive?.()
      if (freshReview?.() === false) return "ACCOUNT_PLAN_REVIEW_REQUIRED"
      f.planArchive(); f.active = null; return null
    },
  }),
}))
vi.mock("./plan-beta-store", async original => ({
  ...await original<typeof import("./plan-beta-store")>(), readPlanBetaStateFromStorage: () => f.active
    ? { kind: "loaded", state: structuredClone(f.active) } : { kind: "missing" },
}))
vi.mock("./plan-mutation-lock", () => ({ PLAN_BETA_MUTATION_LOCK_NAME: "goal-account-test",
  getPlanMutationLockManager: () => ({ request: async (_name: string, _options: unknown, work: (held: object) => unknown) => {
    f.beforeLock?.()
    return work({})
  } }) }))

beforeEach(async () => {
  localStorage.clear();
    await initializeCanonicalJournalFixture(); setActiveLocalAccount(owner); vi.stubGlobal("crypto", webcrypto)
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-11T00:00:00.000Z"))
  const document = syntheticGoalProgram()
  document.revision = 2
  document.application = { appliedAt: "2026-10-10T01:00:00.000Z", currentCycleIndex: 1 }
  document.cycles[0] = { ...document.cycles[0], status: "ENDED", latestPlan: document.program.frames[0]!.plan }
  f.snapshot = { ownerId: owner, sessionGeneration: localJournalScopeGeneration(), status: "READY", revision: 3, sequence: 3,
    historyLoaded: true, document, history: { version: 1, entries: [] }, pendingDocument: null, remoteRevision: null }
  f.active = null; f.failSave = false; f.monthlySave.mockClear(); f.planSave.mockClear(); f.planArchive.mockClear(); f.beforeLock = null; f.beforeArchive = null
  f.beforeLoadHistory = null
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

it.each(["already elapsed", "elapsed while waiting for the mutation lock"])("preserves the selected account plan when replacement start date is %s", async timing => {
  const document = f.snapshot!.document!
  document.cycles[0].status = "CURRENT"
  f.active = structuredClone(document.program.frames[0]!.plan)
  const replacement = syntheticGoalProgram(1)
  const before = structuredClone({ active: f.active, document, history: f.snapshot!.history })
  const expire = () => vi.setSystemTime(new Date(2026, 9, 12, 0, 1))
  if (timing === "already elapsed") expire()
  else f.beforeLock = expire
  expect(await saveGoalTrainingProgram(replacement.program, { expectedRevision: document.revision,
    currentCheck: "NO_KNOWN_RISK", replaceExisting: true })).toEqual({ kind: "rejected", code: "START_DATE_ELAPSED" })
  expect(f.planArchive).not.toHaveBeenCalled()
  expect(f.monthlySave).not.toHaveBeenCalled()
  expect({ active: f.active, document: f.snapshot!.document, history: f.snapshot!.history }).toEqual(before)
})

it("keeps the account replacement date guard valid through the archive writer await", async () => {
  const document = f.snapshot!.document!
  document.cycles[0].status = "CURRENT"
  f.active = structuredClone(document.program.frames[0]!.plan)
  const replacement = syntheticGoalProgram(1), before = structuredClone({ active: f.active, document, history: f.snapshot!.history })
  f.beforeArchive = () => vi.setSystemTime(new Date(2026, 9, 12, 0, 1))
  expect(await saveGoalTrainingProgram(replacement.program, { expectedRevision: document.revision,
    currentCheck: "NO_KNOWN_RISK", replaceExisting: true })).toEqual({ kind: "rejected", code: "ACCOUNT_PLAN_REVIEW_REQUIRED" })
  expect(f.planArchive).not.toHaveBeenCalled()
  expect(f.monthlySave).not.toHaveBeenCalled()
  expect({ active: f.active, document: f.snapshot!.document, history: f.snapshot!.history }).toEqual(before)
})

it("still allows a reviewed current-date replacement and keeps the exact existing program retry idempotent", async () => {
  const document = f.snapshot!.document!
  document.cycles[0].status = "CURRENT"
  f.active = structuredClone(document.program.frames[0]!.plan)
  const replacement = syntheticGoalProgram(1)
  expect(await saveGoalTrainingProgram(replacement.program, { expectedRevision: document.revision,
    currentCheck: "NO_KNOWN_RISK", replaceExisting: true })).toMatchObject({ kind: "saved", document: { application: null } })
  expect(f.planArchive).toHaveBeenCalledOnce()
  expect(f.monthlySave).toHaveBeenCalledOnce()
  expect(f.monthlySave.mock.calls[0]?.[2]).toEqual({ goalStartDateReviewRequired: true, replaceExpiredPending: undefined })
  vi.setSystemTime(new Date(2026, 9, 12, 0, 1))
  expect(await saveGoalTrainingProgram(replacement.program, { expectedRevision: f.snapshot!.document!.revision,
    currentCheck: "NO_KNOWN_RISK", replaceExisting: true })).toMatchObject({ kind: "saved" })
  expect(f.planArchive).toHaveBeenCalledOnce()
  expect(f.monthlySave).toHaveBeenCalledOnce()
})

it.each([false, true])("requires explicit fresh-date approval to replace an expired pending program with confirmed base=%s", async hasConfirmed => {
  vi.setSystemTime(new Date(2026, 9, 12, 0, 1))
  const original = syntheticGoalProgram(), pending = syntheticGoalProgram(1), safety = evaluatePlanSafety("NO_KNOWN_RISK")
  if (safety.kind !== "passed") throw Error("Synthetic safety unavailable")
  const generated = generateGoalTrainingProgram({ goalMinutes: 45, dateChoice: { kind: "START", startDate: "2026-10-12" },
    today: "2026-10-12", generatedAt: new Date().toISOString(), ...original.program.inputs, safetyGate: safety.gate })
  if (generated.kind !== "ready") throw Error("Synthetic next date unavailable")
  f.snapshot = { ...f.snapshot!, status: "PENDING", document: hasConfirmed ? f.snapshot!.document : null,
    revision: hasConfirmed ? 3 : 0, sequence: 4, pendingDocument: pending, goalStartDateReviewRequired: true }
  const options = { expectedRevision: hasConfirmed ? f.snapshot.document!.revision : null,
    currentCheck: "NO_KNOWN_RISK" as const, replaceExisting: hasConfirmed }
  expect(await saveGoalTrainingProgram(generated.program, options)).toEqual({ kind: "rejected", code: "ACCOUNT_PROGRAM_PENDING" })
  expect(f.monthlySave).not.toHaveBeenCalled()
  expect(await saveGoalTrainingProgram(generated.program, { ...options, replaceExpiredPending: true,
    expectedPendingReview: structuredClone(f.snapshot) })).toMatchObject({ kind: "saved", document: { application: null } })
  expect(f.monthlySave.mock.calls[0]?.[2]).toEqual({ goalStartDateReviewRequired: true, replaceExpiredPending: true })
  expect(f.planSave).not.toHaveBeenCalled()
  expect(f.planArchive).not.toHaveBeenCalled()
})

it("does not report an unchanged confirmed program as a successful pending replacement", async () => {
  vi.setSystemTime(new Date(2026, 9, 12, 0, 1))
  const confirmed = structuredClone(f.snapshot!.document!), pending = syntheticGoalProgram(1)
  f.snapshot = { ...f.snapshot!, status: "PENDING", pendingDocument: pending, goalStartDateReviewRequired: true }
  const before = structuredClone(f.snapshot)
  expect(await saveGoalTrainingProgram(confirmed.program, { expectedRevision: confirmed.revision,
    currentCheck: "NO_KNOWN_RISK", replaceExisting: true, replaceExpiredPending: true, expectedPendingReview: structuredClone(f.snapshot) }))
    .toEqual({ kind: "rejected", code: "ACCOUNT_PROGRAM_PENDING" })
  expect(f.snapshot).toEqual(before)
  expect(f.monthlySave).not.toHaveBeenCalled()
  expect(f.planSave).not.toHaveBeenCalled()
  expect(f.planArchive).not.toHaveBeenCalled()
})

it("rejects a different expired pending original adopted during history loading", async () => {
  vi.setSystemTime(new Date(2026, 9, 12, 0, 1))
  const original = syntheticGoalProgram(), safety = evaluatePlanSafety("NO_KNOWN_RISK")
  if (safety.kind !== "passed") throw Error("Synthetic safety unavailable")
  const generated = generateGoalTrainingProgram({ goalMinutes: 45, dateChoice: { kind: "START", startDate: "2026-10-12" },
    today: "2026-10-12", generatedAt: new Date().toISOString(), ...original.program.inputs, safetyGate: safety.gate })
  if (generated.kind !== "ready") throw Error("Synthetic next date unavailable")
  f.snapshot = { ...f.snapshot!, status: "PENDING", pendingDocument: syntheticGoalProgram(1), goalStartDateReviewRequired: true }
  const review = structuredClone(f.snapshot)
  f.beforeLoadHistory = async () => {
    await Promise.resolve()
    f.snapshot = { ...f.snapshot!, sequence: f.snapshot!.sequence + 1, pendingDocument: syntheticGoalProgram(2) }
  }
  expect(await saveGoalTrainingProgram(generated.program, { expectedRevision: review.document!.revision,
    currentCheck: "NO_KNOWN_RISK", replaceExisting: true, replaceExpiredPending: true, expectedPendingReview: review }))
    .toEqual({ kind: "rejected", code: "ACCOUNT_PROGRAM_STATE_CHANGED" })
  expect(f.snapshot!.sequence).toBe(review.sequence + 1)
  expect(f.snapshot!.pendingDocument).not.toEqual(review.pendingDocument)
  expect(f.monthlySave).not.toHaveBeenCalled()
  expect(f.planSave).not.toHaveBeenCalled()
  expect(f.planArchive).not.toHaveBeenCalled()
})

it.each(["missing", "owner", "session", "revision", "sequence", "pending", "marker", "date"])("rejects a %s pending replacement review", async mismatch => {
  vi.setSystemTime(new Date(2026, 9, 12, 0, 1))
  const original = syntheticGoalProgram(), safety = evaluatePlanSafety("NO_KNOWN_RISK")
  if (safety.kind !== "passed") throw Error("Synthetic safety unavailable")
  const generated = generateGoalTrainingProgram({ goalMinutes: 45, dateChoice: { kind: "START", startDate: "2026-10-12" },
    today: "2026-10-12", generatedAt: new Date().toISOString(), ...original.program.inputs, safetyGate: safety.gate })
  if (generated.kind !== "ready") throw Error("Synthetic next date unavailable")
  f.snapshot = { ...f.snapshot!, status: "PENDING", pendingDocument: syntheticGoalProgram(1), goalStartDateReviewRequired: true }
  const before = structuredClone(f.snapshot), review = structuredClone(f.snapshot)
  if (mismatch === "owner") review.ownerId = "b1111111-1111-4111-8111-111111111111"
  if (mismatch === "session") review.sessionGeneration += 1
  if (mismatch === "revision") review.revision += 1
  if (mismatch === "sequence") review.sequence += 1
  if (mismatch === "pending") review.pendingDocument = syntheticGoalProgram(2)
  if (mismatch === "marker") delete review.goalStartDateReviewRequired
  if (mismatch === "date") review.pendingDocument = { ...review.pendingDocument!, program: { ...review.pendingDocument!.program,
    window: { ...review.pendingDocument!.program.window, startDate: "2026-10-12" } } }
  expect(await saveGoalTrainingProgram(generated.program, { expectedRevision: before.document!.revision,
    currentCheck: "NO_KNOWN_RISK", replaceExisting: true, replaceExpiredPending: true,
    expectedPendingReview: mismatch === "missing" ? undefined : review }))
    .toEqual({ kind: "rejected", code: "ACCOUNT_PROGRAM_STATE_CHANGED" })
  expect(f.snapshot).toEqual(before)
  expect(f.monthlySave).not.toHaveBeenCalled()
  expect(f.planSave).not.toHaveBeenCalled()
  expect(f.planArchive).not.toHaveBeenCalled()
})

it("accepts the reviewed pending original after history hydration fills only history metadata", async () => {
  vi.setSystemTime(new Date(2026, 9, 12, 0, 1))
  const original = syntheticGoalProgram(), safety = evaluatePlanSafety("NO_KNOWN_RISK")
  if (safety.kind !== "passed") throw Error("Synthetic safety unavailable")
  const generated = generateGoalTrainingProgram({ goalMinutes: 45, dateChoice: { kind: "START", startDate: "2026-10-12" },
    today: "2026-10-12", generatedAt: new Date().toISOString(), ...original.program.inputs, safetyGate: safety.gate })
  if (generated.kind !== "ready") throw Error("Synthetic next date unavailable")
  f.snapshot = { ...f.snapshot!, status: "PENDING", pendingDocument: syntheticGoalProgram(1), goalStartDateReviewRequired: true,
    historyLoaded: false }
  const review = structuredClone(f.snapshot)
  f.beforeLoadHistory = async () => {
    await Promise.resolve()
    f.snapshot!.historyLoaded = true
    f.snapshot!.history.entries.push({ archivedAt: "2026-10-10T01:00:00.000Z", document: syntheticGoalProgram(2) })
  }
  expect(await saveGoalTrainingProgram(generated.program, { expectedRevision: review.document!.revision,
    currentCheck: "NO_KNOWN_RISK", replaceExisting: true, replaceExpiredPending: true, expectedPendingReview: review }))
    .toMatchObject({ kind: "saved", document: { application: null } })
  expect(f.monthlySave).toHaveBeenCalledOnce()
  expect(f.monthlySave.mock.calls[0]?.[1].entries).toHaveLength(2)
  expect(f.planSave).not.toHaveBeenCalled()
  expect(f.planArchive).not.toHaveBeenCalled()
})
