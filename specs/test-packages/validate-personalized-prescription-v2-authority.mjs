import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const sourceRoot = resolve(import.meta.dirname, "../..")
const DECISION_PATH = "reports/review/OWNER_DECISION_PERSONALIZED_PRESCRIPTION_ALGORITHM_V2_2026-08-23.json"
const RETENTION_PATH = "reports/review/RACE_DATE_RETENTION_AUTHORITY.json"
const AUDIT_PATH = "reports/review/SPEC_PROMOTION_CANDIDATE_AUDIT_2026-08-23.md"
const HANDOFF_PATH = "CURRENT_IMPLEMENTATION_HANDOFF_2026-08-23.md"
const EXPECTED_RECORDED_AT = "2026-08-23T03:32:21+09:00"
const AUDIT_HUMAN_AUTHORITY_BOUNDARY = "This audit classifies current evidence and working-spec gaps. It does not promote a\ncanonical specification, close an OPEN issue, or turn research and implementation\nreceipts into runtime authority."

export const EXPECTED_CANONICAL_PAYLOAD = Object.freeze({
  schemaVersion: 1,
  kind: "TRAINORACLE_PERSONALIZED_PRESCRIPTION_ALGORITHM_V2_OWNER_DECISION",
  decisionId: "TO-PERSONALIZED-PRESCRIPTION-ALGORITHM-V2-2026-08-23",
  status: "APPROVED_FOR_IMPLEMENTATION",
  owner: Object.freeze({ ownerId: "COACH_HOJUNE", role: "PRODUCT_OWNER_COACH", signatureKind: "CONVERSATION_OWNER_APPROVAL" }),
  approvedOn: "2026-08-23",
  source: Object.freeze({
    mainSha: "5ea2eed9fce0f0ddb314358d57c0b2fc538b9daa",
    planPath: ".omo/plans/personalized-prescription-algorithm-v2.md",
    planSha256: "3f081ebbd8d8fa456ff33f01a037942e618cf13f9e549ff3feb83789df590d6b",
  }),
  decisions: Object.freeze({
    candidateDifference: Object.freeze({
      token: "1A",
      initialPairDifference: "SUPPORT_DURATION_ONLY",
      qualityContentIdentical: true,
      frequencyIdentical: true,
      futureChangeDimensionsMax: 1,
    }),
    detailedTemplates: Object.freeze({
      token: "2A",
      supportedEvents: Object.freeze([800, 1500, 3000, 5000]),
      activeBaselineTemplateCount: 4,
      targetTotalPerEvent: Object.freeze([2, 3]),
      maximumReviewedAdditionsPerEvent: 2,
      zeroAdditionsValid: true,
      sprintOrAtpPcActivationAuthorized: false,
    }),
    racePreparation: Object.freeze({
      token: "3A",
      optionalRaceDate: true,
      sourceBackedPlacementOnly: true,
      numericTaperAuthority: "NOT_GRANTED",
      stages: Object.freeze([
        "TAPER_EVIDENCE_MATRIX_INACTIVE",
        "PLACEMENT_ONLY_PREVIEW_AFTER_DUAL_REVIEW",
        "PERSISTENCE_AND_PLACEMENT_AFTER_NAMED_GOVERNANCE_RECEIPT",
      ]),
      persistencePolicy: "RACE_DATE_PERSISTENCE_DISABLED_UNTIL_GOVERNANCE_RECEIPT",
    }),
    delegatedAuthority: Object.freeze({
      token: "B",
      activationRequires: Object.freeze(["COACHING_APPLICABILITY_APPROVAL", "SPORTS_SCIENCE_AND_TRANSFER_APPROVAL"]),
      sameDigestRequired: true,
      ownerAuthorityDelegatedForNumericTaper: false,
    }),
    adaptation: Object.freeze({
      baselineActiveEdge: "BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY",
      baselineEdgeState: "ACTIVE_BASELINE",
      reverseEdge: "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY",
      reverseEdgeState: "APPROVED_FOR_IMPLEMENTATION_NOT_ACTIVE",
      frequencyEdgeState: "INACTIVE_NOT_AUTHORIZED",
      intensityEdgeState: "INACTIVE_NOT_AUTHORIZED",
    }),
    prohibitions: Object.freeze({
      unsupportedEvents: Object.freeze(["100M", "200M", "400M", "TEN_K", "GENERAL_ENDURANCE"]),
      automaticIncreaseTriggers: Object.freeze(["JOURNAL", "REWARDS"]),
      canonicalPromotion: false,
      issueClosure: false,
    }),
  }),
})

export const AUDIT_ROWS = Object.freeze([
  Object.freeze({ family: "YOUTH_ELIGIBILITY", classification: "ALREADY_SPEC_BOUND", evidence: Object.freeze([
    Object.freeze({ path: "reports/review/PERSONALIZED_AUTO_PRESCRIPTION_YOUTH_TRAINING_DECISION_2026-08-17.md", startLine: 20, endLine: 59 }),
    Object.freeze({ path: "specs/active/PLAN_GENERATOR_SPEC.md", startLine: 241, endLine: 295 }),
  ]) }),
  Object.freeze({ family: "FOUR_ACTIVE_EXACT_TEMPLATES", classification: "WORKING_SPEC_AMENDMENT_REQUIRED", evidence: Object.freeze([
    Object.freeze({ path: "app/src/domain/detailed-prescription-manifest.json", startLine: 32, endLine: 598 }),
    Object.freeze({ path: "reports/implementation/PERSONALIZED_PRESCRIPTION_RELEASE_2026-08-18.md", startLine: 19, endLine: 35 }),
  ]) }),
  Object.freeze({ family: "TWO_A_DAY_BETA", classification: "ALREADY_SPEC_BOUND", evidence: Object.freeze([
    Object.freeze({ path: "OWNER_DECISION_FULL_TWO_A_DAY_2026_08_12.md", startLine: 1, endLine: 49 }),
    Object.freeze({ path: "specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md", startLine: 57, endLine: 90 }),
  ]) }),
  Object.freeze({ family: "BOUNDED_ADAPTATION", classification: "ALREADY_SPEC_BOUND", evidence: Object.freeze([
    Object.freeze({ path: "impl/src/plan-generator/adaptation.ts", startLine: 674, endLine: 704 }),
    Object.freeze({ path: "specs/active/PLAN_GENERATOR_SPEC.md", startLine: 297, endLine: 350 }),
  ]) }),
  Object.freeze({ family: "MIDDLE_DISTANCE_800_1500_3000_SPEC_DRIFT", classification: "WORKING_SPEC_AMENDMENT_REQUIRED", evidence: Object.freeze([
    Object.freeze({ path: "reports/review/MIDDLE_DISTANCE_RUNTIME_ACTIVATION_DECISION_2026-08-17.md", startLine: 14, endLine: 34 }),
    Object.freeze({ path: "specs/active/PLAN_GENERATOR_SPEC.md", startLine: 241, endLine: 350 }),
  ]) }),
  Object.freeze({ family: "COMPETITION_DIVISION_DISPLAY_ONLY", classification: "WORKING_SPEC_AMENDMENT_REQUIRED", evidence: Object.freeze([
    Object.freeze({ path: "reports/review/ACCOUNT_LEGAL_AND_COMPETITION_DIVISION_REVIEW_2026-08-14.md", startLine: 3, endLine: 19 }),
    Object.freeze({ path: "reports/review/ACCOUNT_LEGAL_AND_COMPETITION_DIVISION_REVIEW_2026-08-14.md", startLine: 54, endLine: 95 }),
  ]) }),
  Object.freeze({ family: "TAPER_RACE_ANCHORS", classification: "RESEARCH_OR_RECEIPT_ONLY", evidence: Object.freeze([
    Object.freeze({ path: "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md", startLine: 1, endLine: 45 }),
    Object.freeze({ path: "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md", startLine: 108, endLine: 146 }),
    Object.freeze({ path: "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md", startLine: 177, endLine: 184 }),
  ]) }),
  Object.freeze({ family: "ACCOUNT_COACH_MODE", classification: "ALREADY_SPEC_BOUND", evidence: Object.freeze([
    Object.freeze({ path: "PRODUCT_NORTH_STAR.md", startLine: 102, endLine: 123 }),
    Object.freeze({ path: "specs/active/PLAN_GENERATOR_SPEC.md", startLine: 345, endLine: 350 }),
  ]) }),
  Object.freeze({ family: "SPRINT_ATP_PC", classification: "CANONICAL_PROMOTION_BLOCKED", evidence: Object.freeze([
    Object.freeze({ path: "reports/review/MIDDLE_DISTANCE_RUNTIME_ACTIVATION_DECISION_2026-08-17.md", startLine: 48, endLine: 52 }),
    Object.freeze({ path: "specs/active/PLAN_GENERATOR_SPEC.md", startLine: 297, endLine: 343 }),
  ]) }),
  Object.freeze({ family: "TEN_K_GENERAL_ENDURANCE", classification: "CANONICAL_PROMOTION_BLOCKED", evidence: Object.freeze([
    Object.freeze({ path: "impl/src/plan-generator/types.ts", startLine: 42, endLine: 45 }),
    Object.freeze({ path: "impl/src/plan-generator/adaptation.ts", startLine: 280, endLine: 290 }),
  ]) }),
])

const EXPECTED_DEPLOYMENT = Object.freeze({
  status: "PUBLIC_MAIN_DEPLOYMENT_VERIFIED",
  proofBoundary: "LOCAL_ORIGIN_GH_PAGES_REF_AND_EXACT_RECEIPT_NO_LIVE_FETCH",
  sourceSha: "5ea2eed9fce0f0ddb314358d57c0b2fc538b9daa",
  pagesCommit: "066f83a890759bab0c8f5ea3dd13272aa9f5217c",
  pagesTree: "6522ec819a2a8cc5ec7b132e236096793b1932bb",
  receiptPath: "origin/gh-pages:trainoracle-deploy-receipt.json",
  receiptSha256: "ec46f39288608973448e7be6380003d274f29d5088a2c5385365d9002c9840df",
  workflowRunId: "32254051649",
  deployedAt: "2026-08-19T12:54:07.499Z",
  liveFetchPerformed: false,
})

const EXPECTED_WRITE_OWNERSHIP = Object.freeze([
  Object.freeze({ todo: 1, paths: Object.freeze([
    "reports/review/OWNER_DECISION_PERSONALIZED_PRESCRIPTION_ALGORITHM_V2_2026-08-23.json",
    "reports/review/RACE_DATE_RETENTION_AUTHORITY.json",
    "reports/review/SPEC_PROMOTION_CANDIDATE_AUDIT_2026-08-23.md",
    "CURRENT_IMPLEMENTATION_HANDOFF_2026-08-23.md",
    "specs/test-packages/validate-personalized-prescription-v2-authority.mjs",
    "specs/test-packages/validate-personalized-prescription-v2-authority.test.mjs",
    ".omo/evidence/personalized-prescription-algorithm-v2/task-1/",
  ]) }),
  Object.freeze({ todo: 2, paths: Object.freeze([
    "app/src/domain/plan-beta-schema.ts", "app/src/domain/plan-beta-flow.ts", "app/src/domain/plan-candidate-prescription.ts", "app/src/domain/plan-beta-store.ts", "impl/src/plan-generator/types.ts", "impl/src/plan-generator/parser.ts", "impl/src/plan-generator/candidates.ts", "impl/src/plan-generator/selection-types.ts", "impl/src/plan-generator/selection.ts",
  ]) }),
  Object.freeze({ todo: 3, paths: Object.freeze([
    "impl/src/plan-generator/candidates.ts", "impl/src/plan-generator/session-builder.ts", "impl/src/plan-generator/adaptation.ts", "app/src/screens/plan-beta/PlanCandidates.tsx", "app/src/screens/plan-beta/candidate-purpose-status.ts", "app/src/screens/plan-beta/labels.ts",
  ]) }),
  Object.freeze({ todo: 4, paths: Object.freeze([
    "app/src/domain/detailed-prescription-manifest.json", "app/src/domain/detailed-prescription-approvals.ts", "app/src/domain/detailed-prescription.ts", "app/src/domain/detailed-prescription-runtime-authority.contract.test.ts", "reports/review/", "specs/test-packages/",
  ]) }),
  Object.freeze({ todo: 5, paths: Object.freeze(["reports/research/", "reports/review/", "specs/test-packages/"]) }),
  Object.freeze({ todo: 6, paths: Object.freeze(["impl/src/plan-generator/", "app/src/domain/", "specs/test-packages/"]) }),
  Object.freeze({ todo: 7, paths: Object.freeze(["impl/src/plan-generator/adaptation.ts", "app/src/domain/plan-adaptation-store.ts", "app/src/domain/plan-beta-schema.ts", "specs/test-packages/"]) }),
  Object.freeze({ todo: 8, paths: Object.freeze(["impl/src/plan-generator/", "app/src/domain/", "app/src/screens/plan-beta/"]) }),
  Object.freeze({ todo: 9, paths: Object.freeze(["app/src/screens/plan-beta/", "app/e2e/", "specs/active/", "specs/reconstruct/", "TRAINORACLE_SPEC_INDEX.md", "reports/implementation/"]) }),
])

const EXPECTED_TODO1_HANDOFF_RUNTIME = Object.freeze({
  activeDetailedTemplates: Object.freeze(["V2-SEED-05", "MD-800-01", "MD-1500-01", "MD-3000-01"]),
  activeAdaptationEdges: Object.freeze(["BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY"]),
  reverseAdaptationEdgeState: "APPROVED_FOR_IMPLEMENTATION_NOT_ACTIVE",
  raceDatePersistence: "RACE_DATE_PERSISTENCE_DISABLED_UNTIL_GOVERNANCE_RECEIPT",
})

const RETENTION_REQUIREMENTS = Object.freeze([
  "PURPOSE", "RETENTION_EVENT", "RETENTION_DURATION", "DELETION_AND_ERASE_ALL",
  "EXPORT", "YOUTH_AGE_OUT", "WITHDRAWAL", "EXPIRY", "REVOCATION",
])

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

export function sha256Canonical(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`
}

function exactKeys(value, keys, label) {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  invariant(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} has missing or extra keys`)
}

function exactValue(actual, expected, label) {
  invariant(canonicalJson(actual) === canonicalJson(expected), `${label} does not match the locked authority`)
}

function parseJsonFile(root, path) {
  try {
    return JSON.parse(readFileSync(resolve(root, path), "utf8"))
  } catch (error) {
    throw new Error(`${path} is missing or malformed`, { cause: error })
  }
}

function parseMachineBlock(document, name, marker) {
  const start = `<!-- MACHINE_DATA:${marker}:START -->`
  const end = `<!-- MACHINE_DATA:${marker}:END -->`
  const from = document.indexOf(start)
  const to = document.indexOf(end, from + start.length)
  invariant(from >= 0 && to > from, `${name} machine block is missing`)
  const match = document.slice(from + start.length, to).match(/```json\s*([\s\S]*?)\s*```/u)
  invariant(match !== null, `${name} machine block must contain JSON`)
  try {
    return JSON.parse(match[1])
  } catch (error) {
    throw new Error(`${name} machine block is malformed`, { cause: error })
  }
}

function cleanFinalMarker(document, name) {
  const markers = document.match(/^\[DRAFT_COMPLETE\]$/gmu) ?? []
  invariant(markers.length === 1, `${name} must contain exactly one final marker`)
  invariant(document.trimEnd().split(/\r?\n/u).at(-1) === "[DRAFT_COMPLETE]", `${name} has text after final marker`)
}

export function validateOwnerDecision(record) {
  exactKeys(record, ["kind", "recordedAt", "canonicalPayload", "canonicalPayloadSha256"], "owner decision record")
  invariant(record.kind === "TRAINORACLE_OWNER_DECISION_RECORD", "owner decision wrapper kind is wrong")
  invariant(record.recordedAt === EXPECTED_RECORDED_AT, "owner decision recorded provenance timestamp is not exact")
  exactValue(record.canonicalPayload, EXPECTED_CANONICAL_PAYLOAD, "owner decision payload")
  invariant(record.canonicalPayloadSha256 === sha256Canonical(record.canonicalPayload), "owner decision payload digest mismatch")
  return record.canonicalPayload
}

export function validateRetentionAuthority(authority, options = {}) {
  exactKeys(authority, ["schemaVersion", "kind", "status", "policy", "receipt"], "retention authority")
  invariant(authority.schemaVersion === 1 && authority.kind === "TRAINORACLE_RACE_DATE_RETENTION_AUTHORITY", "retention authority identity is wrong")
  invariant(authority.policy === "RACE_DATE_PERSISTENCE_DISABLED_UNTIL_GOVERNANCE_RECEIPT", "retention policy is wrong")
  if (authority.status === "NOT_AUTHORIZED") {
    invariant(authority.receipt === null, "NOT_AUTHORIZED retention must not embed a receipt")
    return Object.freeze({ status: authority.status, persistenceEnabled: false })
  }
  invariant(authority.status === "AUTHORIZED", "retention status is not closed")
  const receipt = authority.receipt
  exactKeys(receipt, ["receiptId", "receiptArtifactPath", "issuerId", "issuerRole", "status", "issuedAt", "expiresAt", "stale", "revoked", "withdrawn", "conflicted", "requirementsCovered", "evidenceSha256", "canonicalPayloadSha256"], "retention receipt")
  invariant(receipt.receiptId.length > 0 && receipt.receiptArtifactPath.length > 0, "retention receipt is unnamed")
  invariant(receipt.issuerId !== "COACH_HOJUNE" && receipt.issuerRole === "PRIVACY_GOVERNANCE_AUTHORITY", "retention receipt is self-approved or unauthorized")
  invariant(receipt.status === "APPROVED" && !receipt.stale && !receipt.revoked && !receipt.withdrawn && !receipt.conflicted, "retention receipt is stale, revoked, withdrawn, conflicted, or unapproved")
  invariant(JSON.stringify(receipt.requirementsCovered) === JSON.stringify(RETENTION_REQUIREMENTS), "retention receipt is incomplete")
  invariant(/^sha256:[0-9a-f]{64}$/u.test(receipt.evidenceSha256), "retention evidence digest is malformed")
  const payload = { ...receipt }
  delete payload.canonicalPayloadSha256
  invariant(receipt.canonicalPayloadSha256 === sha256Canonical(payload), "retention receipt digest mismatch")
  const now = options.now ?? "2026-08-23T00:00:00.000Z"
  invariant(Date.parse(receipt.issuedAt) <= Date.parse(now), "retention receipt is stale or future-dated")
  invariant(Date.parse(now) < Date.parse(receipt.expiresAt), "retention receipt is expired")
  invariant(options.trustedReceipt?.receiptId === receipt.receiptId && options.trustedReceipt?.artifactPath === receipt.receiptArtifactPath && options.trustedReceipt?.evidenceSha256 === receipt.evidenceSha256, "retention receipt is forged or not locally trusted")
  return Object.freeze({ status: authority.status, persistenceEnabled: true })
}

function validateAudit(document, root) {
  cleanFinalMarker(document, "promotion audit")
  const normalizedDocument = document.replace(/\r\n?/gu, "\n")
  const auditStatusLines = document.split(/\r?\n/u).filter((line) => line.startsWith("Status: "))
  invariant(auditStatusLines.length === 1 && auditStatusLines[0] === "Status: NON_CANONICAL_AUDIT", "promotion audit human status line is not exact")
  invariant(normalizedDocument.split(AUDIT_HUMAN_AUTHORITY_BOUNDARY).length - 1 === 1, "promotion audit human authority boundary is missing or changed")
  for (const contradiction of [
    /canonical(?: specification)? promotion(?: is|:)?\s*(?:approved|allowed|true)/iu,
    /(?:OPEN\s+)?issues?\s+(?:are\s+)?closed/iu,
    /issue closure(?: is|:)?\s*(?:approved|allowed|true)/iu,
    /runtime authority(?: is|:)?\s*(?:granted|approved|allowed|true)/iu,
  ]) invariant(!contradiction.test(document), "promotion audit human authority boundary is contradicted")
  const data = parseMachineBlock(document, "promotion audit", "SPEC_PROMOTION_CANDIDATE_AUDIT_V1")
  exactKeys(data, ["schemaVersion", "kind", "status", "canonicalPromotion", "issueClosure", "rows"], "promotion audit data")
  invariant(data.schemaVersion === 1 && data.kind === "TRAINORACLE_SPEC_PROMOTION_CANDIDATE_AUDIT", "promotion audit identity is wrong")
  invariant(data.status === "NON_CANONICAL_AUDIT" && data.canonicalPromotion === false && data.issueClosure === false, "promotion audit overclaims authority")
  invariant(data.rows.length === AUDIT_ROWS.length, "promotion audit row count is wrong")
  data.rows.forEach((row, index) => {
    exactKeys(row, ["family", "classification", "evidence"], `promotion audit row ${index}`)
    exactValue({ family: row.family, classification: row.classification }, { family: AUDIT_ROWS[index].family, classification: AUDIT_ROWS[index].classification }, `promotion audit row ${index}`)
    invariant(canonicalJson(row.evidence) === canonicalJson(AUDIT_ROWS[index].evidence), `promotion audit row ${index} evidence identity or line span is wrong`)
    for (const ref of row.evidence) {
      exactKeys(ref, ["path", "startLine", "endLine"], `promotion audit evidence ${row.family}`)
      const lineCount = readFileSync(resolve(root, ref.path), "utf8").split(/\r?\n/u).length
      invariant(Number.isInteger(ref.startLine) && ref.startLine > 0 && ref.endLine >= ref.startLine && ref.endLine <= lineCount, `promotion audit evidence is stale: ${ref.path}`)
    }
  })
  return data
}

function validateHandoff(document) {
  cleanFinalMarker(document, "implementation handoff")
  const handoffStatusLines = document.split(/\r?\n/u).filter((line) => line.startsWith("Status: "))
  invariant(handoffStatusLines.length === 1 && handoffStatusLines[0] === "Status: TODO_1_PREPARED", "implementation handoff human status line is not exact")
  const data = parseMachineBlock(document, "implementation handoff", "IMPLEMENTATION_HANDOFF_V1")
  exactKeys(data, ["schemaVersion", "kind", "status", "authoritativeMainSha", "authoritativeMainBranchRef", "taskWorktreeBranch", "branchConstraintDeviation", "planSha256", "deployment", "schema", "runtime", "preExistingDirtyPaths", "writeOwnership"], "implementation handoff")
  invariant(data.kind === "TRAINORACLE_PERSONALIZED_PRESCRIPTION_V2_HANDOFF" && data.status === "TODO_1_PREPARED", "handoff identity is wrong")
  invariant(data.authoritativeMainSha === EXPECTED_CANONICAL_PAYLOAD.source.mainSha, "handoff main SHA is stale")
  invariant(data.planSha256 === EXPECTED_CANONICAL_PAYLOAD.source.planSha256, "handoff plan SHA is stale")
  exactKeys(data.deployment, Object.keys(EXPECTED_DEPLOYMENT), "handoff deployment provenance")
  exactValue(data.deployment, EXPECTED_DEPLOYMENT, "handoff deployment provenance")
  invariant(data.deployment.sourceSha === data.authoritativeMainSha, "handoff deployment provenance is not bound to main")
  exactKeys(data.schema, ["planBetaReadableVersions", "planBetaWriteVersion", "detailedPrescriptionManifestVersion", "activeDetailedTemplateCount"], "handoff schema characterization")
  invariant(data.schema.planBetaReadableVersions.join(",") === "1,2" && data.schema.planBetaWriteVersion === 2 && data.schema.detailedPrescriptionManifestVersion === 1 && data.schema.activeDetailedTemplateCount === 4, "handoff schema characterization is stale")
  exactKeys(data.runtime, Object.keys(EXPECTED_TODO1_HANDOFF_RUNTIME), "handoff runtime boundary")
  exactValue(data.runtime, EXPECTED_TODO1_HANDOFF_RUNTIME, "handoff runtime boundary")
  invariant(data.preExistingDirtyPaths.length === 1 && data.preExistingDirtyPaths[0].path === EXPECTED_CANONICAL_PAYLOAD.source.planPath && data.preExistingDirtyPaths[0].sha256 === EXPECTED_CANONICAL_PAYLOAD.source.planSha256, "handoff dirty inventory is wrong")
  exactValue(data.writeOwnership, EXPECTED_WRITE_OWNERSHIP, "handoff ownership ledger")
  return data
}

function occurrenceCount(source, token) {
  return source.split(token).length - 1
}

export function validateRuntime(root) {
  const manifest = parseJsonFile(root, "app/src/domain/detailed-prescription-manifest.json")
  const active = manifest.approvals.filter((row) => row.lifecycleStatus === "ACTIVE" && row.eligibilityStatus === "ELIGIBLE").map((row) => row.templateId)
  exactValue(active, ["V2-SEED-05", "MD-800-01", "MD-1500-01", "MD-3000-01"], "active detailed templates")

  const registry = readFileSync(resolve(root, "impl/src/plan-generator/adaptation-transform-registry.ts"), "utf8").replace(/\r\n?/gu, "\n")
  const activeStart = registry.indexOf("  activeEdges: [")
  const activeEnd = registry.indexOf("  ] as const,\n  inactiveFamilies:", activeStart)
  invariant(activeStart >= 0 && activeEnd > activeStart, "active adaptation registry block is absent")
  const activeBlock = registry.slice(activeStart, activeEnd)
  invariant(occurrenceCount(activeBlock, "edgeId:") === 2, "active adaptation edge count is not exactly two")
  invariant(occurrenceCount(activeBlock, 'edgeId: "BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY"') === 1, "baseline reduction edge is absent or duplicated")
  invariant(occurrenceCount(activeBlock, 'edgeId: "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY"') === 1, "approved restoration edge is absent or duplicated")
  invariant(occurrenceCount(activeBlock, 'dimension: "VOLUME"') === 2, "active adaptation dimension escaped VOLUME")
  invariant(occurrenceCount(activeBlock, 'direction: "REDUCE"') === 1 && occurrenceCount(activeBlock, 'direction: "INCREASE"') === 1, "active adaptation directions are not the approved pair")
  invariant(activeBlock.includes('fromCandidateKind: "BALANCED",\n      toCandidateKind: "CONSERVATIVE"'), "reduction direction endpoints are wrong")
  invariant(activeBlock.includes('fromCandidateKind: "CONSERVATIVE",\n      toCandidateKind: "BALANCED"'), "restoration direction endpoints are wrong")
  invariant(activeBlock.includes('triggerClasses: ["EXPLICIT_REQUEST"],'), "reduction trigger scope is wrong")
  invariant(activeBlock.includes('triggerClasses: ["EXPLICIT_REQUEST", "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START"],'), "restoration trigger scope is wrong")
  invariant(registry.includes('{ dimension: "FREQUENCY", status: "INACTIVE_NOT_AUTHORIZED" }') && registry.includes('{ dimension: "INTENSITY", status: "INACTIVE_NOT_AUTHORIZED" }'), "frequency or intensity family is not inactive")
  invariant(registry.includes('const OWNER_DECISION_PAYLOAD_SHA256 = "sha256:e5a1a8ca8ea7c6301239292ba7a6db4de289feea6a477d195b847893fcbd66be"'), "adaptation registry is not bound to the owner decision digest")

  const schema = readFileSync(resolve(root, "app/src/domain/plan-beta-schema.ts"), "utf8")
  invariant(schema.includes("const planBetaStateV1Schema") && schema.includes("export const planBetaStateV2Schema") && schema.includes("export const planBetaStateV3Schema"), "stored plan schema characterization is stale")
  invariant(schema.includes("version: z.literal(3)"), "stored plan v3 write shape is absent")
  return Object.freeze({ activeTemplateCount: active.length, planBetaWriteVersion: 3, activeAdaptationEdges: 2 })
}

function validateDeployment(root, handoff) {
  const deploymentSource = resolveDeploymentSource(root)
  const gitAtDeploymentSource = (args, options = {}) => execFileSync(
    "git",
    ["-c", `safe.directory=${deploymentSource.cwd.replaceAll("\\", "/")}`, "-C", deploymentSource.cwd, ...args],
    options,
  )
  const receiptBytes = gitAtDeploymentSource(["show", `${deploymentSource.ref}:trainoracle-deploy-receipt.json`])
  const receipt = JSON.parse(receiptBytes.toString("utf8"))
  exactKeys(receipt, ["kind", "sourceSha", "previousPagesSha", "workflowRunId", "workflowAttempt", "deployedAt"], "pinned deployment receipt")
  const digest = createHash("sha256").update(receiptBytes).digest("hex")
  invariant(receipt.sourceSha === EXPECTED_CANONICAL_PAYLOAD.source.mainSha && digest === handoff.deployment.receiptSha256, "deployment receipt does not bind current main")
  invariant(receipt.workflowRunId === handoff.deployment.workflowRunId && receipt.deployedAt === handoff.deployment.deployedAt, "handoff deployment provenance does not match the pinned receipt")
  const pagesCommit = gitAtDeploymentSource(["rev-parse", deploymentSource.ref], { encoding: "utf8" }).trim()
  const pagesTree = gitAtDeploymentSource(["rev-parse", `${deploymentSource.ref}^{tree}`], { encoding: "utf8" }).trim()
  invariant(pagesCommit === EXPECTED_DEPLOYMENT.pagesCommit && handoff.deployment.pagesCommit === pagesCommit, "deployment pages commit is stale")
  invariant(pagesTree === EXPECTED_DEPLOYMENT.pagesTree && handoff.deployment.pagesTree === pagesTree, "deployment tree is stale")
}

function resolveDeploymentSource(root) {
  try {
    execFileSync("git", ["rev-parse", "--verify", "origin/gh-pages"], { cwd: root, stdio: "ignore" })
    return Object.freeze({ cwd: root, ref: "origin/gh-pages" })
  } catch {
    const originUrl = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8" }).trim()
    const localOrigin = resolve(root, originUrl)
    invariant(existsSync(localOrigin), "origin/gh-pages deployment evidence is unavailable")
    try {
      execFileSync("git", ["-c", `safe.directory=${localOrigin.replaceAll("\\", "/")}`, "-C", localOrigin, "rev-parse", "--verify", "origin/gh-pages"], { stdio: "ignore" })
    } catch (error) {
      throw new Error("origin/gh-pages deployment evidence is unavailable", { cause: error })
    }
    return Object.freeze({ cwd: localOrigin, ref: "origin/gh-pages" })
  }
}

export function validateRepository(artifactRoot = sourceRoot, runtimeRoot = sourceRoot) {
  const decision = validateOwnerDecision(parseJsonFile(artifactRoot, DECISION_PATH))
  const retention = validateRetentionAuthority(parseJsonFile(artifactRoot, RETENTION_PATH))
  const audit = validateAudit(readFileSync(resolve(artifactRoot, AUDIT_PATH), "utf8"), runtimeRoot)
  const handoff = validateHandoff(readFileSync(resolve(artifactRoot, HANDOFF_PATH), "utf8"))
  const runtime = validateRuntime(runtimeRoot)
  validateDeployment(runtimeRoot, handoff)
  return Object.freeze({ status: "CURRENT_BETA_RUNTIME_NONCANONICAL", decisionId: decision.decisionId, ownerTokens: ["1A", "2A", "3A", "B"], auditRows: audit.rows.length, auditClassifications: Object.fromEntries(AUDIT_ROWS.map((row) => [row.classification, AUDIT_ROWS.filter((candidate) => candidate.classification === row.classification).length])), retentionStatus: retention.status, raceDatePersistenceEnabled: retention.persistenceEnabled, ...runtime })
}

function main() {
  const prefix = "--artifact-root="
  const artifactArgument = process.argv.slice(2).find((argument) => argument.startsWith(prefix))
  const summary = validateRepository(artifactArgument ? resolve(artifactArgument.slice(prefix.length)) : sourceRoot, sourceRoot)
  process.stdout.write(`${JSON.stringify(summary)}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`personalized-prescription-v2 authority validation failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
