import assert from "node:assert/strict"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { test } from "node:test"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import {
  AUDIT_ROWS,
  EXPECTED_CANONICAL_PAYLOAD,
  sha256Canonical,
  validateOwnerDecision,
  validateRepository,
  validateRetentionAuthority,
  validateRuntime,
} from "./validate-personalized-prescription-v2-authority.mjs"

const root = resolve(import.meta.dirname, "../..")
const artifactPaths = [
  "reports/review/OWNER_DECISION_PERSONALIZED_PRESCRIPTION_ALGORITHM_V2_2026-08-23.json",
  "reports/review/RACE_DATE_RETENTION_AUTHORITY.json",
  "reports/review/SPEC_PROMOTION_CANDIDATE_AUDIT_2026-08-23.md",
  "CURRENT_IMPLEMENTATION_HANDOFF_2026-08-23.md",
]

function withArtifactMutation(path, target, replacement, assertion) {
  const temp = mkdtempSync(join(tmpdir(), "trainoracle-pv2-authority-test-"))
  try {
    for (const artifactPath of artifactPaths) {
      const destination = join(temp, artifactPath)
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(resolve(root, artifactPath), destination)
    }
    const targetPath = join(temp, path)
    const source = readFileSync(targetPath, "utf8")
    assert.equal(source.split(target).length - 1, 1, `mutation target must occur once: ${target}`)
    writeFileSync(targetPath, source.replace(target, replacement), "utf8")
    assertion(() => validateRepository(temp, root))
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

const runtimePaths = [
  "app/src/domain/detailed-prescription-manifest.json",
  "app/src/domain/plan-beta-schema.ts",
  "impl/src/plan-generator/adaptation-transform-registry.ts",
]

function withRuntimeMutation(path, target, replacement, assertion) {
  const temp = mkdtempSync(join(tmpdir(), "trainoracle-pv2-runtime-test-"))
  try {
    for (const runtimePath of runtimePaths) {
      const destination = join(temp, runtimePath)
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(resolve(root, runtimePath), destination)
    }
    const targetPath = join(temp, path)
    const source = readFileSync(targetPath, "utf8")
    assert.equal(source.split(target).length - 1, 1, `runtime mutation target must occur once: ${target}`)
    writeFileSync(targetPath, source.replace(target, replacement), "utf8")
    assertion(() => validateRuntime(temp))
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

function decisionRecord() {
  return {
    kind: "TRAINORACLE_OWNER_DECISION_RECORD",
    recordedAt: "2026-08-23T03:32:21+09:00",
    canonicalPayload: structuredClone(EXPECTED_CANONICAL_PAYLOAD),
    canonicalPayloadSha256: sha256Canonical(EXPECTED_CANONICAL_PAYLOAD),
  }
}

function unauthorizedRetention() {
  return {
    schemaVersion: 1,
    kind: "TRAINORACLE_RACE_DATE_RETENTION_AUTHORITY",
    status: "NOT_AUTHORIZED",
    policy: "RACE_DATE_PERSISTENCE_DISABLED_UNTIL_GOVERNANCE_RECEIPT",
    receipt: null,
  }
}

function authorizedRetention() {
  const receipt = {
    receiptId: "TEST-NAMED-PRIVACY-RECEIPT",
    receiptArtifactPath: "test-fixtures/named-privacy-receipt.json",
    issuerId: "TEST_PRIVACY_REVIEW_BOARD",
    issuerRole: "PRIVACY_GOVERNANCE_AUTHORITY",
    status: "APPROVED",
    issuedAt: "2026-08-22T00:00:00.000Z",
    expiresAt: "2026-08-24T00:00:00.000Z",
    stale: false,
    revoked: false,
    withdrawn: false,
    conflicted: false,
    requirementsCovered: [
      "PURPOSE", "RETENTION_EVENT", "RETENTION_DURATION", "DELETION_AND_ERASE_ALL",
      "EXPORT", "YOUTH_AGE_OUT", "WITHDRAWAL", "EXPIRY", "REVOCATION",
    ],
    evidenceSha256: `sha256:${"a".repeat(64)}`,
  }
  return {
    schemaVersion: 1,
    kind: "TRAINORACLE_RACE_DATE_RETENTION_AUTHORITY",
    status: "AUTHORIZED",
    policy: "RACE_DATE_PERSISTENCE_DISABLED_UNTIL_GOVERNANCE_RECEIPT",
    receipt: { ...receipt, canonicalPayloadSha256: sha256Canonical(receipt) },
  }
}

function trustedReceipt(authority) {
  return {
    receiptId: authority.receipt.receiptId,
    artifactPath: authority.receipt.receiptArtifactPath,
    evidenceSha256: authority.receipt.evidenceSha256,
  }
}

test("repository packet validates against the exact current source", () => {
  const summary = validateRepository(root, root)
  assert.equal(summary.status, "CURRENT_BETA_RUNTIME_NONCANONICAL")
  assert.equal(summary.auditRows, 10)
  assert.equal(summary.retentionStatus, "NOT_AUTHORIZED")
  assert.equal(summary.raceDatePersistenceEnabled, false)
  assert.equal(summary.planBetaWriteVersion, 3)
  assert.equal(summary.activeAdaptationEdges, 2)
})

test("current runtime rejects deleted, promoted-family, and stale-schema mutations", () => {
  const cases = [
    [
      "impl/src/plan-generator/adaptation-transform-registry.ts",
      'edgeId: "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY"',
      'edgeId: "CONSERVATIVE_TO_BALANCED_UNREGISTERED"',
      /restoration edge/u,
    ],
    [
      "impl/src/plan-generator/adaptation-transform-registry.ts",
      '{ dimension: "FREQUENCY", status: "INACTIVE_NOT_AUTHORIZED" }',
      '{ dimension: "FREQUENCY", status: "ACTIVE" }',
      /frequency or intensity/u,
    ],
    [
      "app/src/domain/plan-beta-schema.ts",
      "export const planBetaStateV3Schema",
      "export const stalePlanBetaStateSchema",
      /schema characterization/u,
    ],
  ]
  for (const [path, target, replacement, expected] of cases) {
    withRuntimeMutation(path, target, replacement, (validate) => assert.throws(validate, expected))
  }
})

test("owner decision rejects a changed approved token even after rehash", () => {
  const record = decisionRecord()
  record.canonicalPayload.decisions.candidateDifference.token = "1B"
  record.canonicalPayloadSha256 = sha256Canonical(record.canonicalPayload)
  assert.throws(() => validateOwnerDecision(record), /locked authority/u)
})

test("owner decision rejects changed edge state and unsupported event scope", () => {
  for (const mutate of [
    (payload) => { payload.decisions.adaptation.reverseEdgeState = "ACTIVE_BASELINE" },
    (payload) => { payload.decisions.detailedTemplates.supportedEvents.push(400) },
    (payload) => { payload.decisions.prohibitions.automaticIncreaseTriggers = ["JOURNAL"] },
  ]) {
    const record = decisionRecord()
    mutate(record.canonicalPayload)
    record.canonicalPayloadSha256 = sha256Canonical(record.canonicalPayload)
    assert.throws(() => validateOwnerDecision(record), /locked authority/u)
  }
})

test("owner decision rejects an unrehashable digest mutation", () => {
  const record = decisionRecord()
  record.canonicalPayloadSha256 = `sha256:${"0".repeat(64)}`
  assert.throws(() => validateOwnerDecision(record), /digest mismatch/u)
})

test("owner decision rejects a same-date arbitrary recordedAt timestamp", () => {
  const record = decisionRecord()
  record.recordedAt = "2026-08-23T23:59:59+09:00"
  assert.throws(() => validateOwnerDecision(record), /recorded provenance timestamp/u)
})

test("retention remains disabled without a governance receipt", () => {
  assert.deepEqual(validateRetentionAuthority(unauthorizedRetention()), { status: "NOT_AUTHORIZED", persistenceEnabled: false })
})

test("a complete named governance receipt can satisfy the parser", () => {
  const authority = authorizedRetention()
  assert.deepEqual(validateRetentionAuthority(authority, { now: "2026-08-23T00:00:00.000Z", trustedReceipt: trustedReceipt(authority) }), { status: "AUTHORIZED", persistenceEnabled: true })
})

test("retention rejects forged, self-approved, stale, revoked, expired, and incomplete receipts", () => {
  const cases = [
    ["forged", (authority, options) => { options.trustedReceipt.evidenceSha256 = `sha256:${"b".repeat(64)}` }],
    ["self-approved", (authority) => { authority.receipt.issuerId = "COACH_HOJUNE" }],
    ["stale", (authority) => { authority.receipt.stale = true }],
    ["revoked", (authority) => { authority.receipt.revoked = true }],
    ["expired", (_authority, options) => { options.now = "2026-08-24T00:00:00.000Z" }],
    ["incomplete", (authority) => { authority.receipt.requirementsCovered.pop() }],
    ["digest-mismatched", (authority) => { authority.receipt.canonicalPayloadSha256 = `sha256:${"0".repeat(64)}` }],
  ]
  for (const [name, mutate] of cases) {
    const authority = authorizedRetention()
    const options = { now: "2026-08-23T00:00:00.000Z", trustedReceipt: trustedReceipt(authority) }
    mutate(authority, options)
    if (name !== "digest-mismatched" && name !== "forged" && name !== "expired") {
      const payload = { ...authority.receipt }
      delete payload.canonicalPayloadSha256
      authority.receipt.canonicalPayloadSha256 = sha256Canonical(payload)
    }
    assert.throws(() => validateRetentionAuthority(authority, options), undefined, name)
  }
})

test("audit classifications are closed and exhaustive", () => {
  assert.deepEqual(AUDIT_ROWS.map(({ family, classification }) => [family, classification]), [
    ["YOUTH_ELIGIBILITY", "ALREADY_SPEC_BOUND"],
    ["FOUR_ACTIVE_EXACT_TEMPLATES", "WORKING_SPEC_AMENDMENT_REQUIRED"],
    ["TWO_A_DAY_BETA", "ALREADY_SPEC_BOUND"],
    ["BOUNDED_ADAPTATION", "ALREADY_SPEC_BOUND"],
    ["MIDDLE_DISTANCE_800_1500_3000_SPEC_DRIFT", "WORKING_SPEC_AMENDMENT_REQUIRED"],
    ["COMPETITION_DIVISION_DISPLAY_ONLY", "WORKING_SPEC_AMENDMENT_REQUIRED"],
    ["TAPER_RACE_ANCHORS", "RESEARCH_OR_RECEIPT_ONLY"],
    ["ACCOUNT_COACH_MODE", "ALREADY_SPEC_BOUND"],
    ["SPRINT_ATP_PC", "CANONICAL_PROMOTION_BLOCKED"],
    ["TEN_K_GENERAL_ENDURANCE", "CANONICAL_PROMOTION_BLOCKED"],
  ])
})

test("promotion audit rejects a valid but unrelated evidence path", () => {
  withArtifactMutation(
    "reports/review/SPEC_PROMOTION_CANDIDATE_AUDIT_2026-08-23.md",
    '"path": "reports/review/PERSONALIZED_AUTO_PRESCRIPTION_YOUTH_TRAINING_DECISION_2026-08-17.md"',
    '"path": "README.md"',
    (validate) => assert.throws(validate, /evidence identity/u),
  )
})

test("promotion audit rejects replaced or appended contradictory authority wording", () => {
  const path = "reports/review/SPEC_PROMOTION_CANDIDATE_AUDIT_2026-08-23.md"
  const disclaimer = "This audit classifies current evidence and working-spec gaps. It does not promote a\ncanonical specification, close an OPEN issue, or turn research and implementation\nreceipts into runtime authority."
  withArtifactMutation(
    path,
    disclaimer,
    "This audit classifies current evidence and working-spec gaps. It promotes a\ncanonical specification, closes an OPEN issue, and turns research and implementation\nreceipts into runtime authority.",
    (validate) => assert.throws(validate, /human authority boundary/u),
  )
  withArtifactMutation(
    path,
    "[DRAFT_COMPLETE]",
    "Canonical promotion is approved; OPEN issues are closed; runtime authority is granted.\n\n[DRAFT_COMPLETE]",
    (validate) => assert.throws(validate, /human authority boundary/u),
  )
})

test("promotion audit rejects a canonical human status line", () => {
  withArtifactMutation(
    "reports/review/SPEC_PROMOTION_CANDIDATE_AUDIT_2026-08-23.md",
    "Status: NON_CANONICAL_AUDIT",
    "Status: CANONICAL_PROMOTION_APPROVED",
    (validate) => assert.throws(validate, /human status line/u),
  )
})

test("handoff rejects changed deployment receipt path, pages commit, and proof boundary", () => {
  const cases = [
    ['"receiptPath": "origin/gh-pages:trainoracle-deploy-receipt.json"', '"receiptPath": "README.md"'],
    ['"pagesCommit": "066f83a890759bab0c8f5ea3dd13272aa9f5217c"', '"pagesCommit": "0000000000000000000000000000000000000000"'],
    ['"proofBoundary": "LOCAL_ORIGIN_GH_PAGES_REF_AND_EXACT_RECEIPT_NO_LIVE_FETCH"', '"proofBoundary": "LIVE_PUBLIC_SITE_FETCH_VERIFIED"'],
  ]
  for (const [target, replacement] of cases) {
    withArtifactMutation(
      "CURRENT_IMPLEMENTATION_HANDOFF_2026-08-23.md",
      target,
      replacement,
      (validate) => assert.throws(validate, /deployment provenance/u),
    )
  }
})

test("handoff rejects wrong, missing, and extra deployment provenance claims", () => {
  const cases = [
    ['"workflowRunId": "32254051649"', '"workflowRunId": "00000000000"'],
    ['"deployedAt": "2026-08-19T12:54:07.499Z"', '"deployedAt": "2026-08-20T12:54:07.499Z"'],
    ['"workflowRunId": "32254051649",\n', ""],
    ['"liveFetchPerformed": false\n', '"liveFetchPerformed": false,\n    "publicSiteFetchVerified": true\n'],
  ]
  for (const [target, replacement] of cases) {
    withArtifactMutation(
      "CURRENT_IMPLEMENTATION_HANDOFF_2026-08-23.md",
      target,
      replacement,
      (validate) => assert.throws(validate, /deployment provenance/u),
    )
  }
})

test("handoff rejects substituted Todo 1 ownership and active template count", () => {
  const cases = [
    ['"reports/review/RACE_DATE_RETENTION_AUTHORITY.json"', '"README.md"', /ownership ledger/u],
    ['"activeDetailedTemplateCount": 4', '"activeDetailedTemplateCount": 5', /schema characterization/u],
  ]
  for (const [target, replacement, expected] of cases) {
    withArtifactMutation(
      "CURRENT_IMPLEMENTATION_HANDOFF_2026-08-23.md",
      target,
      replacement,
      (validate) => assert.throws(validate, expected),
    )
  }
})

test("handoff rejects promotion of the recorded reverse runtime edge", () => {
  withArtifactMutation(
    "CURRENT_IMPLEMENTATION_HANDOFF_2026-08-23.md",
    '"reverseAdaptationEdgeState": "APPROVED_FOR_IMPLEMENTATION_NOT_ACTIVE"',
    '"reverseAdaptationEdgeState": "ACTIVE_BASELINE"',
    (validate) => assert.throws(validate, /runtime boundary/u),
  )
})

test("handoff rejects a production-active human status line", () => {
  withArtifactMutation(
    "CURRENT_IMPLEMENTATION_HANDOFF_2026-08-23.md",
    "Status: TODO_1_PREPARED",
    "Status: PRODUCTION_RUNTIME_ACTIVE_AND_DEPLOYED",
    (validate) => assert.throws(validate, /human status line/u),
  )
})
