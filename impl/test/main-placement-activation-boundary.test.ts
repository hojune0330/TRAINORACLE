import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createPlanAdaptationProposal,
  hashPlanCandidate,
  isVerifiedPlanCandidate,
  verifyPlanAdaptationProposal,
  type PlanAdaptationProposalRequest,
} from "../src/plan-generator/adaptation"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import * as placement from "../src/plan-generator/main-placement-policy"
import { selectPlanCandidate } from "../src/plan-generator/selection"
import type { PlanSession } from "../src/plan-generator/types"
import { parsePrescriptionSequence } from "../src/prescription/sequence"
import { baseRequest, clearedGate, expectGenerated } from "./fixtures/plan-beta-request"

afterEach(() => vi.restoreAllMocks())

function legacyPlacement(): placement.MainPlacementContext {
  const refs = ["LEGACY-FIXTURE-A", "LEGACY-FIXTURE-B"].map((templateId, index) => ({
    templateId, version: "1.0.0", fingerprint: `sha256:${String(index + 1).repeat(64)}`,
  }))
  const noRecovery = { mode: "NOT_APPLICABLE", seconds: null } as const
  const sessions = refs.map((ref, index) => {
    const parsed = parsePrescriptionSequence({
      kind: "PRESCRIPTION_SEQUENCE", version: 2, id: ref.templateId, label: null,
      warmup: [], cooldown: [], terminalRecovery: noRecovery,
      main: [{
        kind: "segment", id: "work", label: null, repeatCount: index === 0 ? 5 : 10,
        work: { kind: "distance", distanceM: index === 0 ? 1000 : 500, durationSeconds: null },
        target: { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null },
        recoveryBetweenRepeats: { mode: "JOG", seconds: index === 0 ? 150 : 60 },
        recoveryAfter: noRecovery,
      }],
    })
    if (parsed.kind !== "parsed") throw new Error("Invalid structural fixture")
    // Structural compatibility fixture only. It deliberately cannot pass the
    // exact production prescription parser and is never used as an active plan.
    return {
      day: index === 0 ? 3 : 7, slot: "AM", role: "QUALITY", plannedEnergyIntent: "VO2_INTENT",
      prescription: {
        kind: "PACE_TARGET", templateId: ref.templateId, templateVersion: ref.version,
        templateContentFingerprint: ref.fingerprint, targetEventDistanceM: 5000,
        scope: { eventGroup: "FIVE_K", experienceBand: "EXPERIENCED", population: "YOUTH_AND_ADULT" },
        sequence: parsed.sequence,
      },
    } as unknown as PlanSession
  })
  return { eventDistanceM: 5000, selectedEnergyIntent: "VO2_INTENT", selectedDetailedTemplateRef: refs[0]!, sessions }
}

function syntheticPolicy(context: placement.MainPlacementContext): placement.ReviewedMainPlacementPolicy {
  return {
    policyId: "TEST-ONLY-NOT-ACTIVATION", version: "1", reviewRef: "test-only:placement",
    eventDistanceM: 5000, energyIntent: "VO2_INTENT", experienceBand: "EXPERIENCED", population: "YOUTH_AND_ADULT",
    allowedTemplates: context.sessions.flatMap(session => session.prescription.kind === "PACE_TARGET" ? [{
      templateId: session.prescription.templateId, version: session.prescription.templateVersion,
      fingerprint: session.prescription.templateContentFingerprint,
    }] : []),
    maximumDetailedSessions: 2, minimumSeparationSlots: 2, allowRepeatedConfiguration: false,
  }
}

async function adaptationRequest(): Promise<PlanAdaptationProposalRequest> {
  const [baseCandidate, proposedCandidate] = expectGenerated(generatePlanCandidates(baseRequest())).candidates
  return {
    kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
    scope: { athleteId: "athlete-1", eventDistanceM: 1500, pairId: baseCandidate.pairId, selectedDetailedTemplateRef: null },
    activePlanStartedAt: "2026-08-01T00:00:00.000Z", baseCandidate, proposedCandidate,
    baseContentHash: await hashPlanCandidate(baseCandidate), proposalOrigin: "SELF_SERVICE",
    trigger: { kind: "EXPLICIT_REQUEST", requestedBy: "ATHLETE", sourceRef: "athlete-request:athlete-1:req-1" },
    changeDimension: "VOLUME", safetyGate: clearedGate(),
    safetyEvaluatedAt: "2026-08-18T00:00:00.000Z", safetyValidUntil: "2026-08-18T00:10:00.000Z",
    activeHold: false, createdAt: "2026-08-18T00:05:00.000Z", idempotencyKey: `sha256:${"1".repeat(64)}`,
  }
}

describe("legacy MAIN reading versus new activation", () => {
  it("reads structurally distinct legacy multi placement without activating a production policy", () => {
    const context = legacyPlacement()
    const before = JSON.stringify(context)
    expect(placement.REVIEWED_MAIN_PLACEMENT_POLICIES).toEqual([])
    expect(Object.isFrozen(placement.REVIEWED_MAIN_PLACEMENT_POLICIES)).toBe(true)
    expect(placement.isStoredMainPlacement(context)).toBe(true)
    expect(placement.isReviewedMainPlacement(context)).toBe(false)
    expect(placement.isReviewedMainPlacement({ ...context, athleteExperienceBand: "EXPERIENCED" })).toBe(false)
    expect(JSON.stringify(context)).toBe(before)
  })

  it("requires explicit matching athlete experience even for a synthetic reviewed multi policy", () => {
    const context = legacyPlacement()
    const policies = [syntheticPolicy(context)]
    expect(placement.isReviewedMainPlacement({ ...context, athleteExperienceBand: "EXPERIENCED" }, policies)).toBe(true)
    expect(placement.isReviewedMainPlacement(context, policies)).toBe(false)
    expect(placement.isReviewedMainPlacement({ ...context, athleteExperienceBand: "DEVELOPING" }, policies)).toBe(false)
    expect(placement.REVIEWED_MAIN_PLACEMENT_POLICIES).toEqual([])
  })

  // Guard-wiring tests use real parser-valid RPE candidates and inject only the
  // current-policy verdict. They do not fabricate an approved multi prescription.
  it.each([0, 1] as const)("blocks new selection when candidate %s fails current placement, not legacy parsing", index => {
    const generatedPlan = expectGenerated(generatePlanCandidates(baseRequest()))
    const request = { kind: "PLAN_BETA_SELECTION_REQUEST", generatedPlan,
      selectedCandidateId: generatedPlan.candidates[0].candidateId, actor: "SELF", safetyGate: clearedGate() }
    expect(selectPlanCandidate(request).kind).toBe("selected")
    const rejected = generatedPlan.candidates[index]
    const original = placement.isReviewedMainPlacement
    const policy = vi.spyOn(placement, "isReviewedMainPlacement").mockImplementation(context => context === rejected ? false : original(context))
    expect(generatedPlan.candidates.every(isVerifiedPlanCandidate)).toBe(true)
    expect(selectPlanCandidate(request)).toMatchObject({ kind: "rejected", code: "NON_SELECTABLE_PLAN_RESULT" })
    expect(policy).toHaveBeenCalledWith(rejected)
  })

  it("rejects a new successor at creation and verification even though both candidates remain readable", async () => {
    const request = await adaptationRequest()
    const control = await createPlanAdaptationProposal(request)
    expect(control.kind).toBe("proposed")
    if (control.kind !== "proposed") throw new Error("Expected valid proposal control")
    expect(await verifyPlanAdaptationProposal(control.proposal)).toBe(true)
    const original = placement.isReviewedMainPlacement
    const policy = vi.spyOn(placement, "isReviewedMainPlacement").mockImplementation(context => (
      context === request.proposedCandidate ? false : original(context)
    ))
    expect(isVerifiedPlanCandidate(request.baseCandidate)).toBe(true)
    expect(isVerifiedPlanCandidate(request.proposedCandidate)).toBe(true)
    expect(await createPlanAdaptationProposal(request)).toEqual({ kind: "rejected", code: "UNAPPROVED_TRANSFORM" })
    expect(await verifyPlanAdaptationProposal(control.proposal)).toBe(false)
    expect(policy).toHaveBeenCalledWith(request.proposedCandidate)
  })

  it("does not require current placement approval on the already stored base", async () => {
    const request = await adaptationRequest()
    const original = placement.isReviewedMainPlacement
    const policy = vi.spyOn(placement, "isReviewedMainPlacement").mockImplementation(context => (
      context === request.baseCandidate ? false : original(context)
    ))
    expect(isVerifiedPlanCandidate(request.baseCandidate)).toBe(true)
    const result = await createPlanAdaptationProposal(request)
    expect(result.kind).toBe("proposed")
    if (result.kind !== "proposed") throw new Error("Stored base was incorrectly gated")
    expect(await verifyPlanAdaptationProposal(result.proposal)).toBe(true)
    expect(policy).not.toHaveBeenCalledWith(request.baseCandidate)
    expect(policy).toHaveBeenCalledWith(request.proposedCandidate)
  })
})
