import { describe, expect, it } from "vitest"
import {
  canonicalJsonSha256,
  createPlanAdaptationProposal,
  hashPlanCandidate,
  validateApprovedAdaptationTransform,
  verifyPlanAdaptationProposal,
} from "../src/plan-generator/adaptation"
import { projectPlanCandidate } from "../src/plan-generator/candidate-identity"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import { selectPlanCandidate } from "../src/plan-generator/selection"
import type { PlanCandidate, PlanGenerationSuccess } from "../src/plan-generator/types"
import { canonicalFormation } from "./fixtures/canonical-formation"
import { baseRequest, clearedGate, expectGenerated } from "./fixtures/plan-beta-request"

const EVENT_CASES = [
  { eventDistanceM: 800, eventGroup: "MIDDLE_DISTANCE", selectedEnergyIntent: "GLY_INTENT" },
  { eventDistanceM: 1500, eventGroup: "MIDDLE_DISTANCE", selectedEnergyIntent: "MIXED_INTENT" },
  { eventDistanceM: 3000, eventGroup: "MIDDLE_DISTANCE", selectedEnergyIntent: "VO2_INTENT" },
  { eventDistanceM: 5000, eventGroup: "FIVE_K", selectedEnergyIntent: "VO2_INTENT" },
] as const
const EXPERIENCE_BANDS = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const
const AVAILABILITY_CASES = [
  { label: "3 days", days: [3, 7, 9] },
  { label: "4 days", days: [1, 3, 7, 9] },
  { label: "5 days", days: [1, 3, 5, 7, 9] },
  { label: "6 days", days: [1, 2, 3, 5, 7, 9] },
  { label: "every day", days: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
] as const
const SECOND_SESSION_MODES = ["SINGLE_SESSION_ONLY", "RECOVERY_PM_ALLOWED"] as const
const PROJECTION_LENGTHS = [7, 9, 10] as const

const MATRIX_CASES = EVENT_CASES.flatMap((event) => EXPERIENCE_BANDS.flatMap(
  (experienceBand) => AVAILABILITY_CASES.flatMap((availability) => SECOND_SESSION_MODES.flatMap(
    (secondSessionMode) => PROJECTION_LENGTHS.map((requestedFrameLength) => ({
      ...event,
      experienceBand,
      availability,
      secondSessionMode,
      requestedFrameLength,
    })),
  )),
))

function topology(candidate: PlanCandidate) {
  return candidate.sessions.map(({ day, slot, role }) => ({ day, slot, role }))
}

function qualitySessions(candidate: PlanCandidate) {
  return candidate.sessions.filter((session) => session.role === "QUALITY")
}

function isRecoveryCompanion(candidate: PlanCandidate, index: number): boolean {
  const session = candidate.sessions[index]
  if (session?.role !== "EASY" || session.plannedEnergyIntent !== "RECOVERY_INTENT") return false
  const sameDay = candidate.sessions.filter((item) => item.day === session.day)
  return sameDay.some((item) => item.role === "QUALITY")
    || (session.slot === "PM" && sameDay.length === 2)
}

function withQualityMaximumCollapsed(
  conservative: PlanCandidate,
): PlanCandidate {
  return {
    ...conservative,
    sessions: conservative.sessions.map((session) => (
      session.role === "QUALITY" && session.prescription.kind === "RPE_TIME_RANGE"
        ? {
            ...session,
            prescription: {
              ...session.prescription,
              durationMinutes: {
                ...session.prescription.durationMinutes,
                maximum: session.prescription.durationMinutes.minimum,
              },
            },
          }
        : session
    )),
  }
}

function selectConservative(
  generated: PlanGenerationSuccess,
  conservative: PlanCandidate,
) {
  return selectPlanCandidate({
    kind: "PLAN_BETA_SELECTION_REQUEST",
    generatedPlan: { ...generated, candidates: [generated.candidates[0], conservative] },
    selectedCandidateId: conservative.candidateId,
    actor: "SELF",
    safetyGate: clearedGate(),
  })
}

function selectForgedPair(
  generated: PlanGenerationSuccess,
  balanced: PlanCandidate,
  conservative: PlanCandidate,
) {
  return selectPlanCandidate({
    kind: "PLAN_BETA_SELECTION_REQUEST",
    generatedPlan: { ...generated, candidates: [balanced, conservative] },
    selectedCandidateId: conservative.candidateId,
    actor: "SELF",
    safetyGate: clearedGate(),
  })
}

function withDurationMutation(
  candidate: PlanCandidate,
  role: "EASY" | "QUALITY",
  minimum: number,
  maximum: number,
): PlanCandidate {
  const targetIndex = candidate.sessions.findIndex((session) => (
    session.role === role
    && session.prescription.kind === "RPE_TIME_RANGE"
    && (role !== "EASY" || session.plannedEnergyIntent === "BASE_INTENT")
  ))
  return {
    ...candidate,
    sessions: candidate.sessions.map((session, index) => (
      index === targetIndex
        && session.role !== "REST"
        && session.prescription.kind === "RPE_TIME_RANGE"
        ? {
            ...session,
            prescription: {
              ...session.prescription,
              durationMinutes: { minimum, maximum },
            },
          }
        : session
    )),
  }
}

describe("support-only candidate pair", () => {
  it.each(MATRIX_CASES)(
    "keeps topology and QUALITY identical for $eventDistanceM m, $experienceBand, $availability.label, $secondSessionMode, projection $requestedFrameLength",
    ({
      eventDistanceM,
      eventGroup,
      selectedEnergyIntent,
      experienceBand,
      availability,
      secondSessionMode,
      requestedFrameLength,
    }) => {
      const generated = expectGenerated(generatePlanCandidates({
        kind: "PLAN_BETA_GENERATION_REQUEST",
        safetyGate: clearedGate(),
        profile: {
          eventGroup,
          eventDistanceM,
          experienceBand,
          availableTrainingDays: availability.days,
          secondSessionMode,
          trainingTimePreference: "VARIES",
        },
        formation: canonicalFormation(),
        requestedFrameLength,
        journalSource: { kind: "NO_USABLE_JOURNAL" },
        selectionAuthority: "SELF",
        selectedEnergyIntent,
        selectedDetailedTemplateRef: null,
      }))
      const [balanced, conservative] = generated.candidates

      expect(topology(conservative)).toStrictEqual(topology(balanced))
      expect(conservative.sessions.map((session) => session.plannedEnergyIntent))
        .toStrictEqual(balanced.sessions.map((session) => session.plannedEnergyIntent))
      expect(qualitySessions(conservative)).toStrictEqual(qualitySessions(balanced))
      expect(qualitySessions(balanced).length).toBeLessThanOrEqual(2)
      expect(conservative.mainExposureLedger).toStrictEqual(balanced.mainExposureLedger)
      expect(new Set(balanced.mainExposureLedger.countedExposureIds).size)
        .toBe(balanced.mainExposureLedger.mainExposureCount)
      expect(balanced.candidateId).toMatch(/:candidate-sha256-[a-f0-9]{64}(?::pace-target:|$)/u)
      expect(conservative.candidateId).toMatch(/:candidate-sha256-[a-f0-9]{64}(?::pace-target:|$)/u)
      expect(conservative.candidateId).not.toBe(balanced.candidateId)

      let comparableSupportCount = 0
      let shorterSupportCount = 0
      for (const [index, session] of balanced.sessions.entries()) {
        const shorter = conservative.sessions[index]
        if (session.role !== "EASY" || shorter?.role !== "EASY") continue
        if (isRecoveryCompanion(balanced, index)) {
          expect(shorter).toStrictEqual(session)
          expect(shorter.prescription.rpe.minimum).toBeGreaterThanOrEqual(1)
          expect(shorter.prescription.rpe.maximum).toBeLessThanOrEqual(3)
          continue
        }
        comparableSupportCount += 1
        expect(shorter.prescription.rpe).toStrictEqual(session.prescription.rpe)
        expect(shorter.prescription.durationMinutes.minimum)
          .toBe(session.prescription.durationMinutes.minimum)
        expect(shorter.prescription.durationMinutes.maximum)
          .toBe(session.prescription.durationMinutes.minimum)
        expect(shorter.prescription.durationMinutes.maximum)
          .toBeLessThanOrEqual(session.prescription.durationMinutes.maximum)
        if (shorter.prescription.durationMinutes.maximum
            < session.prescription.durationMinutes.maximum) shorterSupportCount += 1
      }
      expect(comparableSupportCount).toBeGreaterThan(0)
      expect(shorterSupportCount).toBeGreaterThan(0)
    },
  )

  it("rejects a QUALITY-duration mutation at the retained identity boundary", () => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const [balanced, supportOnly] = generated.candidates
    const qualityMutated = withQualityMaximumCollapsed(supportOnly)

    expect(validateApprovedAdaptationTransform(balanced, supportOnly, "VOLUME"))
      .toEqual({ kind: "approved", changeDimension: "VOLUME" })
    expect(validateApprovedAdaptationTransform(balanced, qualityMutated, "VOLUME"))
      .toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })

  it("rejects coordinated support-duration forgery with retained candidate and pair identities", () => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const balanced = withDurationMutation(generated.candidates[0], "EASY", 999, 1000)
    const conservative = withDurationMutation(generated.candidates[1], "EASY", 999, 999)

    expect(selectForgedPair(generated, balanced, conservative)).toMatchObject({
      kind: "rejected",
      code: "STALE_CANDIDATE_FINGERPRINT",
    })
  })

  it("rejects coordinated QUALITY forgery with retained candidate and pair identities", () => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const balanced = withDurationMutation(generated.candidates[0], "QUALITY", 999, 1000)
    const conservative = withDurationMutation(generated.candidates[1], "QUALITY", 999, 1000)

    expect(selectForgedPair(generated, balanced, conservative)).toMatchObject({
      kind: "rejected",
      code: "STALE_CANDIDATE_FINGERPRINT",
    })
  })

  it("rejects topology, stale identity, and coordinated MAIN-link mutations at selection", () => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const [balanced, conservative] = generated.candidates
    const supportOnly = conservative
    const staleCandidateId = supportOnly.candidateId.replace(":1-3-5-7-9:", ":1-3-5-7-10:")
    const nextExposureIds = ["fixture-main-1", "fixture-main-3"] as const
    const coordinatedMainMutation = {
      ...supportOnly,
      candidateId: supportOnly.candidateId.replace(
        "fixture-main-1-fixture-main-2",
        "fixture-main-1-fixture-main-3",
      ),
      mainExposureLedger: {
        mainExposureCount: 2 as const,
        fingerprint: nextExposureIds.join(":"),
        countedExposureIds: nextExposureIds,
      },
    }
    expect(staleCandidateId).not.toBe(supportOnly.candidateId)

    expect(selectConservative(generated, {
      ...supportOnly,
      sessions: supportOnly.sessions.slice(1),
    })).toMatchObject({ kind: "rejected" })
    expect(selectConservative(generated, {
      ...supportOnly,
      candidateId: staleCandidateId,
    })).toMatchObject({ kind: "rejected" })
    expect(selectConservative(generated, coordinatedMainMutation))
      .toMatchObject({ kind: "rejected" })
  })

  it("binds the derived candidate hash and rejects an altered proposal under the stale hash", async () => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const [balanced, conservative] = generated.candidates
    const supportOnly = conservative
    const candidateDigest = balanced.candidateId.match(/:candidate-sha256-([a-f0-9]{64})/u)?.[1]
    expect(candidateDigest).toBeDefined()
    expect(`sha256:${candidateDigest}`).toBe(await canonicalJsonSha256(
      "trainoracle.plan-candidate-identity.v1",
      projectPlanCandidate(balanced),
    ))
    const baseContentHash = await hashPlanCandidate(balanced)
    const proposedContentHash = await hashPlanCandidate(supportOnly)
    const result = await createPlanAdaptationProposal({
      kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
      scope: {
        athleteId: "athlete-1",
        eventDistanceM: 1500,
        pairId: balanced.pairId,
        selectedDetailedTemplateRef: balanced.selectedDetailedTemplateRef,
      },
      activePlanStartedAt: "2026-08-01T00:00:00.000Z",
      baseCandidate: balanced,
      proposedCandidate: supportOnly,
      baseContentHash,
      proposalOrigin: "SELF_SERVICE",
      trigger: {
        kind: "EXPLICIT_REQUEST",
        requestedBy: "ATHLETE",
        sourceRef: "athlete-request:athlete-1:req-1",
      },
      changeDimension: "VOLUME",
      safetyGate: clearedGate(),
      safetyEvaluatedAt: "2026-08-18T00:00:00.000Z",
      safetyValidUntil: "2026-08-18T00:10:00.000Z",
      activeHold: false,
      createdAt: "2026-08-18T00:05:00.000Z",
      idempotencyKey: `sha256:${"1".repeat(64)}`,
    })
    if (result.kind !== "proposed") throw new TypeError(`Expected proposal, received ${result.kind}`)
    expect(result.proposal.proposedContentHash).toBe(proposedContentHash)
    expect(await verifyPlanAdaptationProposal({
      ...result.proposal,
      successorCandidate: { ...supportOnly, sessions: supportOnly.sessions.slice(1) },
    })).toBe(false)
  })
})
