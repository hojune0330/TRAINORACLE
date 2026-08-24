import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const REGISTRY_PATH = "reports/review/RACE_PLACEMENT_AUTHORITY_REGISTRY_V1_2026-08-23.json"

const EVENTS = [800, 1500, 3000, 5000]
const PROJECTIONS = [7, 9, 10]
const SOURCE_GATE_PATH = ".omo/reports/personalized-prescription-source-gate-2026-08-23.md"
const FORMATION_PATH = "reports/research/FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md"
const SOURCE_GATE_SHA256 = "82061a918835ef9e73d663b8a3e27fbf3ec543f70e964ebfb6980b36041e7f41"
const FORMATION_SHA256 = "8155fffb8c05f504476eb28baa47ed21723205785596c9665866fca366d85b86"
const SOURCE_SET_SHA256 = "sha256:bc6577c23d06b5ab2fc4d29dbcc5f57ae951a52827774a1d2b7ec877d97d4954"
const CELL_SET_SHA256 = "sha256:0e02b9e2d911a1a8e34e2a78a403c67165f864c98976321a127cd66ec534f16b"

const EXPECTED_SOURCES = [
  ["SOURCE_GATE_EVENT_800", SOURCE_GATE_PATH, SOURCE_GATE_SHA256, 143, 143, "4957772d0c82fd6719e4ebf45bc8b7d42ab18de1e8570a6b4ef7d89fca3677d1"],
  ["SOURCE_GATE_EVENT_1500", SOURCE_GATE_PATH, SOURCE_GATE_SHA256, 144, 144, "5de739de32d9eecaaf9e6083c010cbe72479c0eadbec0dd22e900de834d7ce31"],
  ["SOURCE_GATE_EVENT_3000", SOURCE_GATE_PATH, SOURCE_GATE_SHA256, 145, 145, "c109ecca8ecbe828e73187dd544ed0739a24d243cf03ea8825ba7bac017c28e4"],
  ["SOURCE_GATE_EVENT_5000", SOURCE_GATE_PATH, SOURCE_GATE_SHA256, 146, 146, "990bae46c99f91a80b5d970c293b9a696c2f2c732650dd04c0ea7156fa679df3"],
  ["SOURCE_GATE_PLACEMENT_BOUNDARY", SOURCE_GATE_PATH, SOURCE_GATE_SHA256, 148, 152, "0ee700ed294bd7e6791c78ba995e4049c7876dee76b0e57e530c09a27cf7cc73"],
  ["SOURCE_GATE_RUNTIME_STATES", SOURCE_GATE_PATH, SOURCE_GATE_SHA256, 228, 248, "43495dae036b5c6d798f98e05dd658353aa9b20e3fcfd302919752b1b0c6bd3c"],
  ["FORMATION_ANCHOR_LIMITS", FORMATION_PATH, FORMATION_SHA256, 29, 40, "77fde381fb2256671681b1fec11504f68e0b89de37348284a9a552400e758275"],
  ["FORMATION_ANCHOR_RULES", FORMATION_PATH, FORMATION_SHA256, 91, 105, "bac31f6037d2d03a22ebb33d89799f15baecaec4da45f1b586217b89a41ff1bc"],
]

const ROW_DIGESTS = new Map([
  ["RACE-PLACEMENT-800-H7", "sha256:d2eaca3b9b3c93fdb9fefa8becb881819dd112276646cf39b979aef8ba2be93c"],
  ["RACE-PLACEMENT-800-H9", "sha256:bb6142f7d5d3fedc68f84d4f42dc380bf8f36b88d36bdab77570e11b658d4bcd"],
  ["RACE-PLACEMENT-800-H10", "sha256:3aab6f3887b2ea421cb75a6ebdcb3c81182a98331bd2223ab391c7f8fe8c223d"],
  ["RACE-PLACEMENT-1500-H7", "sha256:8e485ddebc51881093e92adb6c8faf69eed214d2e7eba5d9fcd540e561bacfa9"],
  ["RACE-PLACEMENT-1500-H9", "sha256:4d838796e8aed28d661690b924f315a711dd0d84d15f0e43d3fe829cb182d9c4"],
  ["RACE-PLACEMENT-1500-H10", "sha256:4f0b3ee90e01f6c3531c8b7ba861908a4862fad6dc37930cea17d6a2ec4cb02e"],
  ["RACE-PLACEMENT-3000-H7", "sha256:08c1f9e0f70efce2ccdb2bc8e8e78797ed31fef03ae82ba48ac38f05eda88323"],
  ["RACE-PLACEMENT-3000-H9", "sha256:c0bb6762efc65cbc20c88bbc33f8c4e1bc75248d084428443c7e6ff9c2ae4469"],
  ["RACE-PLACEMENT-3000-H10", "sha256:1527f796f76624a0e0c95588f86bf609de477598a6aea13ac2ef6bc5f0d2cf18"],
  ["RACE-PLACEMENT-5000-H7", "sha256:061cdab26f3ba1b63497128baa6e9558e4f0ce6160138fc37a074b8f76c870ce"],
  ["RACE-PLACEMENT-5000-H9", "sha256:211ad98bce289dadf75aaa934bf5b4c088450053ab9abbc8c75b9e72287e0457"],
  ["RACE-PLACEMENT-5000-H10", "sha256:8d0c1495282d58cb217a5331c26a20f17ad78f26dfe13d1927a18b7919d37de1"],
])

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function normalizeTextTransport(value) {
  return value.replace(/\r\n?/gu, "\n")
}

function matchesTextTransportDigest(value, expectedDigest) {
  const normalized = normalizeTextTransport(value)
  return sha256(normalized) === expectedDigest
    || sha256(normalized.replace(/\n/gu, "\r\n")) === expectedDigest
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
  }
  return value
}

function fingerprint(domain, value) {
  return `sha256:${sha256(`${domain}\0${JSON.stringify(canonicalize(value))}`)}`
}

function assertExactKeys(value, keys, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  invariant(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} keys are not exact`)
}

function validateSources(registry, sourceRoot) {
  invariant(Array.isArray(registry.sourceEvidence) && registry.sourceEvidence.length === EXPECTED_SOURCES.length, "source evidence count mismatch")
  for (let index = 0; index < EXPECTED_SOURCES.length; index += 1) {
    const [evidenceId, path, fileDigest, lineStart, lineEnd, fragmentDigest] = EXPECTED_SOURCES[index]
    const row = registry.sourceEvidence[index]
    assertExactKeys(row, ["evidenceId", "path", "fileSha256", "lineStart", "lineEnd", "fragmentSha256", "extraction"], `source ${evidenceId}`)
    invariant(row.evidenceId === evidenceId && row.path === path && row.lineStart === lineStart && row.lineEnd === lineEnd, `source identity mismatch: ${evidenceId}`)
    invariant(row.extraction === "LF_NORMALIZED_ID_PATH_LINE_RANGE_FRAGMENT", `source extraction mismatch: ${evidenceId}`)
    const sourceText = readFileSync(resolve(sourceRoot, path), "utf8")
    invariant(matchesTextTransportDigest(sourceText, fileDigest) && row.fileSha256 === `sha256:${fileDigest}`, `source file changed: ${evidenceId}`)
    const lines = normalizeTextTransport(sourceText).split("\n")
    const fragment = lines.slice(lineStart - 1, lineEnd).join("\n")
    const computed = sha256(`${evidenceId}\n${path}\n${lineStart}\n${lineEnd}\n${fragment}`)
    invariant(computed === fragmentDigest && row.fragmentSha256 === `sha256:${computed}`, `source fragment changed: ${evidenceId}`)
  }
  invariant(fingerprint("trainoracle.race-placement-source-set.v1", registry.sourceEvidence) === SOURCE_SET_SHA256, "source set digest mismatch")
  invariant(registry.sourceSetSha256 === SOURCE_SET_SHA256, "registry source set digest mismatch")
}

function validateCells(registry) {
  invariant(Array.isArray(registry.reviewedCells) && registry.reviewedCells.length === 12, "reviewed cell count mismatch")
  const expectedIdentities = EVENTS.flatMap((event) => PROJECTIONS.map((projection) => `RACE-PLACEMENT-${event}-H${projection}`))
  invariant(JSON.stringify(registry.reviewedCells.map((row) => row.rowId)) === JSON.stringify(expectedIdentities), "reviewed cell identities mismatch")
  for (const row of registry.reviewedCells) {
    assertExactKeys(row, [
      "rowId", "eventDistanceM", "projectionH", "status", "reasonCodes", "sourceRefIds", "sourceSetSha256",
      "raceDayAnchor", "coordinatePermutation", "minimumSpacingAuthority", "fixedAnchorPrecedence", "localDateSemantics",
      "youthTransfer", "femaleSexTransfer", "fallback", "numericTaperAuthority", "rowPayloadSha256",
    ], `reviewed cell ${row.rowId}`)
    invariant(row.rowId === `RACE-PLACEMENT-${row.eventDistanceM}-H${row.projectionH}`, `row scope mismatch: ${row.rowId}`)
    invariant(EVENTS.includes(row.eventDistanceM) && PROJECTIONS.includes(row.projectionH), `unsupported row scope: ${row.rowId}`)
    invariant(row.status === "DO_NOT_APPROVE", `row must remain DO_NOT_APPROVE: ${row.rowId}`)
    invariant(JSON.stringify(row.reasonCodes) === JSON.stringify([
      "NO_EXACT_PROJECTION_PERMUTATION_AUTHORITY",
      "YOUTH_TRANSFER_NOT_APPROVED",
      "FEMALE_SEX_TRANSFER_NOT_APPROVED",
      "RETENTION_NOT_AUTHORIZED",
    ]), `row reason codes mismatch: ${row.rowId}`)
    const expectedEventSource = `SOURCE_GATE_EVENT_${row.eventDistanceM}`
    invariant(JSON.stringify(row.sourceRefIds) === JSON.stringify([
      expectedEventSource,
      "SOURCE_GATE_PLACEMENT_BOUNDARY",
      "SOURCE_GATE_RUNTIME_STATES",
      "FORMATION_ANCHOR_LIMITS",
      "FORMATION_ANCHOR_RULES",
    ]), `row source references mismatch: ${row.rowId}`)
    invariant(
      row.sourceSetSha256 === SOURCE_SET_SHA256
        && row.raceDayAnchor === "NOT_APPROVED"
        && row.coordinatePermutation === null
        && row.minimumSpacingAuthority === "NOT_APPROVED"
        && row.fixedAnchorPrecedence === "NOT_APPROVED"
        && row.localDateSemantics === "LOCAL_CIVIL_DATE_ONLY"
        && row.youthTransfer === "NOT_APPROVED"
        && row.femaleSexTransfer === "NOT_APPROVED"
        && row.fallback === "GENERIC_PLACEMENT_NO_AUTHORITY"
        && row.numericTaperAuthority === "NOT_GRANTED",
      `row grants unsupported authority: ${row.rowId}`,
    )
    const { rowPayloadSha256, ...payload } = row
    const computed = fingerprint("trainoracle.race-placement-reviewed-cell.v1", payload)
    invariant(rowPayloadSha256 === computed && rowPayloadSha256 === ROW_DIGESTS.get(row.rowId), `row payload digest mismatch: ${row.rowId}`)
  }
  const cellSet = registry.reviewedCells.map(({ rowId, rowPayloadSha256 }) => ({ rowId, rowPayloadSha256 }))
  invariant(fingerprint("trainoracle.race-placement-reviewed-cell-set.v1", cellSet) === CELL_SET_SHA256, "reviewed cell set changed")
  invariant(registry.reviewedCellSetSha256 === CELL_SET_SHA256, "reviewed cell set digest mismatch")
}

function validateAutomatedReviewRecords(registry) {
  invariant(Array.isArray(registry.automatedReviewRecords) && registry.automatedReviewRecords.length === 2, "exactly two automated review records are required")
  const expected = [
    ["01a00a34-088f-75a0-95d0-3b7813f38e8e", "COACHING_APPLICABILITY", "sha256:313903f617ef200e9daba9ed8a17d48ea3f251ff58c10a1d020ec453a6820356"],
    ["01a00a34-0f37-7d43-bcc5-4b2c0cb3dd2e", "SPORTS_SCIENCE_TRANSFER", "sha256:6f0b6af914cda32eb5e541681630526ce24e85fa1fd8fa34a9aefb4e48bfe86d"],
  ]
  for (let index = 0; index < expected.length; index += 1) {
    const [reviewerId, lane, digest] = expected[index]
    const receipt = registry.automatedReviewRecords[index]
    assertExactKeys(receipt, [
      "reviewerId", "lane", "reviewerQualification", "independentFromExtractionAndImplementation",
      "conflicts", "reviewScope", "verdict", "verdictIsUnconditional", "status", "authorityEffect",
      "owningAuthority", "reviewedAt", "expiresAt", "revoked",
      "sourceSetSha256", "reviewedCellSetSha256", "canonicalPayloadSha256",
    ], `automated review record ${lane}`)
    invariant(
      receipt.reviewerId === reviewerId
        && receipt.lane === lane
        && receipt.reviewerQualification === "AUTOMATED_REVIEW_ASSISTANT_NOT_HUMAN_AUTHORITY"
        && receipt.independentFromExtractionAndImplementation === true
        && receipt.conflicts === "NONE_DECLARED"
        && receipt.reviewScope === "12_EVENT_PROJECTION_CELLS_AND_FAIL_CLOSED_BOUNDARIES"
        && receipt.verdict === "DO_NOT_APPROVE_ALL_12"
        && receipt.verdictIsUnconditional === true
        && receipt.status === "RECORDED_AUTOMATED_REVIEW_ONLY"
        && receipt.authorityEffect === "NONE"
        && receipt.owningAuthority === "MICROCYCLE_AND_CALENDAR_MAPPING_SPEC"
        && receipt.reviewedAt === "2026-08-23T22:02:54+09:00"
        && receipt.expiresAt === null
        && receipt.revoked === false
        && receipt.sourceSetSha256 === SOURCE_SET_SHA256
        && receipt.reviewedCellSetSha256 === CELL_SET_SHA256,
      `automated review record mismatch: ${lane}`,
    )
    const { canonicalPayloadSha256, ...payload } = receipt
    invariant(canonicalPayloadSha256 === digest && canonicalPayloadSha256 === fingerprint("trainoracle.race-placement-automated-review-record.v1", payload), `automated review record digest mismatch: ${lane}`)
  }
  invariant(registry.automatedReviewRecords[0].reviewerId !== registry.automatedReviewRecords[1].reviewerId, "reviewers must be distinct")
}

export function validateRacePlacementAuthority({ registryRoot, sourceRoot }) {
  const registry = JSON.parse(readFileSync(resolve(registryRoot, REGISTRY_PATH), "utf8"))
  assertExactKeys(registry, [
    "schemaVersion", "kind", "registryVersion", "status", "recordedAt", "retentionAuthority",
    "numericTaperAuthority", "runtimeCompiledActiveRowCount", "sourceSetSha256", "sourceEvidence",
    "reviewedCellSetSha256", "reviewedCells", "automatedReviewRecords", "activeRows", "prohibitions",
  ], "race placement registry")
  invariant(
    registry.schemaVersion === 1
      && registry.kind === "TRAINORACLE_RACE_PLACEMENT_AUTHORITY_REGISTRY"
      && registry.registryVersion === "v1"
      && registry.status === "REVIEW_COMPLETE_ZERO_ACTIVE"
      && registry.recordedAt === "2026-08-23T22:02:54+09:00"
      && registry.retentionAuthority === "NOT_AUTHORIZED"
      && registry.numericTaperAuthority === "NOT_GRANTED"
      && registry.runtimeCompiledActiveRowCount === 0,
    "registry authority boundary mismatch",
  )
  invariant(Array.isArray(registry.activeRows) && registry.activeRows.length === 0, "runtime registry must have zero active rows")
  invariant(JSON.stringify(registry.prohibitions) === JSON.stringify([
    "NO_NUMERIC_TAPER_AUTHORITY",
    "NO_VOLUME_FREQUENCY_INTENSITY_DOSE_CHANGE",
    "NO_INVENTED_COORDINATE_PERMUTATION",
    "NO_RACE_DATE_OR_DERIVED_PLACEMENT_PERSISTENCE",
  ]), "registry prohibitions mismatch")
  validateSources(registry, sourceRoot)
  validateCells(registry)
  validateAutomatedReviewRecords(registry)
  return {
    status: registry.status,
    activeRowCount: registry.activeRows.length,
    reviewedCellCount: registry.reviewedCells.length,
    statusCounts: {
      DO_NOT_APPROVE: registry.reviewedCells.filter((row) => row.status === "DO_NOT_APPROVE").length,
      NOT_FOUND: registry.reviewedCells.filter((row) => row.status === "NOT_FOUND").length,
    },
    sourceSetSha256: registry.sourceSetSha256,
    reviewedCellSetSha256: registry.reviewedCellSetSha256,
    reviewerIds: registry.automatedReviewRecords.map((receipt) => receipt.reviewerId),
    numericTaperAuthority: registry.numericTaperAuthority,
    retentionAuthority: registry.retentionAuthority,
  }
}

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1])
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(import.meta.dirname, "../..")
    console.log(JSON.stringify(validateRacePlacementAuthority({ registryRoot: root, sourceRoot: root }), null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
