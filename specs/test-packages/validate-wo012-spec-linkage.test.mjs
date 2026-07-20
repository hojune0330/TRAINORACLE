import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const validator = resolve(import.meta.dirname, "validate-wo012-spec-linkage.mjs");
const matrix = resolve(root, "reports/review/WO012_SPEC_LINKAGE_MATRIX.md");

async function validateWith(replacement) {
  const directory = await mkdtemp(join(tmpdir(), "wo012-spec-linkage-"));
  const path = join(directory, "WO012_SPEC_LINKAGE_MATRIX.md");

  try {
    const original = await readFile(matrix, "utf8");
    await writeFile(path, original.replace(replacement.from, replacement.to), "utf8");
    return spawnSync(process.execPath, [validator, path], { cwd: root, encoding: "utf8" });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("Given the linkage matrix, when it validates, then it reports a docs-only runtime=false contract", () => {
  const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WO012 spec linkage validation passed: 30\/30 rows, runtime=false/u);
});

test("Given a missing CR row, when the linkage matrix validates, then it fails closed", async () => {
  const result = await validateWith({ from: "| CR-30 |", to: "| CR-31 |" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /matrix must map CR-01 through CR-30 exactly once/u);
});

test("Given a generic competition-day substitution, when the linkage matrix validates, then it fails closed", async () => {
  const result = await validateWith({
    from: "same_competition_day_main_placement: ZERO_OR_ONE",
    to: "competition_day_main_placement: ZERO_OR_ONE",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local-civil competition direction/u);
});

test("Given a selectable one-or-four MAIN candidate, when the linkage matrix validates, then it fails closed", async () => {
  const result = await validateWith({ from: "selectable_candidate: false", to: "selectable_candidate: true" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CR-04 must keep selectable_candidate: false/u);
});

test("Given private memo analysis language, when the linkage matrix validates, then it fails closed", async () => {
  const result = await validateWith({
    from: "private memo presence and content remain excluded",
    to: "private memo presence and content may be analyzed",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /private memo exclusion/u);
});

test("Given runtime authority, when the linkage matrix validates, then it fails closed", async () => {
  const result = await validateWith({ from: "runtime_authority: false", to: "runtime_authority: true" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /matrix must not create runtime authority/u);
});

test("Given participant enrollment, when the linkage matrix validates, then it fails closed", async () => {
  const result = await validateWith({ from: "participant_enrollment: false", to: "participant_enrollment: true" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /shadow must keep participant_enrollment: false/u);
});
