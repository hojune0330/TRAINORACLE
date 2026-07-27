import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const defaults = {
  index: resolve(root, "reports/research/TRAINING_SCHEDULE_SOURCE_INDEX_2026-07.md"),
  handoff: resolve(root, "reports/research/README_TRAINING_SCHEDULE_RESEARCH.md"),
  decision: resolve(root, "reports/research/TRAINING_SCHEDULE_RESEARCH_ACCEPTANCE_DECISION.md"),
  catalog: resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"),
};

const args = process.argv.slice(2);
if (args.length !== 0 && args.length !== 8) {
  throw new Error("expected zero arguments or --index --handoff --decision --catalog paths");
}

const paths = { ...defaults };
for (let index = 0; index < args.length; index += 2) {
  const key = args[index]?.replace(/^--/u, "");
  const value = args[index + 1];
  if (key === undefined || value === undefined || !(key in paths)) {
    throw new Error("invalid validation path arguments");
  }
  paths[key] = value;
}

const index = readFileSync(paths.index, "utf8");
const handoff = readFileSync(paths.handoff, "utf8");
const decision = readFileSync(paths.decision, "utf8");
const catalog = readFileSync(paths.catalog, "utf8");
const failures = [];

const requireMarker = (content, marker, label) => {
  if (!content.includes(marker)) failures.push(`${label} missing marker: ${marker}`);
};

const requireLastNonEmptyLine = (content, marker, label) => {
  const lines = content.trimEnd().split(/\r?\n/u);
  if (lines.at(-1) !== marker) failures.push(`${label} must end with ${marker}`);
};

const rowsBetween = (content, start, end) => {
  const section = content.split(start)[1]?.split(end)[0] ?? "";
  return section.split(/\r?\n/u).filter((line) => /^\|\s*\d+\s*\|/u.test(line));
};

const publicRows = rowsBetween(index, "## 공개 리포트·기사·코칭 자료 (60개)", "## 논문·학술 근거 후보 (24편)");
const paperRows = rowsBetween(index, "## 논문·학술 근거 후보 (24편)", "## 유튜브·영상 타임스탬프 수집 규칙");

if (publicRows.length !== 60) failures.push(`expected 60 public rows, found ${publicRows.length}`);
if (paperRows.length !== 24) failures.push(`expected 24 paper rows, found ${paperRows.length}`);

for (const grade of ["| A |", "| B |", "| C |", "| E |", "| C/D |"] ) {
  requireMarker(index, grade, "research index");
}
requireMarker(handoff, "D_CREATOR", "research handoff");

for (const marker of [
  "proposed_status: ACCEPT_AS_RESEARCH_REFERENCE_AND_TEMPLATE_SYNTHESIS_INPUT",
  "owner_acceptance_recorded: false",
  "numeric_template_activation_authorized: false",
  "current_catalog_runtime_authority: false",
  "research_index_can_seed_template_synthesis: true",
  "numeric_detail_without_accepted_template: forbidden",
  "D9_ACTIVE_or_UNKNOWN:",
  "blocks_plan_generation: true",
  "can_be_cleared_by_research_source: false",
  "Exact extraction",
  "Source and transfer review",
  "Template mapping",
  "Minor policy",
  "Athlete anchor",
  "Personal-plan input",
  "Safety gate",
  "Numeric integrity",
  "Runtime evidence",
  "OI-RESEARCH-OWNER-ACCEPTANCE-001",
]) {
  requireMarker(decision, marker, "acceptance decision");
}

for (const marker of ["A_OBSERVED", "B_TECHNICAL", "C_MEDIA", "D_CREATOR", "E_REDDIT", "Paper candidate"]) {
  requireMarker(decision, marker, "source-class policy");
}

requireMarker(handoff, "TRAINING_SCHEDULE_RESEARCH_ACCEPTANCE_DECISION.md", "research handoff");
requireMarker(catalog, "runtime_authority: false", "detailed catalog");
requireMarker(catalog, "automatic_prescription_authorized: false", "detailed catalog");
requireMarker(catalog, "numeric_template_activation_authorized: false", "detailed catalog");
requireMarker(catalog, "lifecycleStatus: DRAFT", "detailed catalog");
requireMarker(catalog, "eligibilityStatus: REVIEW_REQUIRED", "detailed catalog");
requireLastNonEmptyLine(decision, "[DECISION_COMPLETE]", "acceptance decision");

if (/runtime_authority\s*:\s*true/iu.test(decision)) {
  failures.push("research decision must not create runtime authority");
}
if (/numeric_template_activation_authorized\s*:\s*true/iu.test(decision)) {
  failures.push("research decision must not authorize numeric template activation");
}
if (/ACCEPTED_AS_WORKING_SOURCE/iu.test(decision)) {
  failures.push("research decision must not claim working-source acceptance");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Training schedule research acceptance validation passed: 60 public rows, 24 paper candidates, runtime authority remains disabled.");
}
