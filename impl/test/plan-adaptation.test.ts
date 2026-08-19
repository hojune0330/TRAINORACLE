import { describe, expect, it } from "vitest"
import {
  canonicalJsonSha256,
  createPlanAdaptationProposal,
  hashPlanCandidate,
  verifyPlanAdaptationProposal,
} from "../src/plan-generator/adaptation"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import { RVE_NON_SENSITIVE_REASON_CODES } from "../src/rve/signal"
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
    idempotencyKey: `sha256:${"1".repeat(64)}`,
  }
}

function withEnumerableArrayProperty<T>(
  values: readonly T[],
  key: PropertyKey = "evidenceText",
): T[] {
  const copy = [...values]
  Object.defineProperty(copy, key, {
    value: "raw symptom: chest pain after training",
    enumerable: true,
  })
  return copy
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
        recordId: "00000000-0000-4000-8000-000000000001",
        purpose: "PERSONAL_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-08-12T00:00:00.000Z",
        sourceRef: "athlete-record:00000000-0000-4000-8000-000000000001",
        historicalOrBackfilled: false,
      },
    })
    expect(result.kind).toBe("proposed")

    expect(await createPlanAdaptationProposal({
      ...input,
      trigger: {
        kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
        explicitlyConfirmed: true,
        recordId: "00000000-0000-4000-8000-000000000002",
        purpose: "SEASON_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-07-01T00:00:00.000Z",
        sourceRef: "athlete-record:00000000-0000-4000-8000-000000000002",
        historicalOrBackfilled: false,
      },
    })).toEqual({ kind: "rejected", code: "INELIGIBLE_TRIGGER" })
    expect(await createPlanAdaptationProposal({
      ...input,
      trigger: {
        kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
        explicitlyConfirmed: true,
        recordId: "00000000-0000-4000-8000-000000000003",
        purpose: "PERSONAL_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-08-12T00:00:00.000Z",
        sourceRef: "athlete-record:00000000-0000-4000-8000-000000000003",
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
        recordId: "00000000-0000-4000-8000-000000000004",
        purpose: "PERSONAL_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-08-12T11:59:59.999Z",
        sourceRef: "athlete-record:00000000-0000-4000-8000-000000000004",
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
        recordId: "00000000-0000-4000-8000-000000000005",
        purpose: "PERSONAL_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-08-12T12:00:00.000Z",
        sourceRef: "athlete-record:00000000-0000-4000-8000-000000000005",
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
      baseContentHash: await canonicalJsonSha256("trainoracle.plan-candidate.v1", baseCandidate),
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
      trigger: { ...input.trigger, sourceRef: "athlete-request:athlete-2:req-1" },
    })).toEqual({ kind: "rejected", code: "INELIGIBLE_TRIGGER" })
    expect(await createPlanAdaptationProposal({
      ...input,
      trigger: { ...input.trigger, rawNote: "private" },
    } as typeof input)).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(await createPlanAdaptationProposal({ kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST" }))
      .toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it.each([
    ["idempotency key", (input: Awaited<ReturnType<typeof fixtureRequest>>, value: string) => ({ ...input, idempotencyKey: value })],
    ["athlete identity", (input: Awaited<ReturnType<typeof fixtureRequest>>, value: string) => ({ ...input, scope: { ...input.scope, athleteId: value } })],
    ["explicit request source", (input: Awaited<ReturnType<typeof fixtureRequest>>, value: string) => ({
      ...input,
      trigger: { ...input.trigger, sourceRef: `athlete-request:athlete-1:${value}` },
    })],
  ] as const)("rejects raw prose in the %s", async (_label, mutate) => {
    const input = await fixtureRequest()
    for (const value of [
      "raw symptom: chest pain after training",
      "raw_symptom_chest_pain_after_training",
      "raw-symptom-chest-pain-after-training",
    ]) {
      expect(await createPlanAdaptationProposal(mutate(input, value)))
        .toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    }
  })

  it.each([
    "raw symptom: chest pain after training",
    "raw_symptom_chest_pain_after_training",
    "raw-symptom-chest-pain-after-training",
  ])("rejects raw prose in PB/SB record identity and source reference: %s", async (recordId) => {
    const input = await fixtureRequest()
    expect(await createPlanAdaptationProposal({
      ...input,
      trigger: {
        kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
        explicitlyConfirmed: true,
        recordId,
        purpose: "PERSONAL_BEST",
        eventDistanceM: 1500,
        achievedAt: "2026-08-12T00:00:00.000Z",
        sourceRef: `athlete-record:${recordId}`,
        historicalOrBackfilled: false,
      },
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it("rejects raw prose smuggled through serialized candidate references", async () => {
    const input = await fixtureRequest()
    const rationaleCodes = ["raw_symptom_chest_pain_after_training"]
    const baseCandidate = { ...input.baseCandidate, rationaleCodes }
    const proposedCandidate = { ...input.proposedCandidate, rationaleCodes }

    expect(await createPlanAdaptationProposal({
      ...input,
      baseCandidate,
      proposedCandidate,
      baseContentHash: await canonicalJsonSha256("trainoracle.plan-candidate.v1", baseCandidate),
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it("rejects raw prose smuggled through a candidate identity", async () => {
    const input = await fixtureRequest()
    const baseCandidate = {
      ...input.baseCandidate,
      candidateId: "beta:balanced:raw-symptom-chest-pain:event-1500:developing:lt_intent:single_session_only:varies:projection-9.5:local-civil-9-5:fixture-main-1-fixture-main-2:1-3-5-7-9:no_usable_journal:no-continuity",
    }
    const proposedCandidate = {
      ...input.proposedCandidate,
      candidateId: baseCandidate.candidateId.replace("beta:balanced:", "beta:conservative:"),
    }

    expect(await createPlanAdaptationProposal({
      ...input,
      baseCandidate,
      proposedCandidate,
      baseContentHash: await hashPlanCandidate(baseCandidate),
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it("rejects a rehashed RPE-only candidate with a raw detailed fingerprint suffix", async () => {
    const input = await fixtureRequest()
    const rawFingerprint = "raw-symptom-chest-pain-after-training-1"
    const attachFingerprint = (candidate: typeof input.baseCandidate) => ({
      ...candidate,
      candidateId: `${candidate.candidateId}:pace-target:${rawFingerprint}`,
      detailedPrescriptionFingerprint: rawFingerprint,
    })
    const baseCandidate = attachFingerprint(input.baseCandidate)
    const proposedCandidate = attachFingerprint(input.proposedCandidate)

    const result = await createPlanAdaptationProposal({
      ...input,
      baseCandidate,
      proposedCandidate,
      baseContentHash: await hashPlanCandidate(baseCandidate),
    })

    expect(result).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(JSON.stringify(result)).not.toContain(rawFingerprint)
  })

  it("rejects a raw safety reason code without serializing it", async () => {
    const input = await fixtureRequest()
    const rawReasonCode = "raw-symptom-chest-pain-after-training-1"

    const result = await createPlanAdaptationProposal({
      ...input,
      safetyGate: {
        ...input.safetyGate,
        nonSensitiveReasonCodes: [rawReasonCode],
      },
    })

    expect(result).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(JSON.stringify(result)).not.toContain(rawReasonCode)
  })

  it.each([
    ["string property", "evidenceText"],
    ["symbol property", Symbol("evidenceText")],
  ] as const)("rejects a safety reason-code array with an extra enumerable %s", async (_label, key) => {
    const input = await fixtureRequest()
    const nonSensitiveReasonCodes = withEnumerableArrayProperty(
      input.safetyGate.nonSensitiveReasonCodes,
      key,
    )

    expect(await createPlanAdaptationProposal({
      ...input,
      safetyGate: { ...input.safetyGate, nonSensitiveReasonCodes },
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it("rejects a candidate rationale-code array with an extra enumerable property", async () => {
    const input = await fixtureRequest()
    const mutate = (candidate: typeof input.baseCandidate) => ({
      ...candidate,
      rationaleCodes: withEnumerableArrayProperty(candidate.rationaleCodes),
    })
    const baseCandidate = mutate(input.baseCandidate)
    const proposedCandidate = mutate(input.proposedCandidate)

    expect(await createPlanAdaptationProposal({
      ...input,
      baseCandidate,
      proposedCandidate,
      baseContentHash: input.baseContentHash,
    })).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it.each([
    ["raw audit event", (input: Awaited<ReturnType<typeof fixtureRequest>>) => ({
      ...input.safetyGate,
      audit: { ...input.safetyGate.audit, event: "raw-symptom-chest-pain-after-training-1" },
    })],
    ["raw audit privacy", (input: Awaited<ReturnType<typeof fixtureRequest>>) => ({
      ...input.safetyGate,
      audit: { ...input.safetyGate.audit, privacy: "raw_symptom_chest_pain_after_training_1" },
    })],
    ["extra audit evidence text", (input: Awaited<ReturnType<typeof fixtureRequest>>) => ({
      ...input.safetyGate,
      audit: { ...input.safetyGate.audit, evidenceText: "raw symptom: chest pain after training" },
    })],
    ["raw passed action", (input: Awaited<ReturnType<typeof fixtureRequest>>) => ({
      ...input.safetyGate,
      action: "raw-symptom-chest-pain-after-training-1",
    })],
    ["passed action inconsistent with status", (input: Awaited<ReturnType<typeof fixtureRequest>>) => ({
      ...input.safetyGate,
      action: "BLOCK",
    })],
    ["blocked action inconsistent with required next action", (_input: Awaited<ReturnType<typeof fixtureRequest>>) => ({
      ...activeGate(),
      action: "BLOCK",
      requiredNextAction: "MORE_INFO_OR_HUMAN_REVIEW",
    })],
    ["unknown gate key", (input: Awaited<ReturnType<typeof fixtureRequest>>) => ({
      ...input.safetyGate,
      unknownKey: "raw-symptom-chest-pain-after-training-1",
    })],
    ["ignored status key", (input: Awaited<ReturnType<typeof fixtureRequest>>) => ({
      ...input.safetyGate,
      status: "CLEARED",
    })],
    ["ignored disposition key", (input: Awaited<ReturnType<typeof fixtureRequest>>) => ({
      ...input.safetyGate,
      disposition: "D9_CLEARED",
    })],
  ] as const)("rejects %s at the adaptation safety gate boundary", async (_label, makeSafetyGate) => {
    const input = await fixtureRequest()

    const result = await createPlanAdaptationProposal({
      ...input,
      safetyGate: makeSafetyGate(input),
    })

    expect(result).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(result.kind).not.toBe("proposed")
  })

  it("accepts every closed safety reason code and an empty reason list", async () => {
    const input = await fixtureRequest()
    const reasonLists = [
      [],
      ...RVE_NON_SENSITIVE_REASON_CODES.map((reasonCode) => [reasonCode]),
    ]

    for (const nonSensitiveReasonCodes of reasonLists) {
      expect(await createPlanAdaptationProposal({
        ...input,
        safetyGate: { ...input.safetyGate, nonSensitiveReasonCodes },
      })).toMatchObject({ kind: "proposed" })
    }
  })

  it.each([
    ["D9 ACTIVE", {
      kind: "blocked", action: "BLOCK", planGenerationAllowed: false, requiredNextAction: "HUMAN_REVIEW",
      nonSensitiveReasonCodes: ["D9_ACTIVE_MANUAL_OR_MEDICAL_HOLD"],
      audit: { event: "PLAN_SAFETY_GATE_BLOCKED", privacy: "REASON_CODES_ONLY" },
    }, "blocked"],
    ["D9 UNKNOWN", {
      kind: "blocked", action: "BLOCK_OR_HUMAN_REVIEW", planGenerationAllowed: false, requiredNextAction: "MORE_INFO_OR_HUMAN_REVIEW",
      nonSensitiveReasonCodes: ["D9_UNKNOWN_PAIN_WORSENING"],
      audit: { event: "PLAN_SAFETY_GATE_BLOCKED", privacy: "REASON_CODES_ONLY" },
    }, "blocked"],
    ["D9 CLEARED", {
      kind: "passed", action: "CONTINUE_WITH_OTHER_GATES", planGenerationAllowed: true,
      nonSensitiveReasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
      audit: { event: "PLAN_SAFETY_GATE_PASSED", privacy: "REASON_CODES_ONLY" },
    }, "proposed"],
    ["D9 CLEARED advisory", {
      kind: "passed", action: "CONTINUE_WITH_OTHER_GATES", planGenerationAllowed: true,
      nonSensitiveReasonCodes: ["D9_CLEARED_WITH_NON_BLOCKING_ADVISORY", "D9_ADVISORY_UNLOCALIZED_DISCOMFORT"],
      audit: { event: "PLAN_SAFETY_GATE_PASSED", privacy: "REASON_CODES_ONLY" },
    }, "proposed"],
  ] as const)("preserves the authoritative %s safety gate variant", async (_label, safetyGate, expectedKind) => {
    const result = await createPlanAdaptationProposal({ ...await fixtureRequest(), safetyGate })
    expect(result.kind).toBe(expectedKind)
  })

  it("rejects a rehashed serialized proposal containing a raw idempotency value", async () => {
    const result = await createPlanAdaptationProposal(await fixtureRequest())
    if (result.kind !== "proposed") throw new TypeError("Expected a valid proposal fixture")
    const { proposalId: _proposalId, proposalHash: _proposalHash, ...content } = result.proposal
    const tamperedContent = {
      ...content,
      idempotencyKey: "raw symptom: chest pain after training",
    }
    const proposalHash = await canonicalJsonSha256(
      "trainoracle.plan-adaptation-proposal.v1",
      tamperedContent,
    )

    expect(await verifyPlanAdaptationProposal({
      proposalId: `adaptation:${proposalHash.slice("sha256:".length)}`,
      proposalHash,
      ...tamperedContent,
    })).toBe(false)
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
