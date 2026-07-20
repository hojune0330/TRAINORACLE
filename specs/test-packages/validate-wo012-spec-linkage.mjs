import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const suppliedPaths = process.argv.slice(2);

if (suppliedPaths.length > 1) {
  throw new Error("expected zero paths or one matrix path");
}

const matrixPath = suppliedPaths[0] ?? resolve(root, "reports/review/WO012_SPEC_LINKAGE_MATRIX.md");
const matrix = readFileSync(matrixPath, "utf8");
const failures = [];
const rowPattern = /^\| (CR-(?:0[1-9]|[12][0-9]|30)) \|/gmu;
const pathPattern = /`((?:specs|reports)\/[^`]+\.md)`/gu;
const failUnless = (condition, message) => {
  if (!condition) failures.push(message);
};
const rowFor = (id) => matrix.split(/\r?\n/u).find((line) => line.startsWith(`| ${id} |`)) ?? "";
const requireMarker = (marker, message = `matrix missing marker: ${marker}`) =>
  failUnless(matrix.includes(marker), message);

const ids = [...matrix.matchAll(rowPattern)].map((match) => match[1]);
const expectedIds = Array.from({ length: 30 }, (_, index) => `CR-${String(index + 1).padStart(2, "0")}`);
failUnless(ids.length === 30 && new Set(ids).size === 30 && expectedIds.every((id) => ids.includes(id)), "matrix must map CR-01 through CR-30 exactly once");

const targetPaths = [...new Set([...matrix.matchAll(pathPattern)].map((match) => match[1]))];
failUnless(targetPaths.length > 0, "matrix must reference authoritative target paths");
for (const targetPath of targetPaths) {
  failUnless(existsSync(resolve(root, targetPath)), `matrix target path does not exist: ${targetPath}`);
}

for (const marker of [
  "status: PREPARATION_ONLY_PENDING_NAMED_GATES",
  "https://github.com/hojune0330/TRAINORACLE/pull/95",
  "reports/review/FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md",
  "ruleset_accepted: false",
  "canonical_spec_patch_authorized: false",
  "runtime_authority: false",
  "scientific_acceptance: false",
  "privacy_acceptance: false",
]) requireMarker(marker);

for (const [pattern, message] of [
  [/ruleset_accepted\s*:\s*true/iu, "matrix must not accept the ruleset"],
  [/canonical_spec_patch_authorized\s*:\s*true/iu, "matrix must not authorize a canonical spec patch"],
  [/runtime_authority\s*:\s*true/iu, "matrix must not create runtime authority"],
  [/scientific_acceptance\s*:\s*true/iu, "matrix must not claim scientific acceptance"],
  [/privacy_acceptance\s*:\s*true/iu, "matrix must not claim privacy acceptance"],
  [/participant_enrollment\s*:\s*true/iu, "shadow must keep participant_enrollment: false"],
  [/canonical_promotion(?:_allowed)?\s*:\s*true/iu, "matrix must not claim canonical promotion"],
  [/(?:authority|acceptance|closure)_status\s*:\s*(?:APPROVED|ACCEPTED|CLOSED)/iu, "matrix must not claim authority, acceptance, or closure"],
]) failUnless(!pattern.test(matrix), message);

const cr04 = rowFor("CR-04");
for (const marker of [
  "EXACTLY_TWO_OR_THREE_MAIN_CANDIDATE_VALIDITY_UNCHANGED",
  "NEEDS_REVIEW_WITH_REASON",
  "selectable_candidate: false",
  "automatic_execution: false",
]) failUnless(cr04.includes(marker), `CR-04 must keep ${marker}`);

requireMarker("same_competition_day_main_placement: ZERO_OR_ONE", "matrix must preserve local-civil competition direction");
requireMarker("CA-02·CA-03 정식 검토", "matrix must retain the formal CA gate");

const cr18 = rowFor("CR-18");
failUnless(cr18.includes("private memo presence and content remain excluded"), "matrix must preserve private memo exclusion");
failUnless(!/private memo[^|]*may be analyzed/iu.test(cr18), "matrix must not allow private memo analysis");

for (const id of ["CR-19", "CR-20", "CR-21", "CR-22"]) {
  const row = rowFor(id);
  failUnless(row.includes("두 단계"), `${id} must keep two-step review`);
  failUnless(row.includes("초안") || row.includes("검토 요청"), `${id} must allow only a review request or draft`);
  failUnless(row.includes("실제 계획 변경"), `${id} must forbid actual plan mutation`);
}

for (const marker of [
  "participant_enrollment: false",
  "hidden_shadow: forbidden",
  "real_calendar_write: forbidden",
  "real_plan_write: forbidden",
  "notification_write: forbidden",
  "coach_instruction_write: forbidden",
]) requireMarker(marker);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log("WO012 spec linkage validation passed: 30/30 rows, runtime=false");
}
