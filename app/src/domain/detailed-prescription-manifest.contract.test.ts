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
  it("contains only the honest owner authority and V2-SEED-05 approval", () => {
    expect(TRUSTED_REVIEWER_AUTHORITIES).toHaveLength(1)
    expect(DETAILED_PRESCRIPTION_APPROVALS).toHaveLength(1)
    expect(TRUSTED_REVIEWER_AUTHORITIES[0]?.role).toBe("PRODUCT_OWNER_COACH")
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
    expect(approval).not.toHaveProperty("reviews")
  })

  it("cryptographically binds canonical authority, evidence, template, and components", () => {
    const authority = TRUSTED_REVIEWER_AUTHORITIES[0]
    if (authority === undefined) throw new TypeError("Trusted owner authority is missing")
    expect(sha256(authority.authorityEvidenceCanonical)).toBe(authority.authorityEvidenceFingerprint)
    expect(`sha256:${createHash("sha256").update(canonicalizeDetailedPrescriptionTemplateContent(approval.canonicalTemplateContent)).digest("hex")}`).toBe(approval.templateContentFingerprint)
    expect(sha256(approval.sportsScienceEvidence.canonicalEvidence)).toBe(approval.sportsScienceEvidence.canonicalEvidenceFingerprint)
    expect(sha256(approval.populationApplicabilityEvidence.canonicalEvidence)).toBe(approval.populationApplicabilityEvidence.canonicalEvidenceFingerprint)

    const components = approval.canonicalTemplateContent.operationalComponents
    expect(approval.componentRefs.map((component) => component.componentFingerprint)).toEqual([
      sha256(components.warmup), sha256(components.cooldown), sha256(components.fallback), sha256(components.stopConditions),
    ])
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
