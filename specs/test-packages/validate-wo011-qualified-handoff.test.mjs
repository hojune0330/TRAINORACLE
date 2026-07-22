import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const validatorPath = "specs/test-packages/validate-wo011-qualified-handoff.mjs";
const reviewPaths = [
  "WO011_QUALIFIED_PRIVACY_REVIEW_HANDOFF.md",
  "WO011_PRODUCT_FACT_QUESTIONNAIRE.md",
  "WO011_OWNER_PRODUCT_FACT_DECISION_01_LAUNCH_SCOPE_2026-07-20.md",
];

async function withFixture(callback) {
  const root = await mkdtemp(path.join(tmpdir(), "wo011-authority-guard-"));
  try {
    await cp(path.join(projectRoot, validatorPath), path.join(root, validatorPath), {
      recursive: true,
    });
    for (const filename of reviewPaths) {
      const relativePath = path.join("reports/review", filename);
      await cp(path.join(projectRoot, relativePath), path.join(root, relativePath), {
        recursive: true,
      });
    }
    await callback(root);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

function runValidator(root) {
  return spawnSync(process.execPath, [validatorPath], {
    cwd: root,
    encoding: "utf8",
  });
}

test("WO011 handoff accepts the recorded non-authoritative decision", async () => {
  await withFixture(async (root) => {
    const result = runValidator(root);

    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
});

test("WO011 handoff rejects owner-decision account scope escalation", async () => {
  await withFixture(async (root) => {
    const decisionPath = path.join(
      root,
      "reports/review/WO011_OWNER_PRODUCT_FACT_DECISION_01_LAUNCH_SCOPE_2026-07-20.md",
    );
    const decision = await readFile(decisionPath, "utf8");
    await writeFile(
      decisionPath,
      decision.replace(
        "account_or_server_scope_authorized: false",
        "account_or_server_scope_authorized: true",
      ),
      "utf8",
    );

    const result = runValidator(root);

    assert.notEqual(result.status, 0, "owner decision must not authorize account or server scope");
  });
});
