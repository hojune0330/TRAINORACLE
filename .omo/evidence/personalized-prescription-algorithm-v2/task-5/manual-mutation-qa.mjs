import assert from "node:assert/strict"
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const root = resolve(import.meta.dirname, "../../../..")
const matrixPath = "reports/review/TAPER_EVIDENCE_AUTHORITY_MATRIX_V1_2026-08-23.md"
const validatorPath = resolve(root, "specs/test-packages/validate-personalized-prescription-v2-taper-authority.mjs")
const sourceFiles = [
  ".omo/reports/personalized-prescription-source-gate-2026-08-23.md",
  "specs/active/PLAN_GENERATOR_SPEC.md",
  "specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md",
  "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md",
  ".omo/evidence/formation-research-v2/competition-anchor-primary-research.md",
]

function copy(rootFrom, rootTo, path) {
  const destination = join(rootTo, path)
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(resolve(rootFrom, path), destination)
}

function parse(source) {
  const match = source.match(/```json\r?\n([\s\S]*?)\r?\n```/u)
  assert.ok(match, "matrix JSON mutation target must exist")
  return { jsonText: match[1], matrix: JSON.parse(match[1]) }
}

function replaceMatrix(source, mutate) {
  const parsed = parse(source)
  mutate(parsed.matrix)
  return source.replace(parsed.jsonText, JSON.stringify(parsed.matrix, null, 2))
}

function runValidator(artifactRoot, sourceRoot) {
  return spawnSync(process.execPath, [
    validatorPath,
    "--root", artifactRoot,
    "--source-root", sourceRoot,
  ], { encoding: "utf8" })
}

const cases = [
  ["active-authority", source => replaceMatrix(source, matrix => {
    assert.equal(matrix.status, "INACTIVE_RESEARCH_CANDIDATE")
    matrix.status = "ACTIVE"
  })],
  ["omitted-source", source => replaceMatrix(source, matrix => {
    assert.equal(matrix.reviewedRows.length, 22)
    matrix.reviewedRows.pop()
  })],
  ["duplicate-source", source => replaceMatrix(source, matrix => {
    assert.notEqual(matrix.reviewedRows[0].sourceId, matrix.reviewedRows[1].sourceId)
    matrix.reviewedRows[1].sourceId = matrix.reviewedRows[0].sourceId
  })],
  ["deleted-null-evidence", source => replaceMatrix(source, matrix => {
    assert.equal(matrix.reviewedRows.filter(row => row.resultClass === "NULL").length, 4)
    matrix.reviewedRows = matrix.reviewedRows.filter(row => row.resultClass !== "NULL")
  })],
  ["invented-percentage", source => replaceMatrix(source, matrix => {
    const row = matrix.reviewedRows.find(entry => entry.sourceId === "SRC-PMID-10694140")
    assert.ok(row)
    row.numericObservations.push({ field: "volumeReduction", provenance: "REPORTED", value: 42, unit: "PERCENT" })
  })],
  ["changed-reported-number", source => replaceMatrix(source, matrix => {
    const row = matrix.reviewedRows.find(entry => entry.sourceId === "SRC-PMID-2318562")
    const observation = row?.numericObservations.find(entry => entry.field === "volumeReduction")
    assert.equal(observation?.value, 70)
    observation.value = 71
  })],
  ["missing-supplemental-evidence", source => replaceMatrix(source, matrix => {
    assert.equal(matrix.supplementalEvidence.length, 1)
    matrix.supplementalEvidence = []
  })],
  ["stale-supplemental-digest", source => replaceMatrix(source, matrix => {
    assert.equal(matrix.supplementalEvidence.length, 1)
    matrix.supplementalEvidence[0].fileSha256 = `sha256:${"0".repeat(64)}`
  })],
  ["wrong-supplemental-fragment", source => replaceMatrix(source, matrix => {
    assert.equal(matrix.supplementalEvidence[0].lineStart, 109)
    matrix.supplementalEvidence[0].lineStart = 108
    matrix.supplementalEvidence[0].lineEnd = 108
  })],
  ["wrong-supplemental-path", source => replaceMatrix(source, matrix => {
    assert.equal(matrix.supplementalEvidence[0].path, sourceFiles.at(-1))
    matrix.supplementalEvidence[0].path = "README.md"
  })],
  ["coordinated-subgroup-values", source => replaceMatrix(source, matrix => {
    const row = matrix.reviewedRows.find(entry => entry.sourceId === "SRC-PMID-12165889")
    const daily = row?.numericObservations.find(entry => entry.field === "dailyConditionSize")
    const rest = row?.numericObservations.find(entry => entry.field === "restConditionSize")
    assert.equal(daily?.value, 5)
    assert.equal(rest?.value, 4)
    daily.value = 999
    rest.value = 1
  })],
  ["operative-multiplier", source => replaceMatrix(source, matrix => {
    matrix.reviewedRows[0].volumeMultiplier = 0.7
  })],
  ["assumed-baseline", source => replaceMatrix(source, matrix => {
    const row = matrix.reviewedRows.find(entry => entry.sourceId === "SRC-PMID-10694140")
    assert.deepEqual(row?.fields.baselineUnitReference, ["NOT_REPORTED", "NOT_FOUND"])
    row.fields.baselineUnitReference = ["REPORTED", "ASSUMED_PREVIOUS_WEEK_KM"]
  })],
  ["malformed-json", source => {
    assert.ok(source.includes('"schemaVersion": 1'))
    return source.replace('"schemaVersion": 1', '"schemaVersion":')
  }],
  ["trailing-text", source => {
    assert.ok(source.trimEnd().endsWith("[DRAFT_COMPLETE]"))
    return source + "\nTRAILING TEXT\n"
  }],
  ["misleading-human-status", source => {
    const target = "Status: INACTIVE_RESEARCH_CANDIDATE"
    assert.equal(source.split(target).length - 1, 1)
    return source.replace(target, "Status: ACTIVE_RUNTIME_AUTHORITY")
  }],
]

const pristine = runValidator(root, root)
assert.equal(pristine.status, 0, pristine.stderr || pristine.stdout)
const outcomes = []
const tempRoots = []

try {
  for (const [name, mutate] of cases) {
    const temp = mkdtempSync(join(tmpdir(), "trainoracle-taper-task5-"))
    tempRoots.push(temp)
    copy(root, temp, matrixPath)
    const target = join(temp, matrixPath)
    writeFileSync(target, mutate(readFileSync(target, "utf8")), "utf8")
    const result = runValidator(temp, root)
    assert.equal(result.status, 1, name + " must exit 1")
    outcomes.push({ name, exitCode: result.status, targetPresent: true, rejected: true })
    rmSync(temp, { recursive: true, force: true })
  }

  const staleRoot = mkdtempSync(join(tmpdir(), "trainoracle-taper-task5-stale-"))
  tempRoots.push(staleRoot)
  copy(root, staleRoot, matrixPath)
  for (const path of sourceFiles) copy(root, staleRoot, path)
  const gatePath = join(staleRoot, sourceFiles[0])
  writeFileSync(gatePath, readFileSync(gatePath, "utf8") + "\nSTALE\n", "utf8")
  const staleResult = runValidator(staleRoot, staleRoot)
  assert.equal(staleResult.status, 1, "stale source gate must exit 1")
  outcomes.push({ name: "stale-source-gate", exitCode: staleResult.status, targetPresent: true, rejected: true })
  rmSync(staleRoot, { recursive: true, force: true })

  const supplementalRoot = mkdtempSync(join(tmpdir(), "trainoracle-taper-task5-supplemental-"))
  tempRoots.push(supplementalRoot)
  copy(root, supplementalRoot, matrixPath)
  for (const path of sourceFiles) copy(root, supplementalRoot, path)
  const supplementalPath = join(supplementalRoot, sourceFiles.at(-1))
  const supplementalSource = readFileSync(supplementalPath, "utf8")
  const subgroupTarget = "매일 훈련 n=5와 사흘마다 하루 휴식 n=4"
  assert.equal(supplementalSource.split(subgroupTarget).length - 1, 1)
  writeFileSync(supplementalPath, supplementalSource.replace(
    subgroupTarget,
    "매일 훈련 n=999와 사흘마다 하루 휴식 n=1",
  ), "utf8")
  const supplementalResult = runValidator(supplementalRoot, supplementalRoot)
  assert.equal(supplementalResult.status, 1, "mutated supplemental source must exit 1")
  assert.doesNotMatch(supplementalResult.stdout, /PREPARED_DRAFT_NON_RUNTIME_TAPER_MATRIX/u)
  outcomes.push({
    name: "supplemental-source-999-1",
    exitCode: supplementalResult.status,
    targetPresent: true,
    rejected: true,
    misleadingSuccessOutput: false,
  })
  rmSync(supplementalRoot, { recursive: true, force: true })
} finally {
  for (const temp of tempRoots) rmSync(temp, { recursive: true, force: true })
}

assert.ok(tempRoots.every(temp => !existsSync(temp)), "all temporary roots must be removed")
console.log(JSON.stringify({
  pristineExitCode: pristine.status,
  invalidCases: outcomes.length,
  invalidExitCodes: [...new Set(outcomes.map(outcome => outcome.exitCode))],
  exitCodeAuthoritative: true,
  targetPresenceChecked: outcomes.every(outcome => outcome.targetPresent),
  cleanupComplete: tempRoots.every(temp => !existsSync(temp)),
  outcomes,
}, null, 2))
