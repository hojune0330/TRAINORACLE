import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const sourcesArgumentIndex = process.argv.indexOf("--sources");
const sourcesPath = sourcesArgumentIndex >= 0
  ? process.argv[sourcesArgumentIndex + 1]
  : "reports/research/evidence/FORMATION_SOURCE_LEDGER.csv";
const readRows = (path) => parseCsv(read(path), path).rows;

function fail(message) {
  console.error(`FORMATION_SOURCE_AUDIT_INVALID ${message}`);
  process.exitCode = 1;
}

const sourceRows = readRows(sourcesPath);
const auditRows = readRows("reports/research/evidence/FORMATION_CITATION_AUDIT.csv");
const searchLog = read("reports/research/evidence/FORMATION_SEARCH_LOG.md");
const claimRows = readRows("reports/research/evidence/FORMATION_CLAIM_MATRIX.csv");

const requiredFiles = [
  "reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md",
  "specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md",
  ".omo/drafts/formation-followup-deep-research.md",
  ".omo/drafts/formation-followup-source-map.md",
];
const fullTextStates = new Set([
  "FULL_TEXT_VERIFIED",
  "ABSTRACT_ONLY",
  "METADATA_ONLY",
  "RETRACTED_OR_CORRECTED",
  "UNRESOLVED",
]);
const auditStates = new Set(["VERIFIED", "OVERSTATED", "INCORRECT", "UNRESOLVED"]);
const sourceIds = new Set(sourceRows.map((row) => row.source_id));

if (sourceRows.length === 0) fail("source ledger has no audited sources");
if (auditRows.length < 75) fail(`citation occurrence coverage ${auditRows.length}/75`);
if (sourceIds.size !== sourceRows.length || sourceIds.has("")) fail("source IDs are empty or duplicated");

for (const row of sourceRows) {
  if (!row.title || !row.year || !row.source_type || !row.url) fail(`incomplete identity ${row.source_id}`);
  if (!fullTextStates.has(row.full_text_state)) fail(`invalid full_text_state ${row.source_id}`);
  if (!row.correction_state || !row.rq_tags) fail(`missing audit fields ${row.source_id}`);
}

const occurrenceIds = new Set();
for (const row of auditRows) {
  if (!row.occurrence_id || occurrenceIds.has(row.occurrence_id)) fail(`duplicate occurrence ${row.occurrence_id}`);
  occurrenceIds.add(row.occurrence_id);
  if (!requiredFiles.includes(row.source_file)) fail(`unknown citation source file ${row.source_file}`);
  if (!row.source_line || !row.raw_citation || !row.normalized_identity) fail(`incomplete occurrence ${row.occurrence_id}`);
  if (!sourceIds.has(row.source_id)) fail(`unmapped source ${row.occurrence_id}`);
  if (!auditStates.has(row.audit_state) || !row.claim_assessment) fail(`unaudited occurrence ${row.occurrence_id}`);
}

for (const file of requiredFiles) {
  if (!auditRows.some((row) => row.source_file === file)) fail(`missing file coverage ${file}`);
}

for (const rq of ["RQ-A", "RQ-B", "RQ-C", "RQ-D", "RQ-E", "RQ-F", "RQ-G"]) {
  const actualRows = searchLog.split("\n").filter((line) => line.includes(`| ${rq} |`) && !line.includes("| NOT_RUN |"));
  if (actualRows.length === 0) fail(`no executed search logged for ${rq}`);
}
if (searchLog.includes("status: NOT_STARTED")) fail("search log is still NOT_STARTED");
if (!searchLog.includes("ACCESS_UNAVAILABLE") && !searchLog.includes("ACCESS_RESTRICTED")) {
  fail("database access limitations are not recorded");
}

for (const claim of claimRows) {
  const cited = `${claim.supporting_source_ids};${claim.opposing_source_ids}`
    .split(";")
    .map((value) => value.trim())
    .filter(
      (value) =>
        value &&
        !["NOT_FOUND", "NOT_APPLICABLE", "NOT_VERIFIED"].includes(value) &&
        !value.startsWith("OWNER_"),
    );
  for (const sourceId of cited) {
    const source = sourceRows.find((row) => row.source_id === sourceId);
    if (!source) {
      fail(`claim ${claim.claim_id} cites missing source ${sourceId}`);
      continue;
    }
    if (["UNRESOLVED", "RETRACTED_OR_CORRECTED"].includes(source.full_text_state)) {
      fail(`claim ${claim.claim_id} cites excluded source ${sourceId}`);
    }
  }
}

if (!process.exitCode) {
  console.log(`FORMATION_SOURCE_AUDIT_VALID sources=${sourceRows.length} occurrences=${auditRows.length} rqs=7`);
}
