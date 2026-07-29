import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const validator = resolve(import.meta.dirname, "validate-dependency-security-audit.mjs");
const report = resolve(root, "reports/review/DEPENDENCY_SECURITY_AUDIT_2026-07-29.md");

async function validateWith(replacement) {
  const directory = await mkdtemp(join(tmpdir(), "dependency-security-audit-"));
  try {
    const original = await readFile(report, "utf8");
    const text = replacement ? original.replace(replacement.from, replacement.to) : original;
    if (replacement) {
      assert.notEqual(text, original, "hostile mutation must alter its fixture");
    }
    const fixture = join(directory, "audit.md");
    await writeFile(fixture, text, "utf8");
    return spawnSync(process.execPath, [validator, fixture], { cwd: root, encoding: "utf8" });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("current dependency audit records the dev-only advisory across all workspaces", async () => {
  const result = await validateWith();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /workspaces=3 fullHigh=3 productionHigh=0 decision=DEFERRED_DEV_ONLY/u);
});

for (const [name, replacement, expected] of [
  [
    "production exposure cannot be hidden",
    { from: "| app | 1 | 0 |", to: "| app | 1 | 1 |" },
    /production-only high count must be zero/u,
  ],
  [
    "a workspace cannot be removed",
    { from: "| runtime-evidence\/d9-evaluator | 1 | 0 |", to: "| runtime-evidence\/missing | 1 | 0 |" },
    /missing audited workspace: runtime-evidence\/d9-evaluator/u,
  ],
  [
    "a forced remediation cannot be mislabeled deferred",
    { from: "automatic_dependency_change: false", to: "automatic_dependency_change: true" },
    /automatic dependency changes are forbidden/u,
  ],
  [
    "the re-evaluation issue cannot be removed",
    { from: "tracking_issue: #146", to: "tracking_issue: NONE" },
    /dependency decision must retain tracking issue #146/u,
  ],
  [
    "a different advisory cannot masquerade as the audited one",
    { from: /GHSA-r28c-9q8g-f849/gu, to: "GHSA-UNVERIFIED" },
    /expected PostCSS advisory is missing/u,
  ],
  [
    "content after the final marker fails closed",
    { from: "[DRAFT_COMPLETE]", to: "[DRAFT_COMPLETE]\nUNAUTHORIZED_TRAILING_TEXT" },
    /final marker must be the final non-empty line/u,
  ],
]) {
  test(`${name} fails closed`, async () => {
    const result = await validateWith(replacement);
    assert.notEqual(result.status, 0, "hostile fixture must fail");
    assert.match(result.stderr, expected);
  });
}
