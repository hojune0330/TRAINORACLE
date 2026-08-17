import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u
const STOP_CODES = [
  "STOP_NEW_OR_WORSENING_PAIN",
  "STOP_DIZZINESS_OR_FAINTNESS",
  "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING",
  "STOP_LOSS_OF_CONTROLLED_FORM",
]

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex")}`
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function exactArray(actual, expected, label) {
  invariant(Array.isArray(actual) && JSON.stringify(actual) === JSON.stringify(expected), `${label} mismatch`)
}

export function validateCurrentActivation({ catalog, contract, report, manifest }) {
  let parsed
  try {
    parsed = JSON.parse(manifest)
  } catch {
    throw new Error("current manifest must be valid JSON")
  }
  invariant(isObject(parsed) && parsed.schemaVersion === 1, "current manifest schema mismatch")
  invariant(
    parsed.trustedReviewerAuthorities?.every((authority) => authority.role === "PRODUCT_OWNER_COACH"),
    "trusted owner authority roles mismatch",
  )
  const matchingApprovals = parsed.approvals?.filter((candidate) => candidate.templateId === "V2-SEED-05")
  invariant(matchingApprovals?.length === 1, "V2-SEED-05 approval count mismatch")

  const [approval] = matchingApprovals
  const ownerAuthority = parsed.trustedReviewerAuthorities.find((authority) => (
    authority.authorityEvidenceFingerprint
      === approval.ownerDecision?.authorityEvidenceFingerprint
  ))
  invariant(ownerAuthority?.reviewerId === "COACH_HOJUNE", "invented owner authority")
  invariant(approval.templateVersion === "1.0.0", "template version mismatch")
  invariant(approval.lifecycleStatus === "ACTIVE" && approval.eligibilityStatus === "ELIGIBLE", "V2-SEED-05 must be ACTIVE and ELIGIBLE")
  exactArray(approval.eligibleEventGroups, ["FIVE_K"], "event scope")
  exactArray(approval.eligibleExperienceBands, ["EXPERIENCED"], "experience scope")
  invariant(approval.populationApplicability?.scope === "YOUTH_AND_ADULT", "population scope mismatch")
  invariant(approval.ownerDecision?.role === "PRODUCT_OWNER_COACH" && approval.ownerDecision?.decision === "APPROVED", "owner decision mismatch")
  invariant(approval.ownerDecision?.independentReviewClaimed === false, "independent review must not be claimed")
  invariant(!Object.hasOwn(approval, "reviews"), "fabricated multi-review structure forbidden")

  const content = approval.canonicalTemplateContent
  invariant(content?.notation === "5×1000m @5000m RP · r150″ JOG", "exact JOG notation mismatch")
  const components = content.operationalComponents
  invariant(components?.warmup?.componentRef === "WU-V2-5K-01" && components.warmup.easyDurationMinutes === 15, "warm-up component mismatch")
  invariant(components.warmup.rpeMin === 2 && components.warmup.rpeMax === 3, "warm-up RPE mismatch")
  invariant(components.warmup.strides?.repetitions === 4 && components.warmup.strides.durationSeconds === 20 && components.warmup.strides.recoverySeconds === 40, "stride component mismatch")
  invariant(components?.cooldown?.componentRef === "CD-V2-5K-01" && components.cooldown.easyDurationMinutes === 10 && components.cooldown.rpeMin === 1 && components.cooldown.rpeMax === 2, "cooldown component mismatch")
  invariant(components?.fallback?.code === "RPE_ONLY_CONTROLLED" && components.fallback.behavior === "DELEGATE_TO_EXISTING_RPE_CANDIDATE" && components.fallback.numericRepetitionVariant === null, "numeric downshift forbidden")
  exactArray(components?.stopConditions?.codes, STOP_CODES, "stop conditions")
  invariant(sha256(content) === approval.templateContentFingerprint, "template content fingerprint mismatch")
  invariant(SHA256_PATTERN.test(approval.templateContentFingerprint), "template fingerprint format mismatch")

  const componentValues = [components.warmup, components.cooldown, components.fallback, components.stopConditions]
  exactArray(approval.componentRefs?.map((component) => component.componentFingerprint), componentValues.map(sha256), "component fingerprints")
  invariant(sha256(approval.sportsScienceEvidence?.canonicalEvidence) === approval.sportsScienceEvidence?.canonicalEvidenceFingerprint, "sports-science evidence fingerprint mismatch")
  invariant(approval.populationApplicabilityEvidence.canonicalEvidence.ageOnlyReject === false, "age-only rejection forbidden")
  invariant(approval.populationApplicabilityEvidence.canonicalEvidence.ageOnlyDoseMultiplier === false, "age-only dose multiplier forbidden")
  invariant(sha256(approval.populationApplicabilityEvidence?.canonicalEvidence) === approval.populationApplicabilityEvidence?.canonicalEvidenceFingerprint, "population evidence fingerprint mismatch")
  invariant(sha256(ownerAuthority.authorityEvidenceCanonical) === ownerAuthority.authorityEvidenceFingerprint, "owner authority evidence fingerprint mismatch")

  const blocks = catalog.split(/\n(?=- templateId: )/u).filter((block) => block.startsWith("- templateId: "))
  invariant(blocks.length === 30, "catalog must contain 30 records")
  const active = blocks.filter((block) => block.includes("lifecycleStatus: ACTIVE") || block.includes("eligibilityStatus: ELIGIBLE"))
  invariant(active.length === 1 && /^- templateId: V2-SEED-05\r?$/mu.test(active[0]), "only V2-SEED-05 may be active")
  for (const marker of ["version: \"1.0.0\"", "allowedEventGroups: [FIVE_K]", "allowedExperienceBands: [EXPERIENCED]", "repetitionRecovery: \"150 sec JOG\"", "numericReducedRepetitionVariant: null", ...STOP_CODES]) invariant(active[0].includes(marker), `catalog V2 entry missing ${marker}`)
  invariant(contract.includes("active_numeric_template_exists_in_this_document: V2-SEED-05@1.0.0_ONLY"), "contract current activation mismatch")
  invariant(contract.includes("runtime_repetition_arithmetic_for_downshift: forbidden"), "contract runtime arithmetic guard missing")
  invariant(report.trimEnd().endsWith("[DRAFT_COMPLETE]"), "owner decision final marker missing")
  invariant(report.includes("independent_human_review_claimed: false"), "owner decision honesty boundary missing")
  invariant(report.includes("TRAINORACLE_ADAPTATION"), "source adaptation label missing")

  return Object.freeze({
    templateId: approval.templateId,
    templateVersion: approval.templateVersion,
    activeCount: active.length,
    draftCount: blocks.length - active.length,
    authorityCount: parsed.trustedReviewerAuthorities.length,
    approvalCount: parsed.approvals.length,
    templateContentFingerprint: approval.templateContentFingerprint,
    manifestSha256: sha256(manifest),
    reportSha256: sha256(report),
  })
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
  const [catalog, contract, report, manifest] = await Promise.all([
    readFile(resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"), "utf8"),
    readFile(resolve(root, "specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md"), "utf8"),
    readFile(resolve(root, "reports/review/V2_SEED_05_OWNER_ADOPTION_DECISION_2026-08-17.md"), "utf8"),
    readFile(resolve(root, "app/src/domain/detailed-prescription-manifest.json"), "utf8"),
  ])
  const result = validateCurrentActivation({ catalog, contract, report, manifest })
  process.stdout.write([
    `PASS ${result.templateId}@${result.templateVersion}: current owner activation valid`,
    `active_templates=${result.activeCount}`,
    `draft_templates=${result.draftCount}`,
    `trusted_authorities=${result.authorityCount}`,
    `approvals=${result.approvalCount}`,
    `template_content_fingerprint=${result.templateContentFingerprint}`,
    `manifest_sha256=${result.manifestSha256}`,
    `decision_report_sha256=${result.reportSha256}`,
    "",
  ].join("\n"))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
