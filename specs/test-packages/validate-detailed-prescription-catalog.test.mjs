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

test("Given the adopted catalog and contract, when validated, then exactly V2-SEED-05 is active", () => {
  const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /detailed prescription validation passed: 1 active, 29 draft, 30 total/u);
});

test("Given the runtime allowlist loses or gains a template, when validated, then it fails closed", async () => {
  for (const contractReplacement of [
    { from: /    - MD-3000-01@1\.0\.0\r?\n/u, to: "" },
    { from: /    - MD-3000-01@1\.0\.0\r?\n/u, to: "    - MD-3000-01@1.0.0\n    - UNAPPROVED-01@1.0.0\n" },
  ]) {
    const result = await validateWith({ contractReplacement });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /active numeric-template allowlist must remain exact/u);
  }
});

test("Given a ranged interval seed, when it is documented, then context keeps volume and recovery unfixed", async () => {
  const catalogText = await readFile(catalog, "utf8");

  assert.match(catalogText, /machineNotationStatus: PENDING_COACH_CONTEXT/u);
  assert.match(catalogText, /fixed_default_from_energy_intent: forbidden/u);
  assert.match(catalogText, /goal_label_required: true/u);
  assert.match(catalogText, /same_event_comparison_only: true/u);
});

test("Given goal and recent results may compare across events, when validated, then it fails closed", async () => {
  const result = await validateWith({
    catalogReplacement: {
      from: "same_event_comparison_only: true",
      to: "same_event_comparison_only: false",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /same_event_comparison_only: true/u);
});

test("Given a second catalog event group becomes eligible, when validated, then it fails closed", async () => {
  const result = await validateWith({
    catalogReplacement: { from: "allowedEventGroups: []", to: "allowedEventGroups: [SPRINT]" },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must keep allowedEventGroups empty/u);
});

test("Given a second catalog lifecycle becomes active, when validated, then it fails closed", async () => {
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

for (const machineNotationMutation of [
  { name: "V2 parser-ready repetition count changes", from: 'machineNotation: "5×1000m @5000m RP · r150″ JOG"', to: 'machineNotation: "4×1000m @5000m RP · r150″ JOG"', expected: /V2-SEED-05 must keep its exact parser-ready machineNotation/u },
  { name: "V2 parser-ready repetition distance changes", from: 'machineNotation: "5×1000m @5000m RP · r150″ JOG"', to: 'machineNotation: "5×100m @5000m RP · r150″ JOG"', expected: /V2-SEED-05 must keep its exact parser-ready machineNotation/u },
  { name: "V2 parser-ready race-pace event changes", from: 'machineNotation: "5×1000m @5000m RP · r150″ JOG"', to: 'machineNotation: "5×1000m @1500m RP · r150″ JOG"', expected: /V2-SEED-05 must keep its exact parser-ready machineNotation/u },
  { name: "V2 parser-ready recovery mode changes", from: 'machineNotation: "5×1000m @5000m RP · r150″ JOG"', to: 'machineNotation: "5×1000m @5000m RP · r150″ STAND"', expected: /V2-SEED-05 must keep its exact parser-ready machineNotation/u },
  { name: "V2 parser-ready machine notation becomes null", from: 'machineNotation: "5×1000m @5000m RP · r150″ JOG"', to: "machineNotation: null", expected: /V2-SEED-05 parser-ready machineNotation must not be null/u },
  { name: "V2 machine notation receives a pending-state string", from: 'machineNotation: "5×1000m @5000m RP · r150″ JOG"', to: "machineNotation: PENDING_OWNER_RANGE_DECISION", expected: /V2-SEED-05 must keep its exact parser-ready machineNotation/u },
  {
    name: "V2 parser-ready recovery changes from 150 seconds to 120 seconds",
    from: 'machineNotation: "5×1000m @5000m RP · r150″ JOG"',
    to: 'machineNotation: "5×1000m @5000m RP · r120″ JOG"',
    expected: /V2-SEED-05 must keep its exact parser-ready machineNotation/u,
  },
  {
    name: "V2 parser-ready status changes",
    from: "machineNotationStatus: PARSER_READY",
    to: "machineNotationStatus: NOT_APPLICABLE_NO_PACE_TARGET",
    expected: /PARSER_READY must contain exactly 1 entries, got 0/u,
  },
  {
    name: "V2 parser-ready basis becomes null",
    from: 'machineNotationBasis: "5K=5000m; 2 minutes 30 seconds=150 seconds; repetitions, distance, and recovery are unchanged."',
    to: "machineNotationBasis: null",
    expected: /V2-SEED-05 must keep its parser-ready basis/u,
  },
  {
    name: "pending coach-context range receives a machine notation",
    from: /machineNotation: null\r?\n  machineNotationStatus: PENDING_COACH_CONTEXT/u,
    to: 'machineNotation: "3×500m @1500m RP · r120″"\n  machineNotationStatus: PENDING_OWNER_RANGE_DECISION',
    expected: /GL-SEED-01 must keep machineNotation null while pending/u,
  },
  {
    name: "V2 canonical notation pattern changes",
    from: 'notationPattern: "5×1000m @5K RP · r2′30″"',
    to: 'notationPattern: "4×1000m @5K RP · r2′30″"',
    expected: /V2-SEED-05 must preserve its canonical notationPattern/u,
  },
]) {
  test(`Given ${machineNotationMutation.name}, when validated, then it fails closed`, async () => {
    const result = await validateWith({ catalogReplacement: machineNotationMutation });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, machineNotationMutation.expected);
  });
}

for (const componentMutation of [
  { name: "warm-up", from: "WU-V2-5K-01@1.0.0", to: "WU-MISSING" },
  { name: "cooldown", from: "CD-V2-5K-01@1.0.0", to: "CD-MISSING" },
  { name: "stop code", from: "STOP_LOSS_OF_CONTROLLED_FORM", to: "STOP_MISSING" },
  { name: "age-neutral population rule", from: "populationApplicability: YOUTH_AND_ADULT_SAME_CRITERIA_NO_AGE_DOSE_BRANCH", to: "populationApplicability: YOUTH_REDUCED_DOSE" },
]) {
  test(`Given the V2 ${componentMutation.name} contract changes, when validated, then it fails closed`, async () => {
    const result = await validateWith({ catalogReplacement: componentMutation });
    assert.notEqual(result.status, 0);
  });
}

test("Given a second seed is activated, when validated, then it fails closed", async () => {
  const result = await validateWith({
    catalogReplacement: {
      from: /(- templateId: BA-SEED-01\r?\n  version: "0.1"\r?\n  lifecycleStatus:) DRAFT/u,
      to: "$1 ACTIVE",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BA-SEED-01 must remain DRAFT/u);
});
