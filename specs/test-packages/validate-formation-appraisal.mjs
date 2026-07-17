import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  indexAttestations,
  loadTrustedReviewerKeys,
  requireHumanAttestation,
} from "./formation-attestations.mjs";
import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");
const acceptedMode = process.argv.includes("--accepted");
const readCsv = (path) => parseCsv(readFileSync(resolve(root, path), "utf8"), path);
const errors = [];
const trustedReviewerKeys = loadTrustedReviewerKeys(
  process.env.FORMATION_TRUSTED_REVIEWER_KEYS_JSON,
  errors,
);
const sourceRows = readCsv("reports/research/evidence/FORMATION_SOURCE_LEDGER.csv").rows;
const sourceIds = new Set(sourceRows.map((row) => row.source_id));
const extractionById = new Map(
  readCsv("reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv").rows
    .map((row) => [row.source_id, row]),
);
const attestations = readCsv(
  "reports/research/evidence/FORMATION_HUMAN_REVIEW_ATTESTATIONS.csv",
).rows;
const attestationIndex = indexAttestations(attestations, errors, sourceIds);
const overall = new Set(["LOW_CONCERN", "SOME_CONCERNS", "HIGH_CONCERN", "NOT_ASSESSABLE"]);
const directness = new Set(["DIRECT", "PARTIAL", "INDIRECT", "NOT_APPLICABLE"]);
const canonicalDirectness = new Set([...directness, "NOT_VERIFIED"]);
const overallOrder = ["LOW_CONCERN", "SOME_CONCERNS", "HIGH_CONCERN", "NOT_ASSESSABLE"];
const directnessOrder = ["DIRECT", "PARTIAL", "INDIRECT"];

function indexUnique(rows, label) {
  const index = new Map();
  for (const row of rows) {
    if (index.has(row.source_id)) errors.push(`${label} duplicate ${row.source_id}`);
    index.set(row.source_id, row);
  }
  if (index.size !== sourceIds.size) errors.push(`${label} coverage ${index.size}/${sourceIds.size}`);
  return index;
}

const laneMaps = new Map();
for (const lane of [1, 2]) {
  const rows = readCsv(`.omo/evidence/formation-research-v2/appraisal-lane-${lane}.csv`).rows;
  const index = indexUnique(rows, `lane ${lane}`);
  laneMaps.set(lane, index);
  for (const row of rows) {
    if (!sourceIds.has(row.source_id)) errors.push(`lane ${lane} unknown ${row.source_id}`);
    if (!overall.has(row.overall_judgment)) errors.push(`lane ${lane} bad overall ${row.source_id}`);
    if (!directness.has(row.youth_directness) || !directness.has(row.architecture_directness)) {
      errors.push(`lane ${lane} bad directness ${row.source_id}`);
    }
    if (row.human_confirmation !== "PENDING_HUMAN") {
      errors.push(`lane ${lane} human state ${row.source_id}`);
    }
    if (lane === 2) {
      const nonIndependent = extractionById.get(row.source_id)?.adjudication
        === "NON_INDEPENDENT_GAP_FILL_PENDING_HUMAN_REEXTRACTION";
      const expectedState = nonIndependent
        ? "independence_state=NON_INDEPENDENT_EXTRACTION_INPUT"
        : "independence_state=INDEPENDENT_APPRAISAL_INPUT";
      const expectedAdjudication = nonIndependent
        ? "NON_INDEPENDENT_INPUT_PENDING_HUMAN_REAPPRAISAL"
        : "PENDING_INDEPENDENT_APPRAISAL";
      if (!row.notes.includes(expectedState) || row.adjudication !== expectedAdjudication) {
        errors.push(`lane 2 extraction provenance ${row.source_id}`);
      }
    }
  }
}

const canonicalFile = readCsv("reports/research/evidence/FORMATION_APPRAISAL_LEDGER.csv");
const canonical = canonicalFile.rows;
const canonicalById = indexUnique(canonical, "canonical");
for (const row of canonical) {
  if (!overall.has(row.overall_judgment)) errors.push(`canonical bad overall ${row.source_id}`);
  for (const field of [
    "youth_directness",
    "architecture_directness",
    "outcome_compatibility",
    "time_horizon_compatibility",
  ]) {
    if (!canonicalDirectness.has(row[field])) errors.push(`canonical bad ${field} ${row.source_id}`);
  }
  if (!new Set(["PENDING_HUMAN", "CONFIRMED"]).has(row.human_confirmation)) {
    errors.push(`canonical bad human state ${row.source_id}`);
  }
  if (row.human_confirmation === "CONFIRMED" && row.adjudication !== "HUMAN_CONFIRMED") {
    errors.push(`canonical bad confirmed adjudication ${row.source_id}`);
  }
}
const conflictRows = readCsv("reports/research/evidence/FORMATION_APPRAISAL_CONFLICTS.csv").rows;
const conflictsByKey = new Map();
for (const row of conflictRows) {
  const key = `${row.source_id}:${row.field}`;
  if (conflictsByKey.has(key)) errors.push(`duplicate conflict ${key}`);
  conflictsByKey.set(key, row);
  if (
    !sourceIds.has(row.source_id)
    || !new Set(["PENDING_HUMAN", "CONFIRMED"]).has(row.human_confirmation)
  ) {
    errors.push(`invalid conflict ${key}`);
  }
}

function mergedOrdinal(left, right, order) {
  return left === right ? left : order[Math.max(order.indexOf(left), order.indexOf(right))];
}

function expectedDirectness(left, right) {
  if (left === right) return left;
  if (left === "NOT_APPLICABLE" || right === "NOT_APPLICABLE") return "NOT_VERIFIED";
  return mergedOrdinal(left, right, directnessOrder);
}

const expectedConflictKeys = new Set();
for (const sourceId of sourceIds) {
  const left = laneMaps.get(1).get(sourceId);
  const right = laneMaps.get(2).get(sourceId);
  const row = canonicalById.get(sourceId);
  if (!left || !right || !row) continue;
  const confirmed = row.human_confirmation === "CONFIRMED";
  if (confirmed || acceptedMode) {
    requireHumanAttestation({
      attestationIndex,
      canonicalRecord: row,
      errors,
      rawRecords: [left, right],
      reviewType: "APPRAISAL",
      sourceId,
      trustedReviewerKeys,
    });
  }
  const expected = {
    rq_id: left.rq_id === right.rq_id ? left.rq_id : "NOT_VERIFIED",
    design: left.design === right.design ? left.design : "NOT_VERIFIED",
    appraisal_tool: left.appraisal_tool === right.appraisal_tool
      ? left.appraisal_tool
      : "NOT_VERIFIED",
    overall_judgment: mergedOrdinal(left.overall_judgment, right.overall_judgment, overallOrder),
    youth_directness: expectedDirectness(left.youth_directness, right.youth_directness),
    architecture_directness: expectedDirectness(
      left.architecture_directness,
      right.architecture_directness,
    ),
    outcome_compatibility: left.outcome_compatibility === right.outcome_compatibility
      ? left.outcome_compatibility
      : "NOT_VERIFIED",
    time_horizon_compatibility: left.time_horizon_compatibility === right.time_horizon_compatibility
      ? left.time_horizon_compatibility
      : "NOT_VERIFIED",
    correction_state: left.correction_state === right.correction_state
      ? left.correction_state
      : "NOT_VERIFIED",
    overlap_group: left.overlap_group === right.overlap_group
      ? left.overlap_group
      : "NOT_VERIFIED",
    reviewer_1: left.reviewer_1,
    reviewer_2: right.reviewer_2,
  };
  if (!confirmed) {
    for (const [field, value] of Object.entries(expected)) {
      if (row[field] !== value) errors.push(`canonical reconciliation ${sourceId}:${field}`);
    }
    if (row.domain_judgments !== `LANE_1[${left.domain_judgments}] | LANE_2[${right.domain_judgments}]`) {
      errors.push(`canonical reconciliation ${sourceId}:domain_judgments`);
    }
    if (row.notes !== `LANE_1[${left.notes}] | LANE_2[${right.notes}]`) {
      errors.push(`canonical reconciliation ${sourceId}:notes`);
    }
    const nonIndependent = /independence_state=NON_INDEPENDENT_EXTRACTION_INPUT/u.test(
      `${left.notes} ${right.notes}`,
    );
    const expectedAdjudication = nonIndependent
      ? "NON_INDEPENDENT_INPUT_PENDING_HUMAN_REAPPRAISAL"
      : "PENDING_HUMAN_APPRAISAL_ADJUDICATION";
    if (row.adjudication !== expectedAdjudication || row.human_confirmation !== "PENDING_HUMAN") {
      errors.push(`canonical pending state ${sourceId}`);
    }
  }

  for (const [field, value] of [
    ["overall_judgment", expected.overall_judgment],
    ["youth_directness", expected.youth_directness],
    ["architecture_directness", expected.architecture_directness],
  ]) {
    if (left[field] === right[field]) continue;
    const key = `${sourceId}:${field}`;
    expectedConflictKeys.add(key);
    const conflict = conflictsByKey.get(key);
    if (
      !conflict
      || conflict.lane_1_value !== left[field]
      || conflict.lane_2_value !== right[field]
      || (!confirmed && conflict.conservative_value !== value)
    ) {
      errors.push(`conflict reconciliation ${key}`);
      continue;
    }
    if (confirmed) {
      if (conflict.human_confirmation !== "CONFIRMED" || conflict.conservative_value !== row[field]) {
        errors.push(`confirmed conflict state ${key}`);
      }
    } else if (conflict.human_confirmation !== "PENDING_HUMAN") {
      errors.push(`pending conflict state ${key}`);
    }
  }
}
for (const key of conflictsByKey.keys()) {
  if (!expectedConflictKeys.has(key)) errors.push(`unexpected conflict ${key}`);
}

const pending = canonical.filter((row) => row.human_confirmation !== "CONFIRMED").length;
const pendingConflicts = conflictRows.filter((row) => row.human_confirmation !== "CONFIRMED").length;
if (acceptedMode && (pending > 0 || pendingConflicts > 0)) {
  errors.push(`acceptance blocked pending_human=${pending} pending_conflicts=${pendingConflicts}`);
}
if (errors.length > 0) {
  for (const error of errors) console.error(`FORMATION_APPRAISAL_INVALID ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `FORMATION_APPRAISAL_${acceptedMode ? "ACCEPTED" : "PREPARED"} sources=${sourceIds.size} conflicts=${conflictRows.length} pending_human=${pending}`,
  );
}
