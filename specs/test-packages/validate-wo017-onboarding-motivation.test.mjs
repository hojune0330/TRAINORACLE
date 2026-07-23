import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { Wo017Error, validateArtifact, validateChangedPaths, validatePhase } from "./validate-wo017-onboarding-motivation.mjs";

const root = resolve(import.meta.dirname, "../..");
const fixtures = resolve(import.meta.dirname, "fixtures/wo017");

async function withFixture(name, run) {
  const directory = await mkdtemp(join(tmpdir(), "wo017-"));
  const fixtureRoot = join(directory, "fixture");
  try {
    await cp(resolve(fixtures, "valid-issuance"), fixtureRoot, { recursive: true });
    if (name !== "valid-issuance") await cp(resolve(fixtures, name), fixtureRoot, { recursive: true, force: true });
    return await run(fixtureRoot);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function replaceIn(directory, relativePath, from, to) {
  const path = resolve(directory, relativePath);
  const source = await readFile(path, "utf8");
  assert.ok(source.includes(from), `fixture marker missing: ${from}`);
  await writeFile(path, source.replace(from, to), "utf8");
}

async function expectCode(name, mutate, code, phase = "issuance", artifact = null) {
  await withFixture(name, async (directory) => {
    await mutate(directory);
    assert.throws(() => (artifact ? validateArtifact(directory, artifact) : validatePhase(directory, phase)), (error) => error instanceof Wo017Error && error.code === code);
  });
}

test("accepts the complete issuance fixture", () => {
  assert.doesNotThrow(() => validatePhase(resolve(fixtures, "valid-issuance"), "issuance"));
});

test("rejects mandatory router", async () => {
  await expectCode("valid-issuance", (directory) => replaceIn(directory, "reports/review/WO017_OWNER_DIRECTION.md", "router_mode: OPTIONAL_ONE_CONTEXT", "router_mode: MANDATORY"), "MANDATORY_ROUTER");
});

test("rejects plan request capture", async () => {
  await expectCode("valid-issuance", (directory) => replaceIn(directory, "CODEX_WORK_ORDER_017.md", "plan_request_capture_authorized: false", "plan_request_capture_authorized: true"), "PLAN_REQUEST_CAPTURE");
});

test("rejects decoration runtime", async () => {
  await expectCode("valid-issuance", (directory) => replaceIn(directory, "reports/review/WO017_OWNER_DIRECTION.md", "decoration_runtime_authorized: false", "decoration_runtime_authorized: true"), "DECORATION_RUNTIME");
});

test("rejects AI as human approval", async () => {
  await expectCode("sol-ai-approval", async () => {}, "AI_AS_HUMAN_APPROVAL", "sol", "sol");
});

test("rejects phantom work order", async () => {
  await expectCode("valid-issuance", (directory) => replaceIn(directory, "reports/review/WO017_SOURCE_AUTHORITY_MATRIX.md", "CODEX_WORK_ORDER_010.md | MISSING_PHYSICAL_FILE | stage ID only", "CODEX_WORK_ORDER_010.md | CURRENT_APP_EVIDENCE | physical order"), "PHANTOM_WORK_ORDER");
});

test("rejects false analysis", async () => {
  await expectCode("terra-false-analysis", async () => {}, "FALSE_ANALYSIS", "terra", "terra");
});

test("rejects app path change", () => {
  assert.throws(() => validateChangedPaths(["app/src/AppShell.tsx"]), (error) => error instanceof Wo017Error && error.code === "APP_PATH_CHANGE");
});

test("rejects implementation activated", async () => {
  await expectCode("sol-activated", async () => {}, "IMPLEMENTATION_ACTIVATED", "sol", "sol");
});

test("rejects implementation authorized handoff", async () => {
  await expectCode("valid-issuance", (directory) => replaceIn(directory, "TRAINORACLE_SPEC_INDEX.md", "IMPLEMENTATION_NOT_AUTHORIZED", "IMPLEMENTATION_AUTHORIZED"), "IMPLEMENTATION_ACTIVATED", "issuance", "handoff");
});

test("rejects ambiguous mood plus pain receipt", async () => {
  await expectCode("valid-issuance", (directory) => replaceIn(directory, "CODEX_WORK_ORDER_017.md", "both_pain_and_mood: pain_timeline; mood_saved_confirmation", "both_pain_and_mood: mood_timeline"), "MOOD_PLUS_PAIN_PRECEDENCE");
});

test("rejects unsafe Fable provenance", async () => {
  await expectCode("fable-unsafe-provenance", async () => {}, "UNSAFE_FABLE_PROVENANCE", "fable");
});

test("rejects missing WO017 PR link", async () => {
  await expectCode("fable-missing-pr", async () => {}, "MISSING_WO017_PR_LINK", "fable");
});

test("rejects a Terra PR link satisfied only by Fable provenance", async () => {
  await expectCode(
    "valid-terra",
    (directory) => replaceIn(
      directory,
      "reports/review/WO017_TERRA_BINDING_MATRIX.md",
      "pr_url: https://github.com/hojune0330/TRAINORACLE/pull/172",
      "fable_pr_url: https://github.com/hojune0330/TRAINORACLE/pull/102\npr_url: PENDING_GITHUB_DRAFT_PR",
    ),
    "MISSING_WO017_PR_LINK",
    "terra",
    "terra",
  );
});
