import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { generateGoalTrainingProgram, goalTrainingProgramDurationReview, type GoalTrainingProgram, type GoalTrainingProgramPreviewInput } from "./goal-training-program"
import {
  activeGoalTrainingProgramStorageKey, applyGoalTrainingProgramCycle, archiveGoalTrainingProgramCycle,
  exportGoalTrainingProgramJSON, goalTrainingProgramDays, GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY,
  GOAL_TRAINING_PROGRAM_STORAGE_KEY, readGoalTrainingProgram, restoreGoalTrainingProgramJSON,
  saveGoalTrainingProgram, subscribeGoalTrainingProgramChanges, type StoredGoalTrainingProgram,
} from "./goal-training-program-store"
import { accountPlansEnabled } from "./account/account-plan-service"
import { accountScopedStorageKeyFor } from "./account/local-account-scope"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { applyActivePlanEdit, prepareCurrentActivePlanEdit } from "./active-plan-edit-store"
import { listPermittedActivePlanEditTargets } from "./active-plan-edit"
import { evaluatePlanSafety } from "./plan-beta-flow"
import { activePlanBetaStorageKey, readArchivedOriginalPlans, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { ATHLETE_RECORDS_STORAGE_KEY } from "./athlete-records"

// These are full recipe replay + storage integration tests, not mocked arithmetic.
vi.setConfig({ testTimeout: 30_000 })

const lock = vi.hoisted(() => ({ before: null as (() => void) | null, available: true }))
vi.mock("./plan-mutation-lock", () => ({ PLAN_BETA_MUTATION_LOCK_NAME: "test-goal-program-lock", getPlanMutationLockManager: () => ({
  request: async (_name: string, _options: unknown, run: (held: object | null) => unknown) => {
    lock.before?.()
    return run(lock.available ? {} : null)
  },
}) }))
vi.mock("./account/account-plan-service", async importOriginal => {
  const actual = await importOriginal<typeof import("./account/account-plan-service")>()
  return { ...actual, accountPlansEnabled: vi.fn(() => false) }
})

const PLAN_HISTORY = "trainoracle.plan-beta.history.v1", JOURNAL = "trainoracle.journal.v1"
const input: GoalTrainingProgramPreviewInput = {
  goalMinutes: 45, dateChoice: { kind: "START", startDate: "2026-10-11" }, today: "2026-10-11",
  generatedAt: "2026-10-11T00:00:00.000Z", experienceBand: "DEVELOPING", availableDayCount: 4,
  trainingTimePreference: "MORNING",
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.mocked(accountPlansEnabled).mockReturnValue(false)
  lock.before = null; lock.available = true
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-11T03:00:00.000Z"))
})
afterEach(() => {
  setActiveLocalAccount(null); lock.before = null; vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear()
})

function program(overrides: Partial<GoalTrainingProgramPreviewInput> = {}): GoalTrainingProgram {
  const safety = evaluatePlanSafety("NO_KNOWN_RISK")
  if (safety.kind !== "passed") throw Error("Fixture safety")
  const result = generateGoalTrainingProgram({ ...input, ...overrides, longerDurationConfirmed: true, safetyGate: safety.gate })
  if (result.kind !== "ready") throw Error(`Fixture generation: ${JSON.stringify(result)}`)
  return result.program
}
async function saved(value = program()): Promise<StoredGoalTrainingProgram> {
  const result = await saveGoalTrainingProgram(value, { expectedRevision: null, currentCheck: "NO_KNOWN_RISK" })
  expect(result.kind).toBe("saved")
  if (result.kind !== "saved") throw Error("Fixture save")
  return result.document
}
async function applied(document?: StoredGoalTrainingProgram): Promise<StoredGoalTrainingProgram> {
  const current = document ?? await saved()
  const result = await applyGoalTrainingProgramCycle({ programId: current.program.programId,
    expectedRevision: current.revision, cycle: 1, confirmsNoKnownRisk: true })
  expect(result.kind).toBe("applied")
  if (result.kind !== "applied") throw Error(`Fixture apply: ${JSON.stringify(result)}`)
  return result.document
}
function loaded() {
  const read = readGoalTrainingProgram()
  if (read.kind !== "loaded") throw Error(`Fixture read: ${read.kind}`)
  return read
}
function applyInput(document: StoredGoalTrainingProgram, cycle: 1 | 2 | 3 = 1) {
  return { programId: document.program.programId, expectedRevision: document.revision, cycle, confirmsNoKnownRisk: true }
}
function progress(state: PlanBetaStateV3, status: "COMPLETED" | "PAIN_CHECKIN" = "COMPLETED") {
  const session = state.activePlan.sessions.find(item => item.role !== "REST")!
  return planBetaStateV3Schema.parse({ ...state, progress: [{ sessionDay: session.day, sessionSlot: session.slot, state: status }] })
}
async function editCurrentFrame(): Promise<PlanBetaStateV3> {
  const current = loaded().currentPlan!
  const targets = listPermittedActivePlanEditTargets({ state: current, entries: [], today: "2026-10-11", noFixedFutureCommitments: true })
  for (const source of targets) for (const target of source.swapTargets) {
    const preparation = await prepareCurrentActivePlanEdit({ source: source.address, target, action: "SWAP",
      unstartedConfirmed: true, noFixedFutureCommitments: true })
    if (preparation.kind !== "ready") continue
    const accepted = await applyActivePlanEdit(preparation.proposal, true)
    expect(accepted.kind).toBe("applied")
    if (accepted.kind !== "applied") throw Error("Real edit did not apply")
    return preparation.proposal.after
  }
  throw Error("No existing reviewed edit was available")
}

describe("goal program local persistence and explicit current-frame bridge", () => {
  it("saves all three reviewed proposals without activating any plan or fabricating current records", async () => {
    const document = await saved()
    expect(document.revision).toBe(0); expect(document.application).toBeNull()
    expect(document.cycles.map(row => row.status)).toEqual(["PENDING", "PENDING", "PENDING"])
    expect(document.program.frames.every(frame => frame.plan.progress.length === 0)).toBe(true)
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
    expect(localStorage.getItem(PLAN_HISTORY)).toBeNull()
    expect(localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY)).toBeNull()
    expect(loaded()).toMatchObject({ currentCycleStatus: "NOT_STARTED", currentPlan: null, document })
  })

  it("measures one actual generation, save, apply and read without weakening source replay", async () => {
    const started = performance.now(), value = program(), generated = performance.now()
    const savedResult = await saveGoalTrainingProgram(value, { expectedRevision: null, currentCheck: "NO_KNOWN_RISK" })
    const stored = performance.now()
    if (savedResult.kind !== "saved") throw Error("Measured save")
    const appliedResult = await applyGoalTrainingProgramCycle(applyInput(savedResult.document)), activated = performance.now()
    expect(appliedResult.kind).toBe("applied")
    const read = readGoalTrainingProgram(), observed = performance.now()
    expect(read).toMatchObject({ kind: "loaded", currentCycleStatus: "CURRENT" })
    process.stdout.write(`goal-program-persistence-timings-ms ${JSON.stringify({ generation: Math.round(generated - started),
      save: Math.round(stored - generated), apply: Math.round(activated - stored), read: Math.round(observed - activated) })}\n`)
  })

  it("rejects an extended recipe source with missing duration acceptance even when its program ID is recalculated", async () => {
    const value = program(), review = goalTrainingProgramDurationReview(value)
    expect(review.required).toBe(true)
    const safety = evaluatePlanSafety("NO_KNOWN_RISK")
    if (safety.kind !== "passed") throw Error("Safety")
    expect(generateGoalTrainingProgram({ ...input, safetyGate: safety.gate, longerDurationConfirmed: false }))
      .toMatchObject({ kind: "blocked", code: "DURATION_CONFIRMATION_REQUIRED" })
    const { programId: _id, ...content } = value
    const changed = { ...content, inputs: { ...content.inputs, longerDurationConfirmed: false } }
    const forged = { ...changed, programId: `goal-program:${canonicalJsonFingerprint("trainoracle.goal-program.v1", changed)}` }
    expect(await saveGoalTrainingProgram(forged, { expectedRevision: null, currentCheck: "NO_KNOWN_RISK" }))
      .toMatchObject({ kind: "rejected", code: "INVALID_PROGRAM" })
    expect(localStorage.getItem(activeGoalTrainingProgramStorageKey())).toBeNull()
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  })

  it.each([60, 50, 45, 40, 30] as const)("persists and explicitly applies only cycle one of a %i-minute goal", async goalMinutes => {
    const document = await applied(await saved(program({ goalMinutes })))
    expect(document.application?.currentCycleIndex).toBe(1)
    expect(document.cycles.map(row => row.status)).toEqual(["CURRENT", "PENDING", "PENDING"])
    expect(readPlanBetaStateFromStorage()).toMatchObject({ kind: "loaded", state: document.program.frames[0]!.plan })
    expect(loaded().currentCycleStatus).toBe("CURRENT")
    expect(goalTrainingProgramDays(loaded().document)).toHaveLength(29)
    expect(localStorage.getItem(PLAN_HISTORY)).toBeNull()
  })

  it("rejects stale revision, unchecked body, stale preview and a busy lock without writes", async () => {
    const document = await saved(), before = localStorage.getItem(activeGoalTrainingProgramStorageKey())
    expect(await applyGoalTrainingProgramCycle({ ...applyInput(document), expectedRevision: 99 })).toMatchObject({ kind: "rejected", code: "STALE_PROGRAM_REVISION" })
    expect(await applyGoalTrainingProgramCycle({ ...applyInput(document), confirmsNoKnownRisk: false })).toMatchObject({ kind: "rejected", code: "CURRENT_BODY_CONFIRMATION_REQUIRED" })
    expect(await applyGoalTrainingProgramCycle({ ...applyInput(document), freshReview: () => false })).toMatchObject({ kind: "rejected" })
    lock.available = false
    expect(await applyGoalTrainingProgramCycle(applyInput(document))).toMatchObject({ kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
    expect(localStorage.getItem(activeGoalTrainingProgramStorageKey())).toBe(before)
  })

  it("reevaluates actual journal safety after waiting for the shared lock", async () => {
    const document = await saved()
    lock.before = () => localStorage.setItem(JOURNAL, "{incomplete")
    expect(await applyGoalTrainingProgramCycle(applyInput(document))).toMatchObject({ kind: "rejected", code: "SAFETY_OR_PREVIEW_CHANGED" })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
    expect(loaded().document.revision).toBe(0)
  })

  it("preserves an unrelated existing active plan and requires its explicit archive", async () => {
    const document = await saved(), unrelated = program({ dateChoice: { kind: "START", startDate: "2026-10-12" } }).frames[0]!.plan
    const before = JSON.stringify(unrelated); localStorage.setItem(activePlanBetaStorageKey(), before)
    expect(await applyGoalTrainingProgramCycle(applyInput(document))).toMatchObject({ kind: "rejected", code: "EXISTING_ACTIVE_PLAN_REQUIRES_ARCHIVE" })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
    expect(localStorage.getItem(PLAN_HISTORY)).toBeNull()
  })

  it("does not auto-advance or copy completion; ending and next application are separate actions", async () => {
    const document = await applied(), completed = progress(document.program.frames[0]!.plan)
    localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(completed))
    expect(await applyGoalTrainingProgramCycle(applyInput(document, 2))).toMatchObject({ kind: "rejected", code: "CURRENT_CYCLE_REQUIRES_ARCHIVE" })
    expect(loaded().document.application?.currentCycleIndex).toBe(1)
    const ended = await archiveGoalTrainingProgramCycle({ programId: document.program.programId, expectedRevision: document.revision })
    expect(ended.kind).toBe("archived")
    if (ended.kind !== "archived") throw Error("Archive")
    expect(loaded().currentCycleStatus).toBe("ENDED")
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
    expect(await applyGoalTrainingProgramCycle(applyInput(ended.document, 3))).toMatchObject({ kind: "rejected", code: "INVALID_CYCLE_TRANSITION" })
    const next = await applyGoalTrainingProgramCycle(applyInput(ended.document, 2))
    expect(next.kind).toBe("applied")
    if (next.kind !== "applied") throw Error("Next apply")
    expect(next.state).toEqual(document.program.frames[1]!.plan)
    expect(next.state.progress).toEqual([])
    expect(next.state.intake.startDate).toBe("2026-10-20")
    expect(next.document.cycles[0]!.latestPlan).toEqual(completed)
    expect(next.document.cycles[0]!.status).toBe("ENDED")
    expect(readArchivedOriginalPlans()).toMatchObject({ kind: "loaded", plans: expect.arrayContaining([completed]) })
  })

  it("observes progress and accepted changed candidate IDs without read-time storage writes", async () => {
    const original = await applied(), edited = await editCurrentFrame()
    expect(edited.activePlan.candidateId).not.toBe(original.program.frames[0]!.plan.activePlan.candidateId)
    const completed = progress(edited); localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(completed))
    const raw = localStorage.getItem(activeGoalTrainingProgramStorageKey()), write = vi.spyOn(Storage.prototype, "setItem")
    const view = loaded()
    expect(view.currentCycleStatus).toBe("CURRENT")
    expect(view.currentPlan).toEqual(completed)
    expect(view.document.cycles[0]!.lineage).toContainEqual(original.program.frames[0]!.plan)
    expect(goalTrainingProgramDays(view.document).some(day => JSON.stringify(day.session) !== JSON.stringify(original.program.days.find(row => row.date === day.date)?.session))).toBe(true)
    expect(write.mock.calls.filter(([key]) => key !== "__to_probe__")).toEqual([])
    expect(localStorage.getItem(activeGoalTrainingProgramStorageKey())).toBe(raw)
    write.mockRestore()
    const backup = JSON.parse(exportGoalTrainingProgramJSON())
    expect(backup.document.cycles[0].latestPlan).toEqual(completed)
    expect(backup.document.program).toEqual(original.program)
  })

  it("does not identify another cycle occurrence by candidate ID alone", async () => {
    const document = await applied(), wrongOccurrence = clone(document.program.frames[0]!.plan)
    wrongOccurrence.intake.startDate = "2026-10-30"
    localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(wrongOccurrence))
    expect(loaded().currentCycleStatus).toBe("DETACHED")
    expect(() => exportGoalTrainingProgramJSON()).toThrow("GOAL_PROGRAM_BACKUP_NOT_READY")
  })

  it("allows scheduling the first future frame but refuses an elapsed full frame without catch-up or date movement", async () => {
    const future = await saved(program({ dateChoice: { kind: "START", startDate: "2026-10-12" } }))
    expect((await applyGoalTrainingProgramCycle(applyInput(future))).kind).toBe("applied")
    localStorage.clear()
    const document = await saved()
    vi.setSystemTime(new Date("2026-10-21T03:00:00.000Z"))
    expect(await applyGoalTrainingProgramCycle(applyInput(document))).toMatchObject({ kind: "rejected", code: "CYCLE_DATES_ELAPSED" })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
    expect(loaded().document.program.window.startDate).toBe("2026-10-11")
  })

  it("rejects a stale initial start after midnight, while a restored partial current frame resumes on its original dates", async () => {
    const document = await saved()
    vi.setSystemTime(new Date("2026-10-15T03:00:00.000Z"))
    expect(await applyGoalTrainingProgramCycle(applyInput(document))).toMatchObject({ kind: "rejected", code: "START_DATE_ELAPSED" })
    localStorage.clear()
    expect(await saveGoalTrainingProgram(document.program, { expectedRevision: null, currentCheck: "NO_KNOWN_RISK" })).toMatchObject({ kind: "rejected", code: "START_DATE_ELAPSED" })
    vi.setSystemTime(new Date("2026-10-11T03:00:00.000Z")); localStorage.clear()
    await applied(); const backup = exportGoalTrainingProgramJSON(); localStorage.clear()
    vi.setSystemTime(new Date("2026-10-15T03:00:00.000Z"))
    const restored = await restoreGoalTrainingProgramJSON(backup, { expectedRevision: null, confirmsOwnFile: true })
    if (restored.kind !== "restored") throw Error("Restore")
    const accepted = await applyGoalTrainingProgramCycle(applyInput(restored.document))
    expect(accepted.kind).toBe("applied")
    if (accepted.kind === "applied") expect(accepted.state.intake.startDate).toBe("2026-10-11")
  })

  it("keeps invalid wrapper bytes and an unrelated active plan untouched", async () => {
    const invalid = "{preserve-me", active = JSON.stringify(program().frames[0]!.plan)
    localStorage.setItem(activeGoalTrainingProgramStorageKey(), invalid); localStorage.setItem(activePlanBetaStorageKey(), active)
    expect(readGoalTrainingProgram()).toEqual({ kind: "invalid" })
    expect(await saveGoalTrainingProgram(program(), { expectedRevision: null, currentCheck: "NO_KNOWN_RISK" })).toMatchObject({ kind: "rejected" })
    expect(localStorage.getItem(activeGoalTrainingProgramStorageKey())).toBe(invalid)
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(active)
  })

  it("fails closed on an edited calendar collision rather than presenting original planned days", async () => {
    const document = await applied(), invalid = clone(document), frame = invalid.program.frames[1]!
    invalid.cycles[1]!.latestPlan = clone(frame.plan)
    const work = clone(invalid.program.frames[0]!.plan.activePlan.sessions.find(item => item.role !== "REST")!)
    invalid.cycles[1]!.latestPlan!.activePlan.sessions = [{ ...work, day: 1, slot: "PM" }, ...frame.plan.activePlan.sessions.slice(1)]
    expect(() => goalTrainingProgramDays(invalid)).toThrow("GOAL_PROGRAM_CALENDAR_INVALID")
  })

  it("retained PAIN_CHECKIN blocks next-cycle and whole-program replacement even after a stop", async () => {
    const document = await applied(), painful = progress(document.program.frames[0]!.plan, "PAIN_CHECKIN")
    localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(painful))
    const ended = await archiveGoalTrainingProgramCycle({ programId: document.program.programId, expectedRevision: document.revision })
    if (ended.kind !== "archived") throw Error("Archive")
    expect(await applyGoalTrainingProgramCycle(applyInput(ended.document, 2))).toMatchObject({ kind: "rejected", code: "SAFETY_OR_PREVIEW_CHANGED" })
    expect(await saveGoalTrainingProgram(program({ goalMinutes: 50 }), { expectedRevision: ended.document.revision,
      currentCheck: "NO_KNOWN_RISK", replaceExisting: true })).toMatchObject({ kind: "rejected", code: "SAFETY_REVIEW_REQUIRED" })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  })
})

describe("program backup, replacement history and scope boundary", () => {
  it("exports full proposals and accepted progress, restores without activation, then explicitly resumes", async () => {
    const document = await applied(), completed = progress(document.program.frames[0]!.plan)
    localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(completed))
    const backup = exportGoalTrainingProgramJSON()
    localStorage.clear()
    expect(await restoreGoalTrainingProgramJSON(backup, { expectedRevision: null, confirmsOwnFile: false })).toMatchObject({ kind: "rejected", code: "OWN_FILE_CONFIRMATION_REQUIRED" })
    const restored = await restoreGoalTrainingProgramJSON(backup, { expectedRevision: null, confirmsOwnFile: true })
    expect(restored).toMatchObject({ kind: "restored", activePlanChanged: false })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
    expect(loaded().currentCycleStatus).toBe("PAUSED")
    if (restored.kind !== "restored") throw Error("Restore")
    expect((await applyGoalTrainingProgramCycle(applyInput(restored.document))).kind).toBe("applied")
    expect(readPlanBetaStateFromStorage()).toMatchObject({ kind: "loaded", state: completed })
  })

  it("restoring a backup never replaces the unrelated actual active plan", async () => {
    await applied(); const backup = exportGoalTrainingProgramJSON(); localStorage.clear()
    const unrelated = JSON.stringify(program({ dateChoice: { kind: "START", startDate: "2026-10-12" } }).frames[0]!.plan)
    localStorage.setItem(activePlanBetaStorageKey(), unrelated)
    expect((await restoreGoalTrainingProgramJSON(backup, { expectedRevision: null, confirmsOwnFile: true })).kind).toBe("restored")
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(unrelated)
    expect(loaded().currentCycleStatus).toBe("DETACHED")
  })

  it.each(["hash", "source", "date", "field"] as const)("rejects a modified backup %s, including a recalculated outer hash", async change => {
    await saved(); const incoming = JSON.parse(exportGoalTrainingProgramJSON()); localStorage.clear()
    if (change === "hash") incoming.contentFingerprint = "not-the-fingerprint"
    else {
      if (change === "source") incoming.document.program.source.version = "unreviewed"
      if (change === "date") incoming.document.program.frames[1].plan.intake.startDate = "2026-10-21"
      if (change === "field") incoming.document.program.unreviewed = true
      const { contentFingerprint: _hash, ...content } = incoming
      incoming.contentFingerprint = canonicalJsonFingerprint("trainoracle.goal-training-program-store.v1", content)
    }
    expect(await restoreGoalTrainingProgramJSON(JSON.stringify(incoming), { expectedRevision: null, confirmsOwnFile: true })).toMatchObject({ kind: "rejected", code: "INVALID_PROGRAM_BACKUP" })
    expect(localStorage.getItem(activeGoalTrainingProgramStorageKey())).toBeNull()
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  })

  it("replaces only after explicit review, preserving the entire old wrapper and exact active frame", async () => {
    const previous = await applied(), completed = progress(previous.program.frames[0]!.plan)
    localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(completed))
    const next = program({ goalMinutes: 50 }), before = localStorage.getItem(activeGoalTrainingProgramStorageKey())
    expect(await saveGoalTrainingProgram(next, { expectedRevision: previous.revision, currentCheck: "NO_KNOWN_RISK" })).toMatchObject({ kind: "rejected", code: "EXISTING_PROGRAM_REQUIRES_REVIEW" })
    expect(localStorage.getItem(activeGoalTrainingProgramStorageKey())).toBe(before)
    const result = await saveGoalTrainingProgram(next, { expectedRevision: previous.revision, currentCheck: "NO_KNOWN_RISK", replaceExisting: true })
    expect(result.kind).toBe("saved")
    if (result.kind !== "saved") throw Error("Replacement")
    expect(result.document.revision).toBe(previous.revision + 1)
    expect(result.document.application).toBeNull()
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
    const history = JSON.parse(localStorage.getItem(GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY)!)
    expect(history.entries).toHaveLength(1)
    expect(history.entries[0].document.program).toEqual(previous.program)
    expect(history.entries[0].document.cycles[0]).toMatchObject({ status: "ENDED", latestPlan: completed })
    expect(readArchivedOriginalPlans()).toMatchObject({ kind: "loaded", plans: expect.arrayContaining([completed]) })
    const backup = exportGoalTrainingProgramJSON(); localStorage.clear()
    expect((await restoreGoalTrainingProgramJSON(backup, { expectedRevision: null, confirmsOwnFile: true })).kind).toBe("restored")
    expect(JSON.parse(localStorage.getItem(GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY)!).entries).toEqual(history.entries)
    expect(loaded().document.program).toEqual(next)
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  })

  it("refuses history capacity instead of silently deleting a previous program", async () => {
    const previous = await saved()
    const entries = Array.from({ length: 18 }, () => ({ archivedAt: new Date().toISOString(), document: previous }))
    const raw = JSON.stringify({ version: 1, entries }); localStorage.setItem(GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY, raw)
    expect(await saveGoalTrainingProgram(program({ goalMinutes: 50 }), { expectedRevision: previous.revision,
      currentCheck: "NO_KNOWN_RISK", replaceExisting: true })).toMatchObject({ kind: "rejected", code: "PROGRAM_HISTORY_CAPACITY_REACHED" })
    expect(localStorage.getItem(GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY)).toBe(raw)
    expect(loaded().document.program).toEqual(previous.program)
  })

  it("isolates local preview wrappers by owner and refuses active application in an authenticated held lane", async () => {
    const guest = await saved(), guestRaw = localStorage.getItem(GOAL_TRAINING_PROGRAM_STORAGE_KEY)
    setActiveLocalAccount("athlete-a")
    const a = await saved(program({ goalMinutes: 50 }))
    expect(loaded().document.program.goalMinutes).toBe(50)
    expect(await applyGoalTrainingProgramCycle(applyInput(a))).toMatchObject({ kind: "rejected", code: "ACCOUNT_STORAGE_UNSUPPORTED" })
    setActiveLocalAccount("athlete-b")
    expect(readGoalTrainingProgram()).toEqual({ kind: "missing" })
    const b = await saved(program({ goalMinutes: 40 }))
    expect(localStorage.getItem(accountScopedStorageKeyFor(GOAL_TRAINING_PROGRAM_STORAGE_KEY, "athlete-a"))).not.toBeNull()
    expect(b.program.goalMinutes).toBe(40)
    setActiveLocalAccount(null)
    expect(loaded().document).toEqual(guest)
    expect(localStorage.getItem(GOAL_TRAINING_PROGRAM_STORAGE_KEY)).toBe(guestRaw)
  })

  it("invalidates an A to B to A scope round trip while waiting for a lock", async () => {
    setActiveLocalAccount("athlete-a")
    const value = program()
    lock.before = () => { setActiveLocalAccount("athlete-b"); setActiveLocalAccount("athlete-a") }
    expect(await saveGoalTrainingProgram(value, { expectedRevision: null, currentCheck: "NO_KNOWN_RISK" })).toMatchObject({ kind: "rejected", code: "ACCOUNT_OR_STATE_CHANGED" })
    expect(localStorage.getItem(activeGoalTrainingProgramStorageKey())).toBeNull()
  })

  it("never falls back to local storage when canonical account mode is enabled", async () => {
    const value = program(); await saved(value)
    const before = localStorage.getItem(GOAL_TRAINING_PROGRAM_STORAGE_KEY)
    vi.mocked(accountPlansEnabled).mockReturnValue(true)
    expect(readGoalTrainingProgram()).toEqual({ kind: "account_unsupported" })
    expect(await saveGoalTrainingProgram(value, { expectedRevision: 0, currentCheck: "NO_KNOWN_RISK" })).toMatchObject({ kind: "rejected", code: "ACCOUNT_STORAGE_UNSUPPORTED" })
    expect(await applyGoalTrainingProgramCycle({ programId: value.programId, expectedRevision: 0, cycle: 1, confirmsNoKnownRisk: true })).toMatchObject({ kind: "rejected", code: "ACCOUNT_STORAGE_UNSUPPORTED" })
    expect(await restoreGoalTrainingProgramJSON("{}", { expectedRevision: 0, confirmsOwnFile: true })).toMatchObject({ kind: "rejected", code: "ACCOUNT_STORAGE_UNSUPPORTED" })
    expect(localStorage.getItem(GOAL_TRAINING_PROGRAM_STORAGE_KEY)).toBe(before)
  })

  it("notifies local accepted edits, relevant external storage and scope changes", () => {
    const listener = vi.fn(), unsubscribe = subscribeGoalTrainingProgramChanges(listener)
    window.dispatchEvent(new Event("storage")); expect(listener).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new StorageEvent("storage", { key: GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY })); expect(listener).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new StorageEvent("storage", { key: "another-app" })); expect(listener).toHaveBeenCalledTimes(2)
    setActiveLocalAccount("changed"); expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe(); window.dispatchEvent(new Event("storage")); expect(listener).toHaveBeenCalledTimes(3)
  })
})

describe("goal-program multi-key write verification and recoverable rollback", () => {
  it("rolls active plan back when the program document cannot be written", async () => {
    const document = await saved(), before = localStorage.getItem(activeGoalTrainingProgramStorageKey()), original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === GOAL_TRAINING_PROGRAM_STORAGE_KEY) throw Error("Synthetic full storage")
      original.call(this, key, value)
    })
    expect(await applyGoalTrainingProgramCycle(applyInput(document))).toMatchObject({ kind: "failed", rollbackComplete: true })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
    expect(localStorage.getItem(activeGoalTrainingProgramStorageKey())).toBe(before)
  })

  it("does not overwrite a newer external active plan during rollback", async () => {
    const document = await saved(), external = JSON.stringify(program({ dateChoice: { kind: "START", startDate: "2026-10-12" } }).frames[0]!.plan), original = Storage.prototype.setItem
    let first = true
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      original.call(this, key, value)
      if (first && key === activePlanBetaStorageKey()) { first = false; original.call(this, key, external) }
    })
    expect(await applyGoalTrainingProgramCycle(applyInput(document))).toMatchObject({ kind: "failed", rollbackComplete: false })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(external)
    expect(loaded().document.application).toBeNull()
  })

  it("detects scope change immediately after the first write and restores only its own bytes", async () => {
    const document = await saved(), original = Storage.prototype.setItem
    let changed = false
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      original.call(this, key, value)
      if (!changed && key === "trainoracle.plan-beta.v1") { changed = true; setActiveLocalAccount("changed") }
    })
    expect(await applyGoalTrainingProgramCycle(applyInput(document))).toMatchObject({ kind: "failed", rollbackComplete: true })
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
    expect(localStorage.getItem("trainoracle.plan-beta.v1.account.changed")).toBeNull()
    expect(JSON.parse(localStorage.getItem(GOAL_TRAINING_PROGRAM_STORAGE_KEY)!).application).toBeNull()
  })

  it("rolls back whole-program replacement if the archived wrapper cannot be written", async () => {
    const document = await applied(), activeBefore = localStorage.getItem(activePlanBetaStorageKey())
    const headBefore = localStorage.getItem(activeGoalTrainingProgramStorageKey()), original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === GOAL_TRAINING_PROGRAM_HISTORY_STORAGE_KEY) throw Error("Synthetic full storage")
      original.call(this, key, value)
    })
    expect(await saveGoalTrainingProgram(program({ goalMinutes: 50 }), { expectedRevision: document.revision,
      currentCheck: "NO_KNOWN_RISK", replaceExisting: true })).toMatchObject({ kind: "failed", rollbackComplete: true })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(activeBefore)
    expect(localStorage.getItem(activeGoalTrainingProgramStorageKey())).toBe(headBefore)
    expect(localStorage.getItem(PLAN_HISTORY)).toBeNull()
  })
})
