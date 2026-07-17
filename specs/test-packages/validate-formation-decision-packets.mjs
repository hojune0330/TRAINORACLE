import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const paths = {
  load: "reports/review/FORMATION_LOAD_COMPONENT_DECISION_PACKET_V2.md",
  minimum: "reports/review/FORMATION_MINIMUM_EVIDENCE_DECISION_PACKET_V2.md",
  competition: "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md",
};
const texts = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, readFileSync(resolve(root, path), "utf8")]),
);
const expectedOwned = {
  load: [
    "component_id", "component_family", "quantity", "unit", "source_type", "provenance",
    "method_id", "method_version", "device_identity", "quality_state", "missing_reason",
    "parent_session_id", "order_index", "separation_minutes", "aggregation_scope", "dedupe_key",
  ],
  minimum: [
    "claim_level", "intended_use", "coverage_count", "coverage_span", "coverage_cadence",
    "context_coverage", "protocol_continuity", "comparison_compatibility", "reliability_source",
    "error_model", "important_change_definition", "freshness_semantics", "trend_check",
    "autocorrelation_check", "carryover_check", "confound_check", "permitted_interpretation",
  ],
  competition: [
    "competition_anchor_id", "competition_name", "timezone", "venue", "source_provenance",
    "collection_purpose", "access_scope", "retention_class", "competitive_bout_id",
    "event_code", "round_or_role",
    "planned_start_at", "actual_start_at", "actual_end_at", "completion_state",
    "exposure_contribution", "race_priority_class", "taper_template_id",
    "taper_template_version", "reanchor_disposition", "next_main_review_state",
  ],
};
const expectedForbidden = {
  load: [
    "minimum_observation_count", "baseline_eligibility", "freshness_threshold",
    "change_threshold", "causal_claim_level", "statistical_significance",
  ],
  minimum: [
    "component_id_definition", "component_family_definition", "physical_unit_definition",
    "derivation_formula_definition", "parent_leaf_dedupe_definition", "device_schema_definition",
  ],
  competition: [
    "universal_taper_days", "universal_taper_reduction_percent", "universal_last_main_offset",
    "elapsed_time_clearance", "race_equals_training_physiology", "automatic_catch_up_debt",
  ],
};

function parseHeaderYaml(text, label) {
  const match = text.match(/^```yaml\r?\n([\s\S]*?)\r?\n```/mu);
  if (!match) throw new Error(`${label} missing leading YAML document`);
  const result = {};
  let listKey = null;
  for (const [index, line] of match[1].split(/\r?\n/u).entries()) {
    if (!line) continue;
    const listItem = line.match(/^  - ([A-Za-z0-9_]+)$/u);
    if (listItem) {
      if (!listKey) throw new Error(`${label} orphan list item at line ${index + 2}`);
      result[listKey].push(listItem[1]);
      continue;
    }
    const scalar = line.match(/^([A-Za-z0-9_]+):(?: (.*))?$/u);
    if (!scalar) throw new Error(`${label} unsupported YAML at line ${index + 2}`);
    const [, key, value = ""] = scalar;
    if (Object.hasOwn(result, key)) throw new Error(`${label} duplicate key ${key}`);
    if (value) {
      result[key] = value;
      listKey = null;
    } else {
      result[key] = [];
      listKey = key;
    }
  }
  return result;
}

function exactList(actual, expected, label, errors) {
  if (!Array.isArray(actual) || actual.length === 0) {
    errors.push(`${label} is missing or empty`);
    return;
  }
  if (new Set(actual).size !== actual.length) errors.push(`${label} contains duplicates`);
  const missing = expected.filter((value) => !actual.includes(value));
  const unknown = actual.filter((value) => !expected.includes(value));
  if (missing.length > 0) errors.push(`${label} missing ${missing.join(";")}`);
  if (unknown.length > 0) errors.push(`${label} unknown ${unknown.join(";")}`);
}

const errors = [];
const packets = {};
for (const [key, text] of Object.entries(texts)) {
  try {
    packets[key] = parseHeaderYaml(text, key);
  } catch (error) {
    errors.push(error.message);
    packets[key] = {};
  }
  const packet = packets[key];
  if (packet.status !== "NOT_REVIEWED") errors.push(`${key} status is not NOT_REVIEWED`);
  if (packet.runtime_authority !== "false") errors.push(`${key} runtime authority missing`);
  if (packet.owner_product_identity !== "9_5_DAY_FORMATION") {
    errors.push(`${key} owner product identity missing`);
  }
  if (packet.owner_target_authority !== "DEFAULT_AUTOMATED_PRESCRIPTION") {
    errors.push(`${key} owner target authority missing`);
  }
  exactList(packet.owned_fields, expectedOwned[key], `${key} owned_fields`, errors);
  exactList(packet.forbidden_fields, expectedForbidden[key], `${key} forbidden_fields`, errors);
  if (!/APPROVE \| REQUEST_CHANGES \| REJECT \| NOT_REVIEWED/u.test(text)) {
    errors.push(`${key} decision form incomplete`);
  }
  if (!text.includes("## 사용자 관점") || !text.includes("## 대안과 되돌리기")) {
    errors.push(`${key} user or rollback section missing`);
  }
}

const competitionSynthesis = readFileSync(
  resolve(root, "reports/research/FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md"),
  "utf8",
);
for (const field of expectedOwned.competition) {
  if (!competitionSynthesis.includes(field)) {
    errors.push(`competition synthesis missing owned field ${field}`);
  }
}
for (const phrase of [
  "## 개인정보와 최소수집",
  "privacy_gate: YOUTH_PRIVACY_SAFEGUARDING_AND_DATA_MINIMIZATION_REVIEW",
  "privacy_safeguarding_decision: NOT_REVIEWED",
  "retention_class: NOT_DEFINED_RUNTIME_BLOCKED",
  "recipient_share: SEPARATE_USER_DIRECTED_OPERATION_ONLY",
  "exact_gps_or_location_history",
]) {
  if (!texts.competition.includes(phrase)) {
    errors.push(`competition packet missing privacy boundary ${phrase}`);
  }
}

const loadOwned = new Set(packets.load.owned_fields ?? []);
const minimumOwned = new Set(packets.minimum.owned_fields ?? []);
const competitionOwned = new Set(packets.competition.owned_fields ?? []);
const allOwned = [
  ["load", loadOwned],
  ["minimum", minimumOwned],
  ["competition", competitionOwned],
];
const collisions = [];
for (let left = 0; left < allOwned.length; left += 1) {
  for (let right = left + 1; right < allOwned.length; right += 1) {
    for (const field of allOwned[left][1]) {
      if (allOwned[right][1].has(field)) {
        collisions.push(`${allOwned[left][0]}/${allOwned[right][0]}:${field}`);
      }
    }
  }
}
if (collisions.length > 0) errors.push(`owned field collision ${collisions.join(";")}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`FORMATION_PACKETS_INVALID ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `FORMATION_PACKETS_PREPARED load_fields=${loadOwned.size} minimum_fields=${minimumOwned.size} competition_fields=${competitionOwned.size} collisions=0 decisions=NOT_REVIEWED runtime=false`,
  );
}
