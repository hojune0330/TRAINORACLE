import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "../..");
const validator = resolve(import.meta.dirname, "validate-training-schedule-research-acceptance.mjs");
const decision = resolve(root, "reports/research/TRAINING_SCHEDULE_RESEARCH_ACCEPTANCE_DECISION.md");

function run(...args) {
  return spawnSync(process.execPath, [validator, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("research acceptance preserves template-synthesis boundary", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /60 public rows, 24 paper candidates, runtime authority remains disabled/u,
  );
});

test("research acceptance rejects accidental numeric activation", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "trainoracle-research-acceptance-"));
  const mutated = resolve(directory, "decision.md");
  const content = readFileSync(decision, "utf8").replace(
    "numeric_template_activation_authorized: false",
    "numeric_template_activation_authorized: true",
  );
  writeFileSync(mutated, content, "utf8");

  try {
    const result = run("--index", resolve(root, "reports/research/TRAINING_SCHEDULE_SOURCE_INDEX_2026-07.md"), "--handoff", resolve(root, "reports/research/README_TRAINING_SCHEDULE_RESEARCH.md"), "--decision", mutated, "--catalog", resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /research decision must not authorize numeric template activation/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
