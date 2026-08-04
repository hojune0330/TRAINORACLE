import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const validatorPath = resolve(import.meta.dirname, "validate-journal-decoration-contract.mjs");
const contractPath = resolve(root, "specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md");

function replaceRequired(text, from, to, mutationName) {
  const mutated = typeof from === "string" ? text.replace(from, to) : text.replace(from, to);
  assert.notEqual(mutated, text, `${mutationName} fixture mutation must change the contract`);
  return mutated;
}

function validateWith(mutate = (text) => text) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "journal-decoration-contract-"));
  const temporaryContract = join(temporaryRoot, basename(contractPath));

  try {
    const source = readFileSync(contractPath, "utf8");
    writeFileSync(temporaryContract, mutate(source), "utf8");

    const result = spawnSync(process.execPath, [validatorPath, temporaryContract], {
      cwd: root,
      encoding: "utf8",
    });

    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
    assert.equal(existsSync(temporaryRoot), false, `temporary fixture was not removed: ${temporaryRoot}`);
  }
}

test("Given the finalized journal decoration contract, when validated, then every V1 beta boundary passes", () => {
  const result = validateWith();

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^journal decoration contract validation passed: 8 catalog items, 4 date slots\r?\n$/u);
});

test("Given the V2 storage key is missing, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(text, /trainoracle\.decorations\.v2/gu, "trainoracle.decorations.v3", "missing V2 key"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /V2 storage key and migration boundary/u);
});

test("Given a paid catalog price changes, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(text, "| `THEME_SKY_JOURNAL` | `page_theme` | device-wide `equipped.themeId` | `12P` |", "| `THEME_SKY_JOURNAL` | `page_theme` | device-wide `equipped.themeId` | `13P` |", "wrong paid price"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /paid catalog IDs and prices/u);
});

test("Given avatar_badge is inserted into TOP_CORNER, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(text, "| `TOP_CORNER` | `diary_header` | `sticker` | 1 |", "| `TOP_CORNER` | `diary_header` | `sticker`, `avatar_badge` | 1 |", "avatar TOP_CORNER insertion"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fixed slot table and avatar exclusion/u);
});

test("Given global equipped avatarId is missing, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(text, /avatarId: nullable_owned_avatar_badge_ID_default_null/gu, "profileAvatarId: nullable_owned_avatar_badge_ID_default_null", "missing global avatarId"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /global equipped themeId\/inkId\/avatarId/u);
});

for (const fieldMutation of [
  { name: "version", line: /^  version: 2\r?$/mu },
  { name: "spentPoints", line: /^  spentPoints: required_nonnegative_number\r?$/mu },
  { name: "ownedItemIds", line: /^  ownedItemIds: required_unique_recognized_catalog_ID_array\r?$/mu },
]) {
  test(`Given DecorationStateV2 omits ${fieldMutation.name}, when validated, then it fails closed`, () => {
    const result = validateWith((text) =>
      replaceRequired(text, fieldMutation.line, "", `missing V2 ${fieldMutation.name}`),
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exact seven-field V2 state shape/u);
  });
}

test("Given placement scope becomes per-entry journalEntryId, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(
      text,
      "    - date: required_YYYY-MM-DD",
      "    - journalEntryId: required_nonempty_string",
      "per-entry placement scope",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /date-keyed pagePlacements scope/u);
});

test("Given the downloaded backup loses its decorations section, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(
      text,
      "  decorations: required_distinct_decoration_backup_v2_section",
      "  appearance: required_distinct_decoration_backup_v2_section",
      "missing backup decorations section",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /backup envelope decorations section/u);
});

test("Given a coordinate field is accepted by runtime V1, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(text, /future\r?\nextension only/gu, "runtime\nextension allowed", "accepted coordinate field"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /future-only spatial fields/u);
});

test("Given decoration receives safety authority, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(text, "  is_safety_authority: false", "  is_safety_authority: true", "weakened authority"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /decoration authority denial/u);
});

test("Given library favorites grant ownership, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(text, "  grants_ownership: false", "  grants_ownership: true", "favorite ownership grant"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /library favorites and recent history boundary/u);
});

test("Given library recent history grows beyond eight, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(text, "retains at most 8", "retains at most 9", "recent history maximum"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /library favorites and recent history boundary/u);
});

test("Given one trashed same-date entry hides retained placements while another remains active, when validated, then it fails closed", () => {
  const result = validateWith((text) =>
    replaceRequired(
      text,
      "Keep that date's placements visible, even if another same-date entry is trashed or deleted.",
      "Hide that date's placements if another same-date entry is trashed or deleted.",
      "same-date visibility lifecycle",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /same-date placement lifecycle/u);
});

test("Given content follows the final marker, when validated, then it fails closed", () => {
  const result = validateWith((text) => `${text.trimEnd()}\n[DRAFT_TRAILING_CONTENT]\n`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /final marker must be the last nonempty line/u);
});
