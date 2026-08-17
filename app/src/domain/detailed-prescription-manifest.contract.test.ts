import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  DETAILED_PRESCRIPTION_APPROVALS,
  TRUSTED_REVIEWER_AUTHORITIES,
  canonicalizeDetailedPrescriptionTemplateContent,
  isDetailedPrescriptionApprovalApplicable,
  parseDetailedPrescriptionManifest,
  resolveDetailedPrescriptionApproval,
  type DetailedPrescriptionApprovalRecord,
  type DetailedPrescriptionApprovalRequest,
  type DetailedPrescriptionReviewerApproval,
  type TrustedReviewerAuthority,
} from "./detailed-prescription-approvals"

const SHA_A = "sha256:d3ecac32a868f85a138e9f93fbe69ca7407b7ec41d3589c546871f56ce3afdc2"
const SHA_B = `sha256:${"b".repeat(64)}`
const SHA_C = `sha256:${"c".repeat(64)}`
const SHA_D = `sha256:${"d".repeat(64)}`
const SHA_E = `sha256:${"e".repeat(64)}`

const REQUEST: DetailedPrescriptionApprovalRequest = {
  templateId: "SYNTHETIC-TRUSTED-TEMPLATE",
  templateVersion: "2.0.0",
  templateContentFingerprint: SHA_A,
  athleteEventGroup: "FIVE_K",
  athleteExperienceBand: "EXPERIENCED",
  eventScopeEvidenceFingerprint: SHA_D,
  experienceScopeEvidenceFingerprint: SHA_E,
  populationApplicability: "YOUTH_AND_ADULT",
  populationEvidenceFingerprint: SHA_B,
  componentRefs: [{
    componentType: "WARMUP",
    componentRef: "component:warmup:test",
    componentVersion: "1.0.0",
    componentFingerprint: SHA_C,
  }],
  evaluatedAt: "2026-08-17T00:00:00.000Z",
}

type Role = "OWNER" | "COACH" | "SPORTS_SCIENCE" | "POPULATION_APPLICABILITY"

function review<RoleName extends Role>(role: RoleName, suffix: string, qualificationFingerprint: string, evidenceFingerprint: string) {
  return {
    role,
    reviewerId: `reviewer:${suffix}:test`,
    reviewerName: `Synthetic ${suffix}`,
    qualificationAuthorityRef: `qualification-authority:${suffix}:test`,
    qualificationDecisionId: `qualification-decision:${suffix}:test`,
    qualificationEvidenceRef: `qualification-evidence:${suffix}:test`,
    qualificationEvidenceFingerprint: qualificationFingerprint,
    evidenceRef: `evidence:${suffix}:test`,
    evidenceFingerprint,
    decision: "APPROVED" as const,
  }
}

const REVIEWS = {
  OWNER: review("OWNER", "owner", SHA_B, SHA_C),
  COACH: review("COACH", "coach", SHA_C, SHA_D),
  SPORTS_SCIENCE: review("SPORTS_SCIENCE", "sports-science", SHA_D, SHA_E),
  POPULATION_APPLICABILITY: review("POPULATION_APPLICABILITY", "population", SHA_E, SHA_B),
}

const VALID_RECORD: DetailedPrescriptionApprovalRecord = {
  manifestVersion: "1",
  templateId: REQUEST.templateId,
  templateVersion: REQUEST.templateVersion,
  templateContentFingerprint: REQUEST.templateContentFingerprint,
  canonicalTemplateContent: { notation: "5×1000m @5000m RP · r150″" },
  notation: "5×1000m @5000m RP · r150″",
  lifecycleStatus: "ACTIVE",
  eligibilityStatus: "ELIGIBLE",
  eligibleEventGroups: ["FIVE_K"],
  eventScopeEvidence: {
    decisionId: "event-scope-decision:test",
    evidenceRef: "event-scope-evidence:test",
    evidenceFingerprint: SHA_D,
  },
  eligibleExperienceBands: ["EXPERIENCED"],
  experienceScopeEvidence: {
    decisionId: "experience-scope-decision:test",
    evidenceRef: "experience-scope-evidence:test",
    evidenceFingerprint: SHA_E,
  },
  populationApplicability: {
    scope: "YOUTH_AND_ADULT",
    decisionId: "population-scope-decision:test",
    evidenceRef: "population-scope-evidence:test",
    evidenceFingerprint: SHA_B,
  },
  componentRefs: REQUEST.componentRefs,
  sourceDecisionId: "source-decision:test",
  sourceEvidenceRef: "source-evidence:test",
  approvalDecisionId: "approval-decision:test",
  decidedAt: "2026-08-01T00:00:00.000Z",
  expiresAt: "2026-09-01T00:00:00.000Z",
  revokedAt: null,
  reviews: REVIEWS,
}

function authority(reviewEntry: DetailedPrescriptionReviewerApproval): TrustedReviewerAuthority {
  return {
    reviewerId: reviewEntry.reviewerId,
    role: reviewEntry.role,
    qualificationAuthorityRef: reviewEntry.qualificationAuthorityRef,
    qualificationDecisionId: reviewEntry.qualificationDecisionId,
    qualificationEvidenceRef: reviewEntry.qualificationEvidenceRef,
    qualificationEvidenceFingerprint: reviewEntry.qualificationEvidenceFingerprint,
  }
}

const TRUSTED_MANIFEST = parseDetailedPrescriptionManifest({
  schemaVersion: 1,
  trustedReviewerAuthorities: Object.values(REVIEWS).map(authority),
  approvals: [VALID_RECORD],
})
if (TRUSTED_MANIFEST === undefined) throw new TypeError("Synthetic trusted manifest fixture is invalid")

type Mutation = {
  readonly name: string
  readonly apply: () => {
    readonly record: unknown
    readonly originalTarget: unknown
    readonly mutatedTarget: unknown
  }
}

const owner = VALID_RECORD.reviews.OWNER
const mutations: readonly Mutation[] = [
  { name: "wrong template version", apply: () => ({ record: { ...VALID_RECORD, templateVersion: "2.0.1" }, originalTarget: VALID_RECORD.templateVersion, mutatedTarget: "2.0.1" }) },
  { name: "wrong template content fingerprint", apply: () => ({ record: { ...VALID_RECORD, templateContentFingerprint: SHA_C }, originalTarget: VALID_RECORD.templateContentFingerprint, mutatedTarget: SHA_C }) },
  { name: "notation-only tampering", apply: () => ({ record: { ...VALID_RECORD, notation: "4×1000m @5000m RP · r150″" }, originalTarget: VALID_RECORD.notation, mutatedTarget: "4×1000m @5000m RP · r150″" }) },
  { name: "arbitrary legacy qualification without authority", apply: () => ({ record: { ...VALID_RECORD, reviews: { ...REVIEWS, OWNER: { ...owner, qualificationAuthorityRef: "", qualificationRef: "arbitrary" } } }, originalTarget: owner.qualificationAuthorityRef, mutatedTarget: "" }) },
  { name: "missing qualification decision", apply: () => ({ record: { ...VALID_RECORD, reviews: { ...REVIEWS, OWNER: { ...owner, qualificationDecisionId: "" } } }, originalTarget: owner.qualificationDecisionId, mutatedTarget: "" }) },
  { name: "missing qualification evidence fingerprint", apply: () => ({ record: { ...VALID_RECORD, reviews: { ...REVIEWS, OWNER: { ...owner, qualificationEvidenceFingerprint: "" } } }, originalTarget: owner.qualificationEvidenceFingerprint, mutatedTarget: "" }) },
  { name: "missing reviewer evidence", apply: () => ({ record: { ...VALID_RECORD, reviews: { ...REVIEWS, OWNER: { ...owner, evidenceRef: "" } } }, originalTarget: owner.evidenceRef, mutatedTarget: "" }) },
  { name: "duplicate reviewer identity", apply: () => ({ record: { ...VALID_RECORD, reviews: { ...REVIEWS, COACH: { ...REVIEWS.COACH, reviewerId: owner.reviewerId } } }, originalTarget: REVIEWS.COACH.reviewerId, mutatedTarget: owner.reviewerId }) },
  { name: "wrong reviewer role for key", apply: () => ({ record: { ...VALID_RECORD, reviews: { ...REVIEWS, OWNER: { ...owner, role: "COACH" } } }, originalTarget: owner.role, mutatedTarget: "COACH" }) },
  { name: "missing approval decision ID", apply: () => ({ record: { ...VALID_RECORD, approvalDecisionId: "" }, originalTarget: VALID_RECORD.approvalDecisionId, mutatedTarget: "" }) },
  { name: "event mismatch", apply: () => ({ record: { ...VALID_RECORD, eligibleEventGroups: ["TEN_K"] }, originalTarget: VALID_RECORD.eligibleEventGroups, mutatedTarget: ["TEN_K"] }) },
  { name: "missing event scope evidence", apply: () => ({ record: { ...VALID_RECORD, eventScopeEvidence: undefined }, originalTarget: VALID_RECORD.eventScopeEvidence, mutatedTarget: undefined }) },
  { name: "mismatched event scope evidence", apply: () => ({ record: { ...VALID_RECORD, eventScopeEvidence: { ...VALID_RECORD.eventScopeEvidence, evidenceFingerprint: SHA_C } }, originalTarget: VALID_RECORD.eventScopeEvidence.evidenceFingerprint, mutatedTarget: SHA_C }) },
  { name: "experience mismatch", apply: () => ({ record: { ...VALID_RECORD, eligibleExperienceBands: ["DEVELOPING"] }, originalTarget: VALID_RECORD.eligibleExperienceBands, mutatedTarget: ["DEVELOPING"] }) },
  { name: "missing experience scope evidence", apply: () => ({ record: { ...VALID_RECORD, experienceScopeEvidence: undefined }, originalTarget: VALID_RECORD.experienceScopeEvidence, mutatedTarget: undefined }) },
  { name: "mismatched experience scope evidence", apply: () => ({ record: { ...VALID_RECORD, experienceScopeEvidence: { ...VALID_RECORD.experienceScopeEvidence, evidenceFingerprint: SHA_C } }, originalTarget: VALID_RECORD.experienceScopeEvidence.evidenceFingerprint, mutatedTarget: SHA_C }) },
  { name: "population mismatch", apply: () => ({ record: { ...VALID_RECORD, populationApplicability: { ...VALID_RECORD.populationApplicability, scope: "ADULT_ONLY" } }, originalTarget: VALID_RECORD.populationApplicability.scope, mutatedTarget: "ADULT_ONLY" }) },
  { name: "population evidence mismatch", apply: () => ({ record: { ...VALID_RECORD, populationApplicability: { ...VALID_RECORD.populationApplicability, evidenceFingerprint: SHA_C } }, originalTarget: VALID_RECORD.populationApplicability.evidenceFingerprint, mutatedTarget: SHA_C }) },
  { name: "expired record", apply: () => ({ record: { ...VALID_RECORD, expiresAt: REQUEST.evaluatedAt }, originalTarget: VALID_RECORD.expiresAt, mutatedTarget: REQUEST.evaluatedAt }) },
  { name: "revoked record", apply: () => ({ record: { ...VALID_RECORD, revokedAt: "2026-08-10T00:00:00.000Z" }, originalTarget: VALID_RECORD.revokedAt, mutatedTarget: "2026-08-10T00:00:00.000Z" }) },
  { name: "component fingerprint mismatch", apply: () => ({ record: { ...VALID_RECORD, componentRefs: VALID_RECORD.componentRefs.map((component) => ({ ...component, componentFingerprint: SHA_A })) }, originalTarget: SHA_C, mutatedTarget: SHA_A }) },
]

describe("trusted detailed prescription manifest record", () => {
  it("accepts the exact synthetic record and SHA-256 binds canonical content", () => {
    const canonical = canonicalizeDetailedPrescriptionTemplateContent(VALID_RECORD.canonicalTemplateContent)
    const fingerprint = `sha256:${createHash("sha256").update(canonical).digest("hex")}`

    expect(fingerprint).toBe(VALID_RECORD.templateContentFingerprint)
    expect(isDetailedPrescriptionApprovalApplicable(VALID_RECORD, REQUEST, TRUSTED_MANIFEST)).toBe(true)
    for (const approval of DETAILED_PRESCRIPTION_APPROVALS) {
      const content = canonicalizeDetailedPrescriptionTemplateContent(approval.canonicalTemplateContent)
      expect(`sha256:${createHash("sha256").update(content).digest("hex")}`).toBe(approval.templateContentFingerprint)
    }
  })

  it.each(mutations)("rejects $name", ({ apply }) => {
    const mutation = apply()
    expect(mutation.originalTarget).not.toBeUndefined()
    expect(mutation.mutatedTarget).not.toEqual(mutation.originalTarget)
    expect(mutation.record).not.toEqual(VALID_RECORD)
    expect(isDetailedPrescriptionApprovalApplicable(
      mutation.record,
      REQUEST,
      TRUSTED_MANIFEST,
    )).toBe(false)
  })

  it("rejects four fabricated reviewers with valid-looking qualification fields", () => {
    const reviews = {
      OWNER: { ...REVIEWS.OWNER, reviewerId: "fabricated:owner" },
      COACH: { ...REVIEWS.COACH, reviewerId: "fabricated:coach" },
      SPORTS_SCIENCE: { ...REVIEWS.SPORTS_SCIENCE, reviewerId: "fabricated:sports-science" },
      POPULATION_APPLICABILITY: {
        ...REVIEWS.POPULATION_APPLICABILITY,
        reviewerId: "fabricated:population",
      },
    }
    expect(reviews).not.toEqual(VALID_RECORD.reviews)
    expect(new Set(Object.values(reviews).map((reviewer) => reviewer.reviewerId)).size).toBe(4)
    const fabricatedRecord = { ...VALID_RECORD, reviews }
    const fabricatedManifest = parseDetailedPrescriptionManifest({
      schemaVersion: 1,
      trustedReviewerAuthorities: Object.values(REVIEWS).map(authority),
      approvals: [fabricatedRecord],
    })

    expect(isDetailedPrescriptionApprovalApplicable(
      fabricatedRecord,
      REQUEST,
      TRUSTED_MANIFEST,
    )).toBe(false)
    expect(fabricatedManifest).toBeUndefined()
  })

  it("fails closed on malformed manifest boundary shape", () => {
    const malformed = {
      schemaVersion: 1,
      trustedReviewerAuthorities: {},
      approvals: [],
    }
    expect(malformed.trustedReviewerAuthorities).not.toEqual([])

    expect(parseDetailedPrescriptionManifest(malformed)).toBeUndefined()
  })

  it("does not resolve caller-forged lifecycle or eligibility", () => {
    const forgedRequest = {
      ...REQUEST,
      lifecycleStatus: "ACTIVE",
      eligibilityStatus: "ELIGIBLE",
    }

    expect(Object.isFrozen(DETAILED_PRESCRIPTION_APPROVALS)).toBe(true)
    expect(Object.isFrozen(TRUSTED_REVIEWER_AUTHORITIES)).toBe(true)
    expect(DETAILED_PRESCRIPTION_APPROVALS).toHaveLength(0)
    expect(TRUSTED_REVIEWER_AUTHORITIES).toHaveLength(0)
    expect(resolveDetailedPrescriptionApproval(forgedRequest)).toBeUndefined()
  })
})
