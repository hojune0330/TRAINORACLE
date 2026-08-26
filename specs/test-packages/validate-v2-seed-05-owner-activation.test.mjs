import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { validateCurrentActivation } from "./validate-v2-seed-05-owner-activation.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

async function inputs() {
  const [catalog, contract, report, manifest] = await Promise.all([
    readFile(resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"), "utf8"),
    readFile(resolve(root, "specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md"), "utf8"),
    readFile(resolve(root, "reports/review/V2_SEED_05_OWNER_ADOPTION_DECISION_2026-08-17.md"), "utf8"),
    readFile(resolve(root, "app/src/domain/detailed-prescription-manifest.json"), "utf8"),
  ])
  return { catalog, contract, report, manifest }
}

function mutateManifest(manifest, mutate) {
  const parsed = JSON.parse(manifest)
  const before = JSON.stringify(parsed)
  mutate(parsed)
  const after = JSON.stringify(parsed)
  assert.notEqual(after, before, "hostile manifest mutation must alter its target")
  return after
}

test("accepts exactly one V2-SEED-05 activation beside other approved templates", async () => {
  const result = validateCurrentActivation(await inputs())
  assert.deepEqual({ active: result.activeCount, draft: result.draftCount, authorities: result.authorityCount, approvals: result.approvalCount }, { active: 1, draft: 29, authorities: 2, approvals: 4 })
})

for (const mutation of [
  { name: "JOG to STAND", apply: (approval) => { approval.canonicalTemplateContent.notation = "5×1000m @5000m RP · r150″ STAND" }, expected: /exact JOG notation mismatch/u },
  { name: "missing recovery mode", apply: (approval) => { approval.canonicalTemplateContent.notation = "5×1000m @5000m RP · r150″" }, expected: /exact JOG notation mismatch/u },
  { name: "unknown recovery mode", apply: (approval) => { approval.canonicalTemplateContent.notation = "5×1000m @5000m RP · r150″ FLOAT" }, expected: /exact JOG notation mismatch/u },
  { name: "five to four repetitions", apply: (approval) => { approval.canonicalTemplateContent.notation = "4×1000m @5000m RP · r150″ JOG" }, expected: /exact JOG notation mismatch/u },
  { name: "150 to 120 seconds", apply: (approval) => { approval.canonicalTemplateContent.notation = "5×1000m @5000m RP · r120″ JOG" }, expected: /exact JOG notation mismatch/u },
  { name: "missing warm-up", apply: (approval) => { delete approval.canonicalTemplateContent.operationalComponents.warmup }, expected: /warm-up component mismatch/u },
  { name: "missing cooldown", apply: (approval) => { delete approval.canonicalTemplateContent.operationalComponents.cooldown }, expected: /cooldown component mismatch/u },
  { name: "missing stop conditions", apply: (approval) => { delete approval.canonicalTemplateContent.operationalComponents.stopConditions }, expected: /stop conditions mismatch/u },
  { name: "changed sports-science evidence hash", apply: (approval) => { approval.sportsScienceEvidence.canonicalEvidenceFingerprint = `sha256:${"a".repeat(64)}` }, expected: /sports-science evidence fingerprint mismatch/u },
  { name: "numeric downshift", apply: (approval) => { approval.canonicalTemplateContent.operationalComponents.fallback.numericRepetitionVariant = 4 }, expected: /numeric downshift forbidden/u },
  { name: "youth-adult dose difference", apply: (approval) => { approval.populationApplicabilityEvidence.canonicalEvidence.ageOnlyDoseMultiplier = true }, expected: /age-only dose multiplier forbidden/u },
  { name: "claimed independent review", apply: (approval) => { approval.ownerDecision.independentReviewClaimed = true }, expected: /independent review must not be claimed/u },
]) {
  test(`rejects ${mutation.name}`, async () => {
    const value = await inputs()
    const manifest = mutateManifest(value.manifest, (parsed) => mutation.apply(parsed.approvals[0]))
    assert.throws(() => validateCurrentActivation({ ...value, manifest }), mutation.expected)
  })
}

test("rejects an invented owner authority", async () => {
  const value = await inputs()
  const manifest = mutateManifest(value.manifest, (parsed) => {
    const approval = parsed.approvals.find((candidate) => candidate.templateId === "V2-SEED-05")
    assert.ok(approval, "V2-SEED-05 approval must exist before mutation")
    const authority = parsed.trustedReviewerAuthorities.find((candidate) => (
      candidate.authorityEvidenceFingerprint === approval.ownerDecision.authorityEvidenceFingerprint
    ))
    assert.ok(authority, "V2-SEED-05 owner authority must exist before mutation")
    authority.reviewerId = "INVENTED_OWNER"
  })
  assert.throws(() => validateCurrentActivation({ ...value, manifest }), /invented owner authority/u)
})

test("rejects a second active seed", async () => {
  const value = await inputs()
  const catalog = value.catalog.replace(/(- templateId: BA-SEED-01\r?\n  version: "0.1"\r?\n  lifecycleStatus:) DRAFT/u, "$1 ACTIVE")
  assert.notEqual(catalog, value.catalog)
  assert.throws(() => validateCurrentActivation({ ...value, catalog }), /only V2-SEED-05 may be active/u)
})

test("rejects a missing or additional runtime allowlist entry", async () => {
  const value = await inputs()
  for (const contract of [
    value.contract.replace(/    - MD-3000-01@1\.0\.0\r?\n/u, ""),
    value.contract.replace(/    - MD-3000-01@1\.0\.0\r?\n/u, "    - MD-3000-01@1.0.0\n    - UNAPPROVED-01@1.0.0\n"),
  ]) {
    assert.notEqual(contract, value.contract, "hostile allowlist mutation must alter its target")
    assert.throws(() => validateCurrentActivation({ ...value, contract }), /contract active numeric template allowlist mismatch/u)
  }
})
