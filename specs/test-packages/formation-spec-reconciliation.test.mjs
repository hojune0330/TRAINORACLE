import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import test from "node:test"
import { validateFormationSpecReconciliation } from "./validate-formation-spec-reconciliation.mjs"

const projectRoot = path.resolve(import.meta.dirname, "../..")
const rootFiles = [
  "FABLE_CODEX_JOINT_PLANNING_BRIEF.md",
  "FORMATION_COACH_RULESET_ACCEPTANCE_DECISION.md",
  "FORMATION_DEFERRED_GOALS.md",
  "FORMATION_PRIVACY_GOVERNANCE_DECISION.md",
  "FORMATION_PRODUCT_PROJECTION_ACCEPTANCE_DECISION.md",
  "FORMATION_READ_NOW_DECIDE_LATER.md",
  "FORMATION_RESEARCH_ACCEPTANCE_DECISION.md",
  "RACE_SELFCHECK_FIELDS_DECISION.md",
  "TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md",
  "TRAINING_PLAN_METHOD_DECISION.md",
]

async function createFixture() {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "trainoracle-reconciliation-"))
  await Promise.all([
    cp(path.join(projectRoot, "reports"), path.join(fixture, "reports"), { recursive: true }),
    cp(path.join(projectRoot, "specs"), path.join(fixture, "specs"), { recursive: true }),
    ...rootFiles.map((file) => cp(path.join(projectRoot, file), path.join(fixture, file))),
  ])
  return fixture
}

async function replace(fixture, relativePath, before, after) {
  const file = path.join(fixture, relativePath)
  const body = await readFile(file, "utf8")
  assert.ok(body.includes(before), `${relativePath} lacks mutation source`)
  await writeFile(file, body.replace(before, after), "utf8")
}

async function expectInvalid(mutator) {
  const fixture = await createFixture()
  try {
    await mutator(fixture)
    await assert.rejects(() => validateFormationSpecReconciliation(fixture))
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
}

test("complete preparation passes without granting authority", () => {
  const result = spawnSync(process.execPath, ["specs/test-packages/validate-formation-spec-reconciliation.mjs"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
})

test("removed conflict fails closed", async () => {
  await expectInvalid(async (fixture) => {
    const file = path.join(fixture, "reports/review/FORMATION_RESEARCH_TO_P1_RECONCILIATION_MATRIX.csv")
    const rows = (await readFile(file, "utf8")).split(/\r?\n/u)
    await writeFile(file, `${rows.filter((row) => !row.includes("FRV2-CONF-012")).join("\n")}\n`, "utf8")
  })
})

test("unknown P1 plan reference fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/review/FORMATION_RESEARCH_TO_P1_RECONCILIATION_MATRIX.csv",
    '"FRV2-CONF-002","01"',
    '"FRV2-CONF-002","99"',
  ))
})

test("forged plan approval fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/target-patch-plans/01-coach-ruleset.md",
    "approved: false",
    "approved: false\napproved: true",
  ))
})

test("commented forged plan approval fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/target-patch-plans/01-coach-ruleset.md",
    "approved: false",
    "approved: false\napproved: true # forged",
  ))
})

test("spaced-colon forged plan approval fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/target-patch-plans/01-coach-ruleset.md",
    "approved: false",
    "approved: false\napproved : true",
  ))
})

test("quoted-key forged plan approval fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/target-patch-plans/01-coach-ruleset.md",
    "approved: false",
    'approved: false\n"approved": true',
  ))
})

test("runtime authorization fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/target-patch-plans/02-load-component.md",
    "runtime_authorized: false",
    "runtime_authorized: false\nruntime_authorized: true",
  ))
})

test("commented runtime authorization fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/target-patch-plans/02-load-component.md",
    "runtime_authorized: false",
    "runtime_authorized: false\nruntime_authorized: true # forged",
  ))
})

test("duplicate P1 plan reference fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/review/FORMATION_RESEARCH_TO_P1_RECONCILIATION_MATRIX.csv",
    '"FRV2-CONF-002","01"',
    '"FRV2-CONF-002","01;01"',
  ))
})

test("matrix and plan conflict ownership mismatch fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/review/FORMATION_RESEARCH_TO_P1_RECONCILIATION_MATRIX.csv",
    '"FRV2-CONF-002","01"',
    '"FRV2-CONF-002","02"',
  ))
})

test("expanded current authority token fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/review/FORMATION_RESEARCH_TO_P1_RECONCILIATION_MATRIX.csv",
    "PREPARATION_ONLY_NO_APPROVAL_NO_RUNTIME",
    "PREPARATION_ONLY_NO_APPROVAL_NO_RUNTIME_OWNER_APPROVED",
  ))
})

test("eleventh P1 plan fails closed", async () => {
  await expectInvalid((fixture) => cp(
    path.join(fixture, "reports/target-patch-plans/01-coach-ruleset.md"),
    path.join(fixture, "reports/target-patch-plans/11-unapproved-expansion.md"),
  ))
})

test("recipient sharing secondary-use boundary removal fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/target-patch-plans/10-record-governance.md",
    "standing access",
    "persistent access",
  ))
})

test("recipient sharing deletion boundary removal fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/target-patch-plans/10-record-governance.md",
    "deletion propagation",
    "deletion optional",
  ))
})

test("competition choice auto-approval fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md",
    "status: NOT_REVIEWED",
    "status: NOT_REVIEWED\nstatus: APPROVED",
  ))
})

test("commented competition auto-approval fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md",
    "status: NOT_REVIEWED",
    "status: NOT_REVIEWED\nstatus: APPROVED # forged",
  ))
})

test("spaced-colon competition auto-approval fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md",
    "status: NOT_REVIEWED",
    "status: NOT_REVIEWED\nstatus : APPROVED",
  ))
})

test("missing supersession marker fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "TRAINING_PLAN_METHOD_DECISION.md",
    "product_direction_status: SUPERSEDED_PRODUCT_DIRECTION",
    "product_direction_status: CURRENT_PRODUCT_DIRECTION",
  ))
})

test("current race self-check plan use fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "RACE_SELFCHECK_FIELDS_DECISION.md",
    "current_plan_use: prohibited",
    "current_plan_use: prohibited\ncurrent_plan_use: allowed",
  ))
})

test("handoff authority promotion fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/review/FORMATION_LATEST_DECISION_RECONCILIATION_HANDOFF.md",
    "runtime_authority: false",
    "runtime_authority: false\nruntime_authority: true",
  ))
})

test("commented handoff authority promotion fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/review/FORMATION_LATEST_DECISION_RECONCILIATION_HANDOFF.md",
    "runtime_authority: false",
    "runtime_authority: false\nruntime_authority: true # forged",
  ))
})

test("quoted-key handoff authority promotion fails closed", async () => {
  await expectInvalid((fixture) => replace(
    fixture,
    "reports/review/FORMATION_LATEST_DECISION_RECONCILIATION_HANDOFF.md",
    "runtime_authority: false",
    'runtime_authority: false\n"runtime_authority": true',
  ))
})
