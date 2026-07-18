import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const candidatePath =
  "reports/research/evidence/FORMATION_SUPPLEMENTAL_SOURCE_CANDIDATES_20260717.csv";
const searchPath = "reports/research/evidence/FORMATION_SUPPLEMENTAL_SEARCH_LOG_20260717.md";
const identityPath =
  "reports/research/evidence/FORMATION_SUPPLEMENTAL_IDENTITY_AUDIT_20260717.csv";
const canonicalPath = "reports/research/evidence/FORMATION_SOURCE_LEDGER.csv";
const gapAuditPath = "reports/review/FORMATION_LATEST_DECISION_AND_USER_GAP_AUDIT_V2.md";
const requiredHeaders = [
  "candidate_id", "rq", "title", "year", "source_type", "doi", "pmid", "url",
  "target_population", "directness", "canonical_match", "screening_state",
  "extraction_state", "appraisal_state", "permitted_use", "prohibited_use", "source_trace",
];
const allowedMatches = new Set(["NOT_FOUND_BY_DOI", "LIKELY_CANONICAL_DUPLICATE"]);
const allowedScreening = new Set(["PENDING_HUMAN_SCREENING", "PENDING_DUPLICATE_CONFIRMATION"]);
const errors = [];
const fail = (message) => errors.push(message);

const candidates = parseCsv(read(candidatePath), candidatePath);
const identities = parseCsv(read(identityPath), identityPath).rows;
const canonical = parseCsv(read(canonicalPath), canonicalPath).rows;
const searchLog = read(searchPath);
const gapAudit = read(gapAuditPath);

if (candidates.headers.join("\n") !== requiredHeaders.join("\n")) {
  fail("candidate headers changed");
}
if (candidates.rows.length !== 18) fail(`candidate row count ${candidates.rows.length}/18`);
if (identities.length !== 18) fail(`identity row count ${identities.length}/18`);

const normalizeTitle = (value) => value
  .normalize("NFKC")
  .replace(/\s+/gu, " ")
  .trim();
const identitiesById = new Map(identities.map((row) => [row.candidate_id, row]));
if (identitiesById.size !== identities.length) fail("duplicate identity audit candidate id");

const candidateIds = new Set();
const candidateDois = new Set();
for (const row of candidates.rows) {
  if (!row.candidate_id.startsWith("FRV2-SUP-")) fail(`invalid candidate id ${row.candidate_id}`);
  if (candidateIds.has(row.candidate_id)) fail(`duplicate candidate id ${row.candidate_id}`);
  candidateIds.add(row.candidate_id);

  for (const field of requiredHeaders) {
    if (!row[field]) fail(`${row.candidate_id || "UNKNOWN"} missing ${field}`);
  }
  if (!allowedMatches.has(row.canonical_match)) {
    fail(`${row.candidate_id} invalid canonical_match ${row.canonical_match}`);
  }
  if (!allowedScreening.has(row.screening_state)) {
    fail(`${row.candidate_id} screening is not pending`);
  }
  if (row.extraction_state !== "PENDING" || row.appraisal_state !== "PENDING") {
    fail(`${row.candidate_id} downstream review is not pending`);
  }
  if (!/^https:\/\//u.test(row.url)) fail(`${row.candidate_id} invalid URL`);
  if (candidateDois.has(row.doi)) fail(`duplicate supplemental DOI ${row.doi}`);
  candidateDois.add(row.doi);

  const identity = identitiesById.get(row.candidate_id);
  if (!identity) {
    fail(`${row.candidate_id} missing identity audit row`);
  } else {
    if (identity.pmid !== row.pmid) fail(`${row.candidate_id} PMID identity mismatch`);
    if (identity.doi.toLowerCase() !== row.doi.toLowerCase()) {
      fail(`${row.candidate_id} DOI identity mismatch`);
    }
    if (normalizeTitle(identity.pubmed_title) !== normalizeTitle(row.title)) {
      fail(`${row.candidate_id} title identity mismatch`);
    }
    if (identity.verified_at !== "2026-07-17") {
      fail(`${row.candidate_id} identity verification date missing`);
    }
    if (identity.verification_endpoint !== "NCBI_PUBMED_ESUMMARY") {
      fail(`${row.candidate_id} identity verification endpoint missing`);
    }
  }
  if (row.url !== `https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`) {
    fail(`${row.candidate_id} PubMed URL does not match PMID`);
  }

  const canonicalHasDoi = canonical.some(
    (source) => source.doi.toLowerCase() === row.doi.toLowerCase(),
  );
  if (row.canonical_match === "LIKELY_CANONICAL_DUPLICATE" && !canonicalHasDoi) {
    fail(`${row.candidate_id} claims canonical duplicate without DOI match`);
  }
  if (row.canonical_match === "NOT_FOUND_BY_DOI" && canonicalHasDoi) {
    fail(`${row.candidate_id} misses canonical DOI match`);
  }

  if (!existsSync(resolve(root, row.source_trace))) {
    fail(`${row.candidate_id} missing source trace ${row.source_trace}`);
  }
  const trace = read(row.source_trace).toLowerCase();
  if (!trace.includes(row.doi.toLowerCase()) && !trace.includes(row.pmid)) {
    fail(`${row.candidate_id} source trace lacks DOI or PMID`);
  }
}

for (const token of [
  "status: SUPPLEMENTAL_CANDIDATES_PENDING_HUMAN_SCREENING",
  "owner_product_identity: 9_5_DAY_FORMATION",
  "owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION",
  "canonical_source_ledger_changed: false",
  "canonical_claim_matrix_changed: false",
  "runtime_authority: false",
]) {
  if (!searchLog.includes(token)) fail(`search log missing ${token}`);
}
if (!searchLog.includes("SPORTDiscus") || !searchLog.includes("NOT_FOUND_IN_THIS_SEARCH")) {
  fail("search limitations are incomplete");
}

const supplementalSection = gapAudit.match(
  /## 새로 확인한 근거 후보([\s\S]*?)(?=\n## )/u,
)?.[1] ?? "";
for (const [, pmid] of supplementalSection.matchAll(/PMID (\d+)/gu)) {
  if (!candidates.rows.some((row) => row.pmid === pmid)) {
    fail(`gap audit cites untracked supplemental PMID ${pmid}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`FORMATION_SUPPLEMENTAL_INVALID ${error}`);
  process.exitCode = 1;
} else {
  const duplicates = candidates.rows.filter(
    (row) => row.canonical_match === "LIKELY_CANONICAL_DUPLICATE",
  ).length;
  console.log(
    `FORMATION_SUPPLEMENTAL_PREPARED candidates=${candidates.rows.length} identities=${identities.length} canonical_duplicates=${duplicates} human_screening=0 runtime=false`,
  );
}
