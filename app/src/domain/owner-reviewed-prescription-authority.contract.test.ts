import { describe, expect, it } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import {
  OWNER_APPROVAL_RECORD_FINGERPRINT_DOMAIN,
  ownerReviewedDetailedPrescriptionAuthorityMatches as matches,
  type OwnerReviewedDetailedPrescriptionAuthority,
} from "./detailed-prescription-runtime-authority"

function fixture() {
  const approval = structuredClone(DETAILED_PRESCRIPTION_APPROVALS[0])
  if (approval === undefined) throw new Error("Baseline fixture approval is missing")
  const selectedTemplateRef = {
    templateId: approval.templateId, version: approval.templateVersion,
    fingerprint: approval.templateContentFingerprint,
  }
  const authority: OwnerReviewedDetailedPrescriptionAuthority = {
    schemaVersion: 1, kind: "OWNER_REVIEWED_OPERATIONAL_ADOPTION",
    processDecisionId: "TO-OWNER-TRAINING-REVIEW-ROUTE-2026-09-07",
    packetId: "TEST-ONLY", packetVersion: "1", packetFingerprint: `sha256:${"a".repeat(64)}`,
    sourceDigests: [`sha256:${"b".repeat(64)}`], implementationReviewRef: "TEST-REVIEW",
    ownerDecisionId: approval.approvalDecisionId, ownerEvidenceRef: "TEST-OWNER-RESPONSE",
    ownerApprovedPacketFingerprint: `sha256:${"a".repeat(64)}`,
    approvalRecordFingerprint: canonicalJsonFingerprint(OWNER_APPROVAL_RECORD_FINGERPRINT_DOMAIN, approval),
    selectedTemplateRef, targetEventDistanceM: 5000, compatibleIntent: "VO2_INTENT",
    independentExternalReviewClaimed: false, verdict: "APPROVE",
    decidedAt: approval.decidedAt, expiresAt: approval.expiresAt, revokedAt: null,
  }
  const request = { selectedTemplateRef, targetEventDistanceM: 5000,
    selectedEnergyIntent: "VO2_INTENT" as const, evaluatedAt: approval.decidedAt }
  return { authority, request, approval }
}

describe("owner-reviewed operational adoption", () => {
  it("accepts exact synthetic evidence without claiming independent review", () => {
    const f = fixture()
    expect(matches(f.authority, f.request, f.approval)).toBe(true)
  })
  it.each([
    ["packet", { ownerApprovedPacketFingerprint: `sha256:${"c".repeat(64)}` }],
    ["process is not exact approval", { ownerDecisionId: "TO-OWNER-TRAINING-REVIEW-ROUTE-2026-09-07" }],
    ["invented independent review", { independentExternalReviewClaimed: true }],
    ["no sources", { sourceDigests: [] }],
    ["no owner evidence", { ownerEvidenceRef: "" }],
    ["revoked", { revokedAt: "2026-09-07T00:00:00Z" }],
    ["wrong intent", { compatibleIntent: "GLY_INTENT" }],
    ["wrong event", { targetEventDistanceM: 800 }],
  ])("rejects %s", (_name, patch) => {
    const f = fixture()
    expect(matches({ ...f.authority, ...patch }, f.request, f.approval)).toBe(false)
  })
  it("rejects changed manifest content even when template identity is unchanged", () => {
    const f = fixture()
    expect(matches(f.authority, f.request, { ...f.approval, notation: "changed work or recovery" })).toBe(false)
  })
  it("rejects expired and not-yet-valid approval", () => {
    const f = fixture()
    expect(matches(f.authority, { ...f.request, evaluatedAt: f.authority.expiresAt }, f.approval)).toBe(false)
    expect(matches(f.authority, { ...f.request, evaluatedAt: "2000-01-01T00:00:00Z" }, f.approval)).toBe(false)
  })
})
