import { readFile } from "node:fs/promises";

const requiredWorkspaces = ["app", "impl", "runtime-evidence/d9-evaluator"];
const reportPath = process.argv[2] ?? new URL(
  "../../reports/review/DEPENDENCY_SECURITY_AUDIT_2026-07-29.md",
  import.meta.url,
);
const text = await readFile(reportPath, "utf8");
const nonEmptyLines = text.split(/\r?\n/u).filter((line) => line.trim() !== "");
let valid = true;

function fail(message) {
  valid = false;
  process.exitCode = 1;
  process.stderr.write(`${message}\n`);
}

if (nonEmptyLines.at(-1) !== "[DRAFT_COMPLETE]") {
  fail("final marker must be the final non-empty line");
}
if (!/^\s*automatic_dependency_change: false$/mu.test(text)) {
  fail("automatic dependency changes are forbidden");
}
if (!/^\s*tracking_issue: #146$/mu.test(text)) {
  fail("dependency decision must retain tracking issue #146");
}
if (!text.includes("GHSA-r28c-9q8g-f849")) {
  fail("expected PostCSS advisory is missing");
}
if (!/\| GHSA-r28c-9q8g-f849,[^\n]+\| Transitive \|[^\n]+\| DEFERRED_DEV_ONLY \|/u.test(text)) {
  fail("expected advisory must be classified as transitive DEFERRED_DEV_ONLY");
}

const rows = [...text.matchAll(/^\| ([^|]+) \| (\d+) \| (\d+) \|/gmu)].map((match) => ({
  workspace: match[1],
  fullHigh: Number(match[2]),
  productionHigh: Number(match[3]),
}));

for (const workspace of requiredWorkspaces) {
  const row = rows.find((candidate) => candidate.workspace === workspace);
  if (!row) {
    fail(`missing audited workspace: ${workspace}`);
    continue;
  }
  if (row.fullHigh !== 1) {
    fail(`full audit high count must be one for ${workspace}`);
  }
  if (row.productionHigh !== 0) {
    fail(`production-only high count must be zero for ${workspace}`);
  }
}
for (const row of rows) {
  if (!requiredWorkspaces.includes(row.workspace)) {
    fail(`unexpected audited workspace: ${row.workspace}`);
  }
}
if (rows.length !== requiredWorkspaces.length) {
  fail("audited workspace count must be exactly three");
}

if (valid) {
  process.stdout.write("workspaces=3 fullHigh=3 productionHigh=0 decision=DEFERRED_DEV_ONLY\n");
}
