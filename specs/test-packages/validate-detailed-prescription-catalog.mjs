import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const suppliedPaths = process.argv.slice(2);

if (suppliedPaths.length !== 0 && suppliedPaths.length !== 2) {
  throw new Error("expected zero paths or catalog and contract paths");
}

const [catalogPath, contractPath] = suppliedPaths.length === 2
  ? suppliedPaths
  : [
      resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"),
      resolve(root, "specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md"),
    ];
const catalog = readFileSync(catalogPath, "utf8");
const contract = readFileSync(contractPath, "utf8");
const failures = [];
const failUnless = (condition, message) => {
  if (!condition) failures.push(message);
};
const blocks = catalog.split(/\n(?=- templateId: )/u).filter((block) => block.startsWith("- templateId: "));
const reopenedVdotRefs = new Set(["SRC-VDOT-PACES", "SRC-VDOT-T", "SRC-VDOT-CRUISE"]);
const expectedIntentCounts = new Map([
  ["BASE_INTENT", 5],
  ["LT_INTENT", 5],
  ["VO2_INTENT", 5],
  ["GLY_INTENT", 5],
  ["ATP_PC_INTENT", 5],
  ["RECOVERY_INTENT", 5],
]);

function requireFinalMarker(text, documentName) {
  const markerMatches = text.match(/^\[DRAFT_COMPLETE\]$/gmu) ?? [];
  failUnless(markerMatches.length === 1, `${documentName} must contain exactly one final marker`);
  failUnless(
    text.trimEnd().endsWith("[DRAFT_COMPLETE]"),
    `${documentName} final marker must be the last non-whitespace content`,
  );
}

failUnless(blocks.length === 30, `catalog must contain exactly 30 entries, got ${blocks.length}`);

const intentCounts = new Map([...expectedIntentCounts.keys()].map((intent) => [intent, 0]));
const templateIds = new Set();

for (const block of blocks) {
  const id = block.match(/^- templateId: ([^\r\n]+)/mu)?.[1] ?? "unknown";
  const requireEntryMarker = (marker, message) => failUnless(block.includes(marker), `${id} ${message}`);
  const intent = block.match(/^\s+planningIntent: ([^\r\n]+)/mu)?.[1] ?? "missing";

  requireEntryMarker("lifecycleStatus: DRAFT", "must remain DRAFT");
  requireEntryMarker("eligibilityStatus: REVIEW_REQUIRED", "must require review");
  requireEntryMarker("allowedEventGroups: []", "must keep allowedEventGroups empty");
  requireEntryMarker("allowedExperienceBands: []", "must keep allowedExperienceBands empty");
  requireEntryMarker("draftCandidateEventGroups:", "must preserve research-only candidate groups");
  requireEntryMarker("draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED", "must require human mapping");
  failUnless(!/^\s+eligibility:/mu.test(block), `${id} must not contain a TemplateLibrary eligibility object`);
  failUnless(!templateIds.has(id), `${id} templateId must be unique`);
  templateIds.add(id);

  failUnless(intentCounts.has(intent), `${id} has unsupported or missing planningIntent: ${intent}`);
  if (intentCounts.has(intent)) intentCounts.set(intent, intentCounts.get(intent) + 1);

  if (block.includes("sourceVerificationStatus: DIRECT_SOURCE_EXAMPLE")) {
    const refs = block.match(/sourceRefs: \[([^\]]+)\]/u)?.[1]?.split(",").map((value) => value.trim()) ?? [];
    failUnless(
      refs.some((ref) => reopenedVdotRefs.has(ref)),
      `${id} direct-source claim must cite a reopened VDOT source`,
    );
  }
}

for (const [intent, expectedCount] of expectedIntentCounts) {
  const actualCount = intentCounts.get(intent);
  failUnless(
    actualCount === expectedCount,
    `${intent} must contain exactly ${expectedCount} entries, got ${actualCount}`,
  );
}

for (const marker of [
  "catalog_entry_is_registered_template_record: false",
  "allowedEventGroups_empty_means: NOT_ELIGIBLE_FOR_ANY_EVENT_GROUP",
  "allowedExperienceBands_empty_means: NOT_ELIGIBLE_FOR_ANY_EXPERIENCE_BAND",
  "draftCandidateEventGroups_runtime_consumption: forbidden",
  "automatic_plan_binding: forbidden",
  "automatic_prescription_authorized: false",
]) {
  failUnless(catalog.includes(marker), `catalog missing required boundary: ${marker}`);
}

for (const [marker, message] of [
  ["runtime_authority: false", "runtime-authority guard"],
  ["template_activation_authority: false", "template-activation guard"],
  ["automatic_prescription_authority: false", "automatic-prescription guard"],
  ["required_non_null_fields: [paceAnchorRef, paceTargetEventDistanceM]", "race-pace anchor requirement"],
  ["anchor_event_must_equal_target_event: true", "same-event race-pace guard"],
  ["mismatch_result: CROSS_EVENT_MODEL_REQUIRED", "cross-event refusal"],
  ["numeric_pace_output: forbidden", "unbound notation numeric-pace guard"],
  ["derived_pace_duration: unavailable_with_ANCHOR_INCOMPLETE", "incomplete-anchor duration guard"],
  ["catalog_seed_text_must_not_be_deserialized_as_StructuredPrescription: true", "catalog-deserialization guard"],
  ["raw_note_input_for_dose: forbidden", "private-note dose guard"],
  ["private_self_only_signal: forbidden", "private self-only signal guard"],
  ["fixture_stage: UNBOUND_NOTATION_PARSE_ONLY", "unbound notation fixture stage"],
  ["numericPaceOutput: UNAVAILABLE_ANCHOR_INCOMPLETE", "unbound fixture output guard"],
  ["fullStructuredPrescriptionCreation: forbidden_until_explicit_anchor_is_selected", "unbound fixture creation guard"],
  ["active_numeric_template_exists_in_this_document: false", "active numeric-template guard"],
]) {
  failUnless(contract.includes(marker), `contract missing ${message}`);
}

const ownerFixture = contract.match(
  /^fixture_id: OWNER-NOTATION-001\r?\n[\s\S]*?(?=^```$)/mu,
)?.[0] ?? "";
failUnless(ownerFixture.length > 0, "contract missing OWNER-NOTATION-001 fixture");

for (const [marker, message] of [
  ['notation: "2×(10×400m) @5000m RP · r60″ · R3′"', "owner notation"],
  ["setCount: 2", "set count"],
  ["repetitionsPerSet: 10", "repetitions per set"],
  ["totalRepetitions: 20", "total repetitions"],
  ["repetitionDistanceM: 400", "repetition distance"],
  ["qualityDistanceM: 8000", "quality distance"],
  ["repetitionRecoveryOccurrences: 18", "repetition recovery occurrences"],
  ["setRecoveryOccurrences: 1", "set recovery occurrences"],
  ["plannedRecoverySeconds: 1260", "planned recovery seconds"],
]) {
  failUnless(ownerFixture.includes(marker), `OWNER-NOTATION-001 has incorrect or missing ${message}`);
}

requireFinalMarker(catalog, "catalog");
requireFinalMarker(contract, "contract");

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`detailed prescription validation passed: ${blocks.length}/30 inert draft entries`);
}
