import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const validator = resolve(import.meta.dirname, "validate-advisory-session-recommender.mjs");
const catalog = resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md");
const contract = resolve(root, "specs/reconstruct/ADVISORY_SESSION_EXAMPLE_RECOMMENDER_CONTRACT.md");

function applyRequiredReplacement(text, replacement, label) {
  if (!replacement) return text;
  const updated = text.replace(replacement.from, replacement.to);
  assert.notEqual(updated, text, `${label} hostile mutation must alter its fixture`);
  return updated;
}

function candidate(candidateId, sourceTier = "DIRECT_SOURCE_EXAMPLE") {
  return {
    candidateId, sourceTier, nonExecutable: true, authority: false,
    sourceRefs: [`SRC-${candidateId}`],
  };
}

function readyFixture(eligiblePoolCount = 2, visibleCount = Math.min(eligiblePoolCount, 3)) {
  return {
    state: eligiblePoolCount < 2
      ? "INSUFFICIENT_ELIGIBLE_CANDIDATES"
      : "ADVISORY_CANDIDATES_READY",
    d9Status: "CLEARED",
    eligiblePoolCount,
    candidates: eligiblePoolCount < 2
      ? []
      : Array.from({ length: visibleCount }, (_, index) => candidate(`C${index + 1}`)),
    rangeNarrowed: false,
    catalogActivation: false,
    usesJournal: false,
  };
}

function draftFixture() {
  return {
    ...readyFixture(),
    state: "PERSONAL_DRAFT_CREATED",
    confirmations: [
      {
        eventType: "ADVISORY_CANDIDATE_ACKNOWLEDGED",
        confirmationEventId: "E1",
        candidateId: "C1",
      },
      {
        eventType: "PERSONAL_DRAFT_CREATION_CONFIRMED",
        confirmationEventId: "E2",
        selectedCandidateId: "C1",
      },
    ],
    personalDraft: {
      sourceCandidateId: "C1",
      nonExecutable: true,
      authority: false,
      maySubmitValidation: false,
      mayWriteCalendar: false,
      mayExecuteSession: false,
      mayApplyPlan: false,
    },
  };
}

function journalFixture() {
  return {
    ...readyFixture(),
    usesJournal: true,
    targetEventIdentity: "1500M",
    journalProjection: {
      confirmed: true, eventIdentity: "1500M", eventDate: "2026-07-29", performance: "PT4M05S",
      rawTextUsed: false,
    },
  };
}

function changed(fixture, mutate) {
  const copy = structuredClone(fixture);
  mutate(copy);
  return copy;
}

async function validateWith({ fixture, catalogReplacement, contractReplacement } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "advisory-recommender-"));
  const catalogPath = join(directory, "catalog.md");
  const contractPath = join(directory, "contract.md");
  try {
    const [catalogText, contractText] = await Promise.all([
      readFile(catalog, "utf8"),
      readFile(contract, "utf8"),
    ]);
    let nextCatalog = applyRequiredReplacement(catalogText, catalogReplacement, "catalog");
    let nextContract = applyRequiredReplacement(contractText, contractReplacement, "contract");
    if (fixture) {
      const block = [
        "<!-- ADVISORY_TEST_FIXTURE",
        JSON.stringify(fixture),
        "ADVISORY_TEST_FIXTURE_END -->",
        "",
      ].join("\n");
      const mutated = nextContract.replace("[DRAFT_COMPLETE]", `${block}[DRAFT_COMPLETE]`);
      assert.notEqual(mutated, nextContract, "fixture insertion must alter the contract");
      nextContract = mutated;
    }
    await Promise.all([
      writeFile(catalogPath, nextCatalog, "utf8"),
      writeFile(contractPath, nextContract, "utf8"),
    ]);
    return spawnSync(process.execPath, [validator, catalogPath, contractPath], {
      cwd: root,
      encoding: "utf8",
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function assertInvalid(fixture, expected) {
  const result = await validateWith({ fixture });
  assert.notEqual(result.status, 0, "hostile fixture must fail");
  assert.match(result.stderr, expected);
}

test("current production catalog stays insufficient and non-executable", () => {
  const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /currentCatalogState=INSUFFICIENT_ELIGIBLE_CANDIDATES candidates=0 sourceVisible=15 runtimeAuthority=false/u,
  );
});

for (const [pool, visible] of [[2, 2], [3, 3], [4, 3]]) {
  test(`eligible pool ${pool} exposes exactly ${visible} advisory candidates`, async () => {
    const result = await validateWith({ fixture: readyFixture(pool, visible) });
    assert.equal(result.status, 0, result.stderr);
  });
}

for (const pool of [0, 1]) {
  test(`eligible pool ${pool} returns insufficient with no padded candidate`, async () => {
    const result = await validateWith({ fixture: readyFixture(pool) });
    assert.equal(result.status, 0, result.stderr);
  });
}

for (const [name, fixture] of [
  ["one visible candidate", readyFixture(2, 1)],
  ["four visible candidates", readyFixture(4, 4)],
  ["padded insufficient pool", { ...readyFixture(1), candidates: [candidate("C1"), candidate("C1")] }],
]) {
  test(`${name} fails closed`, async () => {
    await assertInvalid(fixture, /visible candidate count|candidate ids must be unique/u);
  });
}

for (const tier of [
  "POPULATION_INDIRECT",
  "PRODUCT_VARIANT",
  "REJECTED_OR_UNUSABLE",
  "UNKNOWN_SOURCE",
]) {
  test(`visible source tier ${tier} fails closed`, async () => {
    await assertInvalid(
      changed(readyFixture(), (fixture) => { fixture.candidates[0].sourceTier = tier; }),
      /forbidden source tier/u,
    );
  });
}

for (const d9Status of ["ACTIVE", "UNKNOWN"]) {
  test(`D9 ${d9Status} candidate leakage fails closed`, async () => {
    await assertInvalid(
      { ...readyFixture(), state: `BLOCKED_BY_D9_${d9Status}`, d9Status },
      /visible candidate count must be 0|D9 block must contain zero candidates/u,
    );
  });
}

test("one confirmation fails closed", async () => {
  await assertInvalid(
    changed(draftFixture(), (fixture) => { fixture.confirmations.pop(); }),
    /requires exactly two confirmation records|draft confirmation missing/u,
  );
});

test("repeated confirmation event ids fail closed", async () => {
  await assertInvalid(
    changed(draftFixture(), (fixture) => { fixture.confirmations[1].confirmationEventId = "E1"; }),
    /confirmation event ids must be distinct/u,
  );
});

test("selected candidate and draft source mismatch fails closed", async () => {
  await assertInvalid(
    changed(draftFixture(), (fixture) => { fixture.personalDraft.sourceCandidateId = "C2"; }),
    /acknowledgement candidate must match the draft source|selected candidate must match the draft source/u,
  );
});

for (const field of [
  "nonExecutable",
  "authority",
  "maySubmitValidation",
  "mayWriteCalendar",
  "mayExecuteSession",
  "mayApplyPlan",
]) {
  test(`unsafe personal draft field ${field} fails closed`, async () => {
    const fixture = draftFixture();
    fixture.personalDraft[field] = field === "nonExecutable" ? false : true;
    await assertInvalid(fixture, /personal draft must be inert|must be false/u);
  });
}

test("a ready result cannot smuggle a personal draft", async () => {
  const draft = draftFixture();
  await assertInvalid(
    { ...readyFixture(), personalDraft: draft.personalDraft },
    /non-draft state must not create a personal draft/u,
  );
});

test("confirmed structured same-event journal input passes", async () => {
  const result = await validateWith({ fixture: journalFixture() });
  assert.equal(result.status, 0, result.stderr);
});

for (const [name, mutate, expected] of [
  ["unconfirmed projection", (f) => { f.journalProjection.confirmed = false; }, /must be confirmed/u],
  ["missing event", (f) => { f.journalProjection.eventIdentity = ""; }, /event identity required/u],
  ["missing date", (f) => { f.journalProjection.eventDate = ""; }, /event date required/u],
  ["missing performance", (f) => { f.journalProjection.performance = ""; }, /performance required/u],
  ["raw text", (f) => { f.journalProjection.rawTextUsed = true; }, /raw journal text must not be used/u],
  ["cross-event", (f) => { f.targetEventIdentity = "800M"; }, /journal comparison must be same-event/u],
]) {
  test(`journal ${name} fails closed`, async () => {
    await assertInvalid(changed(journalFixture(), mutate), expected);
  });
}

for (const [field, expected] of [
  ["rangeNarrowed", /must not narrow a ranged example/u],
  ["catalogActivation", /must not activate the catalog/u],
]) {
  test(`${field} mutation fails closed`, async () => {
    await assertInvalid(changed(readyFixture(), (fixture) => { fixture[field] = true; }), expected);
  });
}

test("content after the contract final marker fails closed", async () => {
  const result = await validateWith({
    contractReplacement: {
      from: /\r?\n\[DRAFT_COMPLETE\]\r?\n/u,
      to: "\n[DRAFT_COMPLETE]\nUNAUTHORIZED_TRAILING_TEXT\n",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /final marker must be the last non-whitespace content/u);
});

test("an absent hostile replacement makes the test itself fail", async () => {
  await assert.rejects(
    validateWith({
      contractReplacement: { from: "ABSENT_REPLACEMENT_TARGET", to: "MUTATED" },
    }),
    /hostile mutation must alter its fixture/u,
  );
});
