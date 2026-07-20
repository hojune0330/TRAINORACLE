import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

const CATALOG_PATH = "reports/work-harness/TRAINORACLE_WORK_CATALOG.json"
const EXPECTED_STAGES = [
  ["S1_DEEP_FRAME", "high"],
  ["S2_BOUNDED_BUILD", "medium"],
  ["S3_MECHANICAL_BATCH", "low"],
]
const STATUSES = new Set(["READY", "WAIT_DEPENDENCY", "BLOCKED_OWNER", "BLOCKED_HUMAN", "DEFERRED_VOLUME", "DONE"])
const LOW_KINDS = new Set(["VALIDATION", "METADATA_AUDIT", "DOC_SYNC", "FIXTURE_TRANSCRIPTION"])
const RISK_KEYS = ["policyInterpretation", "scientificJudgment", "legalJudgment", "humanAuthority", "runtimeActivation"]
const PROTECTED_LOW_PATHS = ["FORMATION_FORMAL_APPROVAL_ROSTER", "reports/target-patch-plans", "runtime-evidence", "app/", "impl/"]

export class HarnessError extends Error {
  constructor(code, message) {
    super(message)
    this.name = "HarnessError"
    this.code = code
  }
}

function issue(errors, code, message) {
  errors.push({ code, message })
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0
}

export function validateCatalog(catalog, { repoRoot } = {}) {
  const errors = []
  if (catalog === null || typeof catalog !== "object" || Array.isArray(catalog)) {
    return [{ code: "E_CATALOG_SHAPE", message: "catalog must be an object" }]
  }
  if (catalog.schemaVersion !== 1) issue(errors, "E_SCHEMA_VERSION", "schemaVersion must be 1")
  if (!/^[0-9a-f]{40}$/u.test(catalog.sourceSnapshot ?? "")) issue(errors, "E_SOURCE_SNAPSHOT", "sourceSnapshot must be a full lowercase commit SHA")
  if (catalog.runtimeAuthority !== false) issue(errors, "E_RUNTIME_AUTHORITY", "runtimeAuthority must remain false")
  if (JSON.stringify(catalog).includes("�")) issue(errors, "E_TEXT_ENCODING", "catalog contains a replacement character")

  const declaredStages = Array.isArray(catalog.stages) ? catalog.stages : []
  if (declaredStages.length !== EXPECTED_STAGES.length) {
    issue(errors, "E_STAGE_SET", "catalog must declare exactly three stages")
  } else {
    for (const [index, [expectedId, expectedReasoning]] of EXPECTED_STAGES.entries()) {
      const stage = declaredStages[index]
      if (stage?.id !== expectedId || stage?.order !== index + 1 || stage?.reasoning !== expectedReasoning) {
        issue(errors, "E_STAGE_SET", `stage ${index + 1} must be ${expectedId}/${expectedReasoning}`)
      }
      for (const key of ["maxReferences", "maxCapsuleChars", "maxBatchTasks"]) {
        if (!Number.isInteger(stage?.[key]) || stage[key] < 1) issue(errors, "E_STAGE_BUDGET", `${expectedId}.${key} must be positive`)
      }
      if (index > 0) {
        const previous = declaredStages[index - 1]
        if (stage?.maxReferences >= previous?.maxReferences || stage?.maxCapsuleChars >= previous?.maxCapsuleChars) {
          issue(errors, "E_STAGE_BUDGET_DESCENT", "reference and capsule budgets must strictly descend")
        }
      }
    }
  }

  if (!Array.isArray(catalog.tasks)) return [...errors, { code: "E_TASK_SET", message: "tasks must be an array" }]
  const stageById = new Map(declaredStages.map((stage) => [stage.id, stage]))
  const ids = new Set()
  for (const task of catalog.tasks) {
    if (task === null || typeof task !== "object" || Array.isArray(task)) {
      issue(errors, "E_TASK_SHAPE", "each task must be an object")
      continue
    }
    const label = typeof task?.id === "string" ? task.id : "UNKNOWN"
    if (!/^[A-Z0-9-]+$/u.test(label) || ids.has(label)) issue(errors, "E_TASK_ID", `invalid or duplicate task id: ${label}`)
    ids.add(label)
    if (!stageById.has(task?.stage)) issue(errors, "E_TASK_STAGE", `${label} has an unknown stage`)
    if (!STATUSES.has(task?.status)) issue(errors, "E_TASK_STATUS", `${label} has an unknown status`)
    if (!Number.isInteger(task?.priority) || task.priority < 1) issue(errors, "E_TASK_PRIORITY", `${label} needs a positive priority`)
    if (typeof task?.decisionComplete !== "boolean") issue(errors, "E_TASK_DECISION_STATE", `${label} needs decisionComplete`)
    if (!isNonEmptyArray(task?.allowedPaths)) issue(errors, "E_TASK_PATHS", `${label} needs allowed paths`)
    if (!isNonEmptyArray(task?.deterministicChecks)) issue(errors, "E_TASK_CHECKS", `${label} needs deterministic checks`)
    if (!isNonEmptyArray(task?.forbiddenActions)) issue(errors, "E_TASK_FORBIDDEN", `${label} needs forbidden actions`)
    if (!Array.isArray(task?.dependsOn) || !Array.isArray(task?.evidence)) issue(errors, "E_TASK_SHAPE", `${label} needs dependencies and evidence`)
    for (const key of RISK_KEYS) {
      if (typeof task?.risks?.[key] !== "boolean") issue(errors, "E_TASK_RISK", `${label}.${key} must be boolean`)
    }

    const stage = stageById.get(task?.stage)
    if (stage && task.evidence?.length > stage.maxReferences) issue(errors, "E_TASK_REFERENCE_CAP", `${label} exceeds its reference cap`)
    if (task?.stage === "S2_BOUNDED_BUILD" && (task.decisionComplete !== true || RISK_KEYS.some((key) => task.risks?.[key] === true))) {
      issue(errors, "E_BOUNDED_STAGE_INCOMPLETE", `${label} is not a bounded decision-complete build`)
    }
    if (task?.stage === "S3_MECHANICAL_BATCH") {
      if (RISK_KEYS.some((key) => task.risks?.[key] === true)) issue(errors, "E_LOW_STAGE_AUTHORITY", `${label} has authority risk`)
      if (task.decisionComplete !== true) issue(errors, "E_LOW_STAGE_INCOMPLETE", `${label} is not decision complete`)
      if (!LOW_KINDS.has(task.kind)) issue(errors, "E_LOW_STAGE_KIND", `${label} has a non-mechanical kind`)
      if (task.allowedPaths?.some((path) => PROTECTED_LOW_PATHS.some((part) => path.includes(part)))) {
        issue(errors, "E_LOW_STAGE_PATH", `${label} can write to a protected path`)
      }
    }
    if (task?.status === "READY" && ["legalJudgment", "humanAuthority", "runtimeActivation"].some((key) => task.risks?.[key] === true)) {
      issue(errors, "E_READY_AUTHORITY", `${label} cannot be ready while authority is required`)
    }

    for (const evidence of task.evidence ?? []) {
      if (typeof evidence?.path !== "string" || typeof evidence?.contains !== "string") {
        issue(errors, "E_EVIDENCE_SHAPE", `${label} has malformed evidence`)
        continue
      }
      if (repoRoot) {
        const path = resolve(repoRoot, evidence.path)
        if (!existsSync(path)) issue(errors, "E_EVIDENCE_MISSING", `${label} reference is missing: ${evidence.path}`)
        else if (!readFileSync(path, "utf8").includes(evidence.contains)) issue(errors, "E_EVIDENCE_STALE", `${label} marker changed: ${evidence.path}`)
      }
    }
  }

  for (const task of catalog.tasks) {
    if (task === null || typeof task !== "object" || Array.isArray(task)) continue
    for (const dependency of task.dependsOn ?? []) {
      if (!ids.has(dependency)) issue(errors, "E_TASK_DEPENDENCY", `${task.id} has missing dependency ${dependency}`)
    }
  }
  return errors
}

export function selectReadyTasks(catalog, stageId) {
  const stage = catalog.stages.find(({ id }) => id === stageId)
  if (!stage) throw new HarnessError("E_UNKNOWN_STAGE", `unknown stage: ${stageId}`)
  const done = new Set(catalog.tasks.filter(({ status }) => status === "DONE").map(({ id }) => id))
  const candidates = catalog.tasks
    .filter((task) => task.stage === stageId && task.status === "READY" && task.dependsOn.every((id) => done.has(id)))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
  const selected = []
  const references = new Set()
  for (const task of candidates) {
    const nextReferences = new Set([...references, ...task.evidence.map(({ path }) => path)])
    if (selected.length >= stage.maxBatchTasks || nextReferences.size > stage.maxReferences) continue
    selected.push(task)
    for (const path of nextReferences) references.add(path)
  }
  return selected
}

export function renderWorkCapsule(catalog, stageId, tasks) {
  const stage = catalog.stages.find(({ id }) => id === stageId)
  if (!stage) throw new HarnessError("E_UNKNOWN_STAGE", `unknown stage: ${stageId}`)
  const lines = [
    `# TRAINORACLE Work Capsule: ${stageId}`,
    "",
    "```yaml",
    `reasoning: ${stage.reasoning}`,
    `reference_cap: ${stage.maxReferences}`,
    `capsule_character_cap: ${stage.maxCapsuleChars}`,
    "runtime_authority: false",
    "```",
    "",
  ]
  if (tasks.length === 0) lines.push("NO_READY_TASKS: dependencies or required human decisions remain open.")
  for (const task of tasks) {
    lines.push(`## ${task.id}: ${task.title}`, "", `Kind: ${task.kind}`, "", "Read only:")
    for (const path of new Set(task.evidence.map((evidence) => evidence.path))) lines.push(`- \`${path}\``)
    lines.push("", "Allowed paths:")
    for (const path of task.allowedPaths) lines.push(`- \`${path}\``)
    lines.push("", "Checks:")
    for (const check of task.deterministicChecks) lines.push(`- \`${check}\``)
    lines.push("", "Forbidden:")
    for (const action of task.forbiddenActions) lines.push(`- ${action}`)
    lines.push("")
  }
  const capsule = `${lines.join("\n")}\n`
  if (capsule.length > stage.maxCapsuleChars) throw new HarnessError("E_CAPSULE_OVER_BUDGET", `${stageId} capsule exceeds its character cap`)
  return capsule
}

function readCatalog(repoRoot) {
  return JSON.parse(readFileSync(resolve(repoRoot, CATALOG_PATH), "utf8"))
}

function main() {
  const repoRoot = resolve(import.meta.dirname, "../..")
  const [command, ...args] = process.argv.slice(2)
  if (!new Set(["validate", "next"]).has(command)) throw new HarnessError("E_USAGE", "usage: reasoning-tier-harness.mjs validate | next --stage <stage>")
  const catalog = readCatalog(repoRoot)
  const errors = validateCatalog(catalog, { repoRoot })
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error.code}: ${error.message}\n`)
    process.exitCode = 1
    return
  }
  if (command === "validate") {
    process.stdout.write(`PASS catalog tasks=${catalog.tasks.length} stages=3 runtime=false\n`)
    return
  }
  const stageIndex = args.indexOf("--stage")
  if (stageIndex === -1 || !args[stageIndex + 1]) throw new HarnessError("E_USAGE", "next requires --stage <stage>")
  const stageId = args[stageIndex + 1]
  process.stdout.write(renderWorkCapsule(catalog, stageId, selectReadyTasks(catalog, stageId)))
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ""
if (import.meta.url === invokedUrl) {
  try {
    main()
  } catch (error) {
    if (error instanceof HarnessError) process.stderr.write(`${error.code}: ${error.message}\n`)
    else throw error
    process.exitCode = 1
  }
}
