import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");
const reports = [
  "reports/research/FORMATION_FRAME_RECOVERY_EVIDENCE_REVIEW_V2.md",
  "reports/research/FORMATION_COMPOSITE_AND_LOAD_EVIDENCE_REVIEW.md",
  "reports/research/FORMATION_MINIMUM_EVIDENCE_METHODS_REVIEW.md",
  "reports/research/FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md",
  "reports/research/FORMATION_COUNTEREVIDENCE_AND_UNCERTAINTY_REVIEW.md",
];
const claimsArgumentIndex = process.argv.indexOf("--claims");
const claimsPath = claimsArgumentIndex >= 0
  ? process.argv[claimsArgumentIndex + 1]
  : "reports/research/evidence/FORMATION_CLAIM_MATRIX.csv";

const readRows = (path) =>
  parseCsv(readFileSync(resolve(root, path), "utf8"), path).rows;
const errors = [];
const sources = readRows("reports/research/evidence/FORMATION_SOURCE_LEDGER.csv");
const sourcesById = new Map(
  sources.map((row) => [row.source_id, row]),
);
const sourceIds = new Set(sourcesById.keys());
const claims = readRows(claimsPath);
const evidenceStatuses = new Set(["SUPPORTED", "CONDITIONALLY_SUPPORTED", "UNKNOWN", "NOT_SUPPORTED"]);
const permittedClaims = new Set(["DESCRIPTIVE_ONLY", "RULE_INPUT_CANDIDATE", "PROHIBITED"]);

for (const path of reports) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    errors.push(`missing report ${path}`);
    continue;
  }
  const text = readFileSync(absolute, "utf8");
  if (text.length < 1_000) errors.push(`report too short ${path}`);
  if (!/사용자|선수/.test(text)) errors.push(`missing user-facing boundary ${path}`);
  if (!/runtime_authority=false|런타임|현재.*권한|자동.*활성화/.test(text)) {
    errors.push(`missing runtime boundary ${path}`);
  }
}

const rqCoverage = new Set();
for (const claim of claims) {
  rqCoverage.add(claim.rq_id);
  if (!/^FRV2-CLAIM-[A-G]-\d{3}$/.test(claim.claim_id)) errors.push(`bad claim id ${claim.claim_id}`);
  if (!evidenceStatuses.has(claim.evidence_status)) errors.push(`bad evidence status ${claim.claim_id}`);
  if (!permittedClaims.has(claim.permitted_claim)) errors.push(`bad permitted claim ${claim.claim_id}`);
  if (claim.owner_decision !== "9_5_DAY_AUTOMATED_PRESCRIPTION_IDENTITY") {
    errors.push(`wrong owner identity ${claim.claim_id}`);
  }
  if (claim.runtime_authority !== "false") errors.push(`runtime authority leak ${claim.claim_id}`);
  for (const field of ["supporting_source_ids", "opposing_source_ids"]) {
    for (const id of claim[field].split(";").filter(Boolean)) {
      if (id.startsWith("FRV2-") || id.startsWith("SRC-")) {
        if (!sourceIds.has(id)) errors.push(`unknown source ${claim.claim_id}:${id}`);
        const source = sourcesById.get(id);
        if (
          field === "supporting_source_ids"
          && new Set(["ABSTRACT_ONLY", "METADATA_ONLY"]).has(source?.full_text_state)
        ) {
          errors.push(`abstract-only supporting source ${claim.claim_id}:${id}`);
        }
      }
    }
  }
}

const claimsById = new Map(claims.map((claim) => [claim.claim_id, claim]));
const privateNoteBoundary = claimsById.get("FRV2-CLAIM-G-003");
if (!privateNoteBoundary?.claim_text.includes("ZERO_SIGNAL_FOR_ANALYSIS")) {
  errors.push("private-note analysis boundary missing FRV2-CLAIM-G-003");
}
const privateNoteTransport = claimsById.get("FRV2-CLAIM-G-004");
if (!privateNoteTransport?.claim_text.includes("USER_DIRECTED_FILE_OPERATION")) {
  errors.push("private-note transport exception missing FRV2-CLAIM-G-004");
}
for (const rq of ["RQ-A", "RQ-B", "RQ-C", "RQ-D", "RQ-E", "RQ-F", "RQ-G"]) {
  if (!rqCoverage.has(rq)) errors.push(`missing claim coverage ${rq}`);
}

const prohibitedAssertions = [
  /9\.5일은 과학적으로 최적이다/,
  /9\.5일은 더 안전하다/,
  /72시간이면 회복 완료/,
  /ACWR.*안전 구간을 결정한다/,
];
for (const path of reports) {
  if (!existsSync(resolve(root, path))) continue;
  const text = readFileSync(resolve(root, path), "utf8");
  for (const pattern of prohibitedAssertions) {
    if (pattern.test(text)) errors.push(`prohibited assertion ${path}:${pattern}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`FORMATION_SYNTHESIS_INVALID ${error}`);
  process.exitCode = 1;
} else {
  console.log(`FORMATION_SYNTHESIS_PREPARED reports=${reports.length} claims=${claims.length} rqs=${rqCoverage.size} runtime=false`);
}
