import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "../..")

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

export const EXPECTED_POLICY = Object.freeze({
  schemaVersion: 1,
  trainingEligibility: Object.freeze({
    ageOnlyReject: false,
    schoolDivisionOnlyReject: false,
    ageOnlyDoseMultiplier: false,
    sexOnlyDoseMultiplier: false,
    schoolDivisionOnlyDoseMultiplier: false,
    allowedGateInputs: Object.freeze([
      "READINESS",
      "SOURCE_TEMPLATE_SCOPE",
      "CURRENT_RECORD",
      "RECENT_LOAD",
      "D9",
      "RECOVERY",
    ]),
  }),
  processingAuthorization: Object.freeze({
    guardianSensitiveProcessingGuard: true,
    sensitiveServerProcessingFailClosed: true,
    accountSyncSharingGuardsPreserved: true,
    baseServiceAvailableWithoutSensitiveConsent: true,
    legalConclusion: false,
  }),
  selectionAuthority: Object.freeze({
    systemTemplate: Object.freeze({
      athleteSelfSelectionAfterAllGates: true,
      lifecycleMustBeActive: true,
      trainingEligibilityMustPass: true,
      processingAuthorizationMustPass: true,
      safetyGateMustPass: true,
    }),
    tenantTemplate: Object.freeze({
      athleteSelfSelectionAllowed: false,
      scopedCoachCapabilityRequired: true,
      tenantScopeRequired: true,
    }),
    coachTemplate: Object.freeze({
      athleteSelfSelectionAllowed: false,
      scopedCoachCapabilityRequired: true,
      ownerCoachScopeRequired: true,
    }),
  }),
})

const POLICY_START = "<!-- MACHINE_POLICY:PERSONALIZED_PRESCRIPTION_V1:START -->"
const POLICY_END = "<!-- MACHINE_POLICY:PERSONALIZED_PRESCRIPTION_V1:END -->"

function parsePolicy(document, documentName) {
  const start = document.indexOf(POLICY_START)
  const end = document.indexOf(POLICY_END)
  invariant(start >= 0 && end > start, `${documentName} missing machine policy block`)
  const body = document.slice(start + POLICY_START.length, end)
  const match = body.match(/```json\s*([\s\S]*?)\s*```/u)
  invariant(match !== null, `${documentName} machine policy must be a JSON code block`)
  try {
    return JSON.parse(match[1])
  } catch (error) {
    throw new Error(`${documentName} machine policy is malformed JSON`, { cause: error })
  }
}

function samePolicy(actual, documentName) {
  invariant(
    JSON.stringify(actual) === JSON.stringify(EXPECTED_POLICY),
    `${documentName} machine policy does not match the approved policy`,
  )
}

function finalMarkerIsClean(document, documentName) {
  const finalNonblank = document.trimEnd().split(/\r?\n/u).at(-1)
  invariant(finalNonblank === "[DRAFT_COMPLETE]", `${documentName} final marker is not clean`)
}

function declaredInteger(document, pattern, label) {
  const match = document.match(pattern)
  invariant(match !== null, `${label} declaration missing`)
  return Number.parseInt(match[1], 10)
}

function countRows(document, pattern) {
  return [...document.matchAll(pattern)].length
}

function validateDocumentCounts(templateLibrary, planGenerator) {
  const templateIssueRows = countRows(templateLibrary, /^\| OI-TL-[^\n]+$/gmu)
  const templateBlockingRows = countRows(templateLibrary, /^\| OI-TL-[^\n]+\| YES \|/gmu)
  const templateSelfCheckRows = countRows(templateLibrary, /^\| SC-TL-\d{3} \|/gmu)
  invariant(
    declaredInteger(templateLibrary, /^  open_issues_total: (\d+)$/mu, "template open issue count")
      === templateIssueRows,
    "template open issue metadata does not match its table",
  )
  invariant(
    declaredInteger(templateLibrary, /^  canonical_blocking_count: (\d+)$/mu, "template blocking count")
      === templateBlockingRows,
    "template canonical blocking metadata does not match its table",
  )
  invariant(
    declaredInteger(templateLibrary, /^  self_check_items_total: (\d+)$/mu, "template self-check count")
      === templateSelfCheckRows,
    "template self-check metadata does not match its table",
  )

  const generatorIssueRows = countRows(planGenerator, /^\| `OI-PG-[^\n]+$/gmu)
  const generatorBlockingRows = countRows(planGenerator, /^\| `OI-PG-[^\n]+\| YES \|/gmu)
  const generatorTestRows = countRows(planGenerator, /^\| `PG-TC-\d{3}` \|/gmu)
  invariant(
    declaredInteger(planGenerator, /^  open_issues_total: (\d+)$/mu, "generator open issue count")
      === generatorIssueRows,
    "generator open issue metadata does not match its table",
  )
  invariant(
    declaredInteger(planGenerator, /^  open_issues_canonical_blocking_count: (\d+)$/mu, "generator blocking count")
      === generatorBlockingRows,
    "generator canonical blocking metadata does not match its table",
  )
  invariant(
    declaredInteger(planGenerator, /^  test_cases_total: (\d+)$/mu, "generator test count")
      === generatorTestRows,
    "generator test metadata does not match its table",
  )
}

export function validateExistingProcessingGuards({ templateLibrary, planGenerator, appBridge }) {
  for (const [document, required] of [
    [templateLibrary, [
      "no_private_free_text_storage",
      "no_medical_rehab_auto_prescription",
      "raw_athlete_free_text",
      "guardian_private_note",
      "symptom_clause",
    ]],
    [planGenerator, [
      "no_profile_privacy_weakening: true",
      "consent_status: ACTIVE",
      "sensitive_profile_field_processing",
      "consent_required_for_sensitive_processing: true",
      "no_legal_determination: true",
    ]],
    [appBridge, [
      "sensitive_processing_requires_active_scoped_consent: true",
      "sensitive_processing_without_consent: BLOCKED",
      "minor_requires_guardian_consent_for_sensitive_processing: true",
      "minor_physiological_processing_without_guardian_consent: BLOCKED",
      "sensitive_consent_must_not_gate_base_service_access: true",
      "legal_review_required_before_production: true",
    ]],
  ]) {
    for (const marker of required) {
      invariant(document.includes(marker), `existing processing guard missing: ${marker}`)
    }
  }

  return Object.freeze({ guardianSensitiveProcessingGuard: true })
}

export function evaluateTrainingEligibility(policy, input) {
  samePolicy(policy, "training eligibility fixture")
  const gateStatus = {
    READINESS: input.readiness,
    SOURCE_TEMPLATE_SCOPE: input.sourceTemplateScope,
    CURRENT_RECORD: input.currentRecord,
    RECENT_LOAD: input.recentLoad,
    D9: input.d9,
    RECOVERY: input.recovery,
  }
  const eligible = policy.trainingEligibility.allowedGateInputs.every(
    (gate) => gateStatus[gate] === "PASS",
  )
  return Object.freeze({
    eligible,
    doseAdjustment: "UNCHANGED",
  })
}

export function validatePersonalizedPrescriptionPolicy({
  templateLibrary,
  planGenerator,
  appBridge,
  decisionReport,
}) {
  const guardSummary = validateExistingProcessingGuards({
    templateLibrary,
    planGenerator,
    appBridge,
  })
  const templatePolicy = parsePolicy(templateLibrary, "TEMPLATE_LIBRARY_SPEC.md")
  const generatorPolicy = parsePolicy(planGenerator, "PLAN_GENERATOR_SPEC.md")
  samePolicy(templatePolicy, "TEMPLATE_LIBRARY_SPEC.md")
  samePolicy(generatorPolicy, "PLAN_GENERATOR_SPEC.md")
  validateDocumentCounts(templateLibrary, planGenerator)
  finalMarkerIsClean(templateLibrary, "TEMPLATE_LIBRARY_SPEC.md")
  finalMarkerIsClean(planGenerator, "PLAN_GENERATOR_SPEC.md")
  invariant(
    decisionReport.includes("supersedes_scope: YOUTH_TRAINING_ELIGIBILITY_DECISION_ONLY"),
    "decision report must supersede only the youth training eligibility decision",
  )
  invariant(
    decisionReport.includes("historical_packet_modified: false"),
    "decision report must preserve the historical packet",
  )
  invariant(
    decisionReport.includes("v2_seed_05_runtime_activation: FORBIDDEN"),
    "decision report must keep V2-SEED-05 activation forbidden",
  )
  finalMarkerIsClean(decisionReport, "decision report")

  return Object.freeze({
    trainingEligibility: Object.freeze({
      ageOnlyReject: templatePolicy.trainingEligibility.ageOnlyReject,
      ageOnlyDoseMultiplier: templatePolicy.trainingEligibility.ageOnlyDoseMultiplier,
    }),
    processingAuthorization: guardSummary,
    systemTemplate: Object.freeze({
      athleteSelfSelectionAfterAllGates:
        templatePolicy.selectionAuthority.systemTemplate.athleteSelfSelectionAfterAllGates,
    }),
  })
}

function argumentPath(flag, fallback) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return fallback
  invariant(process.argv[index + 1] !== undefined, `${flag} requires a path`)
  return resolve(process.argv[index + 1])
}

function readArgument(flag, fallback) {
  const path = argumentPath(flag, resolve(root, fallback))
  return readFileSync(path, "utf8")
}

if (process.argv[1] === import.meta.filename) {
  try {
    const templateLibrary = readArgument("--template", "specs/active/TEMPLATE_LIBRARY_SPEC.md")
    const planGenerator = readArgument("--plan", "specs/active/PLAN_GENERATOR_SPEC.md")
    const appBridge = readArgument("--bridge", "specs/active/APP_IMPLEMENTATION_BRIDGE.md")
    const summary = validatePersonalizedPrescriptionPolicy({
      templateLibrary,
      planGenerator,
      appBridge,
      decisionReport: readArgument(
        "--decision",
        "reports/review/PERSONALIZED_AUTO_PRESCRIPTION_YOUTH_TRAINING_DECISION_2026-08-17.md",
      ),
    })
    console.log(`trainingEligibility.ageOnlyReject=${summary.trainingEligibility.ageOnlyReject};`)
    console.log(`trainingEligibility.ageOnlyDoseMultiplier=${summary.trainingEligibility.ageOnlyDoseMultiplier};`)
    console.log(`processingAuthorization.guardianSensitiveProcessingGuard=${summary.processingAuthorization.guardianSensitiveProcessingGuard};`)
    console.log(`systemTemplate.athleteSelfSelectionAfterAllGates=${summary.systemTemplate.athleteSelfSelectionAfterAllGates};`)
  } catch (error) {
    console.error(`PERSONALIZED_PRESCRIPTION_POLICY_INVALID ${error.message}`)
    process.exitCode = 1
  }
}
