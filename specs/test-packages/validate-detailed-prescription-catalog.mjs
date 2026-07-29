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
const expectedMachineNotationStatusCounts = new Map([
  ["PARSER_READY", 1],
  ["PENDING_COACH_CONTEXT", 1],
  ["NOT_APPLICABLE_INTENSITY_ZONE", 13],
  ["NOT_APPLICABLE_NO_PACE_TARGET", 13],
  ["PENDING_CONVERSION_MODEL", 2],
]);
const expectedNotationPatterns = new Map([
  ["BA-SEED-01", "30~45\u2032 @E"],
  ["BA-SEED-02", "20~30\u2032 @E"],
  ["BA-SEED-03", "45~60\u2032 @E"],
  ["BA-SEED-04", "long easy @E \u00b7 duration unresolved"],
  ["BA-SEED-05", "3\u00d710\u2032 @E \u00b7 r1\u2032 walk/jog"],
  ["LT-SEED-01", "20\u2032 @T"],
  ["LT-SEED-02", "3\u00d71600m @T \u00b7 r1~2\u2032"],
  ["LT-SEED-03", "4\u00d71600m @T \u00b7 r1\u2032"],
  ["LT-SEED-04", "3\u00d77\u2032 @T \u00b7 r1~2\u2032"],
  ["LT-SEED-05", "6\u00d76\u2032 @T \u00b7 r2\u2032"],
  ["V2-SEED-01", "6\u00d72\u2032 @I \u00b7 r1\u2032 jog"],
  ["V2-SEED-02", "5\u00d73\u2032 @I \u00b7 r2\u2032 jog"],
  ["V2-SEED-03", "4\u00d74\u2032 @I \u00b7 r3\u2032 jog"],
  ["V2-SEED-04", "4\u00d73\u2032 @95% vVO2max \u00b7 r3\u2032 easy"],
  ["V2-SEED-05", "5\u00d71000m @5K RP \u00b7 r2\u203230\u2033"],
  ["GL-SEED-01", "3~4\u00d7500m @GOAL 1500m RP \u00b7 r2~3\u2032"],
  ["GL-SEED-02", "3\u00d7(800m+200m+200m) \u00b7 r90\u2033 \u00b7 R3\u2032"],
  ["GL-SEED-03", "2~3\u00d7(250m+100m) \u00b7 r30\u2033 \u00b7 R4~8\u2032"],
  ["GL-SEED-04", "150m-200m-300m @90~100% \u00b7 full recovery"],
  ["GL-SEED-05", "1~2\u00d7300~600m \u00b7 long full recovery"],
  ["AP-SEED-01", "3\u00d7(15~25m acceleration + 30m max velocity) \u00b7 r2~5\u2032"],
  ["AP-SEED-02", "2\u00d7(3\u00d720m) \u00b7 r2\u2032"],
  ["AP-SEED-03", "3\u00d730m \u00b7 r3\u2032"],
  ["AP-SEED-04", "4\u00d730m + 4\u00d750m \u00b7 r2~3\u2032 full recovery"],
  ["AP-SEED-05", "5\u00d7(4 bounds + 30m acceleration)"],
  ["RE-SUPPORT-01", "REST"],
  ["RE-SUPPORT-02", "20~30\u2032 very easy"],
  ["RE-SUPPORT-03", "mobility-only"],
  ["RE-SUPPORT-04", "walk only"],
  ["RE-SUPPORT-05", "REVIEW_REQUIRED"],
]);
const parserReadyNotation = "5\u00d71000m @5000m RP \u00b7 r150\u2033";
const parserReadyBasis = "5K=5000m; 2 minutes 30 seconds=150 seconds; repetitions, distance, and recovery are unchanged.";
const pendingCoachContextBlockers = [
  "Coach context must select the 3-to-4 repetition range from session objective, target distance, speed anchor, and current context; no fixed default is authorized.",
  "Coach context must select the 2-to-3 minute repetition recovery range from session objective, target distance, speed anchor, and current context; no fixed default is authorized.",
  "GOAL RP and a dated recent same-event result may be shown as separate labels; neither value becomes current capability automatically.",
];

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
const machineNotationStatusCounts = new Map(
  [...expectedMachineNotationStatusCounts.keys()].map((status) => [status, 0]),
);
const templateIds = new Set();

for (const block of blocks) {
  const id = block.match(/^- templateId: ([^\r\n]+)/mu)?.[1] ?? "unknown";
  const requireEntryMarker = (marker, message) => failUnless(block.includes(marker), `${id} ${message}`);
  const intent = block.match(/^\s+planningIntent: ([^\r\n]+)/mu)?.[1] ?? "missing";
  const notationPattern = block.match(/^\s+notationPattern: "([^\r\n]+)"$/mu)?.[1] ?? "missing";
  const machineNotation = block.match(/^\s+machineNotation: (null|"[^\r\n]+")$/mu)?.[1] ?? "missing";
  const machineNotationStatus = block.match(/^\s+machineNotationStatus: ([^\r\n]+)/mu)?.[1] ?? "missing";
  const machineNotationBasis = block.match(/^\s+machineNotationBasis: (null|"[^\r\n]+")$/mu)?.[1] ?? "missing";
  const machineNotationBlockers = block.match(/^\s+machineNotationBlockers:\r?\n((?:\s+- "[^\r\n]+"\r?\n)*)/mu)?.[1] ?? "missing";
  const machineNotationBlockerValues = [...machineNotationBlockers.matchAll(/^\s+- "([^\r\n]+)"$/gmu)].map((match) => match[1]);

  requireEntryMarker("lifecycleStatus: DRAFT", "must remain DRAFT");
  requireEntryMarker("eligibilityStatus: REVIEW_REQUIRED", "must require review");
  requireEntryMarker("allowedEventGroups: []", "must keep allowedEventGroups empty");
  requireEntryMarker("allowedExperienceBands: []", "must keep allowedExperienceBands empty");
  requireEntryMarker("draftCandidateEventGroups:", "must preserve research-only candidate groups");
  requireEntryMarker("draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED", "must require human mapping");
  failUnless(!/^\s+eligibility:/mu.test(block), `${id} must not contain a TemplateLibrary eligibility object`);
  failUnless(!templateIds.has(id), `${id} templateId must be unique`);
  templateIds.add(id);
  failUnless(notationPattern === expectedNotationPatterns.get(id), `${id} must preserve its canonical notationPattern`);

  failUnless(intentCounts.has(intent), `${id} has unsupported or missing planningIntent: ${intent}`);
  if (intentCounts.has(intent)) intentCounts.set(intent, intentCounts.get(intent) + 1);

  failUnless(
    machineNotationStatusCounts.has(machineNotationStatus),
    `${id} has unsupported or missing machineNotationStatus: ${machineNotationStatus}`,
  );
  if (machineNotationStatusCounts.has(machineNotationStatus)) {
    machineNotationStatusCounts.set(machineNotationStatus, machineNotationStatusCounts.get(machineNotationStatus) + 1);
  }
  if (machineNotationStatus === "PARSER_READY") {
    failUnless(machineNotation !== "null", `${id} parser-ready machineNotation must not be null`);
    failUnless(machineNotationBasis !== "null", `${id} parser-ready machineNotationBasis must not be null`);
    failUnless(machineNotationBlockerValues.length === 0, `${id} parser-ready machineNotationBlockers must be empty`);
  } else {
    failUnless(machineNotation === "null", `${id} must keep machineNotation null while pending`);
  }
  if (notationPattern.includes("~")) {
    failUnless(machineNotation === "null", `${id} must not narrow a ranged notation into machineNotation`);
    failUnless(machineNotationStatus !== "PARSER_READY", `${id} ranged notation must remain context-dependent`);
  }
  if (id === "V2-SEED-05") {
    failUnless(machineNotation === `"${parserReadyNotation}"`, "V2-SEED-05 must keep its exact parser-ready machineNotation");
    failUnless(machineNotationBasis === `"${parserReadyBasis}"`, "V2-SEED-05 must keep its parser-ready basis");
  }
  if (id === "GL-SEED-01") {
    failUnless(machineNotationStatus === "PENDING_COACH_CONTEXT", "GL-SEED-01 must require coach context instead of a fixed range");
    failUnless(machineNotationBlockerValues.join("\u0000") === pendingCoachContextBlockers.join("\u0000"), "GL-SEED-01 must keep its three contextual blockers");
  }

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

for (const [status, expectedCount] of expectedMachineNotationStatusCounts) {
  const actualCount = machineNotationStatusCounts.get(status);
  failUnless(
    actualCount === expectedCount,
    `${status} must contain exactly ${expectedCount} entries, got ${actualCount}`,
  );
}

for (const marker of [
  "catalog_entry_is_registered_template_record: false",
  "allowedEventGroups_empty_means: NOT_ELIGIBLE_FOR_ANY_EVENT_GROUP",
  "allowedExperienceBands_empty_means: NOT_ELIGIBLE_FOR_ANY_EXPERIENCE_BAND",
  "draftCandidateEventGroups_runtime_consumption: forbidden",
  "automatic_plan_binding: forbidden",
  "automatic_prescription_authorized: false",
  "notationPattern_is_canonical: true",
  "machineNotation_requires_status: PARSER_READY",
  "non_parser_ready_machineNotation_must_be_null: true",
  "runtime_template_activation_from_this_field: forbidden",
  "range_sensitive_interval_policy:",
  "fixed_default_from_energy_intent: forbidden",
  "goal_label_required: true",
  "recent_result_requires: [same_event, recorded_date, performance]",
  "same_event_comparison_only: true",
  "cross_event_display_must_not_derive_pace_or_capability: true",
  "missing_recent_result_label: UNRECORDED",
]) {
  failUnless(catalog.includes(marker), `catalog missing required boundary: ${marker}`);
}
failUnless(!catalog.includes("PENDING_OWNER_RANGE_DECISION"), "catalog must not retain an owner range decision after context policy is recorded");

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
