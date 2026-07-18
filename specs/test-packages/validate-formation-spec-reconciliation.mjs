import assert from "node:assert/strict"
import { access, readFile, readdir } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { parseCsv } from "./formation-csv.mjs"

const MATRIX = "reports/review/FORMATION_RESEARCH_TO_P1_RECONCILIATION_MATRIX.csv"
const CONFLICT_REGISTER = "reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv"
const PLAN_DIR = "reports/target-patch-plans"
const HANDOFF = "reports/review/FORMATION_LATEST_DECISION_RECONCILIATION_HANDOFF.md"
const CONTROLLED_TOKEN = "NO_ACCEPTED_TARGET_YET"
const EXPECTED_HEADERS = [
  "conflict_id",
  "p1_plan_ids",
  "target_paths",
  "latest_owner_clause",
  "research_inputs",
  "decision_packets",
  "remaining_gate",
  "allowed_next_action",
  "forbidden_action",
  "current_authority",
]
const EXPECTED_CONFLICTS = Array.from({ length: 12 }, (_, index) => (
  `FRV2-CONF-${String(index + 1).padStart(3, "0")}`
))
const EXPECTED_PLAN_IDS = Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, "0"))
const EXPECTED_STATUS_BY_CONFLICT = new Map([
  ["FRV2-CONF-001", "PATCH_REQUIRED"],
  ["FRV2-CONF-002", "PATCH_REQUIRED"],
  ["FRV2-CONF-003", "PATCH_REQUIRED"],
  ["FRV2-CONF-004", "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW"],
  ["FRV2-CONF-005", "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW"],
  ["FRV2-CONF-006", "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW"],
  ["FRV2-CONF-007", "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW"],
  ["FRV2-CONF-008", "TARGET_BOUND_PENDING_QUALIFIED_REVIEW"],
  ["FRV2-CONF-009", "HUMAN_REVIEW_REQUIRED"],
  ["FRV2-CONF-010", "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW"],
  ["FRV2-CONF-011", "PATCH_REQUIRED"],
  ["FRV2-CONF-012", "OWNER_DECISION_REQUIRED"],
])
const SUPERSEDED_FILES = [
  "FORMATION_RESEARCH_ACCEPTANCE_DECISION.md",
  "TRAINING_PLAN_METHOD_DECISION.md",
  "FABLE_CODEX_JOINT_PLANNING_BRIEF.md",
  "TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md",
  "reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md",
]

function splitCell(value) {
  return value.split(";").map((item) => item.trim()).filter(Boolean)
}

function yamlScalarValues(text, key) {
  const values = []
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))\s*:\s*(.*?)\s*$/u)
    if (!match) continue
    const parsedKey = match[1] ?? match[2] ?? match[3]
    if (parsedKey === key) values.push(match[4].replace(/\s+#.*$/u, "").trim())
  }
  return values
}

function assertYamlScalar(text, key, expected, expectedCount = 1) {
  assert.deepEqual(
    yamlScalarValues(text, key),
    Array.from({ length: expectedCount }, () => expected),
    `${key} must appear ${expectedCount} time(s) with value ${expected}`,
  )
}

async function read(root, relativePath) {
  return readFile(path.join(root, relativePath), "utf8")
}

async function assertArtifactPath(root, artifact) {
  if (artifact === CONTROLLED_TOKEN) return
  assert.ok(!path.isAbsolute(artifact), `artifact path must be repository-relative: ${artifact}`)
  assert.ok(!artifact.includes(".."), `artifact path cannot traverse: ${artifact}`)
  await access(path.join(root, artifact))
}

function rowMap(rows, key) {
  return new Map(rows.map((row) => [row[key], row]))
}

export async function validateFormationSpecReconciliation(root = process.cwd()) {
  const matrix = parseCsv(await read(root, MATRIX), MATRIX)
  assert.deepEqual(matrix.headers, EXPECTED_HEADERS, "reconciliation matrix headers changed")
  assert.equal(matrix.rows.length, 12, "reconciliation matrix must contain 12 rows")
  const conflicts = matrix.rows.map((row) => row.conflict_id)
  assert.deepEqual([...conflicts].sort(), EXPECTED_CONFLICTS, "matrix must cover each conflict exactly once")

  const referencedPlans = new Set()
  const expectedConflictsByPlan = new Map(EXPECTED_PLAN_IDS.map((planId) => [planId, []]))
  for (const row of matrix.rows) {
    const planIds = splitCell(row.p1_plan_ids)
    assert.ok(planIds.length > 0, `${row.conflict_id} has no P1 plan owner`)
    assert.equal(new Set(planIds).size, planIds.length, `${row.conflict_id} repeats a P1 plan owner`)
    for (const planId of planIds) {
      assert.ok(EXPECTED_PLAN_IDS.includes(planId), `${row.conflict_id} has unknown P1 plan ${planId}`)
      referencedPlans.add(planId)
      expectedConflictsByPlan.get(planId)?.push(row.conflict_id)
    }
    for (const field of ["target_paths", "research_inputs", "decision_packets"]) {
      const artifacts = splitCell(row[field])
      assert.ok(artifacts.length > 0, `${row.conflict_id} has an empty ${field}`)
      for (const artifact of artifacts) await assertArtifactPath(root, artifact)
    }
    assert.equal(row.current_authority, "PREPARATION_ONLY_NO_APPROVAL_NO_RUNTIME")
    assert.ok(row.remaining_gate.length > 0, `${row.conflict_id} hides its remaining gate`)
    assert.ok(row.forbidden_action.length > 0, `${row.conflict_id} hides its forbidden action`)
  }
  assert.deepEqual([...referencedPlans].sort(), EXPECTED_PLAN_IDS, "matrix must reference all ten P1 plans")

  const entries = await readdir(path.join(root, PLAN_DIR), { withFileTypes: true })
  const planFiles = entries
    .filter((entry) => entry.isFile() && /^\d{2}-.+\.md$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort()
  assert.equal(planFiles.length, 10, "P1 inventory must remain exactly ten")
  for (const file of planFiles) {
    const body = await read(root, path.join(PLAN_DIR, file))
    const planId = file.slice(0, 2)
    assert.ok(body.includes("## Latest Research Reconciliation"), `${file} lacks reconciliation section`)
    assertYamlScalar(body, "approved", "false")
    assertYamlScalar(body, "runtime_authorized", "false", 2)
    assertYamlScalar(body, "canonical_spec_patch_authorized", "false", 2)
    assert.match(body, /latest_owner_baseline: reports\/review\/FORMATION_LATEST_OWNER_DECISION_BASELINE\.md/u)
    assertYamlScalar(body, "approval_state_unchanged", "true")
    const reconciliation = body.match(/## Latest Research Reconciliation[\s\S]*?```yaml\s*([\s\S]*?)```/u)?.[1] ?? ""
    const relatedBlock = reconciliation.match(/related_conflicts:\s*\n([\s\S]*?)\nresearch_inputs:/u)?.[1] ?? ""
    const relatedConflicts = [...relatedBlock.matchAll(/^\s+- (FRV2-CONF-\d{3})\s*$/gmu)]
      .map((match) => match[1])
    assert.equal(new Set(relatedConflicts).size, relatedConflicts.length, `${file} repeats a related conflict`)
    assert.deepEqual(
      [...relatedConflicts].sort(),
      [...(expectedConflictsByPlan.get(planId) ?? [])].sort(),
      `${file} conflicts do not match the reconciliation matrix`,
    )
  }

  const planIndex = await read(root, `${PLAN_DIR}/README.md`)
  assertYamlScalar(planIndex, "research_reconciliation", "10/10")
  assertYamlScalar(planIndex, "approved_plans", "0")
  assertYamlScalar(planIndex, "runtime_authorized", "false")
  assert.match(planIndex, /연구[\s\S]{0,160}(?:승인|허가)[\s\S]{0,80}(?:아니|않)/u)

  const register = parseCsv(await read(root, CONFLICT_REGISTER), CONFLICT_REGISTER)
  assert.deepEqual(register.rows.map((row) => row.conflict_id).sort(), EXPECTED_CONFLICTS)
  const registered = rowMap(register.rows, "conflict_id")
  for (const [id, expectedStatus] of EXPECTED_STATUS_BY_CONFLICT) {
    assert.equal(registered.get(id)?.status, expectedStatus, `${id} status is stale`)
  }
  const sharing = registered.get("FRV2-CONF-008")
  assert.match(sharing?.path ?? "", /FORMATION_RECORD_GOVERNANCE_CONTRACT\.md/u)
  assert.match(sharing?.path ?? "", /HUMAN_REVIEW_AND_SHARING_WORKFLOW\.md/u)
  assert.equal(sharing?.status, "TARGET_BOUND_PENDING_QUALIFIED_REVIEW")
  const backup = registered.get("FRV2-CONF-007")
  assert.equal(backup?.status, "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW")
  assert.match(backup?.latest_owner_baseline ?? "", /OWNER_FULL_LOCAL_BACKUP_EXPLICIT_INCLUDE/u)
  assert.match(backup?.required_patch ?? "", /USER_DIRECTED_FILE_OPERATION/u)
  assert.equal(registered.get("FRV2-CONF-012")?.status, "OWNER_DECISION_REQUIRED")

  const governance = await read(root, `${PLAN_DIR}/10-record-governance.md`)
  for (const [label, pattern] of [
    ["FRV2-CONF-008", /FRV2-CONF-008/iu],
    ["OI-FRG-RECIPIENT-SHARE-001", /OI-FRG-RECIPIENT-SHARE-001/iu],
    ["selected recipient", /(?:user-)?selected[^\n]{0,30}recipient/iu],
    ["memo inclusion off by default", /memo inclusion[^\n]{0,40}off by default/iu],
    ["purpose and expiry", /purpose,[^\n]*expiry/iu],
    ["preview through re-share", /preview, confirmation, revocation, download and re-share/iu],
    ["audit youth deletion", /privacy-safe audit, youth handling, and deletion propagation/iu],
    ["sharing unavailable", /sharing remains unavailable/iu],
    ["analysis consent", /no analysis consent/iu],
    ["standing access", /standing access/iu],
    ["Formation through telemetry", /Formation authority, plan authority, safety signal, reward effect,[\s\S]{0,30}telemetry permission/iu],
    ["secondary use", /secondary-use permission/iu],
    ["runtime_authorized: false", /runtime_authorized: false/iu],
  ]) assert.match(governance, pattern, `plan 10 lacks ${label}`)

  const competition = await read(root, "reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md")
  for (const required of [
    "status: NOT_REVIEWED",
    "CA-02",
    "CA-03",
    "APPROVE | REVISE | REJECT",
    "ONE_COMPLETED_COMPETITION_RECORD_ONE_EXPOSURE",
    "calendar_anchor_exposure: 0",
    "runtime_authority: false",
  ]) assert.ok(competition.includes(required), `competition decision sheet lacks ${required}`)
  for (const key of ["status", "owner_decision", "ca_02_decision", "ca_03_decision"]) {
    assertYamlScalar(competition, key, "NOT_REVIEWED")
  }
  assertYamlScalar(competition, "runtime_authority", "false")
  for (const required of [
    "자동 위치 추적",
    "원문 개인/훈련 메모",
    "YOUTH_PRIVACY_SAFEGUARDING_AND_DATA_MINIMIZATION_REVIEW",
    "영속 저장, 공유",
    "telemetry 사용을 허용하지 않는다",
  ]) assert.ok(competition.includes(required), `competition privacy boundary lacks ${required}`)

  for (const file of SUPERSEDED_FILES) {
    const body = await read(root, file)
    assertYamlScalar(body, "product_direction_status", "SUPERSEDED_PRODUCT_DIRECTION")
    assertYamlScalar(body, "historical_runtime_facts_preserved", "true")
    assertYamlScalar(body, "latest_owner_baseline", "reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md")
  }
  const readNow = await read(root, "FORMATION_READ_NOW_DECIDE_LATER.md")
  assert.match(readNow, /no active runtime before named gates/iu)
  assert.doesNotMatch(readNow, /^- no automatic plan;$/mu)
  const deferred = await read(root, "FORMATION_DEFERRED_GOALS.md")
  assert.match(deferred, /9_5_DAY_FORMATION/u)
  assert.match(deferred, /DEFAULT_AUTOMATED_PRESCRIPTION/u)
  assert.match(deferred, /activation[^\n]*deferred/iu)
  const selfCheck = await read(root, "RACE_SELFCHECK_FIELDS_DECISION.md")
  assert.match(selfCheck, /CURRENT_DISPLAY_ONLY_FUTURE_ANALYSIS_INTENDED_FOR_ATHLETE_OWN_ANALYSIS/u)
  assertYamlScalar(selfCheck, "current_plan_use", "prohibited")
  assertYamlScalar(selfCheck, "current_plan_safety_reward_telemetry_use", "PROHIBITED")
  assertYamlScalar(selfCheck, "current_coach_guardian_third_party_use", "PROHIBITED")
  assertYamlScalar(selfCheck, "runtime_authority", "false")

  const handoff = await read(root, HANDOFF)
  for (const required of [
    "status: PREPARATION_PASS_GATES_OPEN",
    "conflicts_mapped: 12/12",
    "patches_applied: 5/12",
    "p1_plans_prepared: 10/10",
    "p1_plans_approved: 0/10",
    "preparation_review_lanes: 5/5_PASS",
    "named_expert_reviews: 0/6",
    "manual_review_scenarios: 0/5",
    "user_teach_back_scenarios: 0/12",
    "ca_02_decision: NOT_REVIEWED",
    "ca_03_decision: NOT_REVIEWED",
    "scientific_acceptance: false",
    "human_acceptance: false",
    "runtime_authority: false",
  ]) assert.ok(handoff.includes(required), `handoff lacks ${required}`)
  assertYamlScalar(handoff, "scientific_acceptance", "false")
  assertYamlScalar(handoff, "human_acceptance", "false")
  assertYamlScalar(handoff, "runtime_authority", "false")
  assert.match(handoff, /현재 앱에[\s\S]{0,80}공유 기능이 생긴 것은 아닙니다/u)

  const evidenceDir = ".omo/evidence/formation-spec-reconciliation"
  const preparationReviews = [
    ["goal-review.md", false],
    ["quality-review.md", true],
    ["security-review.md", false],
    ["qa-review.md", false],
    ["context-review.md", true],
  ]
  for (const [file, preservesInitialBlock] of preparationReviews) {
    const review = await read(root, `${evidenceDir}/${file}`)
    assertYamlScalar(review, "final_verdict", "PREPARATION_PASS")
    assertYamlScalar(review, "formal_human_attestation", "false")
    assertYamlScalar(review, "runtime_authority", "false")
    if (preservesInitialBlock) assertYamlScalar(review, "initial_verdict", "BLOCK")
  }
  const evidenceIndex = await read(root, `${evidenceDir}/README.md`)
  assertYamlScalar(evidenceIndex, "status", "PREPARATION_PASS_GATES_OPEN")
  assertYamlScalar(evidenceIndex, "preparation_review_lanes", "5/5_PASS")
  assertYamlScalar(evidenceIndex, "scientific_acceptance", "false")
  assertYamlScalar(evidenceIndex, "human_acceptance", "false")
  assertYamlScalar(evidenceIndex, "runtime_authority", "false")

  return { conflicts: conflicts.length, plans: planFiles.length, approvedPlans: 0, runtime: false }
}

const invokedAsScript = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedAsScript) {
  try {
    const result = await validateFormationSpecReconciliation()
    process.stdout.write(
      `FORMATION_SPEC_RECONCILIATION_PREPARED conflicts=${result.conflicts} plans=${result.plans} approved=${result.approvedPlans} runtime=${result.runtime}\n`,
    )
  } catch (error) {
    process.stderr.write(`FORMATION_SPEC_RECONCILIATION_INVALID ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
