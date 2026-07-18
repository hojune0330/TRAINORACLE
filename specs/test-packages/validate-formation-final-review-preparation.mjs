import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");

const read = (path) => readFileSync(resolve(root, path), "utf8");
const errors = [];
const ownerBrief = read("reports/review/FORMATION_RESEARCH_OWNER_BRIEF_KO.md");
const annex = read("reports/review/FORMATION_RESEARCH_TECHNICAL_ANNEX.md");
const alignment = read("reports/review/FORMATION_USER_SPEC_ALIGNMENT_REVIEW.md");
const scenarios = read(".omo/evidence/formation-research-v2/manual-review-scenarios.md");
const userScenarios = read("reports/review/FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md");
const previousFinal = read(".omo/evidence/formation-research-v2/task-09.md");
const currentFinal = read(
  ".omo/evidence/formation-research-v2/task-10-supplemental-final-verification.md",
);
const reviewIndex = read(
  ".omo/evidence/formation-research-v2/FINAL_REVIEW_SUPERSESSION_INDEX.md",
);
const reviewers = parseCsv(
  read("reports/review/FORMATION_RESEARCH_REVIEWER_LEDGER.csv"),
  "FORMATION_RESEARCH_REVIEWER_LEDGER.csv",
).rows;
const sourceCount = parseCsv(
  read("reports/research/evidence/FORMATION_SOURCE_LEDGER.csv"),
  "FORMATION_SOURCE_LEDGER.csv",
).rows.length;

for (const phrase of ["지금 확정된 것", "연구가 지지하는 것", "연구가 지지하지 않는 것", "사용자 관점", "사람 검토"]) {
  if (!ownerBrief.includes(phrase)) errors.push(`owner brief missing ${phrase}`);
}
for (const phrase of [`source_ledger: ${sourceCount}`, `human_screening_confirmation: 0/${sourceCount}`, "whole_architecture_direct_sources: 0", "runtime_authority: false"]) {
  if (!annex.includes(phrase)) errors.push(`annex missing ${phrase}`);
}
if ((alignment.match(/\| UX-\d+/g) ?? []).length !== 15) errors.push("user improvements not 15");
if ((alignment.match(/BLOCKER/g) ?? []).length < 3) errors.push("user blockers incomplete");
for (const phrase of [
  "exact_conflict_count: 12",
  "FRV2-CONF-008",
  "FRV2-CONF-010",
  "FRV2-CONF-012",
]) {
  if (!alignment.includes(phrase)) errors.push(`alignment summary missing ${phrase}`);
}
if (reviewers.length !== 6) errors.push(`reviewer rows ${reviewers.length}/6`);
for (const reviewer of reviewers) {
  if (reviewer.identity !== "UNASSIGNED" || reviewer.decision !== "NOT_REVIEWED") {
    errors.push(`fabricated or advanced review ${reviewer.review_id}`);
  }
}
for (let index = 1; index <= 5; index += 1) {
  if (!scenarios.includes(`MR-0${index}`)) errors.push(`missing manual scenario ${index}`);
}
if ((scenarios.match(/NOT_RUN/g) ?? []).length !== 5) errors.push("manual human results not explicitly pending");
for (let index = 1; index <= 12; index += 1) {
  const suffix = String(index).padStart(2, "0");
  if (!userScenarios.includes(`U-${suffix}`)) errors.push(`missing user scenario ${index}`);
}
for (const phrase of [
  "participants_tested: 0",
  "assistive_technology_tests_run: 0",
  "owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION",
  "runtime_authority: false",
  "아직 실제 계획에는 쓰지 않아요",
  "승인·구현되기 전에는 앱에서 누구에게도 보내지 않아요",
  "선수 본인의 분석",
  "별도 승인 없이는 계획·안전 판단·코치 공유에 쓰지 않아요",
]) {
  if (!userScenarios.includes(phrase)) errors.push(`user scenarios missing ${phrase}`);
}
if (!previousFinal.includes("status: SUPERSEDED_HISTORICAL_SNAPSHOT")) {
  errors.push("task 09 is not marked superseded");
}
for (const phrase of [
  "status: CURRENT_PREPARATION_PASS_HUMAN_SCIENTIFIC_RUNTIME_GATES_OPEN",
  "independent_preparation_reviews: 5/5_PASS",
  "node_regression_tests: 28/28_PASS",
  "prepared_state_validators: 11/11_PASS",
  "accepted_state_validators: 3/3_FAILED_CLOSED_AS_REQUIRED",
  "supplemental_source_candidates: 18",
  "supplemental_pubmed_identities: 18_VERIFIED",
  "competition_packet_owned_fields: 21",
  "canonical_conflict_targets: 12",
  "user_teach_back_scenarios: 0/12",
  "runtime_authority: false",
]) {
  if (!currentFinal.includes(phrase)) errors.push(`current final evidence missing ${phrase}`);
}
for (const phrase of [
  "status: CURRENT_PREPARATION_REVIEW_PASS_HUMAN_SCIENTIFIC_RUNTIME_GATES_OPEN",
  "independent_preparation_reviews: 5/5_PASS",
  "final-goal-owner-constraint-remediation-review-v4.md",
  "final-qa-latest-pmid-regression-review.md",
  "final-quality-supplemental-remediation-review-v4.md",
  "final-security-supplemental-remediation-review.md",
  "final-context-spec-user-remediation-review-v5.md",
  "scientific_acceptance: false",
  "human_acceptance: false",
  "runtime_authority: false",
]) {
  if (!reviewIndex.includes(phrase)) errors.push(`review index missing ${phrase}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`FORMATION_FINAL_PREP_INVALID ${error}`);
  process.exitCode = 1;
} else {
  console.log("FORMATION_FINAL_PREPARED reviews=5/5 reviewers=0/6 manual=0/5 user_scenarios=0/12 user_improvements=15 runtime=false");
}
