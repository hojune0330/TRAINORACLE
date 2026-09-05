import { z } from "zod"
import {
  bindDetailedPrescriptionCandidateSet,
  bindOneDetailedPrescriptionCandidate,
  type DetailedPrescriptionPlacement,
  type DetailedPrescriptionTarget,
} from "@impl/plan-generator/candidates"
import { rebindCandidatePairIdentity } from "@impl/plan-generator/candidate-identity"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import type { DetailedTemplateRef, PaceTargetPlanPrescription } from "@impl/plan-generator/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import { loadAthleteRecords } from "./athlete-records"
import { prepareDetailedPrescription } from "./detailed-prescription"
import { resolveDetailedPrescriptionRuntimeAuthority } from "./detailed-prescription-runtime-authority"
import type { PlanBetaIntake } from "./plan-beta-schema"
import { createStoredPaceTargetPrescription } from "./plan-session-schema"
import {
  deriveRecordCurrentness,
  toCurrentSnapshot,
  toRuntimeAnchor,
} from "./pace-target-evidence"

export type { DetailedPrescriptionTarget } from "@impl/plan-generator/candidates"

const selectionSchema = z.object({
  selectedRecordId: z.string().min(1).max(128),
}).strict()

const placementSelectionSchema = selectionSchema.extend({
  selectedTemplateRef: z.object({
    templateId: z.string().min(1),
    version: z.string().min(1),
    fingerprint: z.string().min(1),
  }).strict(),
  target: z.object({
    day: z.number().int().positive(),
    slot: z.enum(["AM", "PM"]),
  }).strict(),
}).strict()

export type DetailedPrescriptionPlacementSelection = z.infer<typeof placementSelectionSchema>

export type CandidatePrescriptionFallbackCode =
  | "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR"
  | "PACE_TARGET_FALLBACK_NO_EXPLICIT_TEMPLATE"
  | "PACE_TARGET_FALLBACK_INVALID_SELECTION"
  | "PACE_TARGET_FALLBACK_ANCHOR_UNAVAILABLE"
  | "PACE_TARGET_FALLBACK_ANCHOR_NOT_CURRENT"
  | "PACE_TARGET_FALLBACK_EVENT_SCOPE"
  | "PACE_TARGET_FALLBACK_EXPERIENCE_SCOPE"
  | "PACE_TARGET_FALLBACK_SAFETY_GATE"
  | "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT"
  | "PACE_TARGET_FALLBACK_INCOMPLETE_TEMPLATE_REF"
  | "PACE_TARGET_FALLBACK_STORED_SCHEMA"
  | "PACE_TARGET_FALLBACK_NO_ELIGIBLE_QUALITY"

export type CandidatePrescriptionBinding =
  | {
      readonly kind: "bound"
      readonly code: "PACE_TARGET_BOUND"
      readonly generated: PlanGenerationSuccess
    }
  | {
      readonly kind: "fallback"
      readonly code: CandidatePrescriptionFallbackCode
      readonly generated: PlanGenerationSuccess
    }

function fallback(
  generated: PlanGenerationSuccess,
  code: CandidatePrescriptionFallbackCode,
): CandidatePrescriptionBinding {
  return Object.freeze({ kind: "fallback", code, generated })
}

type PreparedPrescription =
  | { readonly kind: "prepared"; readonly prescription: PaceTargetPlanPrescription }
  | { readonly kind: "fallback"; readonly code: CandidatePrescriptionFallbackCode }

function preparePrescription(
  intake: PlanBetaIntake,
  safetyGate: SafetyGateDecision,
  selection: unknown,
  evaluatedAt: Date,
  selectedTemplate: DetailedTemplateRef | null,
): PreparedPrescription {
  if (safetyGate.kind === "blocked") return { kind: "fallback", code: "PACE_TARGET_FALLBACK_SAFETY_GATE" }
  if (selectedTemplate === null) return { kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_TEMPLATE" }
  if (selection === undefined) return { kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" }
  const parsedSelection = selectionSchema.safeParse(selection)
  if (!parsedSelection.success) return { kind: "fallback", code: "PACE_TARGET_FALLBACK_INVALID_SELECTION" }
  const record = loadAthleteRecords(evaluatedAt).find(candidate => candidate.id === parsedSelection.data.selectedRecordId)
  if (record === undefined || record.purpose === "RACE_GOAL") return { kind: "fallback", code: "PACE_TARGET_FALLBACK_ANCHOR_UNAVAILABLE" }
  const freshness = deriveRecordCurrentness(record, evaluatedAt)
  if (freshness !== "CURRENT") return { kind: "fallback", code: "PACE_TARGET_FALLBACK_ANCHOR_NOT_CURRENT" }
  if (record.eventDistanceM !== intake.eventDistanceM) return { kind: "fallback", code: "PACE_TARGET_FALLBACK_EVENT_SCOPE" }
  if (intake.experienceBand !== "EXPERIENCED") return { kind: "fallback", code: "PACE_TARGET_FALLBACK_EXPERIENCE_SCOPE" }
  const authority = resolveDetailedPrescriptionRuntimeAuthority({
    selectedTemplateRef: selectedTemplate,
    targetEventDistanceM: intake.eventDistanceM,
    selectedEnergyIntent: intake.trainingFocus,
    evaluatedAt: evaluatedAt.toISOString(),
  })
  if (authority.kind === "fallback") return { kind: "fallback", code: "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT" }
  const approval = authority.approval
  if (!approval.eligibleEventGroups.includes(intake.eventGroup)
      || approval.populationApplicability.scope !== "YOUTH_AND_ADULT") {
    return { kind: "fallback", code: "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT" }
  }
  const anchor = toRuntimeAnchor(record, freshness)
  const snapshot = toCurrentSnapshot(record, freshness, evaluatedAt)
  if (snapshot === null) return { kind: "fallback", code: "PACE_TARGET_FALLBACK_ANCHOR_UNAVAILABLE" }
  const detailed = prepareDetailedPrescription({
    detailedPrescriptionEnabled: true,
    selectedEnergyIntent: intake.trainingFocus,
    templateId: approval.templateId,
    templateVersion: approval.templateVersion,
    templateContentFingerprint: approval.templateContentFingerprint,
    athleteEventGroup: intake.eventGroup,
    targetEventDistanceM: approval.targetEventDistanceM,
    athleteExperienceBand: intake.experienceBand,
    eventScopeEvidenceFingerprint: approval.eventScopeEvidence.evidenceFingerprint,
    experienceScopeEvidenceFingerprint: approval.experienceScopeEvidence.evidenceFingerprint,
    sportsScienceEvidenceFingerprint: approval.sportsScienceEvidence.canonicalEvidenceFingerprint,
    populationApplicability: approval.populationApplicability.scope,
    populationEvidenceFingerprint: approval.populationApplicabilityEvidence.canonicalEvidenceFingerprint,
    componentRefs: approval.componentRefs,
    evaluatedAt: evaluatedAt.toISOString(),
    anchor,
    displayRoundingPolicyVersion: "seconds-v1",
    safetyGate,
  })
  if (detailed === null || detailed.prescription.repetitionDistanceM === null || detailed.totals.qualityDistanceM === null) {
    return { kind: "fallback", code: "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT" }
  }
  const trusted = detailed.approval
  const stored = createStoredPaceTargetPrescription({
    kind: "PACE_TARGET",
    manifestVersion: trusted.manifestVersion,
    templateId: trusted.templateId,
    templateVersion: trusted.templateVersion,
    templateContentFingerprint: trusted.templateContentFingerprint,
    notation: detailed.notation,
    sourceDecisionId: trusted.sourceDecisionId,
    sourceEvidenceRef: trusted.sourceEvidenceRef,
    approvalDecisionId: trusted.approvalDecisionId,
    ownerAuthorityDecisionId: trusted.ownerDecision.authorityDecisionId,
    sportsScienceEvidence: {
      evidenceId: trusted.sportsScienceEvidence.evidenceId,
      decisionRef: trusted.sportsScienceEvidence.decisionRef,
      fingerprint: trusted.sportsScienceEvidence.canonicalEvidenceFingerprint,
    },
    populationApplicabilityEvidence: {
      evidenceId: trusted.populationApplicabilityEvidence.evidenceId,
      decisionRef: trusted.populationApplicabilityEvidence.decisionRef,
      fingerprint: trusted.populationApplicabilityEvidence.canonicalEvidenceFingerprint,
    },
    scope: {
      eventGroup: intake.eventGroup,
      experienceBand: "EXPERIENCED",
      population: "YOUTH_AND_ADULT",
      eventEvidenceFingerprint: trusted.eventScopeEvidence.evidenceFingerprint,
      experienceEvidenceFingerprint: trusted.experienceScopeEvidence.evidenceFingerprint,
    },
    componentRefs: trusted.componentRefs,
    operationalComponents: trusted.canonicalTemplateContent.operationalComponents,
    setCount: detailed.prescription.setCount,
    repetitionsPerSet: detailed.prescription.repetitionsPerSet,
    repetitionDistanceM: detailed.prescription.repetitionDistanceM,
    targetEventDistanceM: detailed.prescription.paceTargetEventDistanceM,
    targetRepSeconds: detailed.pace.targetRepSeconds,
    selectedAnchor: snapshot,
    displayRoundingPolicyVersion: detailed.pace.displayRoundingPolicyVersion,
    repetitionRecoverySeconds: detailed.prescription.repetitionRecoverySeconds,
    repetitionRecoveryMode: detailed.prescription.repetitionRecoveryMode,
    setRecoverySeconds: detailed.prescription.setRecoverySeconds,
    setRecoveryMode: detailed.prescription.setRecoveryMode,
    totals: detailed.totals,
    stopCodes: trusted.canonicalTemplateContent.operationalComponents.stopConditions.codes,
    fallbackCode: "RPE_ONLY_CONTROLLED",
  })
  return stored === null
    ? { kind: "fallback", code: "PACE_TARGET_FALLBACK_STORED_SCHEMA" }
    : { kind: "prepared", prescription: stored }
}

export function bindDetailedPrescriptionCandidates(
  generated: PlanGenerationSuccess,
  intake: PlanBetaIntake,
  safetyGate: SafetyGateDecision,
  selection: unknown,
  evaluatedAt: Date,
  target?: DetailedPrescriptionTarget,
): CandidatePrescriptionBinding {
  const prepared = preparePrescription(
    intake,
    safetyGate,
    selection,
    evaluatedAt,
    intake.selectedDetailedTemplateRef,
  )
  if (prepared.kind === "fallback") return fallback(generated, prepared.code)

  if (generated.candidates.some((candidate) => (
    candidate.selectedEnergyIntent !== intake.trainingFocus
  ))) {
    return fallback(generated, "PACE_TARGET_FALLBACK_NO_ELIGIBLE_QUALITY")
  }
  const balanced = bindOneDetailedPrescriptionCandidate(generated.candidates[0], prepared.prescription, target)
  const conservative = bindOneDetailedPrescriptionCandidate(generated.candidates[1], prepared.prescription, target)
  if (balanced === null || conservative === null) {
    return fallback(generated, "PACE_TARGET_FALLBACK_NO_ELIGIBLE_QUALITY")
  }
  const candidates = rebindCandidatePairIdentity([balanced, conservative])
  return Object.freeze({
    kind: "bound",
    code: "PACE_TARGET_BOUND",
    generated: Object.freeze({
      ...generated,
      pairId: candidates[0].pairId,
      candidates,
      audit: Object.freeze({
        ...generated.audit,
        codes: Object.freeze([
          ...generated.audit.codes.filter((code) => code !== "BETA_DURATION_RPE_ONLY"),
          "PACE_TARGET_BOUND" as const,
        ]),
      }),
    }),
  })
}

export function bindDetailedPrescriptionPlacements(
  generated: PlanGenerationSuccess,
  intake: PlanBetaIntake,
  safetyGate: SafetyGateDecision,
  selections: readonly DetailedPrescriptionPlacementSelection[],
  evaluatedAt: Date,
): CandidatePrescriptionBinding {
  const parsed = z.array(placementSelectionSchema).min(1).max(3).safeParse(selections)
  if (!parsed.success) return fallback(generated, "PACE_TARGET_FALLBACK_INVALID_SELECTION")
  if (generated.candidates.some(candidate => candidate.selectedEnergyIntent !== intake.trainingFocus)) {
    return fallback(generated, "PACE_TARGET_FALLBACK_NO_ELIGIBLE_QUALITY")
  }
  const placements: DetailedPrescriptionPlacement[] = []
  for (const selection of parsed.data) {
    const prepared = preparePrescription(
      intake,
      safetyGate,
      { selectedRecordId: selection.selectedRecordId },
      evaluatedAt,
      selection.selectedTemplateRef,
    )
    if (prepared.kind === "fallback") return fallback(generated, prepared.code)
    placements.push(Object.freeze({ target: selection.target, prescription: prepared.prescription }))
  }
  const balanced = bindDetailedPrescriptionCandidateSet(generated.candidates[0], placements)
  const conservative = bindDetailedPrescriptionCandidateSet(generated.candidates[1], placements)
  if (balanced === null || conservative === null) return fallback(generated, "PACE_TARGET_FALLBACK_NO_ELIGIBLE_QUALITY")
  const candidates = rebindCandidatePairIdentity([balanced, conservative])
  return Object.freeze({
    kind: "bound",
    code: "PACE_TARGET_BOUND",
    generated: Object.freeze({
      ...generated,
      pairId: candidates[0].pairId,
      candidates,
      audit: Object.freeze({
        ...generated.audit,
        codes: Object.freeze([
          ...generated.audit.codes.filter(code => code !== "BETA_DURATION_RPE_ONLY"),
          "PACE_TARGET_BOUND" as const,
        ]),
      }),
    }),
  })
}
