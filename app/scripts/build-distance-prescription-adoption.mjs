import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { decisionRef, decisionId, definitions, sourceRefs } from "../../reports/research/distance-prescription-adoption-20260930.mjs"

const target = new URL("../src/domain/distance-prescription-adoption.json", import.meta.url)
const baseline = JSON.parse(readFileSync(new URL("../src/domain/detailed-prescription-manifest.json", import.meta.url), "utf8"))
const seed = baseline.approvals.find(item => item.templateId === "V2-SEED-05")
const hash = value => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`
const adopted = process.argv.includes("--adopt")
const authorityEvidenceCanonical = { decisionId, ownerId: "COACH_HOJUNE", approvedScope: definitions.map(item => `${item.id}@1.0.0`).join("|") }
const authority = { reviewerId: "COACH_HOJUNE", role: "PRODUCT_OWNER_COACH", authorityDecisionId: decisionId,
  authorityEvidenceRef: decisionRef, authorityEvidenceCanonical, authorityEvidenceFingerprint: hash(authorityEvidenceCanonical) }
const scope = { scope: "YOUTH_AND_ADULT", sameEligibilityCriteria: ["FIVE_K", "EXPERIENCED", "CURRENT_SAME_EVENT_ANCHOR"], ageOnlyReject: false, ageOnlyDoseMultiplier: false }
const science = { classification: "TRAINORACLE_ADAPTATION",
  sourceSupports: ["WORK_BOUT_AND_RECOVERY_CHANGE_STIMULUS", "INTERVAL_GUIDANCE", "ACTIVE_RECOVERY_GUIDANCE"],
  sourceDoesNotPrescribe: ["EXACT_COUNTS_DISTANCES_AND_RECOVERIES", "FIVE_K_RP_IS_NOT_MEASURED_VO2MAX", "YOUTH_SPECIFIC_DOSE", "INDIVIDUAL_OPTIMALITY", "WARMUP_OR_COOLDOWN"] }
const approvals = definitions.map(item => {
  if (item.count * item.sets * item.distance > 5000) throw Error(`Dose exceeds reviewed ceiling: ${item.id}`)
  if (item.setRest !== null && item.setRest % 60 !== 0) throw Error(`Set recovery needs an exact supported minute notation: ${item.id}`)
  const work = `${item.count}×${item.distance}m`
  const notation = `${item.sets > 1 ? `${item.sets}×(${work})` : work} @5000m RP · r${item.rest}″ JOG${item.setRest ? ` · R${item.setRest / 60}′ JOG` : ""}`
  const content = { notation, operationalComponents: structuredClone(seed.canonicalTemplateContent.operationalComponents) }
  const approval = structuredClone(seed)
  return { ...approval, templateId: item.id, templateContentFingerprint: hash(content), canonicalTemplateContent: content, notation,
    eventScopeEvidence: { decisionId, evidenceRef: decisionRef, evidenceFingerprint: hash(science) },
    experienceScopeEvidence: { decisionId, evidenceRef: decisionRef, evidenceFingerprint: hash(scope) },
    sportsScienceEvidence: { evidenceId: `${item.id}-SCIENCE-20260930`, decisionRef, sourceRefs,
      canonicalEvidence: science, canonicalEvidenceFingerprint: hash(science) },
    populationApplicabilityEvidence: { evidenceId: `${item.id}-POPULATION-20260930`, decisionRef,
      sourceRefs: ["TO-YOUTH-TRAINING-ELIGIBILITY-2026-08-17", decisionRef], canonicalEvidence: scope, canonicalEvidenceFingerprint: hash(scope) },
    sourceDecisionId: decisionId, sourceEvidenceRef: decisionRef, approvalDecisionId: decisionId,
    decidedAt: "2026-09-30T00:00:00.000Z", expiresAt: "2027-09-30T00:00:00.000Z", revokedAt: null,
    ownerDecision: { ...seed.ownerDecision, authorityDecisionId: decisionId, authorityEvidenceRef: decisionRef, authorityEvidenceFingerprint: authority.authorityEvidenceFingerprint } }
})
const records = definitions.map((item, index) => {
  const approval = approvals[index]
  return { templateRef: { templateId: item.id, version: "1.0.0", fingerprint: approval.templateContentFingerprint },
    method: { familyId: item.family, configurationId: item.id, version: "1.0.0" }, compatibleIntent: "VO2_INTENT", draftRefs: item.draftRefs,
    parameterLimits: { minimumRepSeconds: 60, maximumRepSeconds: 300, maximumQualityDistanceM: 5000 },
    explanation: { version: "1.0.0", identity: { templateId: item.id, templateVersion: "1.0.0", templateContentFingerprint: approval.templateContentFingerprint,
      targetEventDistanceM: 5000, setCount: item.sets, repetitionsPerSet: item.count, repetitionDistanceM: item.distance,
      repetitionRecoverySeconds: item.rest, repetitionRecoveryMode: "JOG", setRecoverySeconds: item.setRest, setRecoveryMode: item.setRest ? "JOG" : "NOT_APPLICABLE" },
      work: item.work, recovery: item.recovery,
      limitation: "개인 기록으로 계산하는 것은 반복별 목표 시간이에요. 거리·횟수·회복은 검토된 기본 구성이고, 개인에게 최적인 양이나 효과를 측정한 값은 아니에요. 성인 연구를 청소년의 효과 보장으로 사용하지 않아요.",
      decisionPath: decisionRef, sourceRecordPath: decisionRef } }
})
const packet = { decisionId, definitions, sourceRefs, parameterLimits: records.map(item => item.parameterLimits), approvals }
const output = { schemaVersion: 1, status: adopted ? "OWNER_ADOPTED" : "PREPARED_AWAITING_OWNER_DECISION", decisionRef,
  packetFingerprint: hash(packet), packet, manifest: { schemaVersion: 1, trustedReviewerAuthorities: [authority], approvals }, records }
const text = `${JSON.stringify(output, null, 2)}\n`
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== text) throw Error("Distance adoption artifact is stale")
} else writeFileSync(target, text)
console.log(`${fileURLToPath(target)}: ${records.length} exact configurations, ${output.status}`)
