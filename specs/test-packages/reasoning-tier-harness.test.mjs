import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { renderWorkCapsule, selectReadyTasks, validateCatalog } from "./reasoning-tier-harness.mjs"

const stages = [
  {
    id: "S1_DEEP_FRAME",
    order: 1,
    reasoning: "high",
    maxReferences: 10,
    maxCapsuleChars: 12000,
    maxBatchTasks: 1,
  },
  {
    id: "S2_BOUNDED_BUILD",
    order: 2,
    reasoning: "medium",
    maxReferences: 6,
    maxCapsuleChars: 6000,
    maxBatchTasks: 2,
  },
  {
    id: "S3_MECHANICAL_BATCH",
    order: 3,
    reasoning: "high",
    executionModel: "gpt-5.6-terra",
    maxReferences: 3,
    maxCapsuleChars: 3000,
    maxBatchTasks: 5,
  },
]

function task(overrides = {}) {
  return {
    id: "MECH-001",
    title: "Run the deterministic harness checks",
    stage: "S3_MECHANICAL_BATCH",
    status: "READY",
    priority: 1,
    kind: "VALIDATION",
    decisionComplete: true,
    risks: {
      policyInterpretation: false,
      scientificJudgment: false,
      legalJudgment: false,
      humanAuthority: false,
      runtimeActivation: false,
    },
    dependsOn: ["FRAME-000"],
    evidence: [{ path: "README.md", contains: "TRAINORACLE" }],
    allowedPaths: ["reports/work-harness/**"],
    deterministicChecks: ["node specs/test-packages/reasoning-tier-harness.mjs validate"],
    forbiddenActions: ["Do not approve policy", "Do not activate runtime"],
    ...overrides,
  }
}

function catalog(overrides = {}) {
  return {
    schemaVersion: 1,
    catalogId: "TO-REASONING-TIER-HARNESS-TEST",
    sourceSnapshot: "a0a51096762a82f1cdf56b0eb522e72e870484c6",
    runtimeAuthority: false,
    handoffPolicy: {
      mode: "STOP_AND_HANDOFF",
      triggers: ["evidence_stale", "scope_expansion", "authority_required", "check_failure"],
    },
    stages,
    tasks: [
      task({
        id: "FRAME-000",
        title: "Completed framing dependency",
        stage: "S1_DEEP_FRAME",
        status: "DONE",
        kind: "POLICY_FRAME",
        dependsOn: [],
      }),
      task(),
    ],
    ...overrides,
  }
}

test("valid catalog passes when authority and evidence stay bounded", () => {
  assert.deepEqual(validateCatalog(catalog(), { repoRoot: process.cwd() }), [])
})

test("stage budgets must strictly descend", () => {
  const invalidStages = structuredClone(stages)
  invalidStages[2].maxReferences = 7
  const errors = validateCatalog(catalog({ stages: invalidStages }), { repoRoot: process.cwd() })
  assert.ok(errors.some((error) => error.code === "E_STAGE_BUDGET_DESCENT"))
})

test("mechanical stage requires the Terra high execution profile", () => {
  const invalidStages = structuredClone(stages)
  invalidStages[2].executionModel = "gpt-5.6-sol"
  const errors = validateCatalog(catalog({ stages: invalidStages }), { repoRoot: process.cwd() })
  assert.ok(errors.some((error) => error.code === "E_STAGE_EXECUTION"))
})

test("catalog requires stop-and-handoff triggers for uncertain work", () => {
  const errors = validateCatalog(catalog({ handoffPolicy: { mode: "CONTINUE", triggers: [] } }), { repoRoot: process.cwd() })
  assert.ok(errors.some((error) => error.code === "E_HANDOFF_POLICY"))
})

test("catalog requires a pinned source snapshot", () => {
  const errors = validateCatalog(catalog({ sourceSnapshot: "not-a-commit" }), { repoRoot: process.cwd() })
  assert.ok(errors.some((error) => error.code === "E_SOURCE_SNAPSHOT"))
})

test("malformed stage and task structures fail without crashing", () => {
  const malformed = catalog({ stages: "not-an-array", tasks: [null] })
  assert.doesNotThrow(() => validateCatalog(malformed, { repoRoot: process.cwd() }))
  const errors = validateCatalog(malformed, { repoRoot: process.cwd() })
  assert.ok(errors.some((error) => error.code === "E_STAGE_SET"))
  assert.ok(errors.some((error) => error.code === "E_TASK_SHAPE"))
})

test("mechanical stage rejects human or runtime authority", () => {
  const invalidTask = task({
    risks: {
      policyInterpretation: false,
      scientificJudgment: false,
      legalJudgment: false,
      humanAuthority: true,
      runtimeActivation: true,
    },
  })
  const errors = validateCatalog(catalog({ tasks: [invalidTask] }), { repoRoot: process.cwd() })
  assert.ok(errors.some((error) => error.code === "E_LOW_STAGE_AUTHORITY"))
})

test("mechanical stage requires a complete decision and deterministic check", () => {
  const invalidTask = task({ decisionComplete: false, deterministicChecks: [] })
  const errors = validateCatalog(catalog({ tasks: [invalidTask] }), { repoRoot: process.cwd() })
  assert.ok(errors.some((error) => error.code === "E_LOW_STAGE_INCOMPLETE"))
  assert.ok(errors.some((error) => error.code === "E_TASK_CHECKS"))
})

test("bounded build rejects incomplete or authority-bearing work", () => {
  const invalidTask = task({
    stage: "S2_BOUNDED_BUILD",
    decisionComplete: false,
    risks: {
      policyInterpretation: true,
      scientificJudgment: false,
      legalJudgment: false,
      humanAuthority: false,
      runtimeActivation: false,
    },
  })
  const errors = validateCatalog(catalog({ tasks: [invalidTask] }), { repoRoot: process.cwd() })
  assert.ok(errors.some((error) => error.code === "E_BOUNDED_STAGE_INCOMPLETE"))
})

test("ready work cannot claim legal, human, or runtime authority", () => {
  const invalidTask = task({
    stage: "S1_DEEP_FRAME",
    risks: {
      policyInterpretation: false,
      scientificJudgment: false,
      legalJudgment: true,
      humanAuthority: true,
      runtimeActivation: true,
    },
  })
  const errors = validateCatalog(catalog({ tasks: [invalidTask] }), { repoRoot: process.cwd() })
  assert.ok(errors.some((error) => error.code === "E_READY_AUTHORITY"))
})

test("missing or stale evidence and broken text fail closed", () => {
  const invalidTask = task({
    title: "Broken � text",
    evidence: [
      { path: "missing-file.md", contains: "anything" },
      { path: "README.md", contains: "marker-that-does-not-exist" },
    ],
  })
  const errors = validateCatalog(catalog({ tasks: [invalidTask] }), { repoRoot: process.cwd() })
  assert.ok(errors.some((error) => error.code === "E_TEXT_ENCODING"))
  assert.ok(errors.some((error) => error.code === "E_EVIDENCE_MISSING"))
  assert.ok(errors.some((error) => error.code === "E_EVIDENCE_STALE"))
})

test("selection returns only ready tasks with completed dependencies", () => {
  const selected = selectReadyTasks(catalog(), "S3_MECHANICAL_BATCH")
  assert.deepEqual(selected.map(({ id }) => id), ["MECH-001"])

  const blocked = catalog({
    tasks: [task({ id: "FRAME-000", status: "WAIT_DEPENDENCY" }), task()],
  })
  assert.deepEqual(selectReadyTasks(blocked, "S3_MECHANICAL_BATCH"), [])
})

test("rendered capsule preserves authority boundary and stage cap", () => {
  const source = catalog()
  const capsule = renderWorkCapsule(source, "S3_MECHANICAL_BATCH", selectReadyTasks(source, "S3_MECHANICAL_BATCH"))
  assert.match(capsule, /runtime_authority: false/u)
  assert.match(capsule, /model: gpt-5\.6-terra/u)
  assert.match(capsule, /MECH-001/u)
  assert.ok(capsule.length <= 3000)
})

test("rendered capsule fails instead of crossing its character cap", () => {
  const tinyStages = structuredClone(stages)
  tinyStages[2].maxCapsuleChars = 100
  const source = catalog({ stages: tinyStages })
  assert.throws(
    () => renderWorkCapsule(source, "S3_MECHANICAL_BATCH", selectReadyTasks(source, "S3_MECHANICAL_BATCH")),
    (error) => error.code === "E_CAPSULE_OVER_BUDGET",
  )
})

test("real catalog has no autonomous work after the safe gate recount completes", () => {
  const path = resolve(process.cwd(), "reports/work-harness/TRAINORACLE_WORK_CATALOG.json")
  const source = JSON.parse(readFileSync(path, "utf8"))
  assert.deepEqual(validateCatalog(source, { repoRoot: process.cwd() }), [])
  assert.deepEqual(selectReadyTasks(source, "S1_DEEP_FRAME"), [])
  assert.deepEqual(selectReadyTasks(source, "S2_BOUNDED_BUILD"), [])
  assert.deepEqual(selectReadyTasks(source, "S3_MECHANICAL_BATCH"), [])
  assert.equal(source.tasks.find(({ id }) => id === "S3-GATE-RECOUNT")?.status, "DONE")
})
