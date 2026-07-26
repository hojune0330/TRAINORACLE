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

failUnless(blocks.length === 30, `catalog must contain exactly 30 entries, got ${blocks.length}`);

for (const block of blocks) {
  const id = block.match(/^- templateId: ([^\r\n]+)/mu)?.[1] ?? "unknown";
  const requireEntryMarker = (marker, message) => failUnless(block.includes(marker), `${id} ${message}`);

  requireEntryMarker("lifecycleStatus: DRAFT", "must remain DRAFT");
  requireEntryMarker("eligibilityStatus: REVIEW_REQUIRED", "must require review");
  requireEntryMarker("allowedEventGroups: []", "must keep allowedEventGroups empty");
  requireEntryMarker("allowedExperienceBands: []", "must keep allowedExperienceBands empty");
  requireEntryMarker("draftCandidateEventGroups:", "must preserve research-only candidate groups");
  requireEntryMarker("draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED", "must require human mapping");
  failUnless(!/^\s+eligibility:/mu.test(block), `${id} must not contain a TemplateLibrary eligibility object`);

  if (block.includes("sourceVerificationStatus: DIRECT_SOURCE_EXAMPLE")) {
    const refs = block.match(/sourceRefs: \[([^\]]+)\]/u)?.[1]?.split(",").map((value) => value.trim()) ?? [];
    failUnless(
      refs.some((ref) => reopenedVdotRefs.has(ref)),
      `${id} direct-source claim must cite a reopened VDOT source`,
    );
  }
}

for (const marker of [
  "catalog_entry_is_registered_template_record: false",
  "allowedEventGroups_empty_means: NOT_ELIGIBLE_FOR_ANY_EVENT_GROUP",
  "allowedExperienceBands_empty_means: NOT_ELIGIBLE_FOR_ANY_EXPERIENCE_BAND",
  "draftCandidateEventGroups_runtime_consumption: forbidden",
  "automatic_plan_binding: forbidden",
  "automatic_prescription_authorized: false",
  "[DRAFT_COMPLETE]",
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
  ["[DRAFT_COMPLETE]", "draft completion marker"],
]) {
  failUnless(contract.includes(marker), `contract missing ${message}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`detailed prescription validation passed: ${blocks.length}/30 inert draft entries`);
}
