import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const defaultContractPath = resolve(
  import.meta.dirname,
  "../reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md",
);
const contractPath = resolve(process.argv[2] ?? defaultContractPath);
const contract = readFileSync(contractPath, "utf8").replaceAll("\r\n", "\n");

function fail(label) {
  process.stderr.write(`journal decoration contract validation failed: ${label}\n`);
  process.exit(1);
}

function requireAll(label, markers) {
  if (markers.some((marker) => !contract.includes(marker))) fail(label);
}

function requireNone(label, patterns) {
  if (patterns.some((pattern) => pattern.test(contract))) fail(label);
}

const catalogRows = [
  "| `THEME_TRACK_NOTEBOOK` | `page_theme` | device-wide `equipped.themeId` | FREE |",
  "| `INK_NAVY` | `ink_color` | device-wide `equipped.inkId` | FREE |",
  "| `STICKER_WEATHER_SUN` | `sticker` | `TOP_CORNER` or `BODY_MARGIN` | FREE |",
  "| `STAMP_REST_DAY` | `stamp` | `PAGE_FOOTER` | FREE |",
  "| `TAPE_CHECKER` | `masking_tape` | `HEADER_TAPE` | FREE |",
  "| `THEME_SKY_JOURNAL` | `page_theme` | device-wide `equipped.themeId` | `12P` |",
  "| `STICKER_FINISH_LINE` | `sticker` | `TOP_CORNER` or `BODY_MARGIN` | `8P` |",
  "| `AVATAR_START_LINE` | `avatar_badge` | device-wide `equipped.avatarId` on `diary_header` | `20P` |",
];
requireAll("paid catalog IDs and prices", catalogRows.slice(5));
requireAll("complete eight-item V1 beta catalog", catalogRows);

const slotRows = [
  "| `HEADER_TAPE` | `diary_header` | `masking_tape` | 1 |",
  "| `TOP_CORNER` | `diary_header` | `sticker` | 1 |",
  "| `BODY_MARGIN` | `diary_body` | `sticker` | 1 |",
  "| `PAGE_FOOTER` | `diary_footer` | `stamp` | 1 |",
];
requireAll("fixed slot table and avatar exclusion", slotRows);
requireNone("fixed slot table and avatar exclusion", [
  /^\| `(?:HEADER_TAPE|TOP_CORNER|BODY_MARGIN|PAGE_FOOTER)`[^\n]*`avatar_badge`/mu,
]);

requireAll("global equipped themeId/inkId/avatarId", [
  "themeId: required_owned_or_free_page_theme_ID_default_THEME_TRACK_NOTEBOOK",
  "inkId: required_owned_or_free_ink_color_ID_default_INK_NAVY",
  "avatarId: nullable_owned_avatar_badge_ID_default_null",
  "defaults to `THEME_TRACK_NOTEBOOK`",
  "defaults to `INK_NAVY`",
  "defaults to `null`",
]);

const stateMatch = contract.match(/```yaml\nDecorationStateV2:\n(?<body>[\s\S]*?)\n```/u);
if (!stateMatch?.groups?.body) fail("exact seven-field V2 state shape");
const stateTopLevelFields = [...stateMatch.groups.body.matchAll(/^  ([A-Za-z][A-Za-z0-9]*):/gmu)]
  .map((match) => match[1]);
const expectedTopLevelFields = [
  "version",
  "spentPoints",
  "ownedItemIds",
  "equipped",
  "library",
  "pagePlacements",
  "pointMeaning",
];
if (JSON.stringify(stateTopLevelFields) !== JSON.stringify(expectedTopLevelFields)) {
  fail("exact seven-field V2 state shape");
}
requireAll("exact seven-field V2 state shape", [
  "  version: 2",
  "  spentPoints: required_nonnegative_number",
  "  ownedItemIds: required_unique_recognized_catalog_ID_array",
  "  pointMeaning: NON_ECONOMIC_NON_TRANSFERABLE_BETA",
]);

requireAll("date-keyed pagePlacements scope", [
  "  scope: journal_date_page",
  "    - date: required_YYYY-MM-DD",
  "journalEntryId: forbidden",
  "`pagePlacements` is date-page scoped, never individual-entry scoped.",
]);
requireNone("date-keyed pagePlacements scope", [/^\s+journalEntryId: required_/gmu]);

requireAll("V2 storage key and migration boundary", [
  "active_local_storage_key: trainoracle.decorations.v2",
  "The existing purchase/ownership key is `trainoracle.decorations.v1`.",
  "copy V1\n   `spentPoints`",
  "copy only recognized V1 paid `ownedItemIds`",
  "add all five free\n   starter IDs",
  "must never mutate, overwrite,\n   or delete it during this beta",
]);

requireAll("library favorites and recent history boundary", [
  "grants_ownership: false",
  "grants_equipment: false",
  "grants_placement: false",
  "favorites_unique: true",
  "recent_max_items: 8",
  "does not grant ownership",
  "retains at most 8",
]);

requireAll("backup envelope decorations section", [
  "user_downloaded_backup_envelope:",
  "  journal: existing_journal_backup_section",
  "  decorations: required_distinct_decoration_backup_v2_section",
  "  decorations_payload:",
  "    rawMemo: forbidden",
  "    rawSymptomClause: forbidden",
]);

requireAll("future-only spatial fields", [
  "future\nextension only",
  "  x: forbidden",
  "  y: forbidden",
  "  position: forbidden",
  "  rotation: forbidden",
  "  rotationDeg: forbidden",
  "  scale: forbidden",
]);

requireAll("same-date placement lifecycle", [
  "visible_while_any_same_date_entry_active: true",
  "retained_while_only_trashed_entries_remain: true",
  "restored_without_second_spend: true",
  "cascade_only_after_last_same_date_entry_permanently_gone: true",
  "Keep that date's placements visible, even if another same-date entry is trashed or deleted.",
]);

requireAll("decoration authority denial", [
  "is_safety_authority: false",
  "is_medical_authority: false",
  "is_coach_authority: false",
  "can_create_training_plan: false",
  "can_modify_or_unlock_training_plan: false",
  "can_clear_D9_or_Safety_Gate: false",
  "can_generate_analysis_or_health_inference: false",
  "can_diagnose_interpret_or_score_pain: false",
  "can_change_training_recommendations: false",
]);

const nonemptyLines = contract.split("\n").filter((line) => line.trim().length > 0);
if (nonemptyLines.at(-1) !== "[DRAFT_COMPLETE]") {
  fail("final marker must be the last nonempty line");
}
if (nonemptyLines.filter((line) => line === "[DRAFT_COMPLETE]").length !== 1) {
  fail("final marker must be the last nonempty line");
}

process.stdout.write("journal decoration contract validation passed: 8 catalog items, 4 date slots\n");
