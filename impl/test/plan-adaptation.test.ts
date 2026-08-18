import { describe, expect, it } from "vitest"
import {
  createPlanAdaptationProposal,
  hashPlanCandidate,
} from "../src/plan-generator/adaptation"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import { baseRequest, clearedGate, expectGenerated } from "./fixtures/plan-beta-request"
import { activeGate, unknownGate } from "./fixtures/plan-beta-request"

async function fixtureRequest() {
  const generated = expectGenerated(generatePlanCandidates(baseRequest()))
  const [baseCandidate, proposedCandidate] = generated.candidates
  return {
    kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST" as const,
    scope: { athleteId: "athlete-1", eventDistanceM: 1500 },
    activePlanStartedAt: "2026-08-01T00:00:00.000Z",
    baseCandidate,
    proposedCandidate,
    baseContentHash: await hashPlanCandidate(baseCandidate),
    proposalOrigin: "SELF_SERVICE" as const,
    trigger: {
      kind: "EXPLICIT_REQUEST" as const,
      requestedBy: "ATHLETE" as const,
      sourceRef: "athlete-request:athlete-1:req-1",
    },
    changeDimension: "VOLUME" as const,
    safetyGate: clearedGate(),
    safetyEvaluatedAt: "2026-08-18T00:00:00.000Z",
    safetyValidUntil: "2026-08-18T00:10:00.000Z",
    activeHold: false,
    createdAt: "2026-08-18T00:05:00.000Z",
    idempotencyKey: "adaptation-1",
  }
}

describe("next-frame plan adaptation", () => {
  it("creates one volume proposal from an explicit athlete request without mutating the base", async () => {
    const input = await fixtureRequest()
    const { baseCandidate, proposedCandidate } = input
    const baseBytes = JSON.stringify(baseCandidate)

    const result = await createPlanAdaptationProposal(input)

    if (result.kind !== "proposed") throw new Error(JSON.stringify(result))
    expect(result.proposal).toMatchObject({
      targetFrame: "NEXT_FRAME",
      selectionAuthority: "SELF",
      changeDimension: "VOLUME",
    })
    expect(result.proposal.successorCandidate).toEqual(proposedCandidate)
    expect(JSON.stringify(baseCandidate)).toBe(baseBytes)
  })

  it("maps coach-authored requests to coach-required selection", async () => {
    const input = await fixtureRequest()
    const result = await createPlanAdaptationProposal({
      ...input,
      proposalOrigin: "COACH_AUTHORED",
      trigger: {
        kind: "EXPLICIT_REQUEST",
        requestedBy: "COACH",
        sourceRef: "coach-request:athlete-1:req-2",
      },
    })
    expect(result).toMatchObject({
      kind: "proposed",
      proposal: { selectionAuthority: "COACH_REQUIRED" },
    })
  })

  it("accepts only an explicitly confirmed, current same-event PB/SB", async () => {
    const input = await fixtureRequest()
    const result = await createPlanAdaptationProposal({
      ...input,
      trigger: {
        kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
        explicitlyConfirmed: true,
        recordId: "record-1",
        purpose: "PERSONAL_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-08-12T00:00:00.000Z",
        sourceRef: "athlete-record:record-1",
        historicalOrBackfilled: false,
      },
    })
    expect(result.kind).toBe("proposed")

    expect(await createPlanAdaptationProposal({
      ...input,
      trigger: {
        kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
        explicitlyConfirmed: true,
        recordId: "record-old",
        purpose: "SEASON_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-07-01T00:00:00.000Z",
        sourceRef: "athlete-record:record-old",
        historicalOrBackfilled: false,
      },
    })).toEqual({ kind: "rejected", code: "INELIGIBLE_TRIGGER" })
    expect(await createPlanAdaptationProposal({
      ...input,
      trigger: {
        kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
        explicitlyConfirmed: true,
        recordId: "record-backfill",
        purpose: "PERSONAL_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-08-12T00:00:00.000Z",
        sourceRef: "athlete-record:record-backfill",
        historicalOrBackfilled: true,
      },
    })).toEqual({ kind: "rejected", code: "INELIGIBLE_TRIGGER" })
  })

  it("rejects same-day PB evidence achieved before the active plan start timestamp", async () => {
    const input = await fixtureRequest()

    const result = await createPlanAdaptationProposal({
      ...input,
      activePlanStartedAt: "2026-08-12T12:00:00.000Z",
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
    })

    expect(result).toEqual({ kind: "rejected", code: "INELIGIBLE_TRIGGER" })
  })

  it("rejects PB evidence exactly equal to the active plan start timestamp", async () => {
    const input = await fixtureRequest()
    const result = await createPlanAdaptationProposal({
      ...input,
      activePlanStartedAt: "2026-08-12T12:00:00.000Z",
      trigger: {
        kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
        explicitlyConfirmed: true,
        recordId: "record-at-start",
        purpose: "PERSONAL_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-08-12T12:00:00.000Z",
        sourceRef: "athlete-record:record-at-start",
        historicalOrBackfilled: false,
      },
    })
    expect(result).toEqual({ kind: "rejected", code: "INELIGIBLE_TRIGGER" })
  })

  it("rejects an exact middle-distance eligibility mismatch", async () => {
    const input = await fixtureRequest()
    expect(await createPlanAdaptationProposal({
      ...input,
      scope: { ...input.scope, eventDistanceM: 800 },
    })).toEqual({ kind: "rejected", code: "CROSS_SCOPE_PROVENANCE" })
  })

  it("rejects when both legacy caller-controlled event values are changed together", async () => {
    const input = await fixtureRequest()
    expect(await createPlanAdaptationProposal({
      ...input,
      scope: { ...input.scope, eventDistanceM: 800 },
      candidateEligibilityEventDistanceM: 800,
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it("rejects a candidate event mutation that was not regenerated from its profile", async () => {
    const input = await fixtureRequest()
    const baseCandidate = { ...input.baseCandidate, eventDistanceM: 800 as const }
    const proposedCandidate = { ...input.proposedCandidate, eventDistanceM: 800 as const }
    expect(await createPlanAdaptationProposal({
      ...input,
      scope: { ...input.scope, eventDistanceM: 800 },
      baseCandidate,
      proposedCandidate,
      baseContentHash: await hashPlanCandidate(baseCandidate),
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it.each([
    ["D9 ACTIVE", { safetyGate: activeGate() }, "SAFETY_BLOCKED"],
    ["D9 UNKNOWN", { safetyGate: unknownGate() }, "SAFETY_BLOCKED"],
    ["stale safety", { createdAt: "2026-08-18T00:11:00.000Z" }, "STALE_SAFETY"],
    ["active hold", { activeHold: true }, "ACTIVE_HOLD"],
  ] as const)("blocks %s with no selectable successor", async (_label, override, code) => {
    const result = await createPlanAdaptationProposal({ ...await fixtureRequest(), ...override })
    expect(result).toEqual({ kind: "blocked", code })
    expect(JSON.stringify(result)).not.toContain("successorCandidate")
  })

  it("rejects unsupported, cross-event, stale-base, no-op and multi-dimension requests", async () => {
    const input = await fixtureRequest()
    expect(await createPlanAdaptationProposal({
      ...input, scope: { ...input.scope, eventDistanceM: 400 },
    })).toEqual({ kind: "rejected", code: "UNSUPPORTED_EVENT" })
    expect(await createPlanAdaptationProposal({
      ...input, scope: { ...input.scope, eventDistanceM: 5000 },
    })).toEqual({ kind: "rejected", code: "CROSS_SCOPE_PROVENANCE" })
    expect(await createPlanAdaptationProposal({
      ...input, baseContentHash: `sha256:${"0".repeat(64)}`,
    })).toEqual({ kind: "rejected", code: "STALE_BASE" })
    expect(await createPlanAdaptationProposal({
      ...input, proposedCandidate: input.baseCandidate,
    })).toEqual({ kind: "rejected", code: "NO_OP" })
    expect(await createPlanAdaptationProposal({
      ...input,
      proposedCandidate: {
        ...input.proposedCandidate,
        selectedEnergyIntent: "VO2_INTENT",
      },
    })).toEqual({ kind: "rejected", code: "MULTIPLE_DIMENSIONS" })
    const firstRpeIndex = input.proposedCandidate.sessions.findIndex(
      (session) => session.prescription.kind === "RPE_TIME_RANGE",
    )
    const arbitrarySessions = input.proposedCandidate.sessions.map((session, index) => {
      if (index !== firstRpeIndex || session.prescription.kind !== "RPE_TIME_RANGE") return session
      return {
        ...session,
        prescription: {
          ...session.prescription,
          durationMinutes: { ...session.prescription.durationMinutes, maximum: 37 },
        },
      }
    })
    expect(await createPlanAdaptationProposal({
      ...input,
      proposedCandidate: { ...input.proposedCandidate, sessions: arbitrarySessions },
    })).toEqual({ kind: "rejected", code: "UNAPPROVED_TRANSFORM" })
  })

  it("rejects malformed provenance and raw private keys", async () => {
    const input = await fixtureRequest()
    expect(await createPlanAdaptationProposal({
      ...input,
      trigger: { ...input.trigger, sourceRef: "athlete-request:other:req-1" },
    })).toEqual({ kind: "rejected", code: "INELIGIBLE_TRIGGER" })
    expect(await createPlanAdaptationProposal({
      ...input,
      trigger: { ...input.trigger, rawNote: "private" },
    } as typeof input)).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(await createPlanAdaptationProposal({ kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST" }))
      .toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it("rejects malformed PACE_TARGET and cyclic candidate input without throwing", async () => {
    const input = await fixtureRequest()
    const qualityIndex = input.proposedCandidate.sessions.findIndex(
      (session) => session.role === "QUALITY",
    )
    const malformedSessions = input.proposedCandidate.sessions.map((session, index) =>
      index === qualityIndex
        ? { ...session, prescription: { kind: "PACE_TARGET" } }
        : session,
    )
    await expect(createPlanAdaptationProposal({
      ...input,
      proposedCandidate: {
        ...input.proposedCandidate,
        sessions: malformedSessions,
      },
    })).resolves.toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })

    const cyclicFrame: Record<string, unknown> = { ...input.baseCandidate.frame }
    cyclicFrame["self"] = cyclicFrame
    await expect(createPlanAdaptationProposal({
      ...input,
      baseCandidate: { ...input.baseCandidate, frame: cyclicFrame },
    })).resolves.toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })
})
