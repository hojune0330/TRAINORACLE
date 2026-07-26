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

function applyRequiredReplacement(text, replacement, label) {
  if (!replacement) return text;

  const updated = text.replace(replacement.from, replacement.to);
  assert.notEqual(updated, text, `${label} hostile mutation must alter its fixture`);
  return updated;
}

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
        applyRequiredReplacement(catalogText, catalogReplacement, "catalog"),
        "utf8",
      ),
      writeFile(
        contractPath,
        applyRequiredReplacement(contractText, contractReplacement, "contract"),
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

test("Given one BASE seed is relabeled as LT, when validated, then the 5-per-intent invariant fails closed", async () => {
  const result = await validateWith({
    catalogReplacement: { from: "planningIntent: BASE_INTENT", to: "planningIntent: LT_INTENT" },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BASE_INTENT must contain exactly 5 entries, got 4/u);
  assert.match(result.stderr, /LT_INTENT must contain exactly 5 entries, got 6/u);
});

for (const fixtureMutation of [
  {
    name: "total repetitions",
    from: "totalRepetitions: 20",
    to: "totalRepetitions: 19",
    expected: /incorrect or missing total repetitions/u,
  },
  {
    name: "quality distance",
    from: "qualityDistanceM: 8000",
    to: "qualityDistanceM: 7900",
    expected: /incorrect or missing quality distance/u,
  },
  {
    name: "repetition recovery occurrences",
    from: "repetitionRecoveryOccurrences: 18",
    to: "repetitionRecoveryOccurrences: 17",
    expected: /incorrect or missing repetition recovery occurrences/u,
  },
  {
    name: "set recovery occurrences",
    from: "setRecoveryOccurrences: 1",
    to: "setRecoveryOccurrences: 2",
    expected: /incorrect or missing set recovery occurrences/u,
  },
  {
    name: "planned recovery seconds",
    from: "plannedRecoverySeconds: 1260",
    to: "plannedRecoverySeconds: 1200",
    expected: /incorrect or missing planned recovery seconds/u,
  },
]) {
  test(`Given the owner fixture ${fixtureMutation.name} changes, when validated, then it fails closed`, async () => {
    const result = await validateWith({
      contractReplacement: {
        from: fixtureMutation.from,
        to: fixtureMutation.to,
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, fixtureMutation.expected);
  });
}

test("Given the catalog final marker is removed, when validated, then it fails closed", async () => {
  const result = await validateWith({
    catalogReplacement: { from: /\r?\n\[DRAFT_COMPLETE\]\r?\n/u, to: "\n" },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /catalog must contain exactly one final marker/u);
});

test("Given the contract final marker is removed, when validated, then it fails closed", async () => {
  const result = await validateWith({
    contractReplacement: { from: /\r?\n\[DRAFT_COMPLETE\]\r?\n/u, to: "\n" },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contract must contain exactly one final marker/u);
});

test("Given catalog text follows the final marker, when validated, then it fails closed", async () => {
  const result = await validateWith({
    catalogReplacement: {
      from: /\r?\n\[DRAFT_COMPLETE\]\r?\n/u,
      to: "\n[DRAFT_COMPLETE]\nUNAUTHORIZED_TRAILING_TEXT\n",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /catalog final marker must be the last non-whitespace content/u);
});

test("Given contract text follows the final marker, when validated, then it fails closed", async () => {
  const result = await validateWith({
    contractReplacement: {
      from: /\r?\n\[DRAFT_COMPLETE\]\r?\n/u,
      to: "\n[DRAFT_COMPLETE]\nUNAUTHORIZED_TRAILING_TEXT\n",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contract final marker must be the last non-whitespace content/u);
});
