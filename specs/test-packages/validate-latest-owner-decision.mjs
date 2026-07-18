import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");

const read = (path) => readFileSync(resolve(root, path), "utf8");
const baseline = read("reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md");
const protocol = read("reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md");
const plan = read(".omo/plans/trainoracle-formation-followup-deep-research.md");
const conflicts = parseCsv(
  read("reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv"),
  "FORMATION_SPEC_CONFLICT_REGISTER.csv",
).rows;
const expectedConflictIds = new Set([
  "FRV2-CONF-001",
  "FRV2-CONF-002",
  "FRV2-CONF-003",
  "FRV2-CONF-004",
  "FRV2-CONF-005",
  "FRV2-CONF-006",
  "FRV2-CONF-007",
  "FRV2-CONF-008",
  "FRV2-CONF-009",
  "FRV2-CONF-010",
  "FRV2-CONF-011",
  "FRV2-CONF-012",
]);
const expectedStatusByConflict = new Map([
  ["FRV2-CONF-001", "PATCH_REQUIRED"],
  ["FRV2-CONF-002", "PATCH_REQUIRED"],
  ["FRV2-CONF-003", "PATCH_REQUIRED"],
  ["FRV2-CONF-004", "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW"],
  ["FRV2-CONF-005", "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW"],
  ["FRV2-CONF-006", "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW"],
  ["FRV2-CONF-007", "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW"],
  ["FRV2-CONF-008", "TARGET_BOUND_PENDING_QUALIFIED_REVIEW"],
  ["FRV2-CONF-009", "HUMAN_REVIEW_REQUIRED"],
  ["FRV2-CONF-010", "PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW"],
  ["FRV2-CONF-011", "PATCH_REQUIRED"],
  ["FRV2-CONF-012", "OWNER_DECISION_REQUIRED"],
]);
const errors = [];
for (const phrase of [
  "LATEST_EXPLICIT_OWNER_DECISION_GOVERNS",
  "9_5_DAY_FORMATION",
  "DEFAULT_AUTOMATED_PRESCRIPTION",
  "기본 계획 1개",
  "OWNER_FULL_LOCAL_BACKUP",
  "CURRENT_DISPLAY_ONLY_FUTURE_ANALYSIS_INTENDED",
  "공유",
  "runtime_authority: false",
]) {
  if (!baseline.includes(phrase)) errors.push(`baseline missing ${phrase}`);
}
if (!protocol.includes("latest explicit owner decision governs product direction")) {
  errors.push("protocol owner precedence missing");
}
if (!plan.includes("Latest explicit owner decisions govern product direction")) {
  errors.push("plan owner precedence missing");
}
const actualConflictIds = new Set(conflicts.map((conflict) => conflict.conflict_id));
if (actualConflictIds.size !== conflicts.length) errors.push("duplicate conflict id");
for (const conflictId of expectedConflictIds) {
  if (!actualConflictIds.has(conflictId)) errors.push(`missing conflict ${conflictId}`);
}
for (const conflictId of actualConflictIds) {
  if (!expectedConflictIds.has(conflictId)) errors.push(`unexpected conflict ${conflictId}`);
}
for (const conflict of conflicts) {
  if (!conflict.required_patch || !conflict.user_impact) errors.push(`incomplete ${conflict.conflict_id}`);
  if (expectedStatusByConflict.get(conflict.conflict_id) !== conflict.status) {
    errors.push(`invalid status ${conflict.conflict_id}`);
  }
}
const conflictsById = new Map(conflicts.map((conflict) => [conflict.conflict_id, conflict]));
if (!conflictsById.get("FRV2-CONF-008")?.latest_owner_baseline.includes("BUT_NOT_IMPLEMENTED")) {
  errors.push("conflict 008 does not preserve unavailable share state");
}
if (!conflictsById.get("FRV2-CONF-008")?.required_patch.includes("analysis")) {
  errors.push("conflict 008 does not separate share from analysis");
}
if (!conflictsById.get("FRV2-CONF-010")?.latest_owner_baseline.includes("ATHLETE_OWN_ANALYSIS")) {
  errors.push("conflict 010 does not limit future analysis to athlete-own purpose");
}
if (!conflictsById.get("FRV2-CONF-010")?.required_patch.includes("plan safety reward telemetry")) {
  errors.push("conflict 010 downstream prohibitions are incomplete");
}
if (errors.length > 0) {
  for (const error of errors) console.error(`FORMATION_OWNER_BASELINE_INVALID ${error}`);
  process.exitCode = 1;
} else {
  console.log("FORMATION_OWNER_BASELINE_VALID conflicts=12 latest_decision=governs runtime=false");
}
