import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

const requiredFiles = Object.freeze({
  protocol: "reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md",
  sources: "reports/research/evidence/FORMATION_SOURCE_LEDGER.csv",
  searches: "reports/research/evidence/FORMATION_SEARCH_LOG.md",
  exclusions: "reports/research/evidence/FORMATION_EXCLUSION_LEDGER.csv",
  extraction: "reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv",
  claims: "reports/research/evidence/FORMATION_CLAIM_MATRIX.csv",
  attestations: "reports/research/evidence/FORMATION_HUMAN_REVIEW_ATTESTATIONS.csv",
  ownerBaseline: "reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md",
});

const requiredProtocolTokens = Object.freeze([
  "owner_product_identity: 9_5_DAY_FORMATION",
  "owner_target_authority: AUTOMATED_PRESCRIPTION",
  "runtime_authority: false",
  "LOCAL_CIVIL_9_DAYS_12_HOURS",
  "PRISMA-informed structured review",
  "evidence_status",
  "permitted_claim",
  "youth-middle-distance directness",
  "whole-architecture directness",
  "APPROVE | REQUEST_CHANGES",
  "SUPPRESS_ONLY_NO_OUTBOUND_DISCLOSURE",
  "USER_DIRECTED_FILE_OPERATION",
  "NO_CONFIGURED_REVIEWER_KEEP_CURRENT_PLAN",
  "TO-FORMATION-RESEARCH-V2-AMEND-2026-07-17-01",
]);

const expectedHeaders = Object.freeze({
  sources:
    "source_id,title,year,source_type,doi,pmid,pmcid,url,full_text_state,correction_state,population,event,age_range,sex,maturity,training_status,rq_tags,funding,conflicts,overlap_group,notes",
  exclusions:
    "record_id,source_id,screen_stage,primary_rq,decision,primary_reason_code,reason,lane_1_reason,lane_2_reason,human_confirmation,reviewer_1,reviewer_2,adjudication,decision_date",
  extraction:
    "source_id,rq_id,population,event,age_range,sex,maturity,training_age,competitive_level,season,intervention,comparator,component_dose,component_order,separation_hours,target_interval_hours,actual_interval_hours,outcome_domain,outcome_measure,instrument_protocol,time_horizon,time_points,missingness,adverse_events,effect_estimate,uncertainty,individual_response,limitations,reviewer_1,reviewer_2,adjudication",
  claims:
    "claim_id,rq_id,claim_text,evidence_status,permitted_claim,youth_directness,architecture_directness,supporting_source_ids,opposing_source_ids,limitations,owner_decision,runtime_authority,review_state",
  attestations:
    "review_type,source_id,reviewer_id,qualification_ref,decision,raw_input_sha256,canonical_record_sha256,reviewed_at,record_ref,key_id,signature_algorithm,signature_base64",
});

const errors = [];
const contents = new Map();

for (const [name, path] of Object.entries(requiredFiles)) {
  try {
    contents.set(name, readFileSync(resolve(root, path), "utf8"));
  } catch {
    errors.push(`missing file: ${path}`);
  }
}

const protocol = contents.get("protocol") ?? "";
const ownerBaseline = contents.get("ownerBaseline") ?? "";
for (const token of requiredProtocolTokens) {
  if (!protocol.includes(token)) {
    errors.push(`protocol missing token: ${token}`);
  }
}

for (const token of [
  "decision_precedence: LATEST_EXPLICIT_OWNER_DECISION_GOVERNS",
  "owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION",
  "runtime_authority: false_until_named_gates_pass",
]) {
  if (!ownerBaseline.includes(token)) errors.push(`owner baseline missing token: ${token}`);
}

try {
  const amendmentLog = readFileSync(
    resolve(root, "reports/research/FORMATION_PROTOCOL_AMENDMENT_LOG.md"),
    "utf8",
  );
  const recordedHash = amendmentLog.match(/amended_sha256: ([a-f0-9]{64})/u)?.[1];
  const actualHash = createHash("sha256").update(protocol).digest("hex");
  if (!recordedHash || recordedHash !== actualHash) {
    errors.push(`protocol hash mismatch recorded=${recordedHash ?? "MISSING"} actual=${actualHash}`);
  }
} catch {
  errors.push("missing protocol amendment log");
}

for (const rq of ["A", "B", "C", "D", "E", "F", "G"]) {
  if (!protocol.includes(`RQ-${rq}`)) {
    errors.push(`protocol missing research question: RQ-${rq}`);
  }
}

for (const [name, header] of Object.entries(expectedHeaders)) {
  const firstLine = (contents.get(name) ?? "").split(/\r?\n/u, 1)[0];
  if (firstLine !== header) {
    errors.push(`${name} header mismatch`);
  }
}

if (errors.length > 0) {
  console.error("FORMATION_RESEARCH_V2_INVALID");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    "FORMATION_RESEARCH_V2_VALID rqs=7 owner_identity=9_5_DAY_FORMATION frozen_protocol_target=AUTOMATED_PRESCRIPTION latest_target=DEFAULT_AUTOMATED_PRESCRIPTION runtime=false",
  );
}
