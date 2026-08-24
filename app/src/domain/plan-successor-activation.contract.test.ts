import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  acceptPreparedNextFrameAdaptation,
  evaluateActivePlanAdaptationSafety,
  prepareNextFrameAdaptation,
  savePlanAdaptationContext,
} from "./plan-adaptation-ui"
import {
  savePlanBetaState,
} from "./plan-beta-store"
import {
  activateAcceptedNextFrameSuccessor,
  PLAN_BETA_MUTATION_LOCK_NAME,
  PLAN_SUCCESSOR_ACTIVATION_RECEIPT_STORAGE_KEY,
} from "./plan-successor-activation"
import {
  generatePlanFromDraft,
  selectPlanForActivation,
} from "./plan-beta-flow"
import {
  planAdaptationProposalSchema,
  planBetaStateV3Schema,
  type PlanBetaStateV3,
} from "./plan-beta-schema"
import {
  ATHLETE_RECORDS_STORAGE_KEY,
  createSelfReportedAthleteRecord,
  saveAthleteRecord,
} from "./athlete-records"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"

const ACTIVE_KEY = "trainoracle.plan-beta.v1"
const HISTORY_KEY = "trainoracle.plan-beta.history.v1"
const PENDING_KEY = "trainoracle.plan-beta.adaptation.v1"
const CONTEXT_KEY = "trainoracle.plan-adaptation-context.v1"
const PREVIOUS_INTAKE_KEY = "trainoracle.plan-beta.previous-intake.v1"
const ACTIVATED_AT = "2026-08-24T09:00:00.000Z"
const LOCAL_DATE = "2026-08-24"
const APPROVAL_5000 = approved5000Template()

function approved5000Template() {
  const approval = DETAILED_PRESCRIPTION_APPROVALS.find(
    (candidate) => candidate.targetEventDistanceM === 5000,
  )
  if (approval === undefined) throw new TypeError("Expected approved 5000m template")
  return approval
}

type LocksDescriptor = PropertyDescriptor | undefined
let locksDescriptor: LocksDescriptor

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(ACTIVATED_AT))
  window.localStorage.clear()
  window.sessionStorage.clear()
  locksDescriptor = installAvailableLock()
})

afterEach(() => {
  restoreLocks(locksDescriptor)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("accepted successor activation", () => {
  it.each([7, 9, 10] as const)("activates a completed %s-day projection exactly once", async (projectionLength) => {
    const fixture = await acceptedFixture(projectionLength, true)
    const before = storageSnapshot()

    const result = await activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: ACTIVATED_AT,
      localDate: LOCAL_DATE,
    })

    expect(result.kind).toBe("activated")
    if (result.kind !== "activated") return
    expect(result.state.generatedAt).toBe(ACTIVATED_AT)
    expect(result.state.intake.startDate).toBe(LOCAL_DATE)
    expect(result.state.progress).toStrictEqual([])
    expect(result.state.activePlan.candidateId).toBe(fixture.successorCandidateId)
    expect(window.localStorage.getItem(PENDING_KEY)).toBeNull()
    expect(window.localStorage.getItem(PLAN_SUCCESSOR_ACTIVATION_RECEIPT_STORAGE_KEY)).not.toBeNull()
    expect(window.sessionStorage.getItem(PREVIOUS_INTAKE_KEY)).toBe(before.activeIntake)
    expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]")).toHaveLength(1)
    expect(JSON.parse(window.localStorage.getItem(CONTEXT_KEY) ?? "{}").activeCandidateId)
      .toBe(fixture.successorCandidateId)

    const afterFirst = storageSnapshot()
    const retry = await activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: ACTIVATED_AT,
      localDate: LOCAL_DATE,
    })
    expect(retry).toMatchObject({ kind: "already_consumed" })
    expect(storageSnapshot()).toStrictEqual(afterFirst)
  })

  it("activates a completed plan with an approved detailed 5000m prescription", async () => {
    const fixture = await acceptedFixture(9, true, true)

    const result = await activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: ACTIVATED_AT,
      localDate: LOCAL_DATE,
    })

    expect(result.kind).toBe("activated")
    if (result.kind !== "activated") return
    expect(result.state.activePlan.candidateId).toBe(fixture.successorCandidateId)
    expect(result.state.activePlan.sessions.some((session) => (
      session.prescription.kind === "PACE_TARGET"
    ))).toBe(true)
  })

  it("rejects activation when the PB/SB performance changes after acceptance", async () => {
    const fixture = await acceptedFixture(9, true, false, true)
    const raw = window.localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY)
    if (raw === null || fixture.triggerRecordId === undefined) throw new TypeError("Expected a stored PB trigger")
    const records = JSON.parse(raw) as Array<Record<string, unknown>>
    const mutated = records.map((record) => record.id === fixture.triggerRecordId
      ? { ...record, performanceSeconds: Number(record.performanceSeconds) - 1 }
      : record)
    window.localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, JSON.stringify(mutated))

    await expect(activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: ACTIVATED_AT,
      localDate: LOCAL_DATE,
    })).resolves.toEqual({ kind: "rejected", code: "RECORD_SNAPSHOT_MISMATCH" })
  })

  it("activates a replacement successor after terminal progress changes", async () => {
    const fixture = await acceptedFixture(9, true, true)
    const first = fixture.state.progress[0]
    if (first === undefined) throw new TypeError("Expected visible terminal progress")
    const changedState: PlanBetaStateV3 = {
      ...fixture.state,
      progress: [{ ...first, state: "RESTED" }, ...fixture.state.progress.slice(1)],
    }
    expect(savePlanBetaState(changedState)).toEqual({ ok: true })

    const operationAt = "2026-08-24T09:00:01.000Z"
    const safety = evaluateActivePlanAdaptationSafety(
      changedState,
      "NO_KNOWN_RISK",
      new Date(operationAt),
    )
    if (safety.kind !== "evaluated") throw new TypeError("Expected fresh passed safety")
    const prepared = await prepareNextFrameAdaptation({
      state: changedState,
      reason: "EXPLICIT_REQUEST",
      record: null,
      safety,
      operationAt,
    })
    if (prepared.kind !== "ready") throw new TypeError(`Expected replacement successor, got ${prepared.code}`)
    await expect(acceptPreparedNextFrameAdaptation({
      prepared: prepared.prepared,
      predecessorState: changedState,
      safety,
      operationAt,
    })).resolves.toMatchObject({ kind: "accepted", replay: false })

    const result = await activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: "2026-08-24T09:00:02.000Z",
      localDate: LOCAL_DATE,
    })
    expect(result.kind).toBe("activated")
  })

  it("rejects a predecessor before all visible non-rest sessions are terminal", async () => {
    const fixture = await acceptedFixture(9, false)
    const before = storageSnapshot()

    await expect(activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: ACTIVATED_AT,
      localDate: LOCAL_DATE,
    })).resolves.toEqual({ kind: "blocked", code: "INCOMPLETE_FRAME" })
    expect(storageSnapshot()).toStrictEqual(before)
  })

  it("rejects unavailable locks without touching storage", async () => {
    const fixture = await acceptedFixture(9, true)
    const before = storageSnapshot()
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined })

    try {
      await expect(activateAcceptedNextFrameSuccessor({
        currentCheck: "NO_KNOWN_RISK",
        activatedAt: ACTIVATED_AT,
        localDate: LOCAL_DATE,
      })).resolves.toEqual({ kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" })
      expect(storageSnapshot()).toStrictEqual(before)
    } finally {
      restoreLocks(descriptor)
    }
  })

  it("rejects an unavailable Web Lock without touching storage", async () => {
    const fixture = await acceptedFixture(9, true)
    const before = storageSnapshot()
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: async (_name: string, _options: unknown, callback: (lock: null) => unknown) => callback(null) },
    })

    try {
      await expect(activateAcceptedNextFrameSuccessor({
        currentCheck: "NO_KNOWN_RISK",
        activatedAt: ACTIVATED_AT,
        localDate: LOCAL_DATE,
      })).resolves.toEqual({ kind: "rejected", code: "MUTATION_LOCK_UNAVAILABLE" })
      expect(storageSnapshot()).toStrictEqual(before)
    } finally {
      restoreLocks(descriptor)
    }
  })

  it("rejects malformed pending bytes without touching active state", async () => {
    const fixture = await acceptedFixture(9, true)
    const before = storageSnapshot()
    window.localStorage.setItem(PENDING_KEY, "{")

    await expect(activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: ACTIVATED_AT,
      localDate: LOCAL_DATE,
    })).resolves.toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(before.active)
    expect(window.localStorage.getItem(PENDING_KEY)).toBe("{")
  })

  it("rejects a stale predecessor hash without changing any stored bytes", async () => {
    const fixture = await acceptedFixture(9, true)
    const raw = window.localStorage.getItem(ACTIVE_KEY)
    if (raw === null) throw new Error("Expected active plan bytes")
    const stale = { ...JSON.parse(raw), generatedAt: "2026-08-16T00:00:00.000Z" }
    window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(stale))
    const before = storageSnapshot()

    await expect(activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: ACTIVATED_AT,
      localDate: LOCAL_DATE,
    })).resolves.toEqual({ kind: "rejected", code: "PENDING_ENVELOPE_MISMATCH" })
    expect(storageSnapshot()).toStrictEqual(before)
  })

  it("rejects fresh D9/hold failures with zero net writes", async () => {
    const fixture = await acceptedFixture(9, true)
    const before = storageSnapshot()
    await expect(activateAcceptedNextFrameSuccessor({
      currentCheck: "REVIEW_REQUIRED",
      activatedAt: ACTIVATED_AT,
      localDate: LOCAL_DATE,
    })).resolves.toEqual({ kind: "blocked", code: "SAFETY_BLOCKED" })
    expect(storageSnapshot()).toStrictEqual(before)
  })

  it("rejects a fresh pain hold before it can consume the pending successor", async () => {
    const fixture = await acceptedFixture(9, true)
    const first = fixture.state.progress[0]
    if (first === undefined) throw new Error("Expected completed progress")
    const heldState: PlanBetaStateV3 = {
      ...fixture.state,
      progress: [{ ...first, state: "PAIN_CHECKIN" }, ...fixture.state.progress.slice(1)],
    }
    window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(heldState))
    const before = storageSnapshot()

    await expect(activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: ACTIVATED_AT,
      localDate: LOCAL_DATE,
    })).resolves.toEqual({ kind: "blocked", code: "ACTIVE_HOLD" })
    expect(storageSnapshot()).toStrictEqual(before)
  })

  it("restores byte-identical storage when every transaction stage silently drops once", async () => {
    for (const target of [HISTORY_KEY, PREVIOUS_INTAKE_KEY, CONTEXT_KEY, ACTIVE_KEY, PLAN_SUCCESSOR_ACTIVATION_RECEIPT_STORAGE_KEY, PENDING_KEY]) {
      window.localStorage.clear()
      window.sessionStorage.clear()
      const fixture = await acceptedFixture(9, true)
      const before = storageSnapshot()
      let dropped = false
      const realSetItem = Storage.prototype.setItem
      const realRemoveItem = Storage.prototype.removeItem
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
        if (!dropped && key === target) {
          dropped = true
          return
        }
        return realSetItem.call(this, key, value)
      })
      const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
        if (!dropped && key === target) {
          dropped = true
          return
        }
        return realRemoveItem.call(this, key)
      })

      const result = await activateAcceptedNextFrameSuccessor({
        currentCheck: "NO_KNOWN_RISK",
        activatedAt: ACTIVATED_AT,
        localDate: LOCAL_DATE,
      })
      expect(result).toMatchObject({
        kind: "failed",
        code: "ACTIVATION_STORAGE_WRITE_FAILED",
        rollbackComplete: true,
      })
      expect(storageSnapshot()).toStrictEqual(before)
      setItem.mockRestore()
      removeItem.mockRestore()
    }
  })

  it("rejects a caller-supplied future local date and extra input fields", async () => {
    await acceptedFixture(9, false)
    const before = storageSnapshot()

    await expect(activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: ACTIVATED_AT,
      localDate: "2026-09-30",
    })).resolves.toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    await expect(activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: ACTIVATED_AT,
      localDate: LOCAL_DATE,
      injected: true,
    } as never)).resolves.toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(storageSnapshot()).toStrictEqual(before)
  })

  it("rejects an activation timestamp beyond the allowed runtime clock skew", async () => {
    await acceptedFixture(9, false)
    const before = storageSnapshot()
    const tooFarInFuture = new Date(Date.parse(ACTIVATED_AT) + (5 * 60 * 1000) + 1).toISOString()

    await expect(activateAcceptedNextFrameSuccessor({
      currentCheck: "NO_KNOWN_RISK",
      activatedAt: tooFarInFuture,
      localDate: LOCAL_DATE,
    })).resolves.toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(storageSnapshot()).toStrictEqual(before)
  })
})

async function acceptedFixture(
  projectionLength: 7 | 9 | 10,
  complete: boolean,
  withDetailedPrescription = false,
  withPbTrigger = false,
) {
  const selectedDetailedTemplateRef = withDetailedPrescription ? {
    templateId: APPROVAL_5000.templateId,
    version: APPROVAL_5000.templateVersion,
    fingerprint: APPROVAL_5000.templateContentFingerprint,
  } : null
  let selectedRecordId: string | undefined
  if (withDetailedPrescription) {
    const record = createSelfReportedAthleteRecord({
      id: "00000000-0000-4000-8000-000000005001",
      purpose: "PERSONAL_BEST",
      eventDistanceM: 5000,
      performanceSeconds: 1_110,
      achievedOn: "2026-08-10",
      seasonId: null,
    }, new Date(ACTIVATED_AT))
    if (record === null) throw new TypeError("Expected valid 5000m record")
    expect(saveAthleteRecord(record, new Date(ACTIVATED_AT))).toEqual({ ok: true, total: 1 })
    selectedRecordId = record.id
  }
  const generated = generatePlanFromDraft({
    eventGroup: "FIVE_K",
    eventDistanceM: 5000,
    competitionDivision: "OPEN",
    experienceBand: withDetailedPrescription ? "EXPERIENCED" : "DEVELOPING",
    availableDayCount: 5,
    requestedFrameLength: projectionLength,
    trainingFocus: "VO2_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "VARIES",
    selectedDetailedTemplateRef,
  }, "NO_KNOWN_RISK", selectedRecordId === undefined ? undefined : { selectedRecordId })
  if (generated.kind !== "generated") throw new Error(`Expected generated plan, got ${generated.kind}`)
  const base = generated.generated.candidates[withPbTrigger ? 1 : 0]
  if (base === undefined) throw new Error("Expected a base candidate")
  const selected = selectPlanForActivation(
    base.candidateId,
    generated.generated,
    generated.gate,
    generated.intake,
    generated.athleteEvidence,
  )
  if (selected.kind !== "selected" || selected.state.version !== 3) throw new Error("Expected a v3 selected plan")
  const scoped: PlanBetaStateV3 = {
    ...selected.state,
    intake: { ...selected.state.intake, startDate: LOCAL_DATE },
    generatedAt: "2026-08-15T00:00:00.000Z",
    adaptationScope: {
      athleteId: "local-athlete",
      eventDistanceM: 5000,
      pairId: base.pairId,
      selectedDetailedTemplateRef,
    },
  }
  const state = complete ? {
    ...scoped,
    progress: scoped.activePlan.sessions
      .filter((session) => session.day <= projectionLength && session.role !== "REST")
      .map((session) => ({ sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED" as const })),
  } : scoped
  expect(savePlanBetaState(state)).toEqual({ ok: true })
  expect(savePlanAdaptationContext(
    generated.generated.candidates as [typeof generated.generated.candidates[0], typeof generated.generated.candidates[1]],
    state.activePlan.candidateId,
  )).toEqual({ ok: true })

  const triggerRecord = withPbTrigger ? createSelfReportedAthleteRecord({
    id: "00000000-0000-4000-8000-000000005099",
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1_100,
    achievedOn: "2026-08-20",
    seasonId: null,
  }, new Date(ACTIVATED_AT)) : null
  if (withPbTrigger && triggerRecord === null) throw new TypeError("Expected a valid PB trigger")
  if (triggerRecord !== null) expect(saveAthleteRecord(triggerRecord, new Date(ACTIVATED_AT)).ok).toBe(true)

  const safety = evaluateActivePlanAdaptationSafety(state, "NO_KNOWN_RISK", new Date(ACTIVATED_AT))
  if (safety.kind !== "evaluated") throw new Error("Expected fresh passed safety")
  const prepared = await prepareNextFrameAdaptation({
    state,
    reason: withPbTrigger ? "PB_SB" : "EXPLICIT_REQUEST",
    record: triggerRecord,
    safety,
    operationAt: ACTIVATED_AT,
  })
  if (prepared.kind !== "ready") throw new Error(`Expected a prepared successor, got ${prepared.code}`)
  const proposalParsed = planAdaptationProposalSchema.safeParse(prepared.prepared.proposal)
  if (!proposalParsed.success) throw new Error(`Invalid prepared proposal: ${JSON.stringify(proposalParsed.error.issues)}`)
  const successorParsed = planBetaStateV3Schema.safeParse(prepared.prepared.successorState)
  if (!successorParsed.success) throw new Error(`Invalid successor state: ${JSON.stringify(successorParsed.error.issues)}`)
  const accepted = await acceptPreparedNextFrameAdaptation({
    prepared: prepared.prepared,
    predecessorState: state,
    safety,
    operationAt: ACTIVATED_AT,
  })
  if (accepted.kind !== "accepted") throw new Error(`Expected accepted successor, got ${JSON.stringify(accepted)}`)
  return {
    state,
    safety,
    successorCandidateId: prepared.prepared.successorState.activePlan.candidateId,
    triggerRecordId: triggerRecord?.id,
  }
}

function storageSnapshot() {
  return {
    active: window.localStorage.getItem(ACTIVE_KEY),
    history: window.localStorage.getItem(HISTORY_KEY),
    pending: window.localStorage.getItem(PENDING_KEY),
    context: window.localStorage.getItem(CONTEXT_KEY),
    receipt: window.localStorage.getItem(PLAN_SUCCESSOR_ACTIVATION_RECEIPT_STORAGE_KEY),
    previousIntake: window.sessionStorage.getItem(PREVIOUS_INTAKE_KEY),
    activeIntake: window.localStorage.getItem(ACTIVE_KEY) === null
      ? null
      : JSON.stringify(JSON.parse(window.localStorage.getItem(ACTIVE_KEY) ?? "{}").intake),
  }
}

function installAvailableLock(): LocksDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
        expect(name).toBe(PLAN_BETA_MUTATION_LOCK_NAME)
        return callback({})
      },
    },
  })
  return descriptor
}

function restoreLocks(descriptor: LocksDescriptor): void {
  if (descriptor === undefined) Reflect.deleteProperty(navigator, "locks")
  else Object.defineProperty(navigator, "locks", descriptor)
}
