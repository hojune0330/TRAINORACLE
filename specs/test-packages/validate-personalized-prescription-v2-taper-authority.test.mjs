import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { test } from "node:test"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import {
  MATRIX_PATH,
  parseMatrixDocument,
  validateRepository,
} from "./validate-personalized-prescription-v2-taper-authority.mjs"

const root = resolve(import.meta.dirname, "../..")
const validatorPath = resolve(import.meta.dirname, "validate-personalized-prescription-v2-taper-authority.mjs")
const SUPPLEMENTAL_EVIDENCE_PATH = ".omo/evidence/formation-research-v2/competition-anchor-primary-research.md"
const SOURCE_ROOT_FILES = [
  ".omo/reports/personalized-prescription-source-gate-2026-08-23.md",
  "specs/active/PLAN_GENERATOR_SPEC.md",
  "specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md",
  "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md",
  SUPPLEMENTAL_EVIDENCE_PATH,
]

function withMatrixMutation(name, mutate, expected) {
  const temp = mkdtempSync(join(tmpdir(), `trainoracle-taper-${name}-`))
  try {
    const destination = join(temp, MATRIX_PATH)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(resolve(root, MATRIX_PATH), destination)
    const source = readFileSync(destination, "utf8")
    const parsed = parseMatrixDocument(source)
    const replacement = mutate(structuredClone(parsed.matrix), source)
    if (typeof replacement === "string") {
      writeFileSync(destination, replacement, "utf8")
    } else {
      writeFileSync(destination, source.replace(parsed.jsonText, JSON.stringify(replacement, null, 2)), "utf8")
    }
    assert.throws(() => validateRepository(temp, root), expected)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

function withSupplementalSourceMutation(name, mutate, expected) {
  const temp = mkdtempSync(join(tmpdir(), `trainoracle-taper-source-${name}-`))
  try {
    for (const path of SOURCE_ROOT_FILES) {
      const destination = join(temp, path)
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(resolve(root, path), destination)
    }
    const destination = join(temp, SUPPLEMENTAL_EVIDENCE_PATH)
    writeFileSync(destination, mutate(readFileSync(destination, "utf8")), "utf8")
    assert.throws(() => validateRepository(root, temp), expected)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

test("fixed taper source inventory validates as inactive research only", () => {
  const summary = validateRepository(root, root)
  assert.deepEqual(summary, {
    status: "INACTIVE_RESEARCH_CANDIDATE",
    numericTaperAuthority: "NOT_GRANTED",
    sourceCount: 22,
    supplementalEvidenceCount: 1,
    reviewedRowCount: 22,
    exclusionCount: 0,
    eventRequestCount: 12,
    notFoundRequestCount: 7,
    positiveCount: 3,
    nullCount: 4,
    adverseCount: 3,
    numericObservationCount: 37,
    owningIssuesOpen: true,
  })
})

test("rejects active authority and operative multiplier keys", () => {
  withMatrixMutation("active", matrix => {
    matrix.status = "ACTIVE"
    matrix.numericTaperAuthority = "GRANTED"
    return matrix
  }, /inactive research status/u)
  withMatrixMutation("multiplier", matrix => {
    matrix.reviewedRows[0].volumeMultiplier = 0.7
    return matrix
  }, /operative taper key/u)
})

test("rejects omitted and duplicated source identities", () => {
  withMatrixMutation("omitted-source", matrix => {
    matrix.reviewedRows.pop()
    return matrix
  }, /source partition/u)
  withMatrixMutation("duplicate-source", matrix => {
    matrix.reviewedRows[1].sourceId = matrix.reviewedRows[0].sourceId
    return matrix
  }, /duplicate source/u)
})

test("rejects changed source digest and source-reported numbers", () => {
  withMatrixMutation("digest", matrix => {
    matrix.sourceInventory[0].evidenceSha256 = `sha256:${"0".repeat(64)}`
    return matrix
  }, /source evidence digest/u)
  withMatrixMutation("number", matrix => {
    const row = matrix.reviewedRows.find(entry => entry.sourceId === "SRC-PMID-2318562")
    row.numericObservations.find(entry => entry.field === "volumeReduction").value = 71
    return matrix
  }, /numeric observations/u)
})

test("rejects changed supplemental subgroup observations", () => {
  withSupplementalSourceMutation("subgroup-values", source => source.replace(
    "매일 훈련 n=5와 사흘마다 하루 휴식 n=4",
    "매일 훈련 n=999와 사흘마다 하루 휴식 n=1",
  ), /supplemental evidence file changed/u)
  withMatrixMutation("subgroup-values", matrix => {
    const row = matrix.reviewedRows.find(entry => entry.sourceId === "SRC-PMID-12165889")
    row.numericObservations.find(entry => entry.field === "dailyConditionSize").value = 999
    row.numericObservations.find(entry => entry.field === "restConditionSize").value = 1
    return matrix
  }, /supplemental subgroup observations mismatch/u)
})

test("rejects missing stale or wrong supplemental evidence identity", () => {
  withMatrixMutation("missing-supplemental", matrix => {
    matrix.supplementalEvidence = []
    return matrix
  }, /supplemental evidence must contain exactly one extraction/u)
  withMatrixMutation("stale-supplemental", matrix => {
    matrix.supplementalEvidence[0].fileSha256 = `sha256:${"0".repeat(64)}`
    return matrix
  }, /supplemental evidence file digest mismatch/u)
  withMatrixMutation("wrong-fragment", matrix => {
    matrix.supplementalEvidence[0].lineStart = 108
    matrix.supplementalEvidence[0].lineEnd = 108
    return matrix
  }, /supplemental evidence identity mismatch/u)
  withMatrixMutation("wrong-supplemental-path", matrix => {
    matrix.supplementalEvidence[0].path = "README.md"
    return matrix
  }, /supplemental evidence identity mismatch/u)
  withMatrixMutation("wrong-fragment-digest", matrix => {
    matrix.supplementalEvidence[0].fragmentSha256 = `sha256:${"0".repeat(64)}`
    return matrix
  }, /supplemental evidence fragment digest mismatch/u)
})

test("supplemental source rejection cannot print a success verdict", () => {
  const temp = mkdtempSync(join(tmpdir(), "trainoracle-taper-source-cli-"))
  try {
    for (const path of SOURCE_ROOT_FILES) {
      const destination = join(temp, path)
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(resolve(root, path), destination)
    }
    const destination = join(temp, SUPPLEMENTAL_EVIDENCE_PATH)
    const source = readFileSync(destination, "utf8")
    writeFileSync(destination, source.replace("n=5", "n=999"), "utf8")
    const result = spawnSync(process.execPath, [validatorPath, "--root", root, "--source-root", temp], { encoding: "utf8" })
    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stdout, /PREPARED_DRAFT_NON_RUNTIME_TAPER_MATRIX/u)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test("rejects invented numbers and assumed baselines", () => {
  withMatrixMutation("invented-number", matrix => {
    const row = matrix.reviewedRows.find(entry => entry.sourceId === "SRC-PMID-10694140")
    row.numericObservations.push({ field: "volumeReduction", provenance: "REPORTED", value: 42, unit: "PERCENT" })
    return matrix
  }, /numeric observations/u)
  withMatrixMutation("assumed-baseline", matrix => {
    const row = matrix.reviewedRows.find(entry => entry.sourceId === "SRC-PMID-10694140")
    row.fields.baselineUnitReference = { provenance: "REPORTED", value: "ASSUMED_PREVIOUS_WEEK_KM" }
    return matrix
  }, /field payload/u)
})

test("rejects formula averages and a generated 9.5-day rule", () => {
  withMatrixMutation("formula", matrix => {
    matrix.formulaAverage = "mean(volumeReduction)"
    return matrix
  }, /operative taper key/u)
  withMatrixMutation("nine-five", matrix => {
    matrix.runtimeRule = { taperDays: 9.5 }
    return matrix
  }, /operative taper key/u)
})

test("rejects missing null, adverse, youth, and NOT_FOUND evidence", () => {
  withMatrixMutation("null", matrix => {
    matrix.reviewedRows = matrix.reviewedRows.filter(row => row.resultClass !== "NULL")
    return matrix
  }, /source partition|required result class/u)
  withMatrixMutation("adverse", matrix => {
    matrix.reviewedRows = matrix.reviewedRows.filter(row => row.resultClass !== "ADVERSE")
    return matrix
  }, /source partition|required result class/u)
  withMatrixMutation("youth-3000", matrix => {
    matrix.reviewedRows = matrix.reviewedRows.filter(row => row.sourceId !== "SRC-JSTAGE-RJSP-15-2243")
    return matrix
  }, /source partition|youth 3000/u)
  withMatrixMutation("not-found", matrix => {
    matrix.evidenceRequests = matrix.evidenceRequests.filter(request => request.status !== "NOT_FOUND")
    return matrix
  }, /evidence requests/u)
})

test("rejects invalid typed provenance and text after the terminal marker", () => {
  withMatrixMutation("provenance", matrix => {
    matrix.reviewedRows[0].fields.adherence[0] = "ASSUMED"
    return matrix
  }, /typed provenance/u)
  withMatrixMutation("trailing", (_matrix, source) => `${source}\nTRAILING TEXT\n`, /final nonblank content/u)
})

test("rejects a misleading human-facing active status", () => {
  withMatrixMutation("human-status", (_matrix, source) => source.replace(
    "Status: INACTIVE_RESEARCH_CANDIDATE",
    "Status: ACTIVE_RUNTIME_AUTHORITY",
  ), /human status must remain inactive research only/u)
})
