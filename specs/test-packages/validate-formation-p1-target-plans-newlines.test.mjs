import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("P1 target-plan validation accepts valid Windows CRLF Markdown", () => {
  const result = spawnSync(
    process.execPath,
    ["specs/test-packages/validate-formation-p1-target-plans.mjs"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(
    result.status,
    0,
    `validator rejected valid CRLF plans:\n${result.stderr || result.stdout}`,
  );
});
