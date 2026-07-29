import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const validator = resolve(import.meta.dirname, "validate-remaining-open-pr-reconciliation.mjs");
const report = resolve(root, "reports/review/REMAINING_OPEN_PR_RECONCILIATION_2026-07-29.md");

async function validateWith(replacement) {
  const directory = await mkdtemp(join(tmpdir(), "remaining-pr-reconciliation-"));
  try {
    const original = await readFile(report, "utf8");
    const text = replacement
      ? original.replace(replacement.from, replacement.to)
      : original;
    if (replacement) {
      assert.notEqual(text, original, "hostile mutation must alter its fixture");
    }
    const fixture = join(directory, "reconciliation.md");
    await writeFile(fixture, text, "utf8");
    return spawnSync(process.execPath, [validator, fixture], {
      cwd: root,
      encoding: "utf8",
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("current reconciliation records every legacy PR exactly once", async () => {
  const result = await validateWith();
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /legacyPrCount=18 terminalDispositionCount=18 pendingRebuildCount=0/u,
  );
});

for (const [name, replacement, expected] of [
  [
    "missing legacy PR",
    { from: "| #93 |", to: "| #MISSING |" },
    /missing legacy PR #93/u,
  ],
  [
    "duplicate legacy PR",
    { from: "| #98 |", to: "| #93 |" },
    /duplicate legacy PR #93/u,
  ],
  [
    "unsafe backend harvest",
    { from: "backend_code_harvested: false", to: "backend_code_harvested: true" },
    /backend code harvest is forbidden/u,
  ],
  [
    "unbacked close disposition",
    { from: "successor: PR #131", to: "successor: UNRECORDED" },
    /must record a successor/u,
  ],
  [
    "missing replacement successor",
    {
      from: "successor: this reconciliation PR; Task 4",
      to: "successor: UNRECORDED",
    },
    /must record a successor/u,
  ],
  [
    "content after final marker",
    { from: "[DRAFT_COMPLETE]\n", to: "[DRAFT_COMPLETE]\nUNAUTHORIZED_TRAILING_TEXT\n" },
    /final marker must be the final non-empty line/u,
  ],
]) {
  test(`${name} fails closed`, async () => {
    const result = await validateWith(replacement);
    assert.notEqual(result.status, 0, "hostile fixture must fail");
    assert.match(result.stderr, expected);
  });
}
