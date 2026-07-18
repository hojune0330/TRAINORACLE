import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "../..");

async function createFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "formation-integrity-"));
  await cp(path.join(projectRoot, "specs/test-packages"), path.join(root, "specs/test-packages"), {
    recursive: true,
  });
  await cp(path.join(projectRoot, "reports/research"), path.join(root, "reports/research"), {
    recursive: true,
  });
  await cp(path.join(projectRoot, "reports/review"), path.join(root, "reports/review"), {
    recursive: true,
  });
  await cp(
    path.join(projectRoot, ".omo/evidence/formation-research-v2"),
    path.join(root, ".omo/evidence/formation-research-v2"),
    { recursive: true },
  );
  return root;
}

function run(root, script, ...arguments_) {
  return spawnSync(process.execPath, [`specs/test-packages/${script}`, ...arguments_], {
    cwd: root,
    encoding: "utf8",
  });
}

async function rewrite(root, relativePath, transform) {
  const absolute = path.join(root, relativePath);
  const source = await readFile(absolute, "utf8");
  await writeFile(absolute, transform(source), "utf8");
}

async function withFixture(callback) {
  const root = await createFixture();
  try {
    await callback(root);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

test("screening acceptance cannot be forged by changing canonical markers", async () => {
  await withFixture(async (root) => {
    await rewrite(root, "reports/research/evidence/FORMATION_SCREENING_LEDGER.csv", (source) =>
      source.replaceAll(",PENDING_HUMAN,", ",CONFIRMED,").replaceAll(",DEFER,", ",INCLUDE,"),
    );
    const result = run(root, "validate-formation-screening.mjs", "--accepted");
    assert.notEqual(result.status, 0, "screening accepted without human attestations");
  });
});

test("extraction acceptance cannot delete conflicts and rewrite status", async () => {
  await withFixture(async (root) => {
    await rewrite(root, "reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv", (source) =>
      source.replaceAll(/[A-Z_]*PENDING_HUMAN[A-Z_]*/gu, "ACCEPTED_WITHOUT_ADJUDICATION"),
    );
    await rewrite(root, "reports/research/evidence/FORMATION_EXTRACTION_CONFLICTS.csv", (source) =>
      `${source.split(/\r?\n/u, 1)[0]}\n`,
    );
    const result = run(root, "validate-formation-extraction.mjs", "--accepted");
    assert.notEqual(result.status, 0, "extraction accepted without conflict adjudications");
  });
});

test("appraisal acceptance cannot delete conflicts and rewrite status", async () => {
  await withFixture(async (root) => {
    await rewrite(root, "reports/research/evidence/FORMATION_APPRAISAL_LEDGER.csv", (source) =>
      source.replaceAll(",PENDING_HUMAN,", ",CONFIRMED,"),
    );
    await rewrite(root, "reports/research/evidence/FORMATION_APPRAISAL_CONFLICTS.csv", (source) =>
      `${source.split(/\r?\n/u, 1)[0]}\n`,
    );
    const result = run(root, "validate-formation-appraisal.mjs", "--accepted");
    assert.notEqual(result.status, 0, "appraisal accepted without conflict adjudications");
  });
});

test("appraisal rejects lost non-independent extraction provenance", async () => {
  await withFixture(async (root) => {
    await rewrite(root, ".omo/evidence/formation-research-v2/appraisal-lane-2.csv", (source) =>
      source.split(/\r?\n/u).map((line) => line.includes("FRV2-F-015")
        ? line
          .replaceAll("NON_INDEPENDENT_EXTRACTION_INPUT", "INDEPENDENT_APPRAISAL_INPUT")
          .replaceAll(
            "NON_INDEPENDENT_INPUT_PENDING_HUMAN_REAPPRAISAL",
            "PENDING_INDEPENDENT_APPRAISAL",
          )
        : line).join("\n"),
    );
    const result = run(root, "validate-formation-appraisal.mjs");
    assert.notEqual(result.status, 0, "appraisal accepted lost cross-stage provenance");
  });
});

test("extraction repair and build are byte-identical on a second pass", async () => {
  await withFixture(async (root) => {
    const generated = [
      ".omo/evidence/formation-research-v2/extraction-e-lane-1.csv",
      ".omo/evidence/formation-research-v2/extraction-e-lane-2.csv",
      ".omo/evidence/formation-research-v2/extraction-fg-lane-2.csv",
      "reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv",
      "reports/research/evidence/FORMATION_EXTRACTION_CONFLICTS.csv",
    ];
    const execute = () => {
      const repair = run(root, "repair-formation-extraction-preparation.mjs");
      assert.equal(repair.status, 0, repair.stderr || repair.stdout);
      const build = run(root, "build-formation-extraction.mjs");
      assert.equal(build.status, 0, build.stderr || build.stdout);
    };
    const hashes = async () => Promise.all(generated.map(async (file) =>
      createHash("sha256").update(await readFile(path.join(root, file))).digest("hex"),
    ));

    execute();
    const first = await hashes();
    execute();
    assert.deepEqual(await hashes(), first);
  });
});

for (const [name, transform] of [
  ["unterminated quote", (source) => `${source}"`],
  [
    "undeclared extra cell",
    (source) => source.replace(/\r?\n$/u, ",UNDECLARED_EXTRA_COLUMN\n"),
  ],
]) {
  test(`source audit rejects ${name}`, async () => {
    await withFixture(async (root) => {
      await rewrite(root, "reports/research/evidence/FORMATION_SOURCE_LEDGER.csv", transform);
      const result = run(root, "validate-formation-source-audit.mjs");
      assert.notEqual(result.status, 0, `source audit accepted ${name}`);
    });
  });
}

test("supplemental evidence cannot claim completed human screening", async () => {
  await withFixture(async (root) => {
    await rewrite(
      root,
      "reports/research/evidence/FORMATION_SUPPLEMENTAL_SOURCE_CANDIDATES_20260717.csv",
      (source) => source.replace(
        "PENDING_HUMAN_SCREENING,PENDING,PENDING",
        "HUMAN_INCLUDED,COMPLETE,COMPLETE",
      ),
    );
    const result = run(root, "validate-formation-supplemental-evidence.mjs");
    assert.notEqual(result.status, 0, "supplemental evidence accepted forged human review");
  });
});

test("supplemental evidence rejects a mismatched PubMed identity", async () => {
  await withFixture(async (root) => {
    await rewrite(
      root,
      "reports/research/evidence/FORMATION_SUPPLEMENTAL_SOURCE_CANDIDATES_20260717.csv",
      (source) => source.replace(
        "10.3390/bios11030077,33799558,https://pubmed.ncbi.nlm.nih.gov/33799558/",
        "10.3390/bios11030077,33799952,https://pubmed.ncbi.nlm.nih.gov/33799952/",
      ),
    );
    const result = run(root, "validate-formation-supplemental-evidence.mjs");
    assert.notEqual(result.status, 0, "supplemental evidence accepted mismatched PMID");
  });
});

test("supplemental evidence rejects an untracked PMID in the gap audit", async () => {
  await withFixture(async (root) => {
    await rewrite(
      root,
      "reports/review/FORMATION_LATEST_DECISION_AND_USER_GAP_AUDIT_V2.md",
      (source) => source.replace(
        "## 대회 앵커에서 새로 분리해야 할 결정",
        "| rogue | indirect | [PMID 99999999](https://pubmed.ncbi.nlm.nih.gov/99999999/) | prohibited |\n\n## 대회 앵커에서 새로 분리해야 할 결정",
      ),
    );
    const result = run(root, "validate-formation-supplemental-evidence.mjs");
    assert.notEqual(result.status, 0, "supplemental evidence accepted an untracked PMID");
  });
});

test("decision packets cannot omit their owned fields", async () => {
  await withFixture(async (root) => {
    for (const file of [
      "reports/review/FORMATION_LOAD_COMPONENT_DECISION_PACKET_V2.md",
      "reports/review/FORMATION_MINIMUM_EVIDENCE_DECISION_PACKET_V2.md",
      "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md",
    ]) {
      await rewrite(root, file, (source) =>
        source.replace(/owned_fields:\r?\n(?:  - [^\r\n]+\r?\n)+/u, "owned_fields:\n"),
      );
    }
    const result = run(root, "validate-formation-decision-packets.mjs");
    assert.notEqual(result.status, 0, "decision packets accepted empty ownership sets");
  });
});

test("competition packet cannot omit its privacy gate", async () => {
  await withFixture(async (root) => {
    await rewrite(
      root,
      "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md",
      (source) => source.replace(
        "privacy_gate: YOUTH_PRIVACY_SAFEGUARDING_AND_DATA_MINIMIZATION_REVIEW",
        "privacy_gate: OMITTED",
      ),
    );
    const result = run(root, "validate-formation-decision-packets.mjs");
    assert.notEqual(result.status, 0, "competition packet accepted without privacy gate");
  });
});

test("user scenarios cannot present pending features as live", async () => {
  await withFixture(async (root) => {
    await rewrite(
      root,
      "reports/review/FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md",
      (source) => source.replace("아직 실제 계획에는 쓰지 않아요", "지금 실제 계획에 써요"),
    );
    const result = run(root, "validate-formation-final-review-preparation.mjs");
    assert.notEqual(result.status, 0, "user scenarios accepted a pending feature as live");
  });
});
