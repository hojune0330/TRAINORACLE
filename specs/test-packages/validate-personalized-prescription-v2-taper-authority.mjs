import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const MATRIX_PATH = "reports/review/TAPER_EVIDENCE_AUTHORITY_MATRIX_V1_2026-08-23.md"

const SOURCE_GATE_PATH = ".omo/reports/personalized-prescription-source-gate-2026-08-23.md"
const SOURCE_GATE_SHA256 = "82061a918835ef9e73d663b8a3e27fbf3ec543f70e964ebfb6980b36041e7f41"
const SUPPLEMENTAL_EVIDENCE_ID = "SUPP-PMID-12165889-SUBGROUPS"
const SUPPLEMENTAL_EVIDENCE_PATH = ".omo/evidence/formation-research-v2/competition-anchor-primary-research.md"
const SUPPLEMENTAL_FILE_SHA256 = "2ecfff924f7af37aa4c0192ff0ee7c465652122addbbc0cf79e880ec4072308b"
const SUPPLEMENTAL_FRAGMENT_SHA256 = "c8455c9de891aee3788d5ad08da25c556c04908a8fda6601b01b48d07dfe72d1"
const EXPECTED_MATRIX_SHA256 = "2aa964b3f307c3d90414c8258b1ad2540dc81c0fbbd2d5d4b58b9c8c3d9849cf"
const EXPECTED_OBSERVATIONS_SHA256 = "fb3b80169e943844bec2ce59d3dedd890b207fd91688cafbe6c4d66719c856d6"
const EXPECTED_FIELDS_SHA256 = "b1652c727722c77d194cbdb898bf6750e48cc9c057f9054e0b7005d5ab418739"
const EXPECTED_REQUESTS_SHA256 = "b9d5984ce04a15e17b77fa9a9294d55029233bc529f537a32243f9837440618f"
const EXPECTED_CLASSES_SHA256 = "19f790002c1c56dcd004955bab9f1c4974f0b4082903cfaeab2fb6c9448a93fb"

const REQUIRED_FIELDS = [
  "event",
  "population",
  "sex",
  "age",
  "baselineUnitReference",
  "taperDuration",
  "volumeChange",
  "frequencyChange",
  "intensityChange",
  "finalSessionTiming",
  "outcome",
  "adherence",
  "transferLimits",
  "sourceGrade",
]

const PROVENANCE = new Set(["REPORTED", "NOT_REPORTED", "NOT_APPLICABLE"])
const FORBIDDEN_KEYS = new Set([
  "averageFormula",
  "formulaAverage",
  "operativeMultiplier",
  "reductionRatio",
  "runtimeMultiplier",
  "runtimeRule",
  "taperDays",
  "volumeMultiplier",
])

const EXPECTED_INVENTORY = [
  ["SRC-PMID-25189116", 38, 38, "f174577511bc5473af76e40491c5e14b9209700a924cbd5bf99387a93c0dfd86"],
  ["SRC-PMID-37163550", 39, 39, "ca7b693b1910164807caf72ae4b4b2536440cd34b805efd7258869c53ec0bb10"],
  ["SRC-PMID-10694140", 124, 124, "824151f5931cdd95b7761f40a1f1e243dfa89f8282cd8e247a79c33585757c6c"],
  ["SRC-PMID-12165889", 125, 125, "080cc50c6ba9beff2d15dc9c4c4b9cdf9464aff02755df8eb87d902b3048b019"],
  ["SRC-PMID-1559951", 126, 126, "45885792d9786cd8a800216d8e2ecc518a8cabd70166f4f8e5f88b3c1628be9a"],
  ["SRC-PMID-30608885", 127, 127, "35726e6007c33c1d418ffa76a356add517244c6b846eff463d35ea09b8a6db6c"],
  ["SRC-PMID-34062089", 128, 128, "dc670f3184e5f4ea8d53e5e73ef17162086c84135f98e1f8b7cfc7da1c54320a"],
  ["SRC-PMID-8007812", 129, 129, "726c5c34b34cef9777399a37b4bf3650db7808e3205a6fd7b1ea73a592e9e1b6"],
  ["SRC-JSTAGE-RJSP-15-2243", 130, 130, "e067685c3fdec7d45014e66b0786bcab26a124fa5f77d9b748a76b85f27d6729"],
  ["SRC-JSTAGE-JSPEHSSCONF-73-162", 131, 131, "019be1e8cc3d2de17e14add772e9bb9b7498db760bada04f45aa5b58b7dcfd3f"],
  ["SRC-CINII-1390296343172624640", 132, 132, "6ce4737e5162b614f25e2224f588fe3df5bd40f4fa505dbdac826e8bd42796ac"],
  ["SRC-ANALEFEFS-2014-I1-9", 144, 144, "d0cf7806f29c7df53d43844d6ee07624495e36ca25c31e52fafc769fe3988aff"],
  ["SRC-PMID-2318562", 146, 146, "ae933d86d648e3bc5cb06527de665f261e443e9c9b1a54ba78fe72b68f9a313b"],
  ["SRC-PMID-8440543", 146, 146, "5745be6c1ac98ad728f8d5c6de63d9808dec0c9fd8d2fcbef91636879e7607e0"],
  ["SRC-PMID-25134000", 156, 160, "f6b296a3da028d7311a0849ba82b908ffe06621bdf00c4dccc4ef32cbad794dc"],
  ["SRC-PMID-25019608", 161, 166, "83c38d2c4cf9e09231482f1dd2eb226b3a75d62cad4c0d2e25c47c0afd18a266"],
  ["SRC-PMID-17762369", 180, 186, "2a50b2b3fc8958e5f2131ffd022d2d5758369bff7a5f31d540f19f173e090c7f"],
  ["SRC-PMID-32661839", 201, 203, "70968f56b47fb5ddc765510f39bc32597c4043841176d7c357afb6c14df41777"],
  ["SRC-PMID-37726100", 204, 207, "3136d3e4d9927bcb006751d098d03d04a1ae7c18967a86a533f5de52765c6577"],
  ["SRC-PMID-36696042", 208, 210, "31d6a42d52d9d9e68f0ea1097f183fa8515c34525373cfe9f59ffb09b25231dc"],
  ["SRC-PMID-2813655", 211, 215, "db6453777459e2760ddf373f6b2d37973c855df46503b5813abe51704f2fa746"],
  ["SRC-PMID-9140908", 216, 217, "c82a276bd093aeba64f15dcf38d1b81b60b8407df5c31682c30521afeec14c2b"],
]

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]))
  }
  return value
}

function sha256Canonical(value) {
  return sha256(JSON.stringify(canonicalize(value)))
}

function unique(values, message) {
  invariant(new Set(values).size === values.length, message)
}

function assertExactKeys(value, expected, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  invariant(JSON.stringify(actual) === JSON.stringify(wanted), `${label} keys are not exact`)
}

function findForbiddenKey(value, path = "$") {
  if (!value || typeof value !== "object") return null
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) return `${path}.${key}`
    const found = findForbiddenKey(nested, `${path}.${key}`)
    if (found) return found
  }
  return null
}

export function parseMatrixDocument(source) {
  const normalized = source.replace(/\r\n?/gu, "\n")
  const statusLines = normalized.split("\n").filter(line => line.startsWith("Status:"))
  invariant(statusLines.length === 1 && statusLines[0] === "Status: INACTIVE_RESEARCH_CANDIDATE", "human status must remain inactive research only")
  const markerCount = normalized.split("[DRAFT_COMPLETE]").length - 1
  invariant(markerCount === 1, "[DRAFT_COMPLETE] must occur exactly once")
  invariant(normalized.trimEnd().endsWith("[DRAFT_COMPLETE]"), "[DRAFT_COMPLETE] must be final nonblank content")
  const matches = [...source.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/gu)]
  invariant(matches.length === 1, "matrix document must contain exactly one JSON block")
  const jsonText = matches[0][1]
  let matrix
  try {
    matrix = JSON.parse(jsonText)
  } catch (error) {
    throw new Error(`matrix JSON is malformed: ${error instanceof Error ? error.message : "unknown error"}`)
  }
  return { matrix, jsonText }
}

function validateInventory(matrix, sourceGateText) {
  invariant(Array.isArray(matrix.sourceInventory), "source inventory must be an array")
  invariant(matrix.sourceInventory.length === EXPECTED_INVENTORY.length, "source inventory count mismatch")
  const lines = sourceGateText.replace(/\r\n?/gu, "\n").split("\n")
  for (let index = 0; index < EXPECTED_INVENTORY.length; index += 1) {
    const [sourceId, lineStart, lineEnd, digest] = EXPECTED_INVENTORY[index]
    const actual = matrix.sourceInventory[index]
    assertExactKeys(actual, ["sourceId", "lineStart", "lineEnd", "evidenceSha256"], `source inventory row ${sourceId}`)
    invariant(actual.sourceId === sourceId && actual.lineStart === lineStart && actual.lineEnd === lineEnd, `source inventory identity mismatch: ${sourceId}`)
    const fragment = lines.slice(lineStart - 1, lineEnd).join("\n")
    const computed = sha256(`${sourceId}\n${fragment}`)
    invariant(computed === digest, `local source evidence changed: ${sourceId}`)
    invariant(actual.evidenceSha256 === `sha256:${computed}`, `source evidence digest mismatch: ${sourceId}`)
  }
  unique(matrix.sourceInventory.map(row => row.sourceId), "duplicate source inventory identity")
}

function validateSupplementalEvidence(matrix, sourceRoot) {
  invariant(Array.isArray(matrix.supplementalEvidence) && matrix.supplementalEvidence.length === 1, "supplemental evidence must contain exactly one extraction")
  const evidence = matrix.supplementalEvidence[0]
  assertExactKeys(evidence, [
    "evidenceId",
    "sourceId",
    "path",
    "fileSha256",
    "lineStart",
    "lineEnd",
    "fragmentSha256",
    "extraction",
  ], "supplemental evidence")
  invariant(
    evidence.evidenceId === SUPPLEMENTAL_EVIDENCE_ID
      && evidence.sourceId === "SRC-PMID-12165889"
      && evidence.path === SUPPLEMENTAL_EVIDENCE_PATH
      && evidence.lineStart === 109
      && evidence.lineEnd === 109
      && evidence.extraction === "LF_NORMALIZED_PATH_PLUS_LINE_RANGE_PLUS_EXACT_FRAGMENT_SHA256",
    "supplemental evidence identity mismatch",
  )

  const sourceText = readFileSync(resolve(sourceRoot, SUPPLEMENTAL_EVIDENCE_PATH), "utf8").replace(/\r\n?/gu, "\n")
  invariant(sha256(sourceText) === SUPPLEMENTAL_FILE_SHA256, "supplemental evidence file changed")
  invariant(evidence.fileSha256 === `sha256:${SUPPLEMENTAL_FILE_SHA256}`, "supplemental evidence file digest mismatch")
  const lines = sourceText.split("\n")
  const fragment = lines.slice(evidence.lineStart - 1, evidence.lineEnd).join("\n")
  const computed = sha256(`${evidence.path}\n${evidence.lineStart}\n${evidence.lineEnd}\n${fragment}`)
  invariant(computed === SUPPLEMENTAL_FRAGMENT_SHA256, "supplemental evidence fragment changed")
  invariant(evidence.fragmentSha256 === `sha256:${computed}`, "supplemental evidence fragment digest mismatch")
  const subgroupSizes = [...fragment.matchAll(/\bn=(\d+)\b/gu)].map(match => Number(match[1]))
  invariant(JSON.stringify(subgroupSizes) === JSON.stringify([5, 4]), "supplemental subgroup values must remain exactly 5 and 4")

  const row = matrix.reviewedRows.find(entry => entry.sourceId === evidence.sourceId)
  invariant(row, "supplemental evidence source row missing")
  const bindings = row.numericObservations.filter(observation => observation.evidenceRef === evidence.evidenceId)
  invariant(bindings.length === 2, "supplemental evidence must bind exactly two subgroup observations")
  const expectedBindings = [
    ["dailyConditionSize", 5],
    ["restConditionSize", 4],
  ]
  for (let index = 0; index < expectedBindings.length; index += 1) {
    const [field, value] = expectedBindings[index]
    const observation = bindings[index]
    invariant(
      observation.field === field
        && observation.value === value
        && observation.unit === "ATHLETES"
        && observation.provenance === "REPORTED",
      "supplemental subgroup observations mismatch",
    )
  }
}

function validateRows(matrix) {
  invariant(Array.isArray(matrix.reviewedRows) && Array.isArray(matrix.explicitExclusions), "source partition must use arrays")
  const inventoryIds = matrix.sourceInventory.map(row => row.sourceId)
  const partitionIds = [
    ...matrix.reviewedRows.map(row => row.sourceId),
    ...matrix.explicitExclusions.map(row => row.sourceId),
  ]
  unique(partitionIds, "duplicate source in reviewed/exclusion partition")
  invariant(JSON.stringify([...partitionIds].sort()) === JSON.stringify([...inventoryIds].sort()), "source partition must contain every fixed identity exactly once")

  for (const row of matrix.reviewedRows) {
    invariant(row.reviewDisposition === "REVIEWED", `row is not reviewed: ${row.sourceId}`)
    invariant(row.status === "INACTIVE_RESEARCH_CANDIDATE", `row has active status: ${row.sourceId}`)
    invariant(row.numericTaperAuthority === "NOT_GRANTED", `row grants numeric taper authority: ${row.sourceId}`)
    assertExactKeys(row.fields, REQUIRED_FIELDS, `field payload ${row.sourceId}`)
    for (const [field, cell] of Object.entries(row.fields)) {
      invariant(Array.isArray(cell) && cell.length === 2, `field payload is not a provenance cell: ${row.sourceId}.${field}`)
      invariant(PROVENANCE.has(cell[0]), `invalid typed provenance: ${row.sourceId}.${field}`)
      if (cell[0] !== "REPORTED") invariant(cell[1] === "NOT_FOUND", `non-reported field must be NOT_FOUND: ${row.sourceId}.${field}`)
    }
    invariant(Array.isArray(row.numericObservations), `numeric observations missing: ${row.sourceId}`)
    for (const observation of row.numericObservations) {
      const keys = observation.evidenceRef === undefined
        ? ["field", "provenance", "value", "unit"]
        : ["field", "provenance", "value", "unit", "evidenceRef"]
      assertExactKeys(observation, keys, `numeric observation ${row.sourceId}`)
      invariant(observation.provenance === "REPORTED", `numeric observation provenance must be REPORTED: ${row.sourceId}`)
      invariant(typeof observation.value === "number" && Number.isFinite(observation.value), `numeric observation must be finite: ${row.sourceId}`)
      invariant(typeof observation.unit === "string" && observation.unit.length > 0, `numeric observation unit missing: ${row.sourceId}`)
    }
  }

  const observationPayload = matrix.reviewedRows.map(({ sourceId, numericObservations }) => ({ sourceId, numericObservations }))
  const fieldPayload = matrix.reviewedRows.map(({ sourceId, fields }) => ({ sourceId, fields }))
  const classPayload = matrix.reviewedRows.map(({ sourceId, resultClass }) => ({ sourceId, resultClass }))
  invariant(sha256Canonical(observationPayload) === EXPECTED_OBSERVATIONS_SHA256, "source-reported numeric observations mismatch")
  invariant(sha256Canonical(fieldPayload) === EXPECTED_FIELDS_SHA256, "source field payload mismatch")
  invariant(sha256Canonical(classPayload) === EXPECTED_CLASSES_SHA256, "required result class rows mismatch")

  const classes = matrix.reviewedRows.map(row => row.resultClass)
  for (const required of ["POSITIVE", "NULL", "ADVERSE", "CONFLICTING", "MAINTENANCE"]) {
    invariant(classes.includes(required), `required result class missing: ${required}`)
  }
  const youth3000 = new Set(["SRC-JSTAGE-RJSP-15-2243", "SRC-JSTAGE-JSPEHSSCONF-73-162"])
  invariant(matrix.reviewedRows.filter(row => youth3000.has(row.sourceId)).length === 2, "both direct youth 3000 rows are required")
}

function validateRequests(matrix) {
  invariant(Array.isArray(matrix.evidenceRequests) && matrix.evidenceRequests.length === 12, "evidence requests must cover the exact 12-cell grid")
  invariant(sha256Canonical(matrix.evidenceRequests) === EXPECTED_REQUESTS_SHA256, "evidence requests mismatch")
  const events = new Set(matrix.evidenceRequests.map(request => request.eventM))
  invariant(JSON.stringify([...events].sort((a, b) => a - b)) === JSON.stringify([800, 1500, 3000, 5000]), "evidence requests must cover all supported events")
  for (const request of matrix.evidenceRequests) {
    invariant(request.status === "REVIEWED_ROWS" || request.status === "NOT_FOUND", `invalid evidence request status: ${request.requestId}`)
    if (request.status === "NOT_FOUND") invariant(request.sourceIds.length === 0, `NOT_FOUND request cannot cite a source: ${request.requestId}`)
    if (request.status === "REVIEWED_ROWS") invariant(request.sourceIds.length > 0, `reviewed request must cite rows: ${request.requestId}`)
  }
  invariant(matrix.evidenceRequests.some(request => request.requestId === "TAPER-3000-ADULT-FLAT" && request.status === "NOT_FOUND"), "adult flat 3000 request must remain NOT_FOUND")
  for (const eventM of [800, 1500, 3000, 5000]) {
    invariant(matrix.evidenceRequests.some(request => request.eventM === eventM && request.sex === "FEMALE" && request.status === "NOT_FOUND"), `controlled female running request must remain NOT_FOUND: ${eventM}`)
  }
}

function validateOpenAuthority(sourceRoot) {
  const gate = readFileSync(resolve(sourceRoot, SOURCE_GATE_PATH), "utf8")
  invariant(/numeric_taper_authority_granted_by_this_report: false/u.test(gate), "source gate must not grant numeric taper authority")
  invariant(/numeric_taper_decision: OPEN/u.test(gate), "source gate numeric taper decision must remain OPEN")

  const planSpec = readFileSync(resolve(sourceRoot, "specs/active/PLAN_GENERATOR_SPEC.md"), "utf8")
  const planIssueOpen = planSpec.split(/\r?\n/u).some(line => line.includes("OI-PG-COMPETITION-TAPER-POLICY-001") && line.includes("| OPEN |"))
  invariant(planIssueOpen, "owning Plan Generator taper issue must remain OPEN")

  const formationSpec = readFileSync(resolve(sourceRoot, "specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md"), "utf8")
  const formationIssueOpen = formationSpec.split(/\r?\n/u).some(line => line.includes("OI-FA-COACH-RULESET-001") && line.includes("| OPEN |"))
  invariant(formationIssueOpen, "owning Formation coach-ruleset issue must remain OPEN")

  const packet = readFileSync(resolve(sourceRoot, "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md"), "utf8")
  const taperDecision = packet.split(/\r?\n/u).find(line => line.includes("| CA-O3 |"))
  invariant(taperDecision?.includes("| `NOT_REVIEWED` |"), "competition-anchor taper decision must remain NOT_REVIEWED")
  invariant(/owner_decision: NOT_REVIEWED/u.test(packet) && /runtime_authority: false/u.test(packet), "competition-anchor packet must remain non-runtime and unreviewed")
}

export function validateRepository(artifactRoot = resolve(import.meta.dirname, "../.."), sourceRoot = artifactRoot) {
  const matrixSource = readFileSync(resolve(artifactRoot, MATRIX_PATH), "utf8")
  const { matrix } = parseMatrixDocument(matrixSource)
  const sourceGateText = readFileSync(resolve(sourceRoot, SOURCE_GATE_PATH), "utf8").replace(/\r\n?/gu, "\n")
  invariant(sha256(sourceGateText) === SOURCE_GATE_SHA256, "fixed source gate digest mismatch")

  invariant(findForbiddenKey(matrix) === null, `operative taper key is forbidden: ${findForbiddenKey(matrix)}`)
  assertExactKeys(matrix, [
    "schemaVersion",
    "kind",
    "matrixVersion",
    "status",
    "numericTaperAuthority",
    "runtimeAuthority",
    "formulaAuthority",
    "sourceGate",
    "supplementalEvidence",
    "provenanceVocabulary",
    "cellEncoding",
    "sourceInventory",
    "evidenceRequests",
    "reviewedRows",
    "explicitExclusions",
    "owningIssues",
    "prohibitions",
  ], "matrix")
  invariant(matrix.schemaVersion === 1 && matrix.kind === "TRAINORACLE_TAPER_EVIDENCE_AUTHORITY_MATRIX", "matrix identity mismatch")
  invariant(matrix.matrixVersion === "TAPER-EVIDENCE-AUTHORITY-V1", "matrix version mismatch")
  invariant(matrix.status === "INACTIVE_RESEARCH_CANDIDATE", "matrix must retain inactive research status")
  invariant(matrix.numericTaperAuthority === "NOT_GRANTED" && matrix.runtimeAuthority === false && matrix.formulaAuthority === false, "matrix must grant no numeric or runtime authority")
  invariant(!JSON.stringify(matrix).includes('"numericTaperAuthority":"GRANTED"'), "active numeric taper authority is forbidden")

  validateInventory(matrix, sourceGateText)
  validateSupplementalEvidence(matrix, sourceRoot)
  validateRows(matrix)
  validateRequests(matrix)
  validateOpenAuthority(sourceRoot)
  invariant(sha256Canonical(matrix) === EXPECTED_MATRIX_SHA256, "matrix payload differs from reviewed inactive evidence")

  const countResult = resultClass => matrix.reviewedRows.filter(row => row.resultClass === resultClass).length
  return {
    status: matrix.status,
    numericTaperAuthority: matrix.numericTaperAuthority,
    sourceCount: matrix.sourceInventory.length,
    supplementalEvidenceCount: matrix.supplementalEvidence.length,
    reviewedRowCount: matrix.reviewedRows.length,
    exclusionCount: matrix.explicitExclusions.length,
    eventRequestCount: matrix.evidenceRequests.length,
    notFoundRequestCount: matrix.evidenceRequests.filter(request => request.status === "NOT_FOUND").length,
    positiveCount: countResult("POSITIVE"),
    nullCount: countResult("NULL"),
    adverseCount: countResult("ADVERSE"),
    numericObservationCount: matrix.reviewedRows.flatMap(row => row.numericObservations).length,
    owningIssuesOpen: true,
  }
}

function parseCliArguments(argv) {
  let artifactRoot = resolve(import.meta.dirname, "../..")
  let sourceRoot = artifactRoot
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") artifactRoot = resolve(argv[++index])
    else if (argv[index] === "--source-root") sourceRoot = resolve(argv[++index])
    else throw new Error(`unknown argument: ${argv[index]}`)
  }
  return { artifactRoot, sourceRoot }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const { artifactRoot, sourceRoot } = parseCliArguments(process.argv.slice(2))
    const summary = validateRepository(artifactRoot, sourceRoot)
    console.log(JSON.stringify({
      verdict: "PREPARED_DRAFT_NON_RUNTIME_TAPER_MATRIX",
      ...summary,
    }, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
