import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "../..");
const validator = resolve(import.meta.dirname, "validate-wo012-coach-walkthrough.mjs");
const packagePaths = [
  "specs/test-packages/FORMATION_COACH_RULESET_FIXTURES.md",
  "reports/review/WO012_COACH_OWNER_WALKTHROUGH.md",
  "reports/review/WO012_COACH_DECISION_RESPONSE_TEMPLATE.md",
];

async function validateWith(replacement) {
  const directory = await mkdtemp(join(tmpdir(), "wo012-owner-response-"));

  try {
    const paths = await Promise.all(packagePaths.map(async (relativePath) => {
      const original = await readFile(resolve(root, relativePath), "utf8");
      const updated = relativePath === replacement.relativePath
        ? original.replace(replacement.from, replacement.to)
        : original;
      const path = join(directory, basename(relativePath));
      await writeFile(path, updated, "utf8");
      return path;
    }));

    return spawnSync(process.execPath, [validator, ...paths], { cwd: root, encoding: "utf8" });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("Given the recorded owner package, when it validates, then it passes", () => {
  const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /30\/30 rows, pending independent review, no runtime authority/u);
});

test("Given an altered exception window, when the walkthrough validates, then it fails closed", async () => {
  const result = await validateWith({
    relativePath: packagePaths[0],
    from: "current + immediate prior + next; maximum 3 frames",
    to: "current + immediate prior + next; maximum 4 frames",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fixtures missing marker: current \+ immediate prior \+ next; maximum 3 frames/u);
});

test("Given a prematurely resolved competition marker, when the walkthrough validates, then it fails closed", async () => {
  const result = await validateWith({
    relativePath: packagePaths[0],
    from: "marker_text_or_visual_semantics: PENDING_OWNER_RECONCILIATION",
    to: "marker_text_or_visual_semantics: CONFIRMED",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fixtures missing marker: marker_text_or_visual_semantics: PENDING_OWNER_RECONCILIATION/u);
});

test("Given premature runtime authority, when the walkthrough validates, then it fails closed", async () => {
  const result = await validateWith({
    relativePath: packagePaths[2],
    from: "runtime_authority: false",
    to: "runtime_authority: true",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /response must not create runtime authority/u);
});
