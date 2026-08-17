import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import manifestSource from "./detailed-prescription-manifest.json"
import {
  DETAILED_PRESCRIPTION_APPROVALS,
  TRUSTED_REVIEWER_AUTHORITIES,
  canonicalizeDetailedPrescriptionTemplateContent,
  parseDetailedPrescriptionManifest,
  resolveDetailedPrescriptionApproval,
  type DetailedPrescriptionApprovalRequest,
} from "./detailed-prescription-approvals"

function sha256(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`
}

const manifest = parseDetailedPrescriptionManifest(manifestSource)
if (manifest === undefined) throw new TypeError("Compiled detailed-prescription manifest is invalid")
const approval = manifest.approvals[0]
if (approval === undefined) throw new TypeError("V2-SEED-05 approval is missing")

const request: DetailedPrescriptionApprovalRequest = {
  templateId: approval.templateId,
  templateVersion: approval.templateVersion,
  templateContentFingerprint: approval.templateContentFingerprint,
  targetEventDistanceM: approval.targetEventDistanceM,
  athleteEventGroup: "FIVE_K",
  athleteExperienceBand: "EXPERIENCED",
  eventScopeEvidenceFingerprint: approval.eventScopeEvidence.evidenceFingerprint,
  experienceScopeEvidenceFingerprint: approval.experienceScopeEvidence.evidenceFingerprint,
  sportsScienceEvidenceFingerprint: approval.sportsScienceEvidence.canonicalEvidenceFingerprint,
  populationApplicability: "YOUTH_AND_ADULT",
  populationEvidenceFingerprint: approval.populationApplicabilityEvidence.canonicalEvidenceFingerprint,
  componentRefs: approval.componentRefs,
  evaluatedAt: "2026-08-17T03:00:00.000Z",
}

describe("trusted detailed prescription manifest record", () => {
  it("contains only the owner-approved exact runtime templates", () => {
    expect(TRUSTED_REVIEWER_AUTHORITIES).toHaveLength(2)
    expect(DETAILED_PRESCRIPTION_APPROVALS.map((record) => record.templateId)).toEqual([
      "V2-SEED-05",
      "MD-800-01",
      "MD-1500-01",
      "MD-3000-01",
    ])
    expect(TRUSTED_REVIEWER_AUTHORITIES.every((record) => (
      record.role === "PRODUCT_OWNER_COACH"
    ))).toBe(true)
    expect(approval).toMatchObject({
      templateId: "V2-SEED-05",
      templateVersion: "1.0.0",
      lifecycleStatus: "ACTIVE",
      eligibilityStatus: "ELIGIBLE",
      eligibleEventGroups: ["FIVE_K"],
      eligibleExperienceBands: ["EXPERIENCED"],
      populationApplicability: { scope: "YOUTH_AND_ADULT" },
      ownerDecision: { decision: "APPROVED", independentReviewClaimed: false },
    })
    expect(DETAILED_PRESCRIPTION_APPROVALS.every((record) => (
      !Object.hasOwn(record, "reviews")
    ))).toBe(true)
  })

  it("cryptographically binds every authority, evidence, template, and component", () => {
    for (const authority of TRUSTED_REVIEWER_AUTHORITIES) {
      expect(sha256(authority.authorityEvidenceCanonical)).toBe(
        authority.authorityEvidenceFingerprint,
      )
    }
    for (const approvedTemplate of DETAILED_PRESCRIPTION_APPROVALS) {
      expect(
        `sha256:${createHash("sha256")
          .update(canonicalizeDetailedPrescriptionTemplateContent(
            approvedTemplate.canonicalTemplateContent,
          ))
          .digest("hex")}`,
      ).toBe(approvedTemplate.templateContentFingerprint)
      expect(sha256(approvedTemplate.sportsScienceEvidence.canonicalEvidence)).toBe(
        approvedTemplate.sportsScienceEvidence.canonicalEvidenceFingerprint,
      )
      expect(sha256(
        approvedTemplate.populationApplicabilityEvidence.canonicalEvidence,
      )).toBe(
        approvedTemplate.populationApplicabilityEvidence.canonicalEvidenceFingerprint,
      )
      const components = approvedTemplate.canonicalTemplateContent.operationalComponents
      expect(approvedTemplate.componentRefs.map(
        (component) => component.componentFingerprint,
      )).toEqual([
        sha256(components.warmup),
        sha256(components.cooldown),
        sha256(components.fallback),
        sha256(components.stopConditions),
      ])
    }
  })

  it("resolves production authority only for the exact trusted request", () => {
    expect(resolveDetailedPrescriptionApproval(request)).toStrictEqual(approval)
  })

  it.each([
    ["template hash", { templateContentFingerprint: `sha256:${"a".repeat(64)}` }],
    ["sports-science evidence hash", { sportsScienceEvidenceFingerprint: `sha256:${"b".repeat(64)}` }],
    ["population evidence hash", { populationEvidenceFingerprint: `sha256:${"c".repeat(64)}` }],
    ["event scope", { athleteEventGroup: "TEN_K" as const }],
    ["experience scope", { athleteExperienceBand: "DEVELOPING" as const }],
    ["target distance", { targetEventDistanceM: 1500 }],
  ])("rejects a changed %s", (_name, mutation) => {
    expect(mutation).not.toEqual({})
    expect(resolveDetailedPrescriptionApproval({ ...request, ...mutation })).toBeUndefined()
  })

  it("rejects an invented owner authority and an independent-review claim", () => {
    const invented = structuredClone(manifestSource)
    const inventedApproval = invented.approvals[0]
    if (inventedApproval === undefined) throw new TypeError("Mutation target approval is missing")
    inventedApproval.ownerDecision.reviewerId = "INVENTED_OWNER"
    expect(inventedApproval.ownerDecision.reviewerId).not.toBe(approval.ownerDecision.reviewerId)
    expect(parseDetailedPrescriptionManifest(invented)).toBeUndefined()

    const falseClaim = JSON.parse(JSON.stringify(manifestSource).replace('"independentReviewClaimed":false', '"independentReviewClaimed":true'))
    expect(falseClaim).not.toEqual(manifestSource)
    expect(parseDetailedPrescriptionManifest(falseClaim)).toBeUndefined()
  })

  it("rejects age-only dose branches and missing component fingerprints", () => {
    const ageBranch = structuredClone(manifestSource)
    const ageBranchApproval = ageBranch.approvals[0]
    if (ageBranchApproval === undefined) throw new TypeError("Age mutation target approval is missing")
    Object.assign(ageBranchApproval, { ageOnlyDoseMultiplier: 0.8 })
    expect(ageBranchApproval).toHaveProperty("ageOnlyDoseMultiplier")
    expect(parseDetailedPrescriptionManifest(ageBranch)).toBeUndefined()

    const missingComponent = structuredClone(manifestSource)
    const missingComponentApproval = missingComponent.approvals[0]
    if (missingComponentApproval === undefined) throw new TypeError("Component mutation target approval is missing")
    const removed = missingComponentApproval.componentRefs.pop()
    expect(removed).toBeDefined()
    expect(parseDetailedPrescriptionManifest(missingComponent)).toBeUndefined()
  })

  it("deep-freezes the compiled manifest authority surface", () => {
    expect(Object.isFrozen(TRUSTED_REVIEWER_AUTHORITIES)).toBe(true)
    expect(Object.isFrozen(DETAILED_PRESCRIPTION_APPROVALS)).toBe(true)
    expect(Object.isFrozen(approval.canonicalTemplateContent.operationalComponents.warmup.strides)).toBe(true)
  })
})
