import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  canonicalJsonSha256,
  createPlanAdaptationProposal,
  hashPlanCandidate,
} from "@impl/plan-generator/adaptation"
import { generatePlanCandidates } from "@impl/plan-generator/generator"
import { selectPlanCandidate } from "@impl/plan-generator/selection"
import { RVE_NON_SENSITIVE_REASON_CODES } from "@impl/rve/signal"
import {
  activeGate,
  clearedGate,
  expectGenerated,
} from "../../../impl/test/fixtures/plan-beta-request"
import { canonicalFormation } from "../../../impl/test/fixtures/canonical-formation"
import {
  acceptNextFrameProposal,
  loadPendingNextFrameSuccessor,
} from "./plan-adaptation-store"
import { savePlanBetaState } from "./plan-beta-store"
import type { PlanBetaStateV3 } from "./plan-beta-schema"
import { planAdaptationEnvelopeSchema } from "./plan-beta-schema"
import { PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"

const ACTIVE_KEY = "trainoracle.plan-beta.v1"
const ADAPTATION_KEY = "trainoracle.plan-beta.adaptation.v1"
let locksDescriptor: PropertyDescriptor | undefined

async function requestFixture(
  selectedEnergyIntent: "LT_INTENT" | "VO2_INTENT" = "LT_INTENT",
  fixtureId = "1",
) {
  const gate = clearedGate()
  const generated = expectGenerated(generatePlanCandidates({
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate: gate,
    profile: {
      eventGroup: "MIDDLE_DISTANCE",
      eventDistanceM: 1500,
      experienceBand: "DEVELOPING",
      availableTrainingDays: [1, 3, 5, 7, 9],
    },
    formation: canonicalFormation([3, 7]),
    journalSource: { kind: "NO_USABLE_JOURNAL" },
    selectionAuthority: "SELF",
    selectedEnergyIntent,
  }))
  const [baseCandidate, successorCandidate] = generated.candidates
  const proposalResult = await createPlanAdaptationProposal({
    kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
    scope: {
      athleteId: "athlete-1",
      eventDistanceM: 1500,
      pairId: baseCandidate.pairId,
      selectedDetailedTemplateRef: baseCandidate.selectedDetailedTemplateRef,
    },
    activePlanStartedAt: "2026-08-01T00:00:00.000Z",
    baseCandidate,
    proposedCandidate: successorCandidate,
    baseContentHash: await hashPlanCandidate(baseCandidate),
    proposalOrigin: "SELF_SERVICE",
    trigger: {
      kind: "EXPLICIT_REQUEST",
      requestedBy: "ATHLETE",
      sourceRef: "athlete-request:athlete-1:req-1",
    },
    changeDimension: "VOLUME",
    safetyGate: gate,
    safetyEvaluatedAt: "2026-08-18T00:00:00.000Z",
    safetyValidUntil: "2026-08-18T00:10:00.000Z",
    activeHold: false,
    createdAt: "2026-08-18T00:05:00.000Z",
    idempotencyKey: await canonicalJsonSha256("trainoracle.test.proposal-key.v1", fixtureId),
  })
  if (proposalResult.kind !== "proposed") {
    throw new Error(`proposal fixture failed: ${JSON.stringify(proposalResult)}`)
  }
  const baseSelection = selectPlanCandidate({
    kind: "PLAN_BETA_SELECTION_REQUEST",
    generatedPlan: generated,
    selectedCandidateId: baseCandidate.candidateId,
    actor: "SELF",
    safetyGate: gate,
  })
  const successorSelection = selectPlanCandidate({
    kind: "PLAN_BETA_SELECTION_REQUEST",
    generatedPlan: generated,
    selectedCandidateId: successorCandidate.candidateId,
    actor: "SELF",
    safetyGate: gate,
  })
  if (baseSelection.kind !== "selected" || successorSelection.kind !== "selected") {
    throw new Error("selection fixture failed")
  }
  const common = {
    version: 3 as const,
    intake: {
      eventGroup: "MIDDLE_DISTANCE" as const,
      eventDistanceM: 1500 as const,
      competitionDivision: "OPEN" as const,
      experienceBand: "DEVELOPING" as const,
      availableDayCount: 5 as const,
      requestedFrameLength: 9.5 as const,
      trainingFocus: selectedEnergyIntent,
      secondSessionMode: "SINGLE_SESSION_ONLY" as const,
      trainingTimePreference: "VARIES" as const,
      selectedDetailedTemplateRef: baseCandidate.selectedDetailedTemplateRef,
    },
    progress: [],
    adaptationScope: {
      athleteId: "athlete-1",
      eventDistanceM: 1500 as const,
      pairId: baseCandidate.pairId,
      selectedDetailedTemplateRef: baseCandidate.selectedDetailedTemplateRef,
    },
  }
  const predecessorState: PlanBetaStateV3 = {
    ...common,
    activePlan: baseSelection.activePlan,
    generatedAt: "2026-08-01T00:00:00.000Z",
  }
  const successorState: PlanBetaStateV3 = {
    ...common,
    activePlan: successorSelection.activePlan,
    generatedAt: "2026-08-18T00:05:00.000Z",
  }
  return {
    proposal: proposalResult.proposal,
    predecessorState,
    successorState,
    actor: "SELF" as const,
    safetyGate: gate,
    safetyEvaluatedAt: "2026-08-18T00:00:00.000Z",
    safetyValidUntil: "2026-08-18T00:10:00.000Z",
    activeHold: false,
    acceptedAt: "2026-08-18T00:06:00.000Z",
    idempotencyKey: await canonicalJsonSha256("trainoracle.test.accept-key.v1", fixtureId),
  }
}

describe("local immutable next-frame adaptation contract", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
    locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
          expect(name).toBe(PLAN_BETA_MUTATION_LOCK_NAME)
          return callback({})
        },
      },
    })
  })

  afterEach(() => {
    if (locksDescriptor === undefined) Reflect.deleteProperty(navigator, "locks")
    else Object.defineProperty(navigator, "locks", locksDescriptor)
  })

  it("fails closed before reading or writing plan state when the shared lock is unavailable", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const before = window.localStorage.getItem(ACTIVE_KEY)
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined })

    await expect(acceptNextFrameProposal(input)).resolves.toEqual({
      kind: "rejected",
      code: "MUTATION_LOCK_UNAVAILABLE",
    })
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(before)
    expect(window.localStorage.getItem(ADAPTATION_KEY)).toBeNull()
  })

  it("accepts one linked successor with one write and preserves exact active bytes", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const activeBefore = window.localStorage.getItem(ACTIVE_KEY)
    const realSet = Storage.prototype.setItem
    const writes: string[] = []
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === ADAPTATION_KEY) writes.push(value)
      return realSet.call(this, key, value)
    })

    const result = await acceptNextFrameProposal(input)

    expect(result).toMatchObject({ kind: "accepted", replay: false })
    expect(writes).toHaveLength(1)
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(activeBefore)
    expect(loadPendingNextFrameSuccessor()).toMatchObject({
      athleteId: "athlete-1",
      eventDistanceM: 1500,
      proposalId: input.proposal.proposalId,
      baseCandidateId: input.proposal.baseCandidateId,
      successorState: {
        activePlan: {
          candidateId: input.proposal.successorCandidate.candidateId,
          selectionActor: "SELF",
        },
      }
    })
  })

  it("returns a storage failure when the rollback snapshot cannot be read", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const realGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === ADAPTATION_KEY) throw new Error("SecurityError")
      return realGetItem.call(this, key)
    })

    await expect(acceptNextFrameProposal(input)).resolves.toEqual({
      kind: "failed",
      code: "ADAPTATION_STORAGE_WRITE_FAILED",
      rollbackComplete: false,
    })
  })

  it.each([
    ["72h minus 1ms", "2026-08-21T00:04:59.999Z", "accepted"],
    ["exactly 72h", "2026-08-21T00:05:00.000Z", "rejected"],
    ["72h plus 1ms", "2026-08-21T00:05:00.001Z", "rejected"],
  ] as const)("enforces proposal expiry at %s", async (_label, acceptedAt, expectedKind) => {
    const input = await requestFixture()
    const proposalResult = await createPlanAdaptationProposal({
      kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
      scope: {
        athleteId: input.proposal.athleteId,
        eventDistanceM: input.proposal.eventDistanceM,
        pairId: input.proposal.pairId,
        selectedDetailedTemplateRef: input.proposal.selectedDetailedTemplateRef,
      },
      activePlanStartedAt: input.predecessorState.generatedAt,
      baseCandidate: input.proposal.baseCandidate,
      proposedCandidate: input.proposal.successorCandidate,
      baseContentHash: input.proposal.baseContentHash,
      proposalOrigin: "SELF_SERVICE",
      trigger: input.proposal.triggerSnapshot,
      changeDimension: "VOLUME",
      safetyGate: input.safetyGate,
      safetyEvaluatedAt: "2026-08-18T00:00:00.000Z",
      safetyValidUntil: "2026-08-22T00:00:00.000Z",
      activeHold: false,
      createdAt: "2026-08-18T00:05:00.000Z",
      idempotencyKey: `sha256:${"8".repeat(64)}`,
    })
    if (proposalResult.kind !== "proposed") throw new TypeError("Expected expiring proposal")
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const activeBytes = window.localStorage.getItem(ACTIVE_KEY)

    const result = await acceptNextFrameProposal({
      ...input,
      proposal: proposalResult.proposal,
      safetyValidUntil: "2026-08-22T00:00:00.000Z",
      acceptedAt,
    })

    expect(result.kind).toBe(expectedKind)
    if (expectedKind === "rejected") {
      expect(result).toEqual({ kind: "rejected", code: "EXPIRED_PROPOSAL" })
      expect(loadPendingNextFrameSuccessor()).toBeNull()
    }
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(activeBytes)
  })

  it("rejects a raw reason code without replacing the previous pending envelope", async () => {
    const planA = await requestFixture("LT_INTENT", "reason-a")
    expect(savePlanBetaState(planA.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal(planA)).toMatchObject({ kind: "accepted" })
    const previousEnvelope = window.localStorage.getItem(ADAPTATION_KEY)

    const planB = await requestFixture("VO2_INTENT", "reason-b")
    expect(savePlanBetaState(planB.predecessorState)).toEqual({ ok: true })
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    setItem.mockClear()
    const result = await acceptNextFrameProposal({
      ...planB,
      safetyGate: {
        ...planB.safetyGate,
        nonSensitiveReasonCodes: ["raw-symptom-chest-pain-after-training-1"],
      },
    })

    expect(result).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(setItem).not.toHaveBeenCalledWith(ADAPTATION_KEY, expect.any(String))
    expect(window.localStorage.getItem(ADAPTATION_KEY)).toBe(previousEnvelope)
  })

  it("rejects extra enumerable data on safety reason codes without writing", async () => {
    const input = await requestFixture("LT_INTENT", "reason-extra")
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const nonSensitiveReasonCodes = [...input.safetyGate.nonSensitiveReasonCodes]
    Object.defineProperty(nonSensitiveReasonCodes, "evidenceText", {
      value: "raw symptom: chest pain after training",
      enumerable: true,
    })
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    setItem.mockClear()

    expect(await acceptNextFrameProposal({
      ...input,
      safetyGate: { ...input.safetyGate, nonSensitiveReasonCodes },
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(setItem).not.toHaveBeenCalledWith(ADAPTATION_KEY, expect.any(String))
    expect(window.localStorage.getItem(ADAPTATION_KEY)).toBeNull()
  })

  it("keeps the acceptance boundary in exact parity with every RVE reason code", async () => {
    for (const [index, reasonCode] of RVE_NON_SENSITIVE_REASON_CODES.entries()) {
      window.localStorage.clear()
      const input = await requestFixture("LT_INTENT", "reason-" + index)
      expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
      const safetyGate = reasonCode.startsWith("D9_ACTIVE_")
        ? {
            kind: "blocked" as const,
            action: "BLOCK" as const,
            planGenerationAllowed: false as const,
            requiredNextAction: "HUMAN_REVIEW" as const,
            nonSensitiveReasonCodes: [reasonCode],
            audit: { event: "PLAN_SAFETY_GATE_BLOCKED" as const, privacy: "REASON_CODES_ONLY" as const },
          }
        : reasonCode.startsWith("D9_UNKNOWN_") || reasonCode.startsWith("RVE_")
          ? {
              kind: "blocked" as const,
              action: "BLOCK_OR_HUMAN_REVIEW" as const,
              planGenerationAllowed: false as const,
              requiredNextAction: "MORE_INFO_OR_HUMAN_REVIEW" as const,
              nonSensitiveReasonCodes: [reasonCode],
              audit: { event: "PLAN_SAFETY_GATE_BLOCKED" as const, privacy: "REASON_CODES_ONLY" as const },
            }
          : {
              kind: "passed" as const,
              action: "CONTINUE_WITH_OTHER_GATES" as const,
              planGenerationAllowed: true as const,
              nonSensitiveReasonCodes: [reasonCode],
              audit: { event: "PLAN_SAFETY_GATE_PASSED" as const, privacy: "REASON_CODES_ONLY" as const },
            }

      const result = await acceptNextFrameProposal({ ...input, safetyGate })
      expect(result, reasonCode).not.toMatchObject({ kind: "rejected", code: "MALFORMED_INPUT" })
    }
  })

  it("replaces an old-base pending envelope after the active plan switches", async () => {
    const planA = await requestFixture("LT_INTENT", "a")
    expect(savePlanBetaState(planA.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal(planA)).toMatchObject({ kind: "accepted", replay: false })

    const planB = await requestFixture("VO2_INTENT", "b")
    expect(planB.predecessorState.activePlan.candidateId)
      .not.toBe(planA.predecessorState.activePlan.candidateId)
    expect(savePlanBetaState(planB.predecessorState)).toEqual({ ok: true })
    const activeBytes = window.localStorage.getItem(ACTIVE_KEY)

    const result = await acceptNextFrameProposal(planB)

    expect(result).toMatchObject({ kind: "accepted", replay: false })
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(activeBytes)
    expect(loadPendingNextFrameSuccessor()).toMatchObject({
      proposalId: planB.proposal.proposalId,
      baseCandidateId: planB.predecessorState.activePlan.candidateId,
      successorState: {
        activePlan: { candidateId: planB.proposal.successorCandidate.candidateId },
      },
    })
  })

  it("replaces a pending envelope when a later frame reuses the same candidate ID", async () => {
    const planA = await requestFixture()
    expect(savePlanBetaState(planA.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal(planA)).toMatchObject({ kind: "accepted", replay: false })
    const oldPending = loadPendingNextFrameSuccessor()
    if (oldPending === null) throw new TypeError("Expected the first pending successor")

    const laterProposal = await createPlanAdaptationProposal({
      kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
      scope: {
        athleteId: planA.proposal.athleteId,
        eventDistanceM: planA.proposal.eventDistanceM,
        pairId: planA.proposal.pairId,
        selectedDetailedTemplateRef: planA.proposal.selectedDetailedTemplateRef,
      },
      activePlanStartedAt: "2026-08-18T00:07:00.000Z",
      baseCandidate: planA.proposal.baseCandidate,
      proposedCandidate: planA.proposal.successorCandidate,
      baseContentHash: planA.proposal.baseContentHash,
      proposalOrigin: "SELF_SERVICE",
      trigger: {
        kind: "EXPLICIT_REQUEST",
        requestedBy: "ATHLETE",
        sourceRef: "athlete-request:athlete-1:req-2",
      },
      changeDimension: "VOLUME",
      safetyGate: planA.safetyGate,
      safetyEvaluatedAt: "2026-08-18T00:07:00.000Z",
      safetyValidUntil: "2026-08-18T00:17:00.000Z",
      activeHold: false,
      createdAt: "2026-08-18T00:07:00.000Z",
      idempotencyKey: `sha256:${"c".repeat(64)}`,
    })
    if (laterProposal.kind !== "proposed") throw new TypeError("Expected a fresh later-frame proposal")
    const laterFrame = {
      ...planA,
      proposal: laterProposal.proposal,
      predecessorState: {
        ...planA.predecessorState,
        generatedAt: "2026-08-18T00:07:00.000Z",
      },
      successorState: {
        ...planA.successorState,
        generatedAt: "2026-08-18T00:07:00.000Z",
      },
      acceptedAt: "2026-08-18T00:08:00.000Z",
      safetyEvaluatedAt: "2026-08-18T00:07:00.000Z",
      safetyValidUntil: "2026-08-18T00:17:00.000Z",
      idempotencyKey: `sha256:${"b".repeat(64)}`,
    }
    expect(laterFrame.predecessorState.activePlan.candidateId)
      .toBe(planA.predecessorState.activePlan.candidateId)
    expect(savePlanBetaState(laterFrame.predecessorState)).toEqual({ ok: true })
    const activeBytes = window.localStorage.getItem(ACTIVE_KEY)

    expect(await acceptNextFrameProposal(laterFrame)).toMatchObject({
      kind: "accepted",
      replay: false,
    })
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(activeBytes)
    expect(loadPendingNextFrameSuccessor()).toMatchObject({
      baseCandidateId: planA.proposal.baseCandidateId,
      acceptedAt: laterFrame.acceptedAt,
      successorState: { generatedAt: laterFrame.successorState.generatedAt },
    })
    expect(loadPendingNextFrameSuccessor()?.predecessorStateHash)
      .not.toBe(oldPending.predecessorStateHash)
  })

  it("keeps a same-frame idempotency conflict when the candidate ID is unchanged", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal(input)).toMatchObject({ kind: "accepted", replay: false })
    const pendingBefore = loadPendingNextFrameSuccessor()

    expect(await acceptNextFrameProposal({
      ...input,
      idempotencyKey: `sha256:${"c".repeat(64)}`,
    })).toEqual({ kind: "rejected", code: "STALE_BASE" })
    expect(loadPendingNextFrameSuccessor()).toEqual(pendingBefore)
  })

  it("keeps the old-base envelope intact when its atomic replacement fails", async () => {
    const planA = await requestFixture("LT_INTENT", "a")
    expect(savePlanBetaState(planA.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal(planA)).toMatchObject({ kind: "accepted", replay: false })
    const oldEnvelopeBytes = window.localStorage.getItem(ADAPTATION_KEY)

    const planB = await requestFixture("VO2_INTENT", "b")
    expect(savePlanBetaState(planB.predecessorState)).toEqual({ ok: true })
    const activeBytes = window.localStorage.getItem(ACTIVE_KEY)
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === ADAPTATION_KEY) throw new Error("QuotaExceededError")
      return realSet.call(this, key, value)
    })

    expect(await acceptNextFrameProposal(planB)).toEqual({
      kind: "failed",
      code: "ADAPTATION_STORAGE_WRITE_FAILED",
      rollbackComplete: true,
    })
    expect(window.localStorage.getItem(ADAPTATION_KEY)).toBe(oldEnvelopeBytes)
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(activeBytes)
    expect(loadPendingNextFrameSuccessor()).toMatchObject({
      proposalId: planA.proposal.proposalId,
      baseCandidateId: planA.proposal.baseCandidateId,
    })
  })

  it.each([
    ["successor state", (input: Awaited<ReturnType<typeof requestFixture>>) => ({
      ...input,
      successorState: {
        ...input.successorState,
        generatedAt: "2026-08-18T00:05:01.000Z",
      },
    })],
  ])("rejects altered %s replay after hashing the full request", async (_label, alter) => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal(input)).toMatchObject({
      kind: "accepted",
      replay: false,
    })
    expect(await acceptNextFrameProposal(input)).toMatchObject({
      kind: "accepted",
      replay: true,
    })
    expect(await acceptNextFrameProposal(alter(input))).toEqual({
      kind: "rejected",
      code: "REPLAY_MISMATCH",
    })
  })

  it("denies caller-asserted coach acceptance without writing a local decision", async () => {
    const selfInput = await requestFixture()
    const input = { ...selfInput, actor: "COACH" as const }
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const writes: string[] = []
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === ADAPTATION_KEY) writes.push(value)
      return realSet.call(this, key, value)
    })

    expect(await acceptNextFrameProposal(input)).toEqual({
      kind: "rejected",
      code: "UNAUTHORIZED",
    })
    expect(writes).toEqual([])
    expect(loadPendingNextFrameSuccessor()).toBeNull()
  })

  it.each([
    ["D9", (input: Awaited<ReturnType<typeof requestFixture>>) => ({
      ...input,
      safetyGate: activeGate(),
    }), { kind: "blocked", code: "SAFETY_BLOCKED" }],
    ["stale safety", (input: Awaited<ReturnType<typeof requestFixture>>) => ({
      ...input,
      acceptedAt: "2026-08-18T00:11:00.001Z",
    }), { kind: "blocked", code: "STALE_SAFETY" }],
    ["active hold", (input: Awaited<ReturnType<typeof requestFixture>>) => ({
      ...input,
      activeHold: true,
    }), { kind: "blocked", code: "ACTIVE_HOLD" }],
    ["actor/mode mismatch", (input: Awaited<ReturnType<typeof requestFixture>>) => ({
      ...input,
      actor: "COACH" as const,
    }), { kind: "rejected", code: "UNAUTHORIZED" }],
  ])("rechecks current %s before returning an accepted replay", async (_label, alter, expected) => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal(input)).toMatchObject({ kind: "accepted", replay: false })

    expect(await acceptNextFrameProposal(alter(input))).toEqual(expected)
    expect(await acceptNextFrameProposal(input)).toMatchObject({ kind: "accepted", replay: true })
  })

  it("rejects forged hashes, cross-event state scope, and successor content", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal({
      ...input,
      proposal: {
        ...input.proposal,
        proposalHash: `sha256:${"f".repeat(64)}`,
      },
    })).toEqual({ kind: "rejected", code: "FORGED_PROPOSAL" })
    expect(await acceptNextFrameProposal({
      ...input,
      successorState: {
        ...input.successorState,
        adaptationScope: {
          athleteId: "athlete-1",
          eventDistanceM: 800,
          pairId: input.successorState.activePlan.pairId,
          selectedDetailedTemplateRef: input.successorState.activePlan.selectedDetailedTemplateRef,
        },
      },
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(await acceptNextFrameProposal({
      ...input,
      successorState: {
        ...input.successorState,
        activePlan: {
          ...input.successorState.activePlan,
          sourceMode: "JOURNAL_CONTEXT_ONLY",
        },
      },
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it("rejects recomputed INTENSITY, FREQUENCY, and arbitrary VOLUME transforms", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const intensityCandidate = {
      ...input.proposal.successorCandidate,
      selectedEnergyIntent: "VO2_INTENT" as const,
    }
    const [firstSession, ...remainingSessions] = input.proposal.successorCandidate.sessions
    if (firstSession === undefined || firstSession.role === "REST"
        || firstSession.prescription.kind !== "RPE_TIME_RANGE") {
      throw new Error("Expected an RPE fixture session")
    }
    const frequencyCandidate = {
      ...input.proposal.successorCandidate,
      sessions: [{ ...firstSession, day: 20 }, ...remainingSessions],
    }
    const arbitraryVolumeCandidate = {
      ...input.proposal.successorCandidate,
      sessions: [{
        ...firstSession,
        prescription: {
          ...firstSession.prescription,
          durationMinutes: {
            ...firstSession.prescription.durationMinutes,
            maximum: firstSession.prescription.durationMinutes.maximum + 1,
          },
        },
      }, ...remainingSessions],
    }

    for (const [dimension, successorCandidate] of [
      ["INTENSITY", intensityCandidate],
      ["FREQUENCY", frequencyCandidate],
      ["VOLUME", arbitraryVolumeCandidate],
    ] as const) {
      const proposedContentHash = await hashPlanCandidate(successorCandidate)
      const {
        proposalId: _proposalId,
        proposalHash: _proposalHash,
        ...originalContent
      } = input.proposal
      const content = {
        ...originalContent,
        changeDimension: dimension,
        proposedContentHash,
        approvedAfterValueRef: proposedContentHash,
        successorCandidate,
      }
      const proposalHash = await canonicalJsonSha256(
        "trainoracle.plan-adaptation-proposal.v1",
        content,
      )
      const proposal = {
        proposalId: `adaptation:${proposalHash.slice("sha256:".length)}`,
        proposalHash,
        ...content,
      }
      const result = await acceptNextFrameProposal({
        ...input,
        proposal,
        successorState: {
          ...input.successorState,
          activePlan: {
            ...input.successorState.activePlan,
            selectedEnergyIntent: successorCandidate.selectedEnergyIntent,
            sessions: successorCandidate.sessions,
          },
        },
      })
      expect(result).toMatchObject({ kind: "rejected" })
      if (result.kind === "rejected") {
        expect(["FORGED_PROPOSAL", "MALFORMED_INPUT"]).toContain(result.code)
      }
    }
  })

  it("fails closed for malformed nested candidates, forged safety, and raw private keys", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal({
      ...input,
      proposal: {
        ...input.proposal,
        successorCandidate: {
          ...input.proposal.successorCandidate,
          sessions: [{ role: "QUALITY" }],
        },
      },
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(await acceptNextFrameProposal({
      ...input,
      safetyGate: { kind: "passed" },
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(await acceptNextFrameProposal({
      ...input,
      rawMemo: "private",
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it.each([
    ["safety symbol", (safety: object) => {
      Object.defineProperty(safety, Symbol("evidenceText"), {
        value: "raw symptom: chest pain after training",
        enumerable: true,
      })
      return safety
    }],
    ["safety hidden property", (safety: object) => {
      Object.defineProperty(safety, "evidenceText", {
        value: "raw symptom: chest pain after training",
        enumerable: false,
      })
      return safety
    }],
    ["safety accessor", (safety: object) => {
      Object.defineProperty(safety, "kind", {
        get: () => "passed",
        enumerable: true,
        configurable: true,
      })
      return safety
    }],
  ] as const)("rejects non-canonical acceptance %s without writing", async (_label, mutate) => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const setItem = vi.spyOn(Storage.prototype, "setItem")

    expect(await acceptNextFrameProposal({
      ...input,
      safetyGate: mutate({ ...input.safetyGate }),
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(setItem).not.toHaveBeenCalledWith(ADAPTATION_KEY, expect.any(String))
  })

  it.each([
    ["envelope symbol", (envelope: object) => {
      Object.defineProperty(envelope, Symbol("evidenceText"), {
        value: "raw symptom: chest pain after training",
        enumerable: true,
      })
      return envelope
    }],
    ["pending hidden property", (envelope: object) => {
      const pending = "pending" in envelope ? envelope.pending : undefined
      if (typeof pending !== "object" || pending === null) throw new TypeError("Expected pending fixture")
      Object.defineProperty(pending, "evidenceText", {
        value: "raw symptom: chest pain after training",
        enumerable: false,
      })
      return envelope
    }],
    ["pending accessor", (envelope: object) => {
      const pending = "pending" in envelope ? envelope.pending : undefined
      if (typeof pending !== "object" || pending === null) throw new TypeError("Expected pending fixture")
      Object.defineProperty(pending, "targetFrame", {
        get: () => "NEXT_FRAME",
        enumerable: true,
        configurable: true,
      })
      return envelope
    }],
    ["pending custom prototype", (envelope: object) => {
      const pending = "pending" in envelope ? envelope.pending : undefined
      if (typeof pending !== "object" || pending === null) throw new TypeError("Expected pending fixture")
      Object.setPrototypeOf(pending, { evidenceText: "raw symptom: chest pain after training" })
      return envelope
    }],
    ["pending hidden cycle", (envelope: object) => {
      const pending = "pending" in envelope ? envelope.pending : undefined
      if (typeof pending !== "object" || pending === null) throw new TypeError("Expected pending fixture")
      Object.defineProperty(pending, "self", { value: pending, enumerable: false })
      return envelope
    }],
  ] as const)("rejects a non-canonical %s before pending-envelope normalization", async (_label, mutate) => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal(input)).toMatchObject({ kind: "accepted" })
    const raw = window.localStorage.getItem(ADAPTATION_KEY)
    if (raw === null) throw new TypeError("Expected an adaptation envelope")
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new TypeError("Expected an object adaptation envelope")
    }
    const envelope = mutate(parsed)

    expect(planAdaptationEnvelopeSchema.safeParse(envelope).success).toBe(false)
  })

  it.each([
    "raw symptom: chest pain after training",
    "raw_symptom_chest_pain_after_training",
    "raw-symptom-chest-pain-after-training",
  ])("rejects raw prose in the persisted acceptance idempotency key: %s", async (idempotencyKey) => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })

    expect(await acceptNextFrameProposal({ ...input, idempotencyKey }))
      .toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(window.localStorage.getItem(ADAPTATION_KEY)).toBeNull()
  })

  it("rejects a stored envelope tampered with raw prose identifiers", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal(input)).toMatchObject({ kind: "accepted" })
    const raw = window.localStorage.getItem(ADAPTATION_KEY)
    if (raw === null) throw new TypeError("Expected a persisted adaptation envelope")
    const envelope = planAdaptationEnvelopeSchema.parse(JSON.parse(raw))
    const prose = "raw_symptom_chest_pain_after_training"
    const tamperedEnvelopes = [
      {
        ...envelope,
        pending: { ...envelope.pending, athleteId: prose },
      },
      {
        ...envelope,
        pending: { ...envelope.pending, baseCandidateId: prose },
      },
      {
        ...envelope,
        pending: { ...envelope.pending, idempotencyKey: prose },
        decision: { ...envelope.decision, idempotencyKey: prose },
      },
      {
        ...envelope,
        pending: { ...envelope.pending, decisionId: prose },
        decision: { ...envelope.decision, decisionId: prose },
      },
      {
        ...envelope,
        pending: { ...envelope.pending, proposalId: prose },
        decision: { ...envelope.decision, proposalId: prose },
      },
    ]

    for (const tampered of tamperedEnvelopes) {
      window.localStorage.setItem(ADAPTATION_KEY, JSON.stringify(tampered))
      expect(loadPendingNextFrameSuccessor()).toBeNull()
    }
  })

  it("rejects same-day PB evidence achieved before the active-plan start timestamp", async () => {
    const input = await requestFixture()
    expect(await createPlanAdaptationProposal({
      kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
      scope: {
        athleteId: "athlete-1",
        eventDistanceM: 1500,
        pairId: input.proposal.baseCandidate.pairId,
        selectedDetailedTemplateRef: input.proposal.baseCandidate.selectedDetailedTemplateRef,
      },
      activePlanStartedAt: "2026-08-12T12:00:00.000Z",
      baseCandidate: input.proposal.baseCandidate,
      proposedCandidate: input.proposal.successorCandidate,
      baseContentHash: await hashPlanCandidate(input.proposal.baseCandidate),
      proposalOrigin: "SELF_SERVICE",
      trigger: {
        kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
        explicitlyConfirmed: true,
        recordId: "00000000-0000-4000-8000-000000000006",
        purpose: "PERSONAL_BEST",
        eventDistanceM: 1500,
        performanceSeconds: 245,
        achievedAt: "2026-08-12T11:59:59.999Z",
        sourceRef: "athlete-record:00000000-0000-4000-8000-000000000006",
        historicalOrBackfilled: false,
      },
      changeDimension: "VOLUME",
      safetyGate: input.safetyGate,
      safetyEvaluatedAt: "2026-08-18T00:00:00.000Z",
      safetyValidUntil: "2026-08-18T00:10:00.000Z",
      activeHold: false,
      createdAt: "2026-08-18T00:05:00.000Z",
      idempotencyKey: `sha256:${"d".repeat(64)}`,
    })).toEqual({ kind: "rejected", code: "INELIGIBLE_TRIGGER" })
  })

  it.each([
    ["D9", (input: Awaited<ReturnType<typeof requestFixture>>) => ({
      ...input,
      safetyGate: activeGate(),
    }), "SAFETY_BLOCKED"],
    ["stale safety", (input: Awaited<ReturnType<typeof requestFixture>>) => ({
      ...input,
      acceptedAt: "2026-08-18T00:11:00.001Z",
    }), "STALE_SAFETY"],
    ["active hold", (input: Awaited<ReturnType<typeof requestFixture>>) => ({
      ...input,
      activeHold: true,
    }), "ACTIVE_HOLD"],
  ])("blocks %s without changing active bytes", async (_label, alter, code) => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const activeBefore = window.localStorage.getItem(ACTIVE_KEY)
    expect(await acceptNextFrameProposal(alter(input))).toEqual({
      kind: "blocked",
      code,
    })
    expect(loadPendingNextFrameSuccessor()).toBeNull()
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(activeBefore)
  })

  it("leaves no partial record when the single envelope write fails", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const activeBefore = window.localStorage.getItem(ACTIVE_KEY)
    const attempts: string[] = []
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === ADAPTATION_KEY) {
        attempts.push(key)
        throw new Error("QuotaExceededError")
      }
      return realSet.call(this, key, value)
    })

    expect(await acceptNextFrameProposal(input)).toEqual({
      kind: "failed",
      code: "ADAPTATION_STORAGE_WRITE_FAILED",
      rollbackComplete: true,
    })
    expect(attempts).toEqual([ADAPTATION_KEY])
    expect(loadPendingNextFrameSuccessor()).toBeNull()
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(activeBefore)
  })

  it("fails closed when the adaptation envelope write is silently dropped", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    const activeBefore = window.localStorage.getItem(ACTIVE_KEY)
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === ADAPTATION_KEY) return
      return realSet.call(this, key, value)
    })

    expect(await acceptNextFrameProposal(input)).toEqual({
      kind: "failed",
      code: "ADAPTATION_STORAGE_WRITE_FAILED",
      rollbackComplete: true,
    })
    expect(loadPendingNextFrameSuccessor()).toBeNull()
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(activeBefore)
  })

  it("rejects stale active bytes and missing adaptation scope", async () => {
    const input = await requestFixture()
    expect(savePlanBetaState(input.predecessorState)).toEqual({ ok: true })
    window.localStorage.setItem(ACTIVE_KEY, JSON.stringify({
      ...input.predecessorState,
      generatedAt: "2026-08-18T00:07:00.000Z",
    }))
    expect(await acceptNextFrameProposal(input)).toEqual({
      kind: "rejected",
      code: "STALE_BASE",
    })

    window.localStorage.clear()
    const { adaptationScope: _scope, ...withoutScope } = input.predecessorState
    expect(savePlanBetaState(withoutScope)).toEqual({ ok: true })
    expect(await acceptNextFrameProposal({
      ...input,
      predecessorState: withoutScope,
    })).toEqual({ kind: "rejected", code: "SCOPE_MISMATCH" })
  })
})
