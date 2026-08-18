import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  canonicalJsonSha256,
  createPlanAdaptationProposal,
  hashPlanCandidate,
} from "@impl/plan-generator/adaptation"
import { generatePlanCandidates } from "@impl/plan-generator/generator"
import { selectPlanCandidate } from "@impl/plan-generator/selection"
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
import type { PlanBetaStateV2 } from "./plan-beta-schema"

const ACTIVE_KEY = "trainoracle.plan-beta.v1"
const ADAPTATION_KEY = "trainoracle.plan-beta.adaptation.v1"

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
    scope: { athleteId: "athlete-1", eventDistanceM: 1500 },
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
    idempotencyKey: `proposal-create-${fixtureId}`,
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
    version: 2 as const,
    intake: {
      eventGroup: "MIDDLE_DISTANCE" as const,
      competitionDivision: "OPEN" as const,
      experienceBand: "DEVELOPING" as const,
      availableDayCount: 5 as const,
      requestedFrameLength: 9.5 as const,
      trainingFocus: selectedEnergyIntent,
      secondSessionMode: "SINGLE_SESSION_ONLY" as const,
      trainingTimePreference: "VARIES" as const,
    },
    progress: [],
    adaptationScope: {
      athleteId: "athlete-1",
      eventDistanceM: 1500 as const,
    },
  }
  const predecessorState: PlanBetaStateV2 = {
    ...common,
    activePlan: baseSelection.activePlan,
    generatedAt: "2026-08-01T00:00:00.000Z",
  }
  const successorState: PlanBetaStateV2 = {
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
    idempotencyKey: `accept-${fixtureId}`,
  }
}

async function coachRequestFixture() {
  const input = await requestFixture()
  const proposalResult = await createPlanAdaptationProposal({
    kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
    scope: { athleteId: "athlete-1", eventDistanceM: 1500 },
    activePlanStartedAt: input.predecessorState.generatedAt,
    baseCandidate: input.proposal.baseCandidate,
    proposedCandidate: input.proposal.successorCandidate,
    baseContentHash: await hashPlanCandidate(input.proposal.baseCandidate),
    proposalOrigin: "COACH_AUTHORED",
    trigger: {
      kind: "EXPLICIT_REQUEST",
      requestedBy: "COACH",
      sourceRef: "coach-request:athlete-1:req-1",
    },
    changeDimension: "VOLUME",
    safetyGate: input.safetyGate,
    safetyEvaluatedAt: input.safetyEvaluatedAt,
    safetyValidUntil: input.safetyValidUntil,
    activeHold: false,
    createdAt: "2026-08-18T00:05:00.000Z",
    idempotencyKey: "coach-proposal-create-1",
  })
  if (proposalResult.kind !== "proposed") {
    throw new Error(`coach proposal fixture failed: ${JSON.stringify(proposalResult)}`)
  }
  return {
    ...input,
    proposal: proposalResult.proposal,
    successorState: {
      ...input.successorState,
      activePlan: {
        ...input.successorState.activePlan,
        selectionActor: "COACH" as const,
      },
    },
    actor: "COACH" as const,
  }
}

describe("local immutable next-frame adaptation contract", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
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

    const laterFrame = {
      ...planA,
      predecessorState: {
        ...planA.predecessorState,
        generatedAt: "2026-08-18T00:07:00.000Z",
      },
      successorState: {
        ...planA.successorState,
        generatedAt: "2026-08-18T00:07:00.000Z",
      },
      acceptedAt: "2026-08-18T00:08:00.000Z",
      idempotencyKey: "accept-later-frame",
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
      idempotencyKey: "accept-same-frame-conflict",
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
    const input = await coachRequestFixture()
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
        },
      },
    })).toEqual({ kind: "rejected", code: "SCOPE_MISMATCH" })
    expect(await acceptNextFrameProposal({
      ...input,
      successorState: {
        ...input.successorState,
        activePlan: {
          ...input.successorState.activePlan,
          sourceMode: "JOURNAL_CONTEXT_ONLY",
        },
      },
    })).toEqual({ kind: "rejected", code: "SUCCESSOR_MISMATCH" })
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
      expect(await acceptNextFrameProposal({
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
      })).toEqual({ kind: "rejected", code: "FORGED_PROPOSAL" })
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

  it("rejects same-day PB evidence achieved before the active-plan start timestamp", async () => {
    const input = await requestFixture()
    expect(await createPlanAdaptationProposal({
      kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
      scope: { athleteId: "athlete-1", eventDistanceM: 1500 },
      activePlanStartedAt: "2026-08-12T12:00:00.000Z",
      baseCandidate: input.proposal.baseCandidate,
      proposedCandidate: input.proposal.successorCandidate,
      baseContentHash: await hashPlanCandidate(input.proposal.baseCandidate),
      proposalOrigin: "SELF_SERVICE",
      trigger: {
        kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
        explicitlyConfirmed: true,
        recordId: "record-before-start",
        purpose: "PERSONAL_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-08-12T11:59:59.999Z",
        sourceRef: "athlete-record:record-before-start",
        historicalOrBackfilled: false,
      },
      changeDimension: "VOLUME",
      safetyGate: input.safetyGate,
      safetyEvaluatedAt: "2026-08-18T00:00:00.000Z",
      safetyValidUntil: "2026-08-18T00:10:00.000Z",
      activeHold: false,
      createdAt: "2026-08-18T00:05:00.000Z",
      idempotencyKey: "same-day-before-start",
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
