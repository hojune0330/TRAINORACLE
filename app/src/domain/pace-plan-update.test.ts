import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"
import { createPlanAdaptationProposal, hashPlanCandidate, isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { bindCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import * as catalogBinding from "@impl/prescription/catalog-session-binding"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { preparePacePlanUpdate, preparePacePlanUndo, refreshExistingPaceInputs } from "./pace-plan-update"
import { prepareActivePlanEdit } from "./active-plan-edit"
import { activePlanEditReceiptSchema, isPaceOnlyCatalogReplacement, replayActivePlanEdit } from "./active-plan-edit-policy"
import { applyActivePlanEdit, prepareCurrentPaceUpdate, prepareCurrentPaceUndo } from "./active-plan-edit-store"
import { activeAthleteRecordsStorageKey, type AthleteRecord } from "./athlete-records"
import { planAdaptationCandidateSchema, planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import type { VersionedStoredPlanSession as Session } from "./plan-session-schema"
import { createStoredPaceTargetPrescription, paceTargetPlanItemSchema } from "./plan-session-schema"
import { planSessionAnchorsStillCurrent } from "./plan-anchor-reconfirmation"
import { toRuntimeAnchor } from "./pace-target-evidence"
import { preparePrescriptionRuntime } from "@impl/prescription/runtime"
import { parseJournalEntry, type JournalEntry } from "./journal-schema"
import { loadEntriesForPlanSafety } from "./journal-store"
import { preparePrescription } from "./plan-candidate-prescription"
import { evaluatePlanSafety, generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { activePlanBetaStorageKey, loadVersionedPlanBetaState, readArchivedOriginalPlans } from "./plan-beta-store"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { accountPlansEnabled } from "./account/account-plan-service"
import * as accountPlanServices from "./account/account-plan-service"
import { createAccountPlanCollectionService } from "./account/account-plan-collection-service"
import { collectionMemoryBuffers, collectionServer, COLLECTION_OWNER } from "./account/account-plan-collection.test-support"
import { accountPlanEntry, emptyAccountPlanDocument } from "./account/account-plan-document-schema"
import * as accountPaceRecords from "./account/account-athlete-record-service"
import * as accountPlanDomain from "./account/account-plan-domain"
import * as accountJournals from "./account/account-journal-projection"
import * as accountJournalApi from "./account/account-journal-api"
import * as planStore from "./plan-beta-store"
import * as journals from "./journal-store"

vi.mock("./plan-mutation-lock", () => ({ PLAN_BETA_MUTATION_LOCK_NAME: "pace-test-lock", getPlanMutationLockManager: () => ({
  request: async (_name: string, _options: unknown, run: (lock: object) => unknown) => run({}),
}) }))
vi.mock("./account/account-plan-service", async importOriginal => ({
  ...await importOriginal<typeof import("./account/account-plan-service")>(), accountPlansEnabled: vi.fn(() => false),
}))

const today = "2026-10-02", now = "2026-10-02T03:00:00.000Z"
const historyKey = "trainoracle.plan-beta.history.v1", journalKey = "trainoracle.journal.v1"
const oldRecord: AthleteRecord = { schemaVersion: 1, id: "pace-old", purpose: "RECENT_RESULT", eventDistanceM: 5000,
  performanceSeconds: 1200, achievedOn: "2026-09-20", seasonId: null, enteredBy: "ATHLETE",
  verificationState: "SELF_REPORTED", sourceRef: "athlete-record:pace-old", savedAt: "2026-09-21T03:00:00.000Z" }
const record: AthleteRecord = { ...oldRecord, id: "pace-new", sourceRef: "athlete-record:pace-new",
  performanceSeconds: 1100, achievedOn: "2026-10-01", savedAt: now }

function binding(session: Session) {
  if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) throw Error("catalog required")
  return session.prescription.catalogWorkout
}
function fixture(legacy = false) {
  const state = stateFixture() as PlanBetaStateV3
  state.intake.startDate = "2026-10-01"
  state.intake.experienceBand = "EXPERIENCED"
  const bare: Session = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT",
    prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 20, maximum: 50 } } }
  const inputs: WorkoutCalculationInputs = { eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
    confirmedRequirements: [], fiveK: { recordId: oldRecord.id, seconds: oldRecord.performanceSeconds,
      achievedAt: oldRecord.achievedOn!, evaluatedAt: today }, segmentPaces: [] }
  const initial = bindCatalogSession(bare, "P-LT-C", inputs)!
  expect(initial).not.toBeNull()
  const segmentId = resolveCatalogBinding(binding(initial))!.steps.find(s => s.targetModel === "THRESHOLD_REFERENCE")!.segmentId
  const selected = legacy ? initial : bindCatalogSession(bare, "P-LT-C", { ...inputs, fiveK: null, paceReferences: [{
    segmentId, kind: "ACTUAL", recordId: oldRecord.id, recordVersion: oldRecord.savedAt, eventDistanceM: 5000,
    performanceSeconds: oldRecord.performanceSeconds, achievedOn: oldRecord.achievedOn, evaluatedOn: today,
    confirmed: true, model: "FIVE_K_THRESHOLD_V1",
  }] })!
  expect(selected).not.toBeNull()
  state.activePlan.sessions = [1, 4, 7].map(day => ({ ...structuredClone(selected), day }))
  const plan = state.activePlan
  if (!("formationKind" in plan.frame)) throw Error("frame required")
  plan.candidateId = deriveCandidateId(plan.candidateId, { kind: plan.candidateKind, eventDistanceM: plan.eventDistanceM,
    selectedDetailedTemplateRef: plan.selectedDetailedTemplateRef, selectedEnergyIntent: plan.selectedEnergyIntent,
    sourceMode: plan.sourceMode, selectionAuthority: "SELF", frame: plan.frame, sessions: plan.sessions })
  expect(planBetaStateV3Schema.safeParse(state).success).toBe(true)
  return { state, entries: [] as JournalEntry[], today, now, timeZone: "Asia/Seoul", journalGuard: null, record }
}
function ready(input = fixture()) {
  const result = preparePacePlanUpdate(input)
  if (result.kind !== "ready") throw Error(`${result.reasonCode}: ${result.message}`)
  return result.proposal
}
function journal(state: PlanBetaStateV3, linked = false): JournalEntry {
  return { id: "pace-log", kind: "post-session", date: linked ? "2026-10-08" : "2026-10-04", savedAt: now,
    syncState: "local", title: "", memo: "", system: "lt", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
    activityOutcome: "COMPLETED", activitySlot: "UNSPECIFIED", painCheckStatus: "NO_SIGNAL_REPORTED",
    ...(linked ? { plannedSessionLink: createPlannedSessionLogDraft(state, state.activePlan.sessions[1]!, now)!.link } : {}),
  } as JournalEntry
}
function seeded(legacy = false) {
  const input = fixture(legacy)
  localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(input.state))
  localStorage.setItem(journalKey, "[]")
  localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([oldRecord, record]))
  return input
}

beforeEach(() => { localStorage.clear(); setActiveLocalAccount(null); vi.mocked(accountPlansEnabled).mockReturnValue(false) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); setActiveLocalAccount(null); localStorage.clear() })

describe("bounded pace update receipt", () => {
  it("keeps automatic numeric no-ops but retains an explicitly chosen actual record basis", async () => {
    const input = seeded()
    input.record = { ...record, performanceSeconds: oldRecord.performanceSeconds }
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([oldRecord, input.record]))
    expect(preparePacePlanUpdate(input).kind).toBe("blocked")
    const explicit = preparePacePlanUpdate({ ...input, explicitPaceBasis: true })
    if (explicit.kind !== "ready") throw Error(explicit.message)
    expect(explicit.proposal.explicitPaceBasis).toBe(true)
    expect(binding(explicit.proposal.after.activePlan.sessions[1]!).inputs.paceReferences?.[0]?.recordId).toBe(input.record.id)
    expect(isPaceOnlyCatalogReplacement(input.state.activePlan.sessions[1]!, explicit.proposal.after.activePlan.sessions[1]!)).toBe(true)
    vi.useFakeTimers(); vi.setSystemTime(new Date(now))
    const result = await applyActivePlanEdit(explicit.proposal, true)
    expect(result.kind).toBe("applied")
  })
  it("keeps an explicitly selected goal distinct when its numeric pace equals the actual record", () => {
    const input = fixture()
    input.record = { ...record, purpose: "RACE_GOAL", achievedOn: null, performanceSeconds: oldRecord.performanceSeconds }
    const proposal = ready(input)
    expect(proposal.after.activePlanEdit?.replacements).toHaveLength(2)
    for (const replacement of proposal.after.activePlanEdit!.replacements!) {
      expect(binding(replacement).inputs.paceReferences?.every(ref => ref.kind === "GOAL")).toBe(true)
    }
  })

  it("includes an unstarted occurrence today but still protects today's recorded progress", () => {
    const input = fixture()
    input.state.intake.startDate = today
    expect(ready(input).after.activePlanEdit!.replacements?.map(s => s.day)).toEqual([1, 4, 7])
    input.state.progress = [{ sessionDay: 1, sessionSlot: "AM", state: "SKIPPED" }]
    const proposal = ready(input)
    expect(proposal.after.activePlanEdit!.replacements?.map(s => s.day)).toEqual([4, 7])
    expect(proposal.after.activePlan.sessions[0]).toEqual(input.state.activePlan.sessions[0])
  })

  it.each([false, true])("updates a batch of existing references (legacy=%s) without changing work, recovery, order or history", legacy => {
    const input = fixture(legacy), before = structuredClone(input.state), proposal = ready(input)
    const receipt = proposal.after.activePlanEdit!
    expect(receipt.action).toBe("PACE_REFERENCE")
    expect(receipt.replacements?.map(s => s.day)).toEqual([4, 7])
    expect(receipt.protectedSlots).toContainEqual({ day: 1, slot: "AM" })
    expect(proposal.after.activePlan.sessions[0]).toEqual(before.activePlan.sessions[0])
    expect(replayActivePlanEdit(receipt)).toEqual(proposal.after.activePlan.sessions)
    expect(proposal.after.progress).toEqual(before.progress)
    expect(input.state).toEqual(before)
    expect(proposal.paceSourceRecord).toEqual(record)
    expect(proposal.paceSourceRecord).not.toBe(record)
    for (const replacement of receipt.replacements!) {
      const original = before.activePlan.sessions.find(s => s.day === replacement.day)!
      const oldSteps = resolveCatalogBinding(binding(original))!.steps, newSteps = resolveCatalogBinding(binding(replacement))!.steps
      expect(newSteps.map(s => [s.key, s.phase, s.kind, s.set, s.occurrence, s.distanceM])).toEqual(oldSteps.map(s => [s.key, s.phase, s.kind, s.set, s.occurrence, s.distanceM]))
      expect(newSteps.filter(s => s.kind === "RECOVERY" || s.phase !== "main")).toEqual(oldSteps.filter(s => s.kind === "RECOVERY" || s.phase !== "main"))
      expect(newSteps.find(s => s.referenceRecordId)?.paceSecondsPerKm).not.toEqual(oldSteps.find(s => s.referenceRecordId)?.paceSecondsPerKm)
      expect(binding(replacement).inputs.segmentPaces).toEqual(binding(original).inputs.segmentPaces)
      if (!legacy) expect(binding(replacement).inputs.paceReferences?.[0]).toMatchObject({ recordId: record.id, recordVersion: record.savedAt, model: "FIVE_K_THRESHOLD_V1" })
    }
  })

  it.each(["progress", "journal", "linked-journal"])("skips %s protected slots without touching their snapshots", protection => {
    const input = fixture()
    if (protection === "progress") input.state.progress = [{ sessionDay: 4, sessionSlot: "AM", state: "SKIPPED" }]
    else input.entries = [journal(input.state, protection === "linked-journal")]
    const proposal = ready(input)
    expect(proposal.after.activePlanEdit!.replacements?.map(s => s.day)).toEqual([7])
    expect(proposal.after.activePlan.sessions.slice(0, 2)).toEqual(input.state.activePlan.sessions.slice(0, 2))
    expect(proposal.after.progress).toEqual(input.state.progress)
  })

  it("previews eligible slots and exclusion reasons instead of abandoning the batch on an incompatible slot", () => {
    const input = fixture(), bind = catalogBinding.bindCatalogSession
    vi.spyOn(catalogBinding, "bindCatalogSession").mockImplementation((session, ...args) => session.day === 4 ? null : bind(session, ...args))
    const result = preparePacePlanUpdate(input)
    expect(result.kind).toBe("ready")
    expect(result.excluded).toEqual([
      expect.objectContaining({ day: 1, slot: "AM", reasonCode: "TARGET_PROTECTED", reason: expect.any(String) }),
      expect.objectContaining({ day: 4, slot: "AM", reasonCode: "PROPOSAL_INVALID", reason: expect.any(String) }),
    ])
    if (result.kind !== "ready") throw Error("preview")
    expect(result.proposal.after.activePlanEdit!.replacements?.map(s => s.day)).toEqual([7])
    expect(result.proposal.after.activePlan.sessions.slice(0, 2)).toEqual(input.state.activePlan.sessions.slice(0, 2))
  })

  it("returns a blocked preview with reasons when every remaining slot is incompatible", () => {
    const input = fixture()
    vi.spyOn(catalogBinding, "bindCatalogSession").mockReturnValue(null)
    const result = preparePacePlanUpdate(input)
    expect(result.kind).toBe("blocked")
    expect(result.excluded?.map(item => item.day)).toEqual([1, 4, 7])
  })

  it("retains the model while replacing ACTUAL with a visibly separate GOAL snapshot", () => {
    const input = fixture()
    input.record = { ...record, purpose: "RACE_GOAL", achievedOn: null, seasonId: null }
    const proposal = ready(input), refs = binding(proposal.after.activePlanEdit!.replacements![0]!).inputs.paceReferences!
    expect(refs[0]).toMatchObject({ kind: "GOAL", achievedOn: null, model: "FIVE_K_THRESHOLD_V1", recordVersion: now })
    expect(preparePacePlanUpdate({ ...fixture(true), record: input.record }).kind).toBe("blocked")
  })

  it("preserves an explicitly unknown achievement date without inventing a date", () => {
    const proposal = ready({ ...fixture(), record: { ...record, purpose: "RECENT_RESULT", achievedOn: null, seasonId: null } })
    expect(binding(proposal.after.activePlanEdit!.replacements![0]!).inputs.paceReferences?.[0]).toMatchObject({ kind: "ACTUAL", achievedOn: null })
  })

  it("does not add mappings or replace explicit seconds and pace targets", () => {
    const input = fixture(), session = input.state.activePlan.sessions[1]!, old = binding(session)
    const segmentId = old.inputs.paceReferences![0]!.segmentId
    for (const override of [{ segmentPaces: [{ segmentId, secondsPerKm: 260 }] }, { segmentSeconds: [{ segmentId, seconds: 200 }] }]) {
      const { paceReferences: _references, ...inputs } = old.inputs
      const explicit = { ...session, prescription: { ...session.prescription, catalogWorkout: { ...old, inputs: { ...inputs, ...override } } } } as Session
      expect(refreshExistingPaceInputs(explicit, record, today)).toBeNull()
    }
    expect(preparePacePlanUpdate({ ...input, record: { ...record, eventDistanceM: 1500 } }).kind).toBe("blocked")
    expect(preparePacePlanUpdate({ ...input, record: { ...record, verificationState: "UNVERIFIED" } }).kind).toBe("blocked")
  })

  it.each(["duplicate", "past", "protected", "missing-source", "oversized"])("rejects a forged %s batch atomically", change => {
    const receipt = structuredClone(ready().after.activePlanEdit!)
    const replacement = receipt.replacements![0]!
    if (change === "duplicate") receipt.replacements!.push(replacement)
    if (change === "past") receipt.replacements!.push({ ...replacement, day: 1 })
    if (change === "protected") receipt.protectedSlots.push({ day: 7, slot: "AM" })
    if (change === "missing-source") receipt.replacements = receipt.replacements!.filter(s => s.day !== receipt.source.day)
    if (change === "oversized") receipt.replacements = Array.from({ length: 39 }, () => replacement)
    expect(replayActivePlanEdit(receipt)).toBeNull()
  })

  it.each(["catalog", "recovery", "explicit-pace", "available", "model", "mapping"])("rejects %s drift even with a fresh catalog calculation", change => {
    const input = fixture(), source = input.state.activePlan.sessions[1]!, good = ready(input).after.activePlanEdit!.replacements![0]!
    const old = binding(good), inputs = structuredClone(old.inputs)
    const ref = inputs.paceReferences![0]!
    const changedInputs = change === "recovery" ? { ...inputs, recoverySeconds: [{ segmentId: "forged", seconds: 999 }] }
      : change === "explicit-pace" ? { ...inputs, segmentPaces: [{ segmentId: "forged", secondsPerKm: 250 }] }
        : change === "available" ? { ...inputs, availableSeconds: 9999 }
          : change === "model" ? { ...inputs, paceReferences: [{ ...ref, model: "RACE_AVERAGE_V1" as const }] }
            : change === "mapping" ? { ...inputs, paceReferences: [...inputs.paceReferences!, { ...ref, segmentId: "forged" }] } : inputs
    const id = change === "catalog" ? "P-LT-B" : old.catalogId
    const rebound = bindCatalogSession(source, id, changedInputs)
    const forged = rebound ?? { ...good, prescription: { ...good.prescription, catalogWorkout: { ...old, catalogId: id, inputs: changedInputs } } } as Session
    // bindCatalogSession normalizes availability; exercise the actual supplied changed field too.
    const candidate = change === "available" ? { ...good, prescription: { ...good.prescription, catalogWorkout: { ...old, inputs: changedInputs } } } as Session : forged
    expect(isPaceOnlyCatalogReplacement(source, candidate)).toBe(false)
  })

  it("keeps legacy receipts absent-field compatible and disallows batch fields on legacy actions", () => {
    const receipt = ready().after.activePlanEdit!
    const { replacements: _batch, ...rest } = receipt
    const legacy = { ...rest, action: "CATALOG", replacement: receipt.replacements![0] }
    expect(activePlanEditReceiptSchema.safeParse(legacy).success).toBe(true)
    expect(activePlanEditReceiptSchema.safeParse({ ...legacy, replacements: [] }).success).toBe(false)
    expect(activePlanEditReceiptSchema.safeParse(rest).success).toBe(false)
    expect(prepareActivePlanEdit({ ...fixture(), action: "CATALOG", source: receipt.source, replacements: [],
      unstartedConfirmed: true, noFixedFutureCommitments: false }).kind).toBe("blocked")
  })
})

describe("pace batch persistence", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(now)) })

  it("prepares with no writes and applies every replacement in one active-plan save with the original archived", async () => {
    const input = seeded(), key = activePlanBetaStorageKey(), writes = vi.spyOn(Storage.prototype, "setItem")
    const result = await prepareCurrentPaceUpdate(record)
    expect(result.kind).toBe("ready")
    expect(writes.mock.calls.filter(([k]) => k !== "__to_probe__")).toEqual([])
    if (result.kind !== "ready") throw Error("preview")
    expect(await applyActivePlanEdit(result.proposal, true)).toMatchObject({ kind: "applied" })
    expect(writes.mock.calls.filter(([k]) => k === key)).toHaveLength(1)
    expect(loadVersionedPlanBetaState()).toEqual(result.proposal.after)
    const history = readArchivedOriginalPlans()
    expect(history.kind).toBe("loaded")
    if (history.kind === "loaded") expect(history.plans).toContainEqual(input.state)
    expect(localStorage.getItem(journalKey)).toBe("[]")
  })

  it.each(["record", "state", "journal", "scope"])("blocks %s drift before any plan write", async change => {
    const input = seeded(), result = await prepareCurrentPaceUpdate(record), key = activePlanBetaStorageKey()
    if (result.kind !== "ready") throw Error("preview")
    if (change === "record") localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([oldRecord, { ...record, savedAt: "2026-10-02T04:00:00.000Z" }]))
    if (change === "state") localStorage.setItem(key, JSON.stringify({ ...input.state, progress: [{ sessionDay: 7, sessionSlot: "AM", state: "SKIPPED" }] }))
    if (change === "journal") localStorage.setItem(journalKey, JSON.stringify([journal(input.state)]))
    if (change === "scope") setActiveLocalAccount("offline-pace-account")
    const before = localStorage.getItem(key), writes = vi.spyOn(Storage.prototype, "setItem")
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("blocked")
    expect(writes.mock.calls.filter(([k]) => k === key || k === historyKey)).toEqual([])
    expect(localStorage.getItem(key)).toBe(before)
  })

  it.each(["deleted", "edited"])("does not revalidate a %s historical source in protected slots", async change => {
    const input = seeded()
    input.state.progress = [{ sessionDay: 4, sessionSlot: "AM", state: "SKIPPED" }]
    localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(input.state))
    const result = await prepareCurrentPaceUpdate(record)
    if (result.kind !== "ready") throw Error("preview")
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify(change === "deleted" ? [record]
      : [record, { ...oldRecord, performanceSeconds: 1500, savedAt: now }]))
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("applied")
    expect(loadVersionedPlanBetaState()?.activePlan.sessions.slice(0, 2)).toEqual(input.state.activePlan.sessions.slice(0, 2))
  })

  it("fails closed offline and does not fall back to guest storage", async () => {
    seeded(); setActiveLocalAccount("offline-pace-account")
    const writes = vi.spyOn(Storage.prototype, "setItem")
    expect((await prepareCurrentPaceUpdate(record)).kind).toBe("blocked")
    expect(writes).not.toHaveBeenCalled()
  })

  it("blocks account pace writes until the server can verify the source record snapshot", async () => {
    seeded()
    const result = await prepareCurrentPaceUpdate(record)
    if (result.kind !== "ready") throw Error("preview")
    vi.mocked(accountPlansEnabled).mockReturnValue(true)
    const writes = vi.spyOn(Storage.prototype, "setItem")
    expect(await applyActivePlanEdit(result.proposal, true)).toMatchObject({ kind: "blocked" })
    expect(writes).not.toHaveBeenCalled()
  })

  it("also blocks legacy fiveK source version drift using the proposal record snapshot", async () => {
    seeded(true)
    const result = await prepareCurrentPaceUpdate(record)
    if (result.kind !== "ready") throw Error("preview")
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([oldRecord, { ...record, savedAt: "2026-10-02T04:00:00.000Z" }]))
    const writes = vi.spyOn(Storage.prototype, "setItem")
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("blocked")
    expect(writes.mock.calls.filter(([k]) => k === activePlanBetaStorageKey() || k === historyKey)).toEqual([])
  })

  it.each(["missing", "different-record"])("rejects a %s source snapshot instead of trusting the displayed record", async change => {
    seeded()
    const result = await prepareCurrentPaceUpdate(record)
    if (result.kind !== "ready") throw Error("preview")
    const proposal = { ...result.proposal, paceSourceRecord: change === "missing" ? undefined : oldRecord }
    const writes = vi.spyOn(Storage.prototype, "setItem")
    expect((await applyActivePlanEdit(proposal, true)).kind).toBe("blocked")
    expect(writes.mock.calls.filter(([k]) => k === activePlanBetaStorageKey() || k === historyKey)).toEqual([])
  })

  it("retains the whole original when the single active write fails, with no partial slot writes", async () => {
    const input = seeded(), result = await prepareCurrentPaceUpdate(record), key = activePlanBetaStorageKey()
    if (result.kind !== "ready") throw Error("preview")
    const write = Storage.prototype.setItem
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k, value) {
      if (k === key) throw Error("synthetic write failure")
      write.call(this, k, value)
    })
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("blocked")
    expect(writes.mock.calls.filter(([k]) => k === key)).toHaveLength(1)
    expect(loadVersionedPlanBetaState()).toEqual(input.state)
    expect(readArchivedOriginalPlans().kind).toBe("loaded")
  })
})

describe("guarded exact pace undo", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(now)) })
  async function applied() {
    const input = seeded(), forward = await prepareCurrentPaceUpdate(record)
    if (forward.kind !== "ready") throw Error("forward preview")
    expect((await applyActivePlanEdit(forward.proposal, true)).kind).toBe("applied")
    return { input, forward: forward.proposal }
  }

  it("restores exact previous bindings once in one save and retains both archives", async () => {
    const { input, forward } = await applied(), result = await prepareCurrentPaceUndo()
    if (result.kind !== "ready") throw Error(JSON.stringify(result))
    expect(result.proposal.after.activePlanEdit!.undoOf).toEqual(forward.after.activePlanEdit)
    expect(result.proposal.afterSessions).toEqual(input.state.activePlan.sessions)
    expect(result.proposal).not.toHaveProperty("paceSourceRecord")
    const records = localStorage.getItem(activeAthleteRecordsStorageKey()), writes = vi.spyOn(Storage.prototype, "setItem")
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("applied")
    expect(writes.mock.calls.filter(([k]) => k === activePlanBetaStorageKey())).toHaveLength(1)
    expect(loadVersionedPlanBetaState()?.activePlan.sessions).toEqual(input.state.activePlan.sessions)
    expect(localStorage.getItem(activeAthleteRecordsStorageKey())).toBe(records)
    const history = readArchivedOriginalPlans()
    if (history.kind !== "loaded") throw Error("history")
    expect(history.plans).toEqual(expect.arrayContaining([input.state, forward.after]))
    expect((await prepareCurrentPaceUndo()).kind).toBe("blocked")
  })

  it.each(["journal", "progress"])("excludes only the slot with newly injected %s and restores the other", async protection => {
    const { input, forward } = await applied()
    if (protection === "journal") {
      const entry = journal(forward.after)
      expect(parseJournalEntry(entry)).not.toBeNull()
      localStorage.setItem(journalKey, JSON.stringify([entry]))
      expect(loadEntriesForPlanSafety()).toMatchObject({ status: "complete", entries: [expect.objectContaining({ id: entry.id })] })
    } else localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify({ ...forward.after,
      progress: [{ sessionDay: 4, sessionSlot: "AM", state: "SKIPPED" }] }))
    const result = await prepareCurrentPaceUndo()
    if (result.kind !== "ready") throw Error(JSON.stringify(result))
    expect(result.excluded).toContainEqual(expect.objectContaining({ day: 4, reasonCode: "TARGET_PROTECTED" }))
    expect(result.proposal.after.activePlanEdit!.replacements?.map(s => s.day)).toEqual([7])
    expect(result.proposal.afterSessions[1]).toEqual(forward.afterSessions[1])
    expect(result.proposal.afterSessions[2]).toEqual(input.state.activePlan.sessions[2])
    const journalBefore = localStorage.getItem(journalKey), progressBefore = loadVersionedPlanBetaState()?.progress
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("applied")
    expect(localStorage.getItem(journalKey)).toBe(journalBefore)
    expect(loadVersionedPlanBetaState()?.progress).toEqual(progressBefore)
  })

  it("does not require the deleted forward source or rewrite its archived snapshot", async () => {
    const { forward } = await applied()
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([oldRecord]))
    const result = await prepareCurrentPaceUndo()
    if (result.kind !== "ready") throw Error(JSON.stringify(result))
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("applied")
    const history = readArchivedOriginalPlans()
    if (history.kind !== "loaded") throw Error("history")
    expect(history.plans).toContainEqual(forward.after)
  })

  it.each(["deleted", "edited", "version"])("restores the exact historical snapshot despite a %s source record", async change => {
    const { input } = await applied()
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify(change === "deleted" ? [record]
      : [record, { ...oldRecord, ...(change === "edited" ? { performanceSeconds: 999 } : { savedAt: now }) }]))
    const result = await prepareCurrentPaceUndo()
    if (result.kind !== "ready") throw Error(JSON.stringify(result))
    expect(result.proposal.afterSessions).toEqual(input.state.activePlan.sessions)
    const records = localStorage.getItem(activeAthleteRecordsStorageKey())
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("applied")
    expect(loadVersionedPlanBetaState()?.activePlan.sessions).toEqual(input.state.activePlan.sessions)
    expect(localStorage.getItem(activeAthleteRecordsStorageKey())).toBe(records)
  })

  it.each(["journal", "progress", "account"])("rejects %s drift after undo preview without a write", async change => {
    const { forward } = await applied(), result = await prepareCurrentPaceUndo()
    if (result.kind !== "ready") throw Error("undo")
    if (change === "journal") localStorage.setItem(journalKey, JSON.stringify([journal(forward.after)]))
    if (change === "progress") localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify({ ...forward.after,
      progress: [{ sessionDay: 4, sessionSlot: "AM", state: "SKIPPED" }] }))
    if (change === "account") setActiveLocalAccount("different-account")
    const writes = vi.spyOn(Storage.prototype, "setItem")
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("blocked")
    expect(writes.mock.calls.filter(([k]) => k === activePlanBetaStorageKey() || k === historyKey)).toEqual([])
  })

  it("rejects changed identity and a missing latest receipt", async () => {
    const { input, forward } = await applied()
    for (const state of [{ ...forward.after, activePlan: { ...forward.after.activePlan, candidateId: "different-plan" } },
      { ...forward.after, activePlanEdit: undefined }]) {
      expect(preparePacePlanUndo({ ...input, state }).kind).toBe("blocked")
    }
  })

  it("uses only the latest forward receipt after a second pace update", async () => {
    const { input, forward } = await applied()
    const newer: AthleteRecord = { ...record, id: "pace-newest", sourceRef: "athlete-record:pace-newest", performanceSeconds: 1050 }
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([oldRecord, record, newer]))
    const second = await prepareCurrentPaceUpdate(newer)
    if (second.kind !== "ready") throw Error("second preview")
    expect((await applyActivePlanEdit(second.proposal, true)).kind).toBe("applied")
    const undo = await prepareCurrentPaceUndo()
    if (undo.kind !== "ready") throw Error("latest undo")
    expect(undo.proposal.afterSessions).toEqual(forward.afterSessions)
    expect(undo.proposal.after.activePlanEdit!.undoOf).toEqual(second.proposal.after.activePlanEdit)
    expect(prepareActivePlanEdit({ ...input, state: second.proposal.after, action: "PACE_REFERENCE", source: { day: 4, slot: "AM" },
      replacements: input.state.activePlan.sessions.filter(s => s.day !== 1), undoOf: forward.after.activePlanEdit!,
      unstartedConfirmed: true, noFixedFutureCommitments: false }).kind).toBe("blocked")
    expect((await applyActivePlanEdit(undo.proposal, true)).kind).toBe("applied")
    expect(loadVersionedPlanBetaState()?.activePlan.sessions).toEqual(forward.afterSessions)
  })

  it("rejects a valid rebound that is not the exact original undo binding", async () => {
    const { input, forward } = await applied(), result = preparePacePlanUndo({ ...input, state: forward.after })
    if (result.kind !== "ready") throw Error("undo")
    const receipt = structuredClone(result.proposal.after.activePlanEdit!)
    const original = receipt.replacements![0]!, old = binding(original), ref = old.inputs.paceReferences![0]!
    const forged = bindCatalogSession(original, old.catalogId, { ...old.inputs,
      paceReferences: [{ ...ref, recordVersion: now }] })!
    expect(forged).not.toBeNull()
    receipt.replacements![0] = forged
    expect(replayActivePlanEdit(receipt)).toBeNull()
    expect(activePlanEditReceiptSchema.safeParse({ ...receipt, undoOf: result.proposal.after.activePlanEdit }).success).toBe(false)
  })
})

const legacyCases = [
  { event: 800, seconds: 122, template: "MD-800-01", focus: "GLY_INTENT" },
  { event: 1500, seconds: 245, template: "MD-1500-01", focus: "MIXED_INTENT" },
  { event: 3000, seconds: 611, template: "MD-3000-01", focus: "VO2_INTENT" },
  { event: 5000, seconds: 1200, template: "V2-SEED-05", focus: "VO2_INTENT" },
] as const

function legacyFixture(testCase: typeof legacyCases[number]) {
  const input = seeded(), approval = DETAILED_PRESCRIPTION_APPROVALS.find(a => a.templateId === testCase.template)!
  const previous: AthleteRecord = { ...oldRecord, eventDistanceM: testCase.event, performanceSeconds: testCase.seconds }
  input.record = { ...record, eventDistanceM: testCase.event, performanceSeconds: testCase.seconds * 0.95 }
  localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([previous, input.record]))
  input.state.intake.eventDistanceM = testCase.event
  input.state.intake.eventGroup = testCase.event === 5000 ? "FIVE_K" : "MIDDLE_DISTANCE"
  input.state.intake.trainingFocus = testCase.focus
  const template = { templateId: approval.templateId, version: approval.templateVersion, fingerprint: approval.templateContentFingerprint }
  input.state.intake.selectedDetailedTemplateRef = template
  input.state.intake.startDate = today
  const generated = generatePlanFromDraft(input.state.intake, "NO_KNOWN_RISK", { selectedRecordId: previous.id })
  if (generated.kind !== "generated") throw Error(JSON.stringify(generated))
  const selected = selectPlanForActivation(generated.generated.candidates[0].candidateId, generated.generated,
    generated.gate, generated.intake, generated.athleteEvidence)
  if (selected.kind !== "selected" || selected.state.version !== 3) throw Error(JSON.stringify(selected))
  input.state = selected.state
  input.state.intake.startDate = today
  const parsed = planBetaStateV3Schema.safeParse(input.state)
  if (!parsed.success) throw Error(JSON.stringify(parsed.error.issues))
  localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(input.state))
  return input
}

describe("legacy PACE_TARGET batch", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(now)) })
  it.each(legacyCases)("prepares an explicit initial $event m goal without granting current-capability authority", testCase => {
    const input = legacyFixture(testCase)
    const goal: AthleteRecord = { ...input.record, purpose: "RACE_GOAL", achievedOn: null, seasonId: null,
      performanceSeconds: testCase.seconds + 0.125 }
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([goal]))
    const before = localStorage.getItem(activePlanBetaStorageKey()), writes = vi.spyOn(Storage.prototype, "setItem")
    const safety = evaluatePlanSafety("NO_KNOWN_RISK", new Date(now))
    if (safety.kind !== "passed") throw Error("safety")
    const prepare = (selection: unknown, source: AthleteRecord = goal) => preparePrescription(input.state.intake,
      safety.gate, selection, new Date(now), input.state.intake.selectedDetailedTemplateRef, [source])
    expect(prepare(undefined).kind).toBe("fallback")
    const prepared = prepare({ selectedRecordId: goal.id })
    if (prepared.kind !== "prepared") throw Error(prepared.code)
    const p = prepared.prescription
    expect(p.targetRepSeconds).toBe(goal.performanceSeconds * p.repetitionDistanceM / testCase.event)
    expect(p.selectedAnchor).toMatchObject({ kind: "GOAL", purpose: "ASPIRATIONAL_TARGET", freshnessState: "UNKNOWN",
      achievedAt: null, seasonId: null, selectionEvidence: { version: 1, kind: "EXPLICIT_GOAL", confirmed: true,
        recordVersion: goal.savedAt, recordPurpose: "RACE_GOAL", evaluatedOn: today } })
    expect(paceTargetPlanItemSchema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p)
    const approval = DETAILED_PRESCRIPTION_APPROVALS.find(a => a.templateId === testCase.template)!
    expect(preparePrescriptionRuntime({ notation: approval.notation, anchor: toRuntimeAnchor(goal, "UNKNOWN"),
      displayRoundingPolicyVersion: "seconds-v1", template: approval, safetyGate: safety.gate,
      operationalComponents: approval.canonicalTemplateContent.operationalComponents }).kind).toBe("rejected")
    const { prescriptionFingerprint: _fingerprint, ...content } = p
    for (const forged of [{ purpose: "CURRENT_CAPABILITY" }, { freshnessState: "CURRENT" },
      { achievedAt: today }, { selectionEvidence: undefined }, { verificationState: "UNVERIFIED" }]) {
      expect(createStoredPaceTargetPrescription({ ...content, selectedAnchor: { ...p.selectedAnchor, ...forged } })).toBeNull()
    }
    expect(prepare({ selectedRecordId: goal.id }, { ...goal, performanceSeconds: Number.POSITIVE_INFINITY }).kind).toBe("fallback")
    expect(planSessionAnchorsStillCurrent([{ prescription: p }], new Date(now))).toBe(true)
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
    expect(writes.mock.calls.filter(([key]) => key !== "__to_probe__")).toHaveLength(0)
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([{ ...goal, savedAt: "2026-10-02T03:01:00.000Z" }]))
    expect(planSessionAnchorsStillCurrent([{ prescription: p }], new Date(now))).toBe(false)
  })

  it.each(legacyCases)("accepts an explicit $event m goal in next-cycle parsers without authorizing an automatic change", async testCase => {
    vi.stubGlobal("crypto", webcrypto)
    const input = legacyFixture(testCase)
    const goal: AthleteRecord = { ...input.record, purpose: "RACE_GOAL", achievedOn: null, seasonId: null }
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([goal]))
    const generated = generatePlanFromDraft(input.state.intake, "NO_KNOWN_RISK", { selectedRecordId: goal.id })
    if (generated.kind !== "generated") throw Error(JSON.stringify(generated))
    const candidate = generated.generated.candidates[0]
    const anchors = candidate.sessions.flatMap(s => s.prescription.kind === "PACE_TARGET" ? [s.prescription.selectedAnchor] : [])
    expect(anchors.length).toBeGreaterThan(0)
    expect(anchors.every(a => a.kind === "GOAL" && a.achievedAt === null && a.freshnessState === "UNKNOWN")).toBe(true)
    expect(planAdaptationCandidateSchema.safeParse(candidate).success).toBe(true)
    expect(isVerifiedPlanCandidate(candidate)).toBe(true)
    const request = {
      kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST", scope: { athleteId: "local-athlete",
        eventDistanceM: candidate.eventDistanceM, pairId: candidate.pairId,
        selectedDetailedTemplateRef: candidate.selectedDetailedTemplateRef },
      activePlanStartedAt: now, baseCandidate: candidate, proposedCandidate: candidate,
      baseContentHash: await hashPlanCandidate(candidate), proposalOrigin: "SELF_SERVICE",
      trigger: { kind: "EXPLICIT_REQUEST", requestedBy: "ATHLETE", sourceRef: "athlete-request:local-athlete:req-1" },
      changeDimension: "VOLUME", safetyGate: generated.gate, safetyEvaluatedAt: "2026-10-12T03:00:00.000Z",
      safetyValidUntil: "2026-10-12T03:10:00.000Z", activeHold: false, createdAt: "2026-10-12T03:00:00.000Z",
      idempotencyKey: `sha256:${"e".repeat(64)}`,
    }
    expect(await createPlanAdaptationProposal(request)).toEqual({ kind: "rejected", code: "NO_OP" })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(JSON.stringify(input.state))
  })

  it.each(legacyCases)("explicitly applies and undoes an equal-time $event m goal while preserving dose and original evidence", async testCase => {
    const input = legacyFixture(testCase), original = structuredClone(input.state)
    input.record = { ...input.record, purpose: "RACE_GOAL", achievedOn: null, seasonId: null, performanceSeconds: testCase.seconds }
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([input.record]))
    const before = localStorage.getItem(activePlanBetaStorageKey())
    const result = await prepareCurrentPaceUpdate(input.record)
    if (result.kind !== "ready") throw Error(JSON.stringify(result))
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
    const replacement = result.proposal.after.activePlanEdit!.replacements![0]!
    const prior = original.activePlan.sessions.find(s => s.day === replacement.day && s.slot === replacement.slot)!
    if (prior.prescription.kind !== "PACE_TARGET" || replacement.prescription.kind !== "PACE_TARGET") throw Error("target")
    expect(replacement.prescription.targetRepSeconds).toBe(prior.prescription.targetRepSeconds)
    expect(replacement.prescription.selectedAnchor.kind).toBe("GOAL")
    expect(prior.prescription.selectedAnchor.kind).not.toBe("GOAL")
    expect(replacement.prescription.totals).toEqual(prior.prescription.totals)
    expect(replacement.prescription.operationalComponents).toEqual(prior.prescription.operationalComponents)
    expect(replacement.prescription.notation).toBe(prior.prescription.notation)
    expect(replayActivePlanEdit(result.proposal.after.activePlanEdit!)).toEqual(result.proposal.afterSessions)
    expect((await applyActivePlanEdit(result.proposal, false)).kind).toBe("blocked")
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("applied")
    expect(loadVersionedPlanBetaState()?.activePlan.sessions).toEqual(result.proposal.afterSessions)
    localStorage.removeItem(activeAthleteRecordsStorageKey())
    const undo = await prepareCurrentPaceUndo()
    if (undo.kind !== "ready") throw Error(JSON.stringify(undo))
    expect(undo.proposal.afterSessions).toEqual(original.activePlan.sessions)
    expect((await applyActivePlanEdit(undo.proposal, true)).kind).toBe("applied")
  })
  it.each(legacyCases)("keeps exact legacy $event m bindings for an equal-performance newer record", async testCase => {
    const input = legacyFixture(testCase)
    input.record = { ...input.record, performanceSeconds: testCase.seconds }
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([input.record]))
    const plan = localStorage.getItem(activePlanBetaStorageKey()), history = localStorage.getItem(historyKey)
    const result = await prepareCurrentPaceUpdate(input.record)
    expect(result).toMatchObject({ kind: "blocked", reasonCode: "NO_PACE_CHANGE" })
    expect(result.excluded?.some(row => row.reasonCode === "NO_PACE_CHANGE")).toBe(true)
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(plan)
    expect(localStorage.getItem(historyKey)).toBe(history)
  })

  it.each([false, true])("does not refresh catalog provenance without a displayed pace change (legacy=%s)", async legacy => {
    const input = seeded(legacy), samePerformance = { ...record, performanceSeconds: oldRecord.performanceSeconds }
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([oldRecord, samePerformance]))
    const plan = localStorage.getItem(activePlanBetaStorageKey()), history = localStorage.getItem(historyKey)
    const writes = vi.spyOn(Storage.prototype, "setItem")
    const result = await prepareCurrentPaceUpdate(samePerformance)
    expect(result).toMatchObject({ kind: "blocked", reasonCode: "NO_PACE_CHANGE" })
    expect(result.excluded?.filter(row => row.reasonCode === "NO_PACE_CHANGE").map(row => row.day)).toEqual([4, 7])
    expect(input.state.activePlan.sessions).toEqual(JSON.parse(plan!).activePlan.sessions)
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(plan)
    expect(localStorage.getItem(historyKey)).toBe(history)
    expect(writes.mock.calls.filter(([key]) => key !== "__to_probe__")).toHaveLength(0)
  })

  it("does not propose a legacy target that rounds to the same displayed seconds", async () => {
    const input = legacyFixture(legacyCases[0])
    input.record = { ...input.record, performanceSeconds: legacyCases[0].seconds - 0.01 }
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([input.record]))
    expect(await prepareCurrentPaceUpdate(input.record)).toMatchObject({ kind: "blocked", reasonCode: "NO_PACE_CHANGE" })
  })

  it.each(legacyCases)("recomputes exact $event m targets and safely undoes them", async testCase => {
    const input = legacyFixture(testCase), result = await prepareCurrentPaceUpdate(input.record)
    if (result.kind !== "ready") throw Error(JSON.stringify(result))
    const originals = input.state.activePlan.sessions.filter(s => s.prescription.kind === "PACE_TARGET")
    expect(originals).toHaveLength(1)
    expect(result.proposal.after.activePlanEdit!.replacements?.map(s => s.day)).toEqual(originals.map(s => s.day))
    const original = originals[0]!, replacement = result.proposal.after.activePlanEdit!.replacements![0]!
    if (original.prescription.kind !== "PACE_TARGET" || replacement.prescription.kind !== "PACE_TARGET") throw Error("target")
    expect(replacement.prescription.targetRepSeconds).toBe(input.record.performanceSeconds * original.prescription.repetitionDistanceM / testCase.event)
    expect(replacement.prescription.totals).toEqual(original.prescription.totals)
    expect(replacement.prescription.operationalComponents).toEqual(original.prescription.operationalComponents)
    expect(replacement.prescription.notation).toBe(original.prescription.notation)
    expect(replacement.prescription.templateContentFingerprint).toBe(original.prescription.templateContentFingerprint)
    expect(replacement.prescription.repetitionRecoverySeconds).toBe(original.prescription.repetitionRecoverySeconds)
    const safety = evaluatePlanSafety("NO_KNOWN_RISK", new Date(now))
    if (safety.kind !== "passed") throw Error("safety")
    expect(preparePrescription(input.state.intake, safety.gate, { selectedRecordId: input.record.id }, new Date(now),
      input.state.intake.selectedDetailedTemplateRef)).toEqual({ kind: "prepared", prescription: replacement.prescription })
    expect(replayActivePlanEdit(result.proposal.after.activePlanEdit!)).toEqual(result.proposal.afterSessions)
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("applied")
    const undo = await prepareCurrentPaceUndo()
    if (undo.kind !== "ready") throw Error(JSON.stringify(undo))
    expect(undo.proposal.afterSessions).toEqual(input.state.activePlan.sessions)
    expect((await applyActivePlanEdit(undo.proposal, true)).kind).toBe("applied")
  })

  it.each(["stale", "event", "unverified"])("skips %s records without falling back to a different template", change => {
    const input = legacyFixture(legacyCases[0])
    input.record = { ...input.record, ...(change === "stale" ? { achievedOn: "2020-01-01" } : change === "event" ? { eventDistanceM: 1500 }
        : { verificationState: "UNVERIFIED" }) } as AthleteRecord
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([input.record]))
    expect(preparePacePlanUpdate(input).kind).toBe("blocked")
  })

  it.each(["volume", "recovery", "sequence", "evidence", "pace", "unverified"])("rejects legacy %s tampering during replay", change => {
    const proposal = ready(legacyFixture(legacyCases[0])), receipt = structuredClone(proposal.after.activePlanEdit!)
    const session = receipt.replacements![0]!
    if (session.prescription.kind !== "PACE_TARGET") throw Error("target")
    const p = session.prescription
    if (change === "volume") p.repetitionsPerSet += 1
    if (change === "recovery") p.repetitionRecoverySeconds! += 1
    if (change === "sequence") p.sequence = { ...p.sequence!, main: [] }
    if (change === "evidence") p.sourceEvidenceRef = "different-evidence"
    if (change === "pace") p.targetRepSeconds += 1
    if (change === "unverified") p.selectedAnchor.verificationState = "UNVERIFIED"
    const { prescriptionFingerprint: _fingerprint, ...content } = p
    p.prescriptionFingerprint = `canonical-json-v1:${JSON.stringify(content)}`
    expect(replayActivePlanEdit(receipt)).toBeNull()
  })

  it.each(["deleted", "version"])("restores legacy bindings exactly when the source is %s after undo preview", async change => {
    const input = legacyFixture(legacyCases[3]), forward = await prepareCurrentPaceUpdate(input.record)
    if (forward.kind !== "ready") throw Error("forward")
    expect((await applyActivePlanEdit(forward.proposal, true)).kind).toBe("applied")
    const undo = await prepareCurrentPaceUndo()
    if (undo.kind !== "ready") throw Error("undo")
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify(change === "deleted" ? [] : [input.record, { ...oldRecord, savedAt: now }]))
    const records = localStorage.getItem(activeAthleteRecordsStorageKey())
    const writes = vi.spyOn(Storage.prototype, "setItem")
    expect((await applyActivePlanEdit(undo.proposal, true)).kind).toBe("applied")
    expect(writes.mock.calls.filter(([k]) => k === activePlanBetaStorageKey())).toHaveLength(1)
    expect(loadVersionedPlanBetaState()?.activePlan.sessions).toEqual(input.state.activePlan.sessions)
    expect(localStorage.getItem(activeAthleteRecordsStorageKey())).toBe(records)
  })

  it("keeps the optional server revision guard distinct from source savedAt", () => {
    const input = fixture(), paceRecordGuard = { documentId: "00000000-0000-4000-8000-000000000001", revision: 3 }
    const result = preparePacePlanUpdate({ ...input, paceRecordGuard })
    if (result.kind !== "ready") throw Error("guard")
    const receipt = result.proposal.after.activePlanEdit!
    expect(receipt.paceRecordGuard).toEqual(paceRecordGuard)
    expect(activePlanEditReceiptSchema.safeParse({ ...receipt, paceRecordGuard: { ...paceRecordGuard, revision: now } }).success).toBe(false)
    expect(activePlanEditReceiptSchema.safeParse({ ...receipt, paceRecordGuard: { ...paceRecordGuard, revision: 0 } }).success).toBe(false)
  })
})

describe("confirmed account pace collection guard", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(now)) })
  function online(ownerId = "00000000-0000-4000-8000-000000000002", input = seeded()) {
    const read = loadEntriesForPlanSafety()
    setActiveLocalAccount(ownerId)
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([oldRecord, record]))
    vi.mocked(accountPlansEnabled).mockReturnValue(true)
    vi.spyOn(accountPlanDomain, "ensureAccountPlanHistory").mockResolvedValue(true)
    vi.spyOn(planStore, "loadVersionedPlanBetaState").mockReturnValue(input.state)
    vi.spyOn(journals, "loadEntriesForPlanSafety").mockReturnValue(read)
    vi.spyOn(accountJournals, "currentConfirmedAccountJournalVersions").mockReturnValue([])
    const server: accountPaceRecords.AccountAthleteRecordsState = { status: "READY", ownerId,
      documentId: "00000000-0000-4000-8000-000000000001", serverRevision: 3, records: [oldRecord, record], confirmed: true }
    vi.spyOn(accountPaceRecords, "loadAccountAthleteRecords").mockImplementation(async () => structuredClone(server))
    vi.spyOn(accountPaceRecords, "readAccountAthleteRecordsState").mockImplementation(() => structuredClone(server))
    vi.spyOn(accountPaceRecords, "getConfirmedAccountAthleteRecordSnapshot").mockImplementation(recordId =>
      server.status === "READY" && server.confirmed && server.records.some(r => r.id === recordId)
        ? { documentId: server.documentId!, serverRevision: server.serverRevision!, recordId } : null)
    return { input, server }
  }

  async function collection(input?: ReturnType<typeof fixture>) {
    vi.stubGlobal("crypto", webcrypto)
    vi.spyOn(accountJournalApi, "requestAccountDocument").mockResolvedValue({ ok: true, data: { kind: "athlete-record-support", version: 1 } })
    const context = online(COLLECTION_OWNER, input), document = emptyAccountPlanDocument()
    const entry = accountPlanEntry({ state: context.input.state, evidence: null }, now)
    document.data.plans = [entry]; document.data.currentPlanId = entry.planId
    const remote = collectionServer(document), buffers = collectionMemoryBuffers()
    const service = createAccountPlanCollectionService({ ownerId: COLLECTION_OWNER, isCurrent: () => true,
      client: remote.client, buffers: buffers.dependencies, legacyBuffer: buffers.legacy.buffer,
      runExclusive: async run => run(), yieldTask: async () => {}, now: () => now })
    vi.spyOn(accountPlanServices, "accountPlanService").mockReturnValue(service)
    expect(await service.hydrate()).toBe(true)
    expect(await service.loadHistory()).toBe(true)
    vi.mocked(planStore.loadVersionedPlanBetaState).mockImplementation(() => {
      const current = service.snapshot().currentPlan
      return current?.kind === "read_only" && current.packet.state.version === 3 ? current.packet.state : null
    })
    return { ...context, remote, service }
  }

  it.each(["catalog", "legacy"] as const)("applies a same-ID confirmed server edit to %s without overwriting the older local record", async kind => {
    const input = kind === "legacy" ? legacyFixture(legacyCases[3]) : seeded()
    const { server, remote, service } = await collection(input)
    try {
      const edited = { ...oldRecord, performanceSeconds: 1100, achievedOn: record.achievedOn, savedAt: now }
      server.records = [edited]; server.serverRevision = 4
      localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([oldRecord]))
      const cache = localStorage.getItem(activeAthleteRecordsStorageKey())
      const writes = vi.spyOn(Storage.prototype, "setItem")
      const prepared = await prepareCurrentPaceUpdate(edited)
      if (prepared.kind !== "ready") throw Error(JSON.stringify(prepared))
      expect(prepared.proposal.paceSourceRecord).toEqual(edited)
      expect(prepared.proposal.after.activePlanEdit?.paceRecordGuard?.revision).toBe(4)
      const replacement = prepared.proposal.after.activePlanEdit!.replacements![0]!
      if (replacement.prescription.kind === "PACE_TARGET") {
        expect(replacement.prescription.selectedAnchor.performanceSeconds).toBe(edited.performanceSeconds)
        expect(replacement.prescription.targetRepSeconds).toBe(edited.performanceSeconds * replacement.prescription.repetitionDistanceM / edited.eventDistanceM)
      } else expect(binding(replacement).inputs.paceReferences?.[0]?.recordVersion).toBe(now)
      expect((await applyActivePlanEdit(prepared.proposal, true)).kind).toBe("applied")
      expect(remote.commits).toHaveLength(1)
      expect(localStorage.getItem(activeAthleteRecordsStorageKey())).toBe(cache)
      expect(writes.mock.calls.filter(([key]) => key === activeAthleteRecordsStorageKey())).toHaveLength(0)
    } finally { service.close(); vi.unstubAllGlobals() }
  }, 30_000)

  it.each(["catalog", "legacy"] as const)("keeps guest %s updates blocked against a different local version of the same record", async kind => {
    const input = kind === "legacy" ? legacyFixture(legacyCases[3]) : seeded()
    const edited = { ...oldRecord, performanceSeconds: 1100, achievedOn: record.achievedOn, savedAt: now }
    localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([oldRecord]))
    const cache = localStorage.getItem(activeAthleteRecordsStorageKey()), history = localStorage.getItem(historyKey)
    const prepared = await prepareCurrentPaceUpdate(edited)
    if (kind === "legacy") expect(prepared.kind).toBe("blocked")
    else {
      if (prepared.kind !== "ready") throw Error(JSON.stringify(prepared))
      expect((await applyActivePlanEdit(prepared.proposal, true)).kind).toBe("blocked")
    }
    expect(loadVersionedPlanBetaState()?.activePlan.sessions).toEqual(input.state.activePlan.sessions)
    expect(localStorage.getItem(activeAthleteRecordsStorageKey())).toBe(cache)
    expect(localStorage.getItem(historyKey)).toBe(history)
  })

  it("commits one guarded batch and restores exact snapshots online after records are deleted", async () => {
    const { input, server, remote, service } = await collection()
    try {
      const prepared = await prepareCurrentPaceUpdate(record)
      if (prepared.kind !== "ready") throw Error(JSON.stringify(prepared))
      expect(await applyActivePlanEdit(prepared.proposal, true)).toMatchObject({ kind: "applied" })
      expect(remote.commits).toHaveLength(1)
      expect(remote.commits[0]!.journalGuard).toEqual([])
      const current = loadVersionedPlanBetaState()
      expect(current?.version === 3 && current.activePlanEdit?.paceRecordGuard).toEqual({ documentId: server.documentId, revision: 3 })
      expect(service.snapshot().document?.data.plans).toHaveLength(2)
      const original = service.snapshot().document?.data.plans.find(p => p.snapshot.state.version === 3
        && p.snapshot.state.activePlan.candidateId === input.state.activePlan.candidateId)?.snapshot.state
      expect(original?.version === 3 && original.activePlan.sessions).toEqual(input.state.activePlan.sessions)
      server.status = "DELETED"; server.confirmed = false; server.records = []
      localStorage.removeItem(activeAthleteRecordsStorageKey())
      vi.mocked(accountPaceRecords.loadAccountAthleteRecords).mockClear()
      const undo = await prepareCurrentPaceUndo()
      if (undo.kind !== "ready") throw Error(JSON.stringify(undo))
      expect(await applyActivePlanEdit(undo.proposal, true)).toMatchObject({ kind: "applied" })
      expect(remote.commits).toHaveLength(2)
      const restored = loadVersionedPlanBetaState()
      expect(restored?.activePlan.sessions).toEqual(input.state.activePlan.sessions)
      expect(restored?.version === 3 && restored.activePlanEdit).not.toHaveProperty("paceRecordGuard")
      expect(accountPaceRecords.loadAccountAthleteRecords).not.toHaveBeenCalled()
      expect(accountJournalApi.requestAccountDocument).toHaveBeenCalledTimes(2)
      expect(vi.mocked(accountJournalApi.requestAccountDocument).mock.calls.every(call => call[1].action === "athleteRecordSupport")).toBe(true)
      expect(service.snapshot().document?.data.plans).toHaveLength(3)
    } finally { service.close(); vi.unstubAllGlobals() }
  }, 30_000)

  it.each(["unsupported", "unavailable", "scope changed"])("does not stage a batch when transaction support is %s", async failure => {
    const { input, remote, service } = await collection()
    try {
      const prepared = await prepareCurrentPaceUpdate(record)
      if (prepared.kind !== "ready") throw Error(JSON.stringify(prepared))
      if (failure === "unsupported") vi.mocked(accountJournalApi.requestAccountDocument).mockResolvedValue({ ok: false, code: "ATHLETE_RECORD_UNSUPPORTED" })
      if (failure === "unavailable") vi.mocked(accountJournalApi.requestAccountDocument).mockRejectedValue(Error("offline"))
      if (failure === "scope changed") vi.mocked(accountJournalApi.requestAccountDocument).mockImplementation(async () => {
        setActiveLocalAccount(null)
        return { ok: true, data: { kind: "athlete-record-support", version: 1 } }
      })
      expect((await applyActivePlanEdit(prepared.proposal, true)).kind).toBe("blocked")
      expect(remote.client.stage).not.toHaveBeenCalled()
      expect(remote.commits).toHaveLength(0)
      expect(loadVersionedPlanBetaState()?.activePlan.sessions).toEqual(input.state.activePlan.sessions)
    } finally { service.close(); vi.unstubAllGlobals() }
  })

  it("rejects source revision drift during collection staging before committing any slots", async () => {
    const { input, server, remote, service } = await collection()
    try {
      const prepared = await prepareCurrentPaceUpdate(record)
      if (prepared.kind !== "ready") throw Error(JSON.stringify(prepared))
      const stage = vi.mocked(remote.client.stage).getMockImplementation()!
      vi.spyOn(remote.client, "stage").mockImplementation(async (...args) => { await stage(...args); server.serverRevision = 4 })
      // The durable collection outbox remains pending; no slot was committed.
      expect((await applyActivePlanEdit(prepared.proposal, true)).kind).toBe("uncertain")
      expect(service.snapshot().status).toBe("PENDING")
      expect(remote.client.stage).toHaveBeenCalled()
      expect(remote.commits).toHaveLength(0)
      expect(remote.revision()).toBe(1)
      expect(loadVersionedPlanBetaState()?.activePlan.sessions).toEqual(input.state.activePlan.sessions)
    } finally { service.close(); vi.unstubAllGlobals() }
  })

  it("excludes a new journal slot from online undo while restoring the other original binding", async () => {
    const { input, server, remote, service } = await collection()
    try {
      const forward = await prepareCurrentPaceUpdate(record)
      if (forward.kind !== "ready") throw Error(JSON.stringify(forward))
      expect((await applyActivePlanEdit(forward.proposal, true)).kind).toBe("applied")
      const entry = journal(forward.proposal.after)
      vi.mocked(journals.loadEntriesForPlanSafety).mockReturnValue({ status: "complete", entries: [entry] })
      vi.mocked(accountJournals.currentConfirmedAccountJournalVersions).mockReturnValue([{ entryId: entry.id, revision: 1 }])
      server.status = "DELETED"; server.confirmed = false; server.records = []
      localStorage.removeItem(activeAthleteRecordsStorageKey())
      const undo = await prepareCurrentPaceUndo()
      if (undo.kind !== "ready") throw Error(JSON.stringify(undo))
      expect(undo.excluded?.some(s => s.day === 4)).toBe(true)
      expect(undo.proposal.after.activePlanEdit?.replacements?.map(s => s.day)).toEqual([7])
      expect((await applyActivePlanEdit(undo.proposal, true)).kind).toBe("applied")
      expect(remote.commits).toHaveLength(2)
      const sessions = loadVersionedPlanBetaState()?.activePlan.sessions
      expect(sessions?.find(s => s.day === 4)).toEqual(forward.proposal.afterSessions.find(s => s.day === 4))
      expect(sessions?.find(s => s.day === 7)).toEqual(input.state.activePlan.sessions.find(s => s.day === 7))
    } finally { service.close(); vi.unstubAllGlobals() }
  }, 30_000)

  it.each(["conflict", "lost acknowledgement"])("never falls back to local plan writes after a collection %s", async failure => {
    const { input, remote, service } = await collection()
    try {
      const prepared = await prepareCurrentPaceUpdate(record)
      if (prepared.kind !== "ready") throw Error(JSON.stringify(prepared))
      if (failure === "conflict") vi.spyOn(remote.client, "commit").mockResolvedValue({ kind: "conflict" })
      else remote.loseResponse()
      const writes = vi.spyOn(Storage.prototype, "setItem")
      expect((await applyActivePlanEdit(prepared.proposal, true)).kind).toBe(failure === "conflict" ? "blocked" : "uncertain")
      expect(remote.client.commit).toHaveBeenCalledOnce()
      expect(writes.mock.calls.filter(([key]) => key === activePlanBetaStorageKey() || key.endsWith(historyKey))).toHaveLength(0)
      expect(loadVersionedPlanBetaState()?.activePlan.sessions).toEqual(input.state.activePlan.sessions)
    } finally { service.close(); vi.unstubAllGlobals() }
  })

  it("captures only the confirmed collection revision, never the source savedAt", async () => {
    const { server } = online(), result = await prepareCurrentPaceUpdate(record)
    if (result.kind !== "ready") throw Error(JSON.stringify(result))
    expect(accountPaceRecords.loadAccountAthleteRecords).toHaveBeenCalledOnce()
    expect(result.proposal.after.activePlanEdit!.paceRecordGuard).toEqual({ documentId: server.documentId, revision: 3 })
    expect(result.proposal.paceSourceRecord?.savedAt).toBe(now)
  })

  it.each(["PENDING", "FAILED", "DELETED"] as const)("does not fetch or require %s athlete records for an exact account undo", async status => {
    const { input, server } = online(), forward = ready(input)
    vi.mocked(planStore.loadVersionedPlanBetaState).mockReturnValue(forward.after)
    localStorage.removeItem(activeAthleteRecordsStorageKey())
    server.status = status; server.confirmed = false; server.records = []
    const result = await prepareCurrentPaceUndo()
    if (result.kind !== "ready") throw Error(JSON.stringify(result))
    expect(result.proposal.afterSessions).toEqual(input.state.activePlan.sessions)
    expect(result.proposal.after.activePlanEdit).not.toHaveProperty("paceRecordGuard")
    // Account application remains separately gated by collection transaction support.
    await applyActivePlanEdit(result.proposal, true)
    expect(accountPaceRecords.loadAccountAthleteRecords).not.toHaveBeenCalled()
    expect(accountPaceRecords.readAccountAthleteRecordsState).not.toHaveBeenCalled()
    expect(accountPaceRecords.getConfirmedAccountAthleteRecordSnapshot).not.toHaveBeenCalled()
  })

  it.each(["PENDING", "CONFLICT", "FAILED", "DELETED"] as const)("does not prepare from %s records even when a local snapshot exists", async status => {
    const { server } = online()
    server.status = status; server.confirmed = false
    const writes = vi.spyOn(Storage.prototype, "setItem")
    expect((await prepareCurrentPaceUpdate(record)).kind).toBe("blocked")
    expect(writes).not.toHaveBeenCalled()
  })

  it.each(["revision", "document", "source", "deleted", "owner", "pending"])("refreshes and rejects %s drift before account writes", async change => {
    const { server } = online(), result = await prepareCurrentPaceUpdate(record)
    if (result.kind !== "ready") throw Error(JSON.stringify(result))
    if (change === "revision") server.serverRevision = 4
    if (change === "document") server.documentId = "00000000-0000-4000-8000-000000000003"
    if (change === "source") server.records = [oldRecord, { ...record, performanceSeconds: 1000 }]
    if (change === "deleted") server.records = [oldRecord]
    if (change === "owner") server.ownerId = "different-owner"
    if (change === "pending") { server.status = "PENDING"; server.confirmed = false }
    const write = vi.spyOn(accountPlanDomain, "captureAccountPlanWrite"), writes = vi.spyOn(Storage.prototype, "setItem")
    expect((await applyActivePlanEdit(result.proposal, true)).kind).toBe("blocked")
    expect(accountPaceRecords.loadAccountAthleteRecords).toHaveBeenCalledTimes(2)
    expect(write).not.toHaveBeenCalled()
    expect(writes).not.toHaveBeenCalled()
  })
})
