import { describe, expect, it } from "vitest"
import manifest from "../../app/src/domain/detailed-prescription-manifest.json"
import {
  bindOneDetailedPrescriptionCandidate,
  type DetailedPrescriptionTarget,
} from "../src/plan-generator/candidates"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import type { PaceTargetPlanPrescription, PlanSession } from "../src/plan-generator/session-types"
import type { PlanCandidate } from "../src/plan-generator/types"
import { baseRequest, expectGenerated } from "./fixtures/plan-beta-request"

const approval = manifest.approvals.find((entry) => entry.templateId === "V2-SEED-05")
if (approval === undefined) throw new Error("Missing approved 5000m fixture")
const templateRef = {
  templateId: approval.templateId,
  version: approval.templateVersion,
  fingerprint: approval.templateContentFingerprint,
}

// Placement-only fixture; the app tests exercise approval and stored-schema validation.
const prescription: PaceTargetPlanPrescription = {
  kind: "PACE_TARGET",
  manifestVersion: approval.manifestVersion,
  templateId: approval.templateId,
  templateVersion: approval.templateVersion,
  templateContentFingerprint: approval.templateContentFingerprint,
  notation: approval.notation,
  sourceDecisionId: approval.sourceDecisionId,
  sourceEvidenceRef: approval.sourceEvidenceRef,
  approvalDecisionId: approval.approvalDecisionId,
  ownerAuthorityDecisionId: approval.ownerDecision.authorityDecisionId,
  sportsScienceEvidence: {
    evidenceId: approval.sportsScienceEvidence.evidenceId,
    decisionRef: approval.sportsScienceEvidence.decisionRef,
    fingerprint: approval.sportsScienceEvidence.canonicalEvidenceFingerprint,
  },
  populationApplicabilityEvidence: {
    evidenceId: approval.populationApplicabilityEvidence.evidenceId,
    decisionRef: approval.populationApplicabilityEvidence.decisionRef,
    fingerprint: approval.populationApplicabilityEvidence.canonicalEvidenceFingerprint,
  },
  scope: {
    eventGroup: "FIVE_K", experienceBand: "EXPERIENCED", population: "YOUTH_AND_ADULT",
    eventEvidenceFingerprint: approval.eventScopeEvidence.evidenceFingerprint,
    experienceEvidenceFingerprint: approval.experienceScopeEvidence.evidenceFingerprint,
  },
  componentRefs: approval.componentRefs as PaceTargetPlanPrescription["componentRefs"],
  operationalComponents: approval.canonicalTemplateContent.operationalComponents as
    PaceTargetPlanPrescription["operationalComponents"],
  setCount: 1, repetitionsPerSet: 5, repetitionDistanceM: 1000,
  targetEventDistanceM: 5000, targetRepSeconds: 222.2,
  selectedAnchor: {
    anchorId: "synthetic-current", kind: "PB", purpose: "CURRENT_CAPABILITY", seasonId: null,
    eventDistanceM: 5000, performanceSeconds: 1111, achievedAt: "2026-07-01",
    enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", freshnessState: "CURRENT",
    sourceRef: "synthetic-record", elapsedLabel: "test",
  },
  displayRoundingPolicyVersion: "seconds-v1",
  repetitionRecoverySeconds: 150, repetitionRecoveryMode: "JOG",
  setRecoverySeconds: null, setRecoveryMode: "NOT_APPLICABLE",
  totals: Object.freeze({
    totalRepetitions: 5, qualityDistanceM: 5000, qualityDurationSeconds: 1111,
    repetitionRecoveryOccurrences: 4, repetitionRecoveryTotalSeconds: 600,
    setRecoveryOccurrences: 0, setRecoveryTotalSeconds: 0, plannedRecoverySeconds: 600,
    mainSessionTotalExcludingWarmupCooldown: 1711, uncomputableReasonCodes: [],
  }),
  stopCodes: approval.canonicalTemplateContent.operationalComponents.stopConditions.codes as
    PaceTargetPlanPrescription["stopCodes"],
  fallbackCode: "RPE_ONLY_CONTROLLED", prescriptionFingerprint: "placement-test-fingerprint",
}
Object.freeze(prescription)

function fixture(slot: "AM" | "PM" = "AM") {
  const request = baseRequest()
  return expectGenerated(generatePlanCandidates({
    ...request,
    profile: {
      ...request.profile, eventGroup: "FIVE_K", eventDistanceM: 5000,
      experienceBand: "EXPERIENCED", secondSessionMode: "RECOVERY_PM_ALLOWED",
      trainingTimePreference: slot === "AM" ? "MORNING" : "EVENING",
    },
    selectedEnergyIntent: "VO2_INTENT", selectedDetailedTemplateRef: templateRef,
  })).candidates[0]
}

function mains(candidate: PlanCandidate) {
  const sessions = candidate.sessions.filter((session) => session.role === "QUALITY")
  expect(sessions).toHaveLength(2)
  const [first, second] = sessions
  if (first === undefined || second === undefined) throw new Error("Missing MAIN fixture")
  return { first, second }
}

describe("detailed prescription exact session targeting", () => {
  it.each(["AM", "PM"] as const)("binds only the second MAIN in %s without changing dose or references", (slot) => {
    const candidate = fixture(slot)
    const before = JSON.stringify(candidate)
    const { first, second } = mains(candidate)
    expect(second.slot).toBe(slot)
    const target = Object.freeze({ day: second.day, slot })
    const result = bindOneDetailedPrescriptionCandidate(candidate, prescription, target)
    expect(result).not.toBeNull()
    if (result === null) throw new Error("Target binding failed")
    expect(result.sessions.filter((session) => session.prescription.kind === "PACE_TARGET")).toHaveLength(1)
    candidate.sessions.forEach((session, index) => {
      const bound = result.sessions[index]
      if (session !== second) expect(bound).toBe(session)
      else {
        expect(bound).toEqual({ ...second, prescription })
        expect(bound?.prescription).toBe(prescription)
      }
    })
    expect(result.sessions).toContain(first)
    expect(result.mainExposureLedger).toBe(candidate.mainExposureLedger)
    expect(result.frame).toBe(candidate.frame)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.sessions)).toBe(true)
    expect(Object.isFrozen(result.sessions.find((session) => session.prescription === prescription))).toBe(true)
    expect(JSON.stringify(candidate)).toBe(before)
    const firstResult = bindOneDetailedPrescriptionCandidate(candidate, prescription, first)
    expect(result.candidateId).not.toBe(firstResult?.candidateId)
  })

  it("keeps the omitted and undefined legacy target on the first eligible MAIN", () => {
    const candidate = fixture()
    const { first, second } = mains(candidate)
    const result = bindOneDetailedPrescriptionCandidate(candidate, prescription)
    expect(result).toEqual(bindOneDetailedPrescriptionCandidate(candidate, prescription, undefined))
    expect(result?.sessions.find((session) => session.prescription === prescription)?.day).toBe(first.day)
    expect(result?.sessions).toContain(second)
    expect(result?.candidateId).toBe(`${candidate.candidateId}:pace-target:${prescription.prescriptionFingerprint}`)
  })

  it.each(["REST", "EASY"] as const)("rejects an exact %s target without redirecting to a MAIN", (role) => {
    const candidate = fixture()
    const target = candidate.sessions.find((session) => session.role === role)
    if (target === undefined) throw new Error(`Missing ${role} fixture`)
    expect(bindOneDetailedPrescriptionCandidate(candidate, prescription, target)).toBeNull()
  })

  it.each([
    { day: 99, slot: "AM" }, { day: 0, slot: "AM" }, { day: 1.5, slot: "AM" },
    { day: Number.NaN, slot: "AM" }, { day: 3, slot: "NIGHT" }, null, {},
  ])("rejects malformed or missing target %j without redirecting", (target) => {
    expect(bindOneDetailedPrescriptionCandidate(fixture(), prescription, target as DetailedPrescriptionTarget)).toBeNull()
  })

  it("rejects a wrong-purpose second MAIN even when the first is eligible", () => {
    const candidate = fixture()
    const { second } = mains(candidate)
    const sessions: readonly PlanSession[] = candidate.sessions.map((session) => session === second
      ? { ...second, plannedEnergyIntent: "GLY_INTENT" } : session)
    expect(bindOneDetailedPrescriptionCandidate({ ...candidate, sessions }, prescription, second)).toBeNull()
  })

  it("rejects duplicate target coordinates including a conflicting REST entry", () => {
    const candidate = fixture()
    const { second } = mains(candidate)
    const duplicate: PlanSession = {
      day: second.day, slot: second.slot, role: "REST",
      plannedEnergyIntent: "RECOVERY_INTENT", prescription: { kind: "REST" },
    }
    for (const extra of [second, duplicate]) {
      expect(bindOneDetailedPrescriptionCandidate(
        { ...candidate, sessions: [...candidate.sessions, extra] }, prescription, second,
      )).toBeNull()
    }
  })

  it("rejects a repeat bind and never duplicates a detailed dose onto another MAIN", () => {
    const candidate = fixture()
    const { first, second } = mains(candidate)
    const bound = bindOneDetailedPrescriptionCandidate(candidate, prescription, second)
    if (bound === null) throw new Error("Initial binding failed")
    for (const target of [undefined, first, second]) {
      expect(bindOneDetailedPrescriptionCandidate(bound, prescription, target)).toBeNull()
    }
  })

  it.each([
    { eventDistanceM: 3000 }, { eventGroup: "MIDDLE_DISTANCE" },
    { selectedDetailedTemplateRef: null },
    { selectedDetailedTemplateRef: { ...templateRef, templateId: "unapproved" } },
    { selectedDetailedTemplateRef: { ...templateRef, version: "unapproved" } },
    { selectedDetailedTemplateRef: { ...templateRef, fingerprint: "unapproved" } },
  ] as const)("retains exact event and template checks for %j", (change) => {
    const candidate = fixture()
    expect(bindOneDetailedPrescriptionCandidate(
      { ...candidate, ...change }, prescription, mains(candidate).second,
    )).toBeNull()
  })
})
