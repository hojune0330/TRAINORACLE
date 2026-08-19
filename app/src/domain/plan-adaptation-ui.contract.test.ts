import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createPlanAdaptationProposal,
  hashPlanCandidate,
} from "@impl/plan-generator/adaptation"
import { generatePlanCandidates } from "@impl/plan-generator/generator"
import type { PlanCandidate } from "@impl/plan-generator/types"
import {
  createSelfReportedAthleteRecord,
  saveAthleteRecord,
} from "./athlete-records"
import type { AthleteRecord } from "./athlete-records"
import {
  evaluatePlanSafety,
  generatePlanFromDraft,
} from "./plan-beta-flow"
import {
  acceptPreparedNextFrameAdaptation,
  eligiblePbSbRecords,
  evaluateActivePlanAdaptationSafety,
  loadMatchingPendingSuccessor,
  prepareNextFrameAdaptation,
  savePlanAdaptationContext,
} from "./plan-adaptation-ui"
import {
  savePlanBetaState,
  type PlanBetaState,
} from "./plan-beta-store"
import { createPlanFormation } from "./plan-beta-formation"
import type { PlanBetaStateV2 } from "./plan-beta-schema"
import { saveSelectedPlanCandidate } from "../screens/plan-beta/plan-selection"
import {
  loadPlanAdaptationContext,
  PLAN_ADAPTATION_CONTEXT_STORAGE_KEY,
} from "./plan-adaptation-ui-context"

const ACTIVE_KEY = "trainoracle.plan-beta.v1"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe("next-frame adaptation UI adapter", () => {
  it("rejects a raw active candidate selector without changing saved context bytes", () => {
    const fixture = createCoachRequiredFixture(new Date("2026-08-18T12:00:00.000Z"))
    const candidates = [fixture.baseCandidate, fixture.proposedCandidate] as const
    const previousBytes = window.localStorage.getItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY)
    expect(previousBytes).not.toBeNull()
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    setItem.mockClear()

    expect(savePlanAdaptationContext(
      candidates,
      "raw-symptom-chest-pain-after-training-1",
    )).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY)).toBe(previousBytes)
  })

  it("does not load a stored context whose selector is unrelated to its candidates", () => {
    const fixture = createCoachRequiredFixture(new Date("2026-08-18T12:00:00.000Z"))
    const raw = window.localStorage.getItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY)
    if (raw === null) throw new TypeError("Expected a saved adaptation context")
    const context: unknown = JSON.parse(raw)
    if (typeof context !== "object" || context === null || Array.isArray(context)) {
      throw new TypeError("Expected an object adaptation context")
    }
    const unrelated = "raw-symptom-chest-pain-after-training-1"
    window.localStorage.setItem(
      PLAN_ADAPTATION_CONTEXT_STORAGE_KEY,
      JSON.stringify({ ...context, activeCandidateId: unrelated }),
    )

    expect(loadPlanAdaptationContext(unrelated)).toBeNull()
    expect(loadPlanAdaptationContext(fixture.baseCandidate.candidateId)).toBeNull()
  })

  it("accepts one real conservative successor, survives reload, and preserves active bytes", async () => {
    const now = new Date()
    const anchor = athleteRecord("00000000-0000-4000-8000-000000005001", 5000, "2026-08-01", now)
    expect(saveAthleteRecord(anchor, now).ok).toBe(true)
    const generated = generatePlanFromDraft({
      eventGroup: "FIVE_K",
      competitionDivision: "OPEN",
      experienceBand: "EXPERIENCED",
      availableDayCount: 5,
      requestedFrameLength: 9,
      trainingFocus: "VO2_INTENT",
      secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "MORNING",
    }, "NO_KNOWN_RISK", { selectedRecordId: anchor.id })
    if (generated.kind !== "generated") throw new Error(`Expected generated plan, got ${generated.kind}`)
    expect(generated.prescriptionBinding.kind).toBe("bound")
    const saved = saveSelectedPlanCandidate(
      { candidate: generated.generated.candidates[0], startDate: "2026-08-18" },
      generated.generated,
      generated.gate,
      generated.intake,
      generated.athleteEvidence,
    )
    if (saved.kind !== "saved") throw new Error(`Expected saved plan, got ${saved.code}`)
    const activeBefore = window.localStorage.getItem(ACTIVE_KEY)
    expect(activeBefore).not.toBeNull()

    const proposalTime = new Date(Date.now() + 60_000)
    const proposalSafety = evaluateActivePlanAdaptationSafety(
      saved.state,
      "NO_KNOWN_RISK",
      proposalTime,
    )
    const prepared = await prepareNextFrameAdaptation({
      state: saved.state,
      reason: "EXPLICIT_REQUEST",
      record: null,
      safety: proposalSafety,
      operationAt: proposalTime.toISOString(),
    })
    if (prepared.kind !== "ready") throw new Error(`Expected ready proposal, got ${prepared.code}`)
    expect(prepared.prepared.changedSessions.map(summarizeDurationChange)).toEqual([
      { day: 1, slot: "AM", before: [35, 60], after: [35, 35] },
      { day: 5, slot: "AM", before: [35, 60], after: [35, 35] },
      { day: 7, slot: "AM", before: [35, 60], after: [35, 35] },
      { day: 9, slot: "AM", before: [30, 50], after: [30, 30] },
    ])

    const acceptanceTime = new Date(proposalTime.getTime() + 1_000)
    const acceptanceSafety = evaluateActivePlanAdaptationSafety(
      saved.state,
      "NO_KNOWN_RISK",
      acceptanceTime,
    )
    const accepted = await acceptPreparedNextFrameAdaptation({
      prepared: prepared.prepared,
      predecessorState: saved.state,
      safety: acceptanceSafety,
      operationAt: acceptanceTime.toISOString(),
    })
    expect(accepted.kind).toBe("accepted")
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBe(activeBefore)
    const reloaded = await loadMatchingPendingSuccessor(saved.state)
    expect(reloaded?.baseCandidateId).toBe(saved.state.activePlan.candidateId)
    expect(reloaded?.successorState.activePlan.candidateId).not.toBe(saved.state.activePlan.candidateId)

    const laterFrame = {
      ...saved.state,
      generatedAt: "2026-08-19T00:00:00.000Z",
    }
    expect(laterFrame.activePlan.candidateId).toBe(saved.state.activePlan.candidateId)
    expect(savePlanBetaState(laterFrame)).toEqual({ ok: true })
    expect(await loadMatchingPendingSuccessor(laterFrame)).toBeNull()
  })

  it("consumes real blocked, stale, and held active-plan safety contexts", async () => {
    const state = createBoundState()
    const checkedAt = new Date(Date.now() + 60_000)
    const passed = evaluateActivePlanAdaptationSafety(state, "NO_KNOWN_RISK", checkedAt)
    const blocked = evaluateActivePlanAdaptationSafety(state, "REVIEW_REQUIRED", checkedAt)
    const firstSession = state.activePlan.sessions[0]
    if (firstSession === undefined) throw new Error("Expected a session for the hold fixture")
    const heldState: PlanBetaState = {
      ...state,
      progress: [{
        sessionDay: firstSession.day,
        sessionSlot: firstSession.slot,
        state: "PAIN_CHECKIN",
      }],
    }
    const held = evaluateActivePlanAdaptationSafety(heldState, "NO_KNOWN_RISK", checkedAt)

    const baseInput = {
      state,
      reason: "EXPLICIT_REQUEST" as const,
      record: null,
    }
    const ready = await prepareNextFrameAdaptation({
      ...baseInput,
      safety: passed,
      operationAt: checkedAt.toISOString(),
    })
    const blockedResult = await prepareNextFrameAdaptation({
      ...baseInput,
      safety: blocked,
      operationAt: checkedAt.toISOString(),
    })
    const staleResult = await prepareNextFrameAdaptation({
      ...baseInput,
      safety: passed,
      operationAt: new Date(checkedAt.getTime() + 1).toISOString(),
    })
    const heldResult = await prepareNextFrameAdaptation({
      ...baseInput,
      state: heldState,
      safety: held,
      operationAt: checkedAt.toISOString(),
    })

    expect(ready.kind).toBe("ready")
    expect(blockedResult).toMatchObject({ kind: "blocked" })
    expect(staleResult).toEqual({ kind: "blocked", code: "STALE_SAFETY" })
    expect(heldResult).toEqual({ kind: "blocked", code: "ACTIVE_HOLD" })
  })

  it("keeps genuine COACH_REQUIRED proposals read-only without synthesizing a coach actor", async () => {
    const checkedAt = new Date("2026-08-18T12:00:00.000Z")
    const fixture = createCoachRequiredFixture(checkedAt)
    const safety = evaluateActivePlanAdaptationSafety(
      fixture.state,
      "NO_KNOWN_RISK",
      checkedAt,
    )
    if (safety.kind !== "evaluated") throw new Error("Expected passed coach fixture safety")
    const baseContentHash = await hashPlanCandidate(fixture.baseCandidate)
    const proposal = await createPlanAdaptationProposal({
      kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
      scope: fixture.state.adaptationScope,
      activePlanStartedAt: fixture.state.generatedAt,
      baseCandidate: fixture.baseCandidate,
      proposedCandidate: fixture.proposedCandidate,
      baseContentHash,
      proposalOrigin: "COACH_AUTHORED",
      trigger: {
        kind: "EXPLICIT_REQUEST",
        requestedBy: "COACH",
        sourceRef: "coach-request:local-athlete:v1",
      },
      changeDimension: "VOLUME",
      safetyGate: safety.safetyGate,
      safetyEvaluatedAt: safety.safetyEvaluatedAt,
      safetyValidUntil: safety.safetyValidUntil,
      activeHold: safety.activeHold,
      createdAt: checkedAt.toISOString(),
      idempotencyKey: `sha256:${"f".repeat(64)}`,
    })
    if (proposal.kind !== "proposed") throw new Error(`Expected coach proposal, got ${proposal.code}`)
    const prepared = {
      proposal: proposal.proposal,
      successorState: successorStateFor(fixture.state, fixture.proposedCandidate, checkedAt.toISOString()),
      changedSessions: [],
      reason: "EXPLICIT_REQUEST" as const,
      record: null,
    }

    const unavailable = await prepareNextFrameAdaptation({
      state: fixture.state,
      reason: "EXPLICIT_REQUEST",
      record: null,
      safety,
      operationAt: checkedAt.toISOString(),
    })
    const accepted = await acceptPreparedNextFrameAdaptation({
      prepared,
      predecessorState: fixture.state,
      safety,
      operationAt: checkedAt.toISOString(),
    })

    expect(unavailable).toEqual({ kind: "unavailable", code: "COACH_CONNECTION_REQUIRED" })
    expect(accepted).toEqual({ kind: "rejected", code: "UNAUTHORIZED" })
    expect(await loadMatchingPendingSuccessor(fixture.state)).toBeNull()
  })

  it("offers only same-event PB/SB records strictly after the active plan timestamp", () => {
    const now = new Date("2026-08-18T12:00:00.000Z")
    const state = {
      version: 2 as const,
      intake: {
        eventGroup: "FIVE_K" as const,
        competitionDivision: "OPEN" as const,
        experienceBand: "EXPERIENCED" as const,
      },
      activePlan: {
        kind: "BETA_ACTIVE_PLAN_SNAPSHOT" as const,
        activationState: "SELECTED_BETA_SNAPSHOT" as const,
        candidateId: "candidate",
        candidateKind: "BALANCED" as const,
        eventDistanceM: 5000 as const,
        selectionActor: "SELF" as const,
        sourceMode: "PROFILE_ONLY" as const,
        selectedEnergyIntent: "VO2_INTENT" as const,
        frame: { lengthDays: 9 as const, continuity: { kind: "STANDARD_FRAME" as const } },
        sessions: [],
      },
      progress: [],
      generatedAt: "2026-08-10T12:00:00.000Z",
      adaptationScope: { athleteId: "local-athlete", eventDistanceM: 5000 as const },
    }
    const sameDayBeforeStart = athleteRecord("same-day", 5000, "2026-08-10", now)
    const afterStart = athleteRecord("after-start", 5000, "2026-08-11", now)
    const wrongEvent = athleteRecord("wrong-event", 1500, "2026-08-11", now)

    expect(eligiblePbSbRecords(state, [sameDayBeforeStart, afterStart, wrongEvent]).map((record) => record.id))
      .toEqual(["after-start"])
  })
})

function createBoundState(): PlanBetaState {
  const now = new Date()
  const anchor = athleteRecord("00000000-0000-4000-8000-000000005002", 5000, "2026-08-01", now)
  expect(saveAthleteRecord(anchor, now).ok).toBe(true)
  const generated = generatePlanFromDraft({
    eventGroup: "FIVE_K",
    competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED",
    availableDayCount: 5,
    requestedFrameLength: 9,
    trainingFocus: "VO2_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "MORNING",
  }, "NO_KNOWN_RISK", { selectedRecordId: anchor.id })
  if (generated.kind !== "generated") throw new Error(`Expected generated plan, got ${generated.kind}`)
  const saved = saveSelectedPlanCandidate(
    { candidate: generated.generated.candidates[0], startDate: "2026-08-18" },
    generated.generated,
    generated.gate,
    generated.intake,
    generated.athleteEvidence,
  )
  if (saved.kind !== "saved") throw new Error(`Expected saved plan, got ${saved.code}`)
  return saved.state
}

function createCoachRequiredFixture(now: Date): {
  readonly state: PlanBetaState
  readonly baseCandidate: PlanCandidate
  readonly proposedCandidate: PlanCandidate
} {
  const safety = evaluatePlanSafety("NO_KNOWN_RISK", now)
  if (safety.kind !== "passed") throw new Error("Expected passed coach generation safety")
  const availableTrainingDays = [1, 3, 5, 7, 9] as const
  const generated = generatePlanCandidates({
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate: safety.gate,
    profile: {
      eventGroup: "FIVE_K",
      eventDistanceM: 5000,
      experienceBand: "EXPERIENCED",
      availableTrainingDays,
      secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "MORNING",
    },
    formation: createPlanFormation("2026-08-18", availableTrainingDays, "EXPERIENCED"),
    requestedFrameLength: 9,
    selectedEnergyIntent: "VO2_INTENT",
    journalSource: { kind: "NO_USABLE_JOURNAL" },
    selectionAuthority: "COACH_REQUIRED",
  })
  if (generated.kind !== "generated") throw new Error(`Expected coach candidates, got ${generated.kind}`)
  const baseCandidate = generated.candidates[0]
  const proposedCandidate = generated.candidates[1]
  const state: PlanBetaState = {
    version: 2,
    intake: {
      eventGroup: "FIVE_K",
      competitionDivision: "OPEN",
      experienceBand: "EXPERIENCED",
      availableDayCount: 5,
      requestedFrameLength: 9,
      trainingFocus: "VO2_INTENT",
      secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "MORNING",
      startDate: "2026-08-18",
    },
    activePlan: {
      kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
      activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId: baseCandidate.candidateId,
      candidateKind: baseCandidate.kind,
      eventDistanceM: baseCandidate.eventDistanceM,
      selectionActor: "COACH",
      sourceMode: baseCandidate.sourceMode,
      selectedEnergyIntent: baseCandidate.selectedEnergyIntent,
      frame: baseCandidate.frame,
      sessions: baseCandidate.sessions,
    },
    progress: [],
    generatedAt: "2026-08-10T12:00:00.000Z",
    adaptationScope: { athleteId: "local-athlete", eventDistanceM: 5000 },
  }
  expect(savePlanBetaState(state).ok).toBe(true)
  expect(savePlanAdaptationContext(generated.candidates, baseCandidate.candidateId)).toBe(true)
  return { state, baseCandidate, proposedCandidate }
}

function successorStateFor(
  state: PlanBetaState,
  candidate: PlanCandidate,
  generatedAt: string,
): PlanBetaStateV2 {
  return {
    ...state,
    version: 2,
    activePlan: {
      kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
      activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId: candidate.candidateId,
      candidateKind: candidate.kind,
      eventDistanceM: candidate.eventDistanceM,
      selectionActor: "COACH",
      sourceMode: candidate.sourceMode,
      selectedEnergyIntent: candidate.selectedEnergyIntent,
      frame: candidate.frame,
      sessions: candidate.sessions,
    },
    progress: [],
    generatedAt,
  }
}

function summarizeDurationChange(change: {
  readonly before: PlanBetaState["activePlan"]["sessions"][number]
  readonly after: PlanBetaState["activePlan"]["sessions"][number]
}) {
  if (
    change.before.prescription.kind !== "RPE_TIME_RANGE"
    || change.after.prescription.kind !== "RPE_TIME_RANGE"
  ) {
    throw new Error("Expected a duration-based changed session")
  }
  return {
    day: change.after.day,
    slot: change.after.slot,
    before: [
      change.before.prescription.durationMinutes.minimum,
      change.before.prescription.durationMinutes.maximum,
    ],
    after: [
      change.after.prescription.durationMinutes.minimum,
      change.after.prescription.durationMinutes.maximum,
    ],
  }
}

function athleteRecord(
  id: string,
  eventDistanceM: number,
  achievedOn: string,
  now: Date,
): AthleteRecord {
  const record = createSelfReportedAthleteRecord({
    id,
    purpose: "PERSONAL_BEST",
    eventDistanceM,
    performanceSeconds: eventDistanceM === 5000 ? 1_020 : 260,
    achievedOn,
    seasonId: null,
  }, now)
  if (record === null) throw new Error(`Invalid athlete record fixture: ${id}`)
  return record
}
