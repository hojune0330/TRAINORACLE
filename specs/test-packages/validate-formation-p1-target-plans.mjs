import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PLAN_DIR = path.resolve("reports/target-patch-plans");
const CANONICAL_SOURCE = path.resolve("specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md");

const EXPECTED = [
  ["OI-FA-COACH-RULESET-001", "01-coach-ruleset.md"],
  ["OI-FA-LOAD-COMPONENT-001", "02-load-component.md"],
  ["OI-FA-MINIMUM-EVIDENCE-001", "03-minimum-evidence.md"],
  ["OI-FA-PLAN-VERSION-BINDING-001", "04-plan-version-binding.md"],
  ["OI-FA-PILOT-PROTOCOL-001", "05-pilot-protocol.md"],
  ["OI-FA-CALENDAR-SCHEMA-BINDING-001", "06-calendar-schema-binding.md"],
  ["OI-FA-UPSTREAM-SAFETY-PRIVACY-BINDING-001", "07-upstream-safety-privacy-binding.md"],
  ["OI-FA-RULE-CLASSIFIER-EXPOSURE-BINDING-001", "08-rule-classifier-exposure-binding.md"],
  ["OI-FA-PRODUCT-PROJECTION-001", "09-product-projection.md"],
  ["OI-FA-RECORD-GOVERNANCE-001", "10-record-governance.md"],
];

const REQUIRED_HEADINGS = [
  "## Classification",
  "## Governing Decision",
  "## Exact Targets",
  "## Prerequisites",
  "## Forbidden Work",
  "## Impact",
  "## Baseline",
  "## RED",
  "## Patch Order",
  "## GREEN",
  "## Manual QA",
  "## Migration, Rollback, And Kill Switch",
  "## Privacy And Security Review",
  "## Closure Evidence",
  "## Human Decision",
];

const FORBIDDEN_PLACEHOLDERS = [
  /\bTBD\b/i,
  /\bTODO\b/i,
  /future UI\/screen contracts/i,
  /owning_files:\s*NO_TARGET_YET/i,
  /owning_issues:\s*NO_TARGET_YET/i,
];
const READINESS_CLASSES = new Set([
  "READY_AFTER_NAMED_APPROVAL",
  "REQUIRES_HIGH_ACCURACY_RESEARCH",
  "REQUIRES_RUNTIME_TARGET",
  "RUNTIME_EVIDENCE_ONLY",
]);

async function main() {
  const canonicalSource = await readFile(CANONICAL_SOURCE, "utf8");
  const canonicalP1Ids = [...canonicalSource.matchAll(/\| `(OI-FA-[A-Z0-9-]+)` \| P1 \| YES \| OPEN \|/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(
    canonicalP1Ids,
    EXPECTED.map(([issueId]) => issueId).sort(),
    "plan inventory must exactly match the canonical open P1 rows",
  );

  const entries = await readdir(PLAN_DIR, { withFileTypes: true });
  const planFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name)
    .sort();

  assert.equal(planFiles.length, 10, "exactly ten P1 plan files must exist");
  assert.deepEqual(planFiles, EXPECTED.map(([, file]) => file), "plan filenames must match the canonical index");

  const seenIds = new Set();
  for (const [issueId, filename] of EXPECTED) {
    const body = await readFile(path.join(PLAN_DIR, filename), "utf8");
    assert.match(body, new RegExp(`issue_id: ${issueId.replaceAll("-", "\\-")}`));
    assert.match(body, /approved: false/);
    assert.match(body, /state: READY_FOR_OWNER_APPROVAL/);
    const readinessClass = body.match(/^readiness_class: ([A-Z_]+)$/m)?.[1];
    assert.ok(readinessClass && READINESS_CLASSES.has(readinessClass), `${filename} has invalid readiness_class`);
    assert.match(body, /owning_files:\r?\n(?:  - `[^`]+`\r?\n)+/);
    assert.match(body, /owning_issues:\r?\n(?:  - `[^`]+`\r?\n)+/);
    assert.match(body, /runtime_authorized: false/);
    assert.match(body, /canonical_spec_patch_authorized: false/);

    for (const heading of REQUIRED_HEADINGS) {
      assert.ok(body.includes(heading), `${filename} is missing ${heading}`);
    }
    for (const forbidden of FORBIDDEN_PLACEHOLDERS) {
      assert.doesNotMatch(body, forbidden, `${filename} contains an unresolved generic target`);
    }
    assert.equal((body.match(/issue_id: OI-FA-[A-Z0-9-]+/g) ?? []).length, 1, `${filename} must declare one issue_id`);
    seenIds.add(issueId);
  }

  assert.equal(seenIds.size, 10, "the plan set must cover ten unique canonical P1 IDs");

  const index = await readFile(path.join(PLAN_DIR, "README.md"), "utf8");
  for (const [issueId, filename] of EXPECTED) {
    assert.ok(index.includes(issueId), `README is missing ${issueId}`);
    assert.ok(index.includes(`./${filename}`), `README is missing ${filename}`);
  }
  assert.match(index, /approved_plans: 0/);
  assert.match(index, /ready_for_owner_approval: 10/);

  process.stdout.write("PASS: exactly 10 unique owner-approval-ready P1 target patch plans validated\n");
}

await main();
