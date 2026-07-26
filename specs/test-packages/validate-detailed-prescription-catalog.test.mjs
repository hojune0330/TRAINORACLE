import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const validator = resolve(import.meta.dirname, "validate-detailed-prescription-catalog.mjs");
const catalog = resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md");
const contract = resolve(root, "specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md");

async function validateWith({ catalogReplacement, contractReplacement }) {
  const directory = await mkdtemp(join(tmpdir(), "detailed-prescription-validator-"));
  const catalogPath = join(directory, "catalog.md");
  const contractPath = join(directory, "contract.md");

  try {
    const [catalogText, contractText] = await Promise.all([
      readFile(catalog, "utf8"),
      readFile(contract, "utf8"),
    ]);
    await Promise.all([
      writeFile(
        catalogPath,
        catalogReplacement ? catalogText.replace(catalogReplacement.from, catalogReplacement.to) : catalogText,
        "utf8",
      ),
      writeFile(
        contractPath,
        contractReplacement ? contractText.replace(contractReplacement.from, contractReplacement.to) : contractText,
        "utf8",
      ),
    ]);
    return spawnSync(process.execPath, [validator, catalogPath, contractPath], { cwd: root, encoding: "utf8" });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("Given the draft catalog and contract, when validated, then all 30 entries remain inert", () => {
  const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /detailed prescription validation passed: 30\/30 inert draft entries/u);
});

test("Given one catalog event group becomes eligible, when validated, then it fails closed", async () => {
  const result = await validateWith({
    catalogReplacement: { from: "allowedEventGroups: []", to: "allowedEventGroups: [SPRINT]" },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must keep allowedEventGroups empty/u);
});

test("Given one catalog lifecycle becomes active, when validated, then it fails closed", async () => {
  const result = await validateWith({
    catalogReplacement: { from: "  lifecycleStatus: DRAFT", to: "  lifecycleStatus: ACTIVE" },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must remain DRAFT/u);
});

test("Given a direct-source claim points outside reopened VDOT material, when validated, then it fails closed", async () => {
  const result = await validateWith({
    catalogReplacement: {
      from: "sourceRefs: [SRC-VDOT-PACES]",
      to: "sourceRefs: [SRC-WA-1500]",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /direct-source claim must cite a reopened VDOT source/u);
});

test("Given the same-event requirement is removed, when validated, then it fails closed", async () => {
  const result = await validateWith({
    contractReplacement: {
      from: "anchor_event_must_equal_target_event: true",
      to: "anchor_event_must_equal_target_event: false",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /same-event race-pace guard/u);
});

test("Given unbound notation may emit a numeric pace, when validated, then it fails closed", async () => {
  const result = await validateWith({
    contractReplacement: { from: "numeric_pace_output: forbidden", to: "numeric_pace_output: allowed" },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unbound notation numeric-pace guard/u);
});

test("Given private note input becomes usable for dose, when validated, then it fails closed", async () => {
  const result = await validateWith({
    contractReplacement: { from: "raw_note_input_for_dose: forbidden", to: "raw_note_input_for_dose: allowed" },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /private-note dose guard/u);
});

test("Given catalog prose may deserialize into a prescription, when validated, then it fails closed", async () => {
  const result = await validateWith({
    contractReplacement: {
      from: "catalog_seed_text_must_not_be_deserialized_as_StructuredPrescription: true",
      to: "catalog_seed_text_must_not_be_deserialized_as_StructuredPrescription: false",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /catalog-deserialization guard/u);
});
