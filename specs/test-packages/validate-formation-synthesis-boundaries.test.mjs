import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("synthesis validation rejects an abstract-only supporting source", async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "formation-claims-"));
  const temporaryClaims = path.join(temporaryDirectory, "claims.csv");

  try {
    const source = await readFile(
      "reports/research/evidence/FORMATION_CLAIM_MATRIX.csv",
      "utf8",
    );
    const injected = source.replace(
      "FRV2-A-006;FRV2-A-012",
      "FRV2-B-001;FRV2-A-012",
    );
    assert.notEqual(injected, source, "test fixture must inject an abstract-only source");
    await writeFile(temporaryClaims, injected, "utf8");

    const result = spawnSync(
      process.execPath,
      [
        "specs/test-packages/validate-formation-synthesis.mjs",
        "--claims",
        temporaryClaims,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    assert.notEqual(result.status, 0, "validator accepted an abstract-only supporting source");
    assert.match(
      result.stderr || result.stdout,
      /abstract-only supporting source FRV2-CLAIM-A-001:FRV2-B-001/u,
    );
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
